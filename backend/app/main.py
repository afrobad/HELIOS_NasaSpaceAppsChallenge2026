"""
backend/app/main.py
FastAPI Application Entry Point for the NASA Astronaut Health Monitoring System.
Hosts REST management APIs, JARVIS voice query endpoints, and the high-frequency 10 Hz WebSocket stream.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware

from .db.database import init_database
from .db.repository import TelemetryRepository
from .core.baselines import BaselineManager
from .core.lab_assay_manager import lab_assay_manager
from .streaming.websocket_manager import WebSocketManager
from .streaming.telemetry_feeder import TelemetryFeeder
from .ai.decision_engine import DecisionEngine
from .ai.ollama_client import OllamaClient
from .ai.voice_engine import VoiceEngine
from .ai.fallback_templates import clean_crew_name

# Global application instances
ws_manager = WebSocketManager()
baseline_mgr: Optional[BaselineManager] = None
repo: Optional[TelemetryRepository] = None
feeder: Optional[TelemetryFeeder] = None
feeder_task: Optional[asyncio.Task] = None
ollama_client: Optional[OllamaClient] = None
voice_engine: Optional[VoiceEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes aerospace database, baselines, AI engines, and background telemetry feeder on startup."""
    global baseline_mgr, repo, feeder, feeder_task, ollama_client, voice_engine

    conn = init_database()
    repo = TelemetryRepository(conn)
    baseline_mgr = BaselineManager()
    ollama_client = OllamaClient()
    voice_engine = VoiceEngine(ollama_client=ollama_client)
    feeder = TelemetryFeeder(ws_manager, repo, baseline_mgr, voice_engine=voice_engine)

    # Launch background 10 Hz streaming task
    feeder_task = asyncio.create_task(feeder.run_loop())
    # Pre-warm common scenario voice alerts for instant zero-latency playback
    asyncio.create_task(VoiceEngine.prewarm_scenario_cache())
    # Auto-initiate local Ollama AI model in background
    if ollama_client:
        asyncio.create_task(ollama_client.initiate_model())
    print("[+] NASA Astronaut Health Sentry & JARVIS AI Engine Online (10 Hz Stream Active)")

    yield

    # Clean shutdown
    if feeder:
        feeder.stop()
    if feeder_task:
        feeder_task.cancel()
    print("[-] Sentry Engine Shutdown Cleanly")


app = FastAPI(
    title="NASA Astronaut Health Intelligence System (JARVIS-Sentry)",
    description="Autonomous, offline-first deep-space clinical decision-support and telemetry sentry.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    """Health and status endpoint for flight computer monitoring."""
    return {
        "status": "NOMINAL",
        "system": "JARVIS_ASTRONAUT_HEALTH_SENTRY",
        "streaming_hz": 10,
        "active_hud_clients": len(ws_manager.active_connections),
        "mars_latency_mode": ws_manager.mars_delay_enabled,
        "loaded_crew_members": len(baseline_mgr.get_astronaut_ids()) if baseline_mgr else 0
    }


@app.get("/api/ai/status")
async def get_ai_status() -> Dict[str, Any]:
    """Returns the operational status of the local AI inference engine and voice subsystem."""
    client = ollama_client or OllamaClient()
    health = await client.check_health()
    return {
        "ai_engine": health,
        "cooldown_seconds": voice_engine.cooldown_seconds if voice_engine else 30.0,
        "anti_chatter_active": True
    }


@app.post("/api/ai/initiate")
async def post_ai_initiate() -> Dict[str, Any]:
    """Explicitly initiates the local Ollama AI model and warms up inference memory."""
    client = ollama_client or OllamaClient()
    res = await client.initiate_model()
    return res


@app.get("/api/baselines")
def get_baselines() -> Dict[str, Any]:
    """Returns NASA-derived crew baseline distributions and thresholds."""
    if not baseline_mgr:
        raise HTTPException(status_code=500, detail="Baseline manager uninitialized.")
    return {
        "crew_profiles": baseline_mgr.crew_profiles,
        "environmental_baselines": baseline_mgr.environmental_baselines
    }


@app.get("/api/telemetry/recent/{astronaut_id}")
def get_recent_telemetry(astronaut_id: str, limit: int = 50) -> Dict[str, Any]:
    """Queries recent telemetry rows from SQLite WAL database."""
    if not repo:
        raise HTTPException(status_code=500, detail="Database uninitialized.")
    rows = repo.get_recent_telemetry(astronaut_id, limit=limit)
    return {"astronaut_id": astronaut_id, "count": len(rows), "records": rows}


@app.get("/api/telemetry/latest-all")
def get_latest_all_telemetry() -> Dict[str, Any]:
    """Returns the most recent or seeded telemetry packet for all crew members."""
    if not baseline_mgr:
        raise HTTPException(status_code=500, detail="Baseline manager uninitialized.")
    ast_ids = baseline_mgr.get_astronaut_ids()
    data = {}
    for ast_id in ast_ids:
        data[ast_id] = get_latest_or_seed_telemetry(ast_id)
    return {"telemetry": data}


@app.get("/api/telemetry/lab-assays/{astronaut_id}")
def get_crew_lab_assays(astronaut_id: str, timepoint: str = "R+1") -> Dict[str, Any]:
    """Returns 100% authentic NASA OSDR spaceflight laboratory panels (OSD-569 CBC, OSD-575 CMP, CV, Immune)."""
    canonical_id = resolve_astronaut_id(astronaut_id)
    return lab_assay_manager.get_crew_full_lab_profile(canonical_id, timepoint=timepoint)


@app.get("/api/telemetry/lab-assays")
def get_all_crew_lab_assays(timepoint: str = "R+1") -> Dict[str, Any]:
    """Returns authentic NASA OSDR spaceflight laboratory panels for all crew members."""
    if not baseline_mgr:
        raise HTTPException(status_code=500, detail="Baseline manager uninitialized.")
    result = {}
    for ast_id in baseline_mgr.get_astronaut_ids():
        result[ast_id] = lab_assay_manager.get_crew_full_lab_profile(ast_id, timepoint=timepoint)
    return {"lab_assays": result}


@app.get("/api/alerts")
def get_recent_alerts(limit: int = 20) -> Dict[str, Any]:
    """Returns the proactive alert audit log from SQLite."""
    if not repo:
        raise HTTPException(status_code=500, detail="Database uninitialized.")
    alerts = repo.get_recent_alerts(limit=limit)
    return {"count": len(alerts), "alerts": alerts}


@app.post("/api/scenario/{scenario_key}")
async def trigger_scenario(scenario_key: str) -> Dict[str, Any]:
    """Jumps telemetry playback to trigger a competition demonstration scenario and returns instant telemetry."""
    if not feeder:
        raise HTTPException(status_code=500, detail="Feeder uninitialized.")

    latest_telemetry = await feeder.jump_to_scenario_and_broadcast(scenario_key)
    if not latest_telemetry and not feeder.jump_to_scenario(scenario_key):
        raise HTTPException(status_code=404, detail=f"Scenario key '{scenario_key}' not found.")

    return {
        "status": "SCENARIO_TRIGGERED",
        "scenario": scenario_key,
        "current_index": feeder.current_index,
        "telemetry": latest_telemetry
    }


@app.post("/api/mars-delay")
def toggle_mars_delay(enabled: bool) -> Dict[str, Any]:
    """Toggles Mars 22-minute communication latency simulation."""
    ws_manager.set_mars_delay(enabled)
    return {
        "status": "UPDATED",
        "mars_delay_active": ws_manager.mars_delay_enabled,
        "delay_minutes": 22.0 if enabled else 0.0
    }


ASTRONAUT_ALIAS_MAP = {
    "crew_1": "AST-01_COMMANDER",
    "commander": "AST-01_COMMANDER",
    "c001": "AST-01_COMMANDER",
    "ast-01_commander": "AST-01_COMMANDER",
    "crew_2": "AST-02_PILOT",
    "pilot": "AST-02_PILOT",
    "c002": "AST-02_PILOT",
    "ast-02_pilot": "AST-02_PILOT",
    "crew_3": "AST-03_MEDICAL",
    "medical": "AST-03_MEDICAL",
    "doctor": "AST-03_MEDICAL",
    "c003": "AST-03_MEDICAL",
    "ast-03_medical": "AST-03_MEDICAL",
    "ast-03_medical_specialist": "AST-03_MEDICAL",
    "crew_4": "AST-04_ENGINEER",
    "engineer": "AST-04_ENGINEER",
    "specialist": "AST-04_ENGINEER",
    "c004": "AST-04_ENGINEER",
    "ast-04_engineer": "AST-04_ENGINEER",
    "ast-04_mission_specialist": "AST-04_ENGINEER",
}


def resolve_astronaut_id(raw_id: str) -> str:
    """Maps friendly aliases (e.g. 'crew_1', 'commander') to canonical NASA astronaut IDs."""
    cleaned = (raw_id or "").strip()
    return ASTRONAUT_ALIAS_MAP.get(cleaned.lower(), cleaned)


def get_latest_or_seed_telemetry(ast_id: str) -> Dict[str, Any]:
    """Retrieves recent telemetry from ring buffer, SQLite WAL, or seeded flight records."""
    if feeder and ast_id in feeder.buffers:
        latest = feeder.buffers[ast_id].get_latest()
        if latest:
            return latest
    if repo:
        recent_rows = repo.get_recent_telemetry(ast_id, limit=1)
        if recent_rows:
            return recent_rows[0]
    if feeder and feeder.records:
        for rec in feeder.records:
            if rec.get("astronaut_id") == ast_id:
                return rec
    return {}


@app.post("/api/voice/query")
async def post_voice_query(request: Dict[str, Any]) -> Dict[str, Any]:
    """Hands-free JARVIS voice query answering endpoint."""
    engine = voice_engine or VoiceEngine()
    query = request.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")

    raw_id = request.get("astronaut_id", "AST-01_COMMANDER")
    ast_id = resolve_astronaut_id(raw_id)
    recent = get_latest_or_seed_telemetry(ast_id)

    ast_name = clean_crew_name(recent.get("astronaut_name", ""), ast_id)
    severity = recent.get("evaluated_severity", "NOMINAL")

    answer = await engine.handle_voice_query(
        query=query,
        astronaut_id=ast_id,
        astronaut_name=ast_name,
        current_telemetry=recent,
        severity=severity,
        reason="Astronaut voice inquiry"
    )
    return answer


@app.get("/api/voice/synthesize")
async def get_synthesized_voice(
    text: str = Query(..., description="Text to synthesize using deep neural TTS"),
    voice: Optional[str] = Query(None, description="Neural voice identifier"),
    severity: Optional[str] = Query("NOMINAL", description="Severity level for distinct pitch and rate prosody")
) -> Response:
    """
    Streams broadcast-grade MP3 audio using Microsoft Edge Neural TTS via HTTP chunked transfer.
    Audio chunks are piped to the browser as edge_tts produces them — no full-file buffering.
    Cache hits return the full pre-synthesized audio in a single pass (~0 ms synthesis cost).

    Severity calibrates tone, pitch, and cadence:
      - NOMINAL: Warm, relaxed, reassuring conversational cadence (+2% rate, -1Hz pitch)
      - WARNING: Attentive, focused advisory delivery (+12% rate, +2Hz pitch)
      - CRITICAL: Brisk, urgent emergency directive (+20% rate, +5Hz pitch)
    """
    from fastapi.responses import StreamingResponse as FastAPIStreamingResponse
    clean = text.strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Text parameter cannot be empty.")

    engine = voice_engine or VoiceEngine()
    audio_gen = engine.stream_neural_speech(clean, voice, severity=severity)

    return FastAPIStreamingResponse(
        audio_gen,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Transfer-Encoding": "chunked",
        }
    )


@app.get("/api/voice/greeting/{astronaut_id}")
async def get_voice_greeting(astronaut_id: str) -> Dict[str, Any]:
    """
    Generates a personalized, conversational AI greeting and plain-English health advisory
    for the specified astronaut, based on their live telemetry.
    Lets the local AI model decide the greeting, observations, and advice.
    """
    resolved_id = resolve_astronaut_id(astronaut_id)
    recent = get_latest_or_seed_telemetry(resolved_id)
    ast_name = clean_crew_name(recent.get("astronaut_name", ""), resolved_id)
    severity = recent.get("evaluated_severity", "NOMINAL")

    engine = voice_engine or VoiceEngine()
    greeting_payload = await engine.create_greeting_advisory(
        astronaut_id=resolved_id,
        astronaut_name=ast_name,
        telemetry=recent,
        severity=severity
    )
    return greeting_payload


@app.post("/api/ai/triage/{astronaut_id}")
async def post_ai_triage(astronaut_id: str) -> Dict[str, Any]:
    """Triggers an on-demand comprehensive clinical triage evaluation for an astronaut."""
    if not baseline_mgr:
        raise HTTPException(status_code=500, detail="Telemetry system uninitialized.")

    resolved_id = resolve_astronaut_id(astronaut_id)
    recent = get_latest_or_seed_telemetry(resolved_id)

    if not recent:
        raise HTTPException(status_code=404, detail=f"No telemetry found for astronaut '{astronaut_id}'.")

    ast_name = clean_crew_name(recent.get("astronaut_name", ""), resolved_id)
    mission_state = recent.get("mission_state", "REST")
    baseline = baseline_mgr.get_astronaut_baseline(resolved_id, mission_state)
    env = baseline_mgr.environmental_baselines

    severity = recent.get("evaluated_severity", "NOMINAL")
    reason = "On-demand clinical diagnostic scan"

    triage_record = DecisionEngine.structure_triage_record(
        astronaut_id=resolved_id,
        astronaut_name=ast_name,
        telemetry=recent,
        baseline=baseline,
        env_thresholds=env,
        severity=severity,
        reason=reason
    )

    engine = voice_engine or VoiceEngine()
    voice = await engine.create_voice_warning(
        astronaut_id=resolved_id,
        astronaut_name=ast_name,
        telemetry=recent,
        severity=severity,
        reason=reason
    )
    triage_record["voice_warning"] = voice

    return triage_record


@app.post("/api/ai/joint-triage")
async def post_ai_joint_triage(request: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Generates a joint clinical voice warning addressing two crew members naturally by name and broadcasts to HUD."""
    req = request or {}
    id1 = resolve_astronaut_id(req.get("astronaut_id_1", "AST-01_COMMANDER"))
    id2 = resolve_astronaut_id(req.get("astronaut_id_2", "AST-02_PILOT"))
    rec1 = get_latest_or_seed_telemetry(id1)
    rec2 = get_latest_or_seed_telemetry(id2)
    name1 = clean_crew_name(rec1.get("astronaut_name", ""), id1)
    name2 = clean_crew_name(rec2.get("astronaut_name", ""), id2)
    joint_names = f"{name1} and {name2}"
    severity = req.get("severity", "WARNING")
    reason = req.get("reason", "Resting heart rate drift and core thermal elevation detected")

    engine = voice_engine or VoiceEngine()
    voice = await engine.create_joint_voice_warning(
        crew_names=joint_names,
        astronaut_ids=[id1, id2],
        telemetry_1=rec1,
        telemetry_2=rec2,
        severity=severity,
        reason=reason,
        scenario_phase=rec1.get("scenario_phase")
    )

    alert_payload = {
        **voice,
        "triage_diagnosis": f"Joint Alert ({joint_names}): {reason}",
        "actionable_instruction": f"Cross-verify vitals between {name1} and {name2}. Initiate hydration and rest protocol.",
        "confidence": 0.98,
        "evidence_breakdown": [
            {"metric": f"{name1} Heart Rate", "value": rec1.get("heart_rate", 88), "clinical_finding": f"{name1} HR: {rec1.get('heart_rate', 88)} bpm"},
            {"metric": f"{name2} Heart Rate", "value": rec2.get("heart_rate", 86), "clinical_finding": f"{name2} HR: {rec2.get('heart_rate', 86)} bpm"},
            {"metric": "Primary Condition", "value": reason, "clinical_finding": reason}
        ],
        "telemetry": rec1
    }

    if repo:
        for ast_id, pkt in [(id1, rec1), (id2, rec2)]:
            repo.log_proactive_alert(
                astronaut_id=ast_id,
                severity=severity,
                trigger_reason=reason,
                confidence=0.98,
                evidence=pkt,
                voice_text=voice["speech_text"]
            )

    await ws_manager.broadcast_alert(alert_payload)
    return alert_payload


@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """High-frequency 10 Hz real-time telemetry WebSocket endpoint for the HUD."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep socket alive and listen for client ping or voice queries
            data = await websocket.receive_text()
            if data == "PING":
                await websocket.send_text("PONG")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# Mount compiled frontend SPA static assets if built
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend",
    "dist"
)

if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa_route(full_path: str):
        # Pass through API, docs, or WebSocket requests
        if full_path.startswith("api/") or full_path.startswith("ws/") or full_path in ("docs", "redoc", "openapi.json"):
            raise HTTPException(status_code=404, detail="Endpoint not found")
        
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build index.html not found")

