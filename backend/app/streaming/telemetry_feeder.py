"""
backend/app/streaming/telemetry_feeder.py
Background streaming loop that replays the 10 Hz time-series dataset, evaluates the math sentry,
logs to SQLite WAL, and dispatches frames to WebSocket clients.
"""

import os
import csv
import time
import asyncio
from typing import Dict, Any, List, Optional
from ..core.circular_buffer import BoundedTelemetryBuffer
from ..core.baselines import BaselineManager
from ..core.sentry_matrix import SentryMatrixEngine
from ..db.repository import TelemetryRepository
from ..ai.decision_engine import DecisionEngine
from ..ai.voice_engine import VoiceEngine
from ..ai.fallback_templates import clean_crew_name, format_crew_names_list
from .websocket_manager import WebSocketManager

DEFAULT_CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data",
    "astronaut_telemetry_stream.csv"
)


class TelemetryFeeder:
    """10 Hz continuous stream feeder."""

    def __init__(
        self,
        ws_manager: WebSocketManager,
        repo: TelemetryRepository,
        baseline_mgr: BaselineManager,
        voice_engine: Optional[VoiceEngine] = None,
        csv_path: str = DEFAULT_CSV_PATH
    ):
        self.ws_manager = ws_manager
        self.repo = repo
        self.baseline_mgr = baseline_mgr
        self.voice_engine = voice_engine or VoiceEngine()
        self.csv_path = csv_path
        self.is_running = False
        self.current_tick = 0
        self.total_ticks = 0
        self.records: List[Dict[str, Any]] = []
        self.records_by_astronaut: Dict[str, List[Dict[str, Any]]] = {}
        self.buffers: Dict[str, BoundedTelemetryBuffer] = {}
        self.last_severities: Dict[str, str] = {}

        # Alert Coalescing Staging Buffer (Temporal Multi-Crew Aggregation)
        self._staged_candidates: List[Dict[str, Any]] = []
        self._coalesce_timer_task: Optional[asyncio.Task] = None
        self._coalescing_lock = asyncio.Lock()

        self.load_dataset()

    @property
    def current_index(self) -> int:
        return self.current_tick

    @current_index.setter
    def current_index(self, val: int) -> None:
        self.current_tick = val

    def load_dataset(self) -> None:
        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"Telemetry stream CSV not found at {self.csv_path}")

        self.records = []
        self.records_by_astronaut = {ast_id: [] for ast_id in self.baseline_mgr.get_astronaut_ids()}
        with open(self.csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Cast numeric values
                rec = {
                    "timestamp": row["timestamp"],
                    "tick": int(row["tick"]),
                    "astronaut_id": row["astronaut_id"],
                    "astronaut_name": row["astronaut_name"],
                    "mission_state": row["mission_state"],
                    "heart_rate": float(row["heart_rate"]),
                    "hrv_rmssd": float(row["hrv_rmssd"]),
                    "spo2": float(row["spo2"]),
                    "core_temp": float(row["core_temp"]),
                    "sleep_score": float(row["sleep_score"]),
                    "cabin_co2": float(row["cabin_co2"]),
                    "potassium": float(row["potassium"]) if "potassium" in row and row["potassium"] else 4.2,
                    "hematocrit": float(row["hematocrit"]) if "hematocrit" in row and row["hematocrit"] else 44.0,
                    "wbc_count": float(row["wbc_count"]) if "wbc_count" in row and row["wbc_count"] else 6.8,
                    "il_6": float(row["il_6"]) if "il_6" in row and row["il_6"] else 6.2,
                    "platelet_count": float(row["platelet_count"]) if "platelet_count" in row and row["platelet_count"] else 240.0,
                    "crp": float(row["crp"]) if "crp" in row and row["crp"] else 1.2,
                    "radiation_flux": float(row["radiation_flux"]) if "radiation_flux" in row and row["radiation_flux"] else 0.05,
                    "lymphocyte_count": float(row["lymphocyte_count"]) if "lymphocyte_count" in row and row["lymphocyte_count"] else 2.2,
                    "radiation_dose_gy": float(row["radiation_dose_gy"]) if "radiation_dose_gy" in row and row["radiation_dose_gy"] else 0.0,
                    "computed_qtc": float(row["computed_qtc"]) if "computed_qtc" in row and row["computed_qtc"] else 400.0,
                    "computed_epi": float(row["computed_epi"]) if "computed_epi" in row and row["computed_epi"] else 0.0,
                    "computed_arf": float(row["computed_arf"]) if "computed_arf" in row and row["computed_arf"] else 0.74,
                    "computed_trm": float(row["computed_trm"]) if "computed_trm" in row and row["computed_trm"] else 1.0,
                    "computed_rsi": float(row["computed_rsi"]) if "computed_rsi" in row and row["computed_rsi"] else 0.1,
                    "scenario_phase": row["scenario_phase"],
                    "z_score_hr": float(row["z_score_hr"]),
                    "z_score_hrv": float(row["z_score_hrv"]),
                    "alert_severity": row["alert_severity"],
                    "data_source": row["data_source"]
                }
                self.records.append(rec)
                if rec["astronaut_id"] in self.records_by_astronaut:
                    self.records_by_astronaut[rec["astronaut_id"]].append(rec)

        self.total_ticks = max((len(recs) for recs in self.records_by_astronaut.values()), default=len(self.records))
        self.current_tick = 0

        # Initialize per-astronaut circular ring buffers
        for ast_id in self.baseline_mgr.get_astronaut_ids():
            self.buffers[ast_id] = BoundedTelemetryBuffer(max_seconds=360, sample_rate_hz=10)
            self.last_severities[ast_id] = "NOMINAL"

        # Continuous Progressive Sentry State Tracking
        self._active_scenario: str = "NOMINAL_CRUISE"
        self._scenario_stage_index: int = 0
        self._last_progressive_dispatch_time: float = 0.0
        # 16.0s interval guarantees ~8.0s speaking + a calm 3.5s to 4s quiet break before next progressive stage
        self._progressive_interval_seconds: float = 16.0

    SCENARIO_OFFSETS: Dict[str, int] = {
        "NOMINAL_CRUISE": 0,
        "SCENARIO_1_BASELINE_DRIFT": 1520,      # Point of resting tachycardia drift
        "SCENARIO_2_WORKOUT_GATING": 2400,      # Point of workout tachycardia initiation
        "SCENARIO_3_CO2_HYPOXIA": 3890,         # Point of acute CO2 leak & SpO2 desaturation
        "SCENARIO_4_DEEP_SPACE_BLACKOUT": 4805, # Point of communications blackout
        "SCENARIO_5_PRESYMPTOMATIC_SEPSIS": 6000, # Point of subclinical immune cytokine surge
        "SCENARIO_6_HYPOKALEMIA_ARRHYTHMIA": 7200, # Point of microgravity K+ wasting & QTc widening
        "SCENARIO_7_VENOUS_THROMBOSIS_RISK": 8400, # Point of cephalic hemoconcentration & IJV stasis
        "SCENARIO_8_SOLAR_RADIATION_STORM": 9600,  # Point of solar particle event & lymphocyte depletion
        "SOLAR_RADIATION_STORM": 9600,
        "SOLAR_STORM": 9600
    }


    def jump_to_scenario(self, scenario_phase: str) -> bool:
        """Jumps playback index directly to active scenario phase onset for instant demonstration."""
        found = False
        target_tick = 0
        if scenario_phase in self.SCENARIO_OFFSETS:
            target_tick = self.SCENARIO_OFFSETS[scenario_phase] % max(self.total_ticks, 1)
            found = True
        else:
            for ast_recs in self.records_by_astronaut.values():
                for idx, rec in enumerate(ast_recs):
                    if rec["scenario_phase"] == scenario_phase:
                        target_tick = idx
                        found = True
                        break
                if found:
                    break
            if not found:
                for idx, rec in enumerate(self.records):
                    if rec["scenario_phase"] == scenario_phase:
                        target_tick = rec.get("tick", idx)
                        found = True
                        break

        if found:
            self._active_scenario = scenario_phase
            self._scenario_stage_index = 0
            self._last_progressive_dispatch_time = time.time()
            self.current_tick = target_tick
            # Reset evaluated severities and flush stale circular ring buffers
            for ast_id in self.buffers:
                self.buffers[ast_id]._buffer.clear()
                self.last_severities[ast_id] = "NOMINAL"
            # Flush pending staged alerts
            self._staged_candidates.clear()
            if self._coalesce_timer_task and not self._coalesce_timer_task.done():
                self._coalesce_timer_task.cancel()
                self._coalesce_timer_task = None
            return True
        return False

    async def jump_to_scenario_and_broadcast(self, scenario_phase: str) -> Dict[str, Any]:
        """Jumps playback index, flushes buffers, immediately steps a tick and broadcasts to HUD clients."""
        success = self.jump_to_scenario(scenario_phase)
        if not success:
            return {}

        # Reset suppression cooldowns and cancel pending coalesced alerts on scenario jump
        if self.voice_engine:
            self.voice_engine.reset_suppression_cooldowns()

        async with self._coalescing_lock:
            self._staged_candidates.clear()
            if self._coalesce_timer_task and not self._coalesce_timer_task.done():
                self._coalesce_timer_task.cancel()

        await self.step_tick()
        return {
            ast_id: self.buffers[ast_id].get_latest()
            for ast_id in self.buffers
            if self.buffers[ast_id].get_latest() is not None
        }

    async def step_tick(self) -> Optional[Dict[str, Any]]:
        """Executes a single 10 Hz tick: buffer push, sentry evaluation, DB log, and WS broadcast for all crew."""
        if not self.records:
            return None

        dispatched_packets = []
        if self.records_by_astronaut and any(self.records_by_astronaut.values()):
            elevated_candidates = []
            for ast_id, crew_recs in self.records_by_astronaut.items():
                if not crew_recs:
                    continue
                packet = crew_recs[self.current_tick % len(crew_recs)]
                mission_state = packet["mission_state"]

                # 1. Push to O(1) in-memory buffer
                if ast_id in self.buffers:
                    self.buffers[ast_id].append(packet)

                # 2. Evaluate Tier 1 Sentry Matrix
                baseline = self.baseline_mgr.get_astronaut_baseline(ast_id, mission_state)
                env = self.baseline_mgr.environmental_baselines
                severity, confidence, reason = SentryMatrixEngine.evaluate_state(packet, baseline, env)

                # Update packet with evaluated severity
                packet["evaluated_severity"] = severity
                packet["confidence"] = confidence

                # 3. Check for Proactive Alert Escalation
                prev_sev = self.last_severities.get(ast_id, "NOMINAL")
                if severity in ("WARNING", "CRITICAL") and (prev_sev != severity or severity == "CRITICAL"):
                    elevated_candidates.append({
                        "ast_id": ast_id,
                        "packet": packet,
                        "severity": severity,
                        "confidence": confidence,
                        "reason": reason,
                        "baseline": baseline,
                        "env": env
                    })

                self.last_severities[ast_id] = severity

                # 4. Asynchronously log telemetry to SQLite WAL
                self.repo.log_telemetry(packet)

                # 5. Broadcast to connected WebSocket HUD clients
                await self.ws_manager.broadcast_telemetry(packet)
                dispatched_packets.append(packet)

            # Route elevated candidates into temporal alert coalescing engine
            if elevated_candidates:
                self._stage_and_coalesce_alerts(elevated_candidates)

            # Continuous Progressive Sentry Loop:
            # While an elevated clinical state persists or an active scenario is running,
            # re-evaluate telemetry every 11 seconds and advance to the next progressive recommendation stage!
            now = time.time()
            is_any_elevated = any(s in ("WARNING", "CRITICAL") for s in self.last_severities.values())
            is_active_scenario = self._active_scenario not in ("NOMINAL_CRUISE", "SCENARIO_2_WORKOUT_GATING", "")

            if (is_any_elevated or is_active_scenario) and (now - self._last_progressive_dispatch_time >= self._progressive_interval_seconds):
                self._last_progressive_dispatch_time = now
                self._scenario_stage_index += 1

                current_active_candidates = []
                for ast_id, s in self.last_severities.items():
                    if s in ("WARNING", "CRITICAL") or is_active_scenario:
                        latest_pkt = self.buffers[ast_id].get_latest() if ast_id in self.buffers else None
                        if latest_pkt:
                            current_active_candidates.append({
                                "ast_id": ast_id,
                                "packet": latest_pkt,
                                "severity": latest_pkt.get("evaluated_severity", "WARNING"),
                                "confidence": latest_pkt.get("confidence", 0.92),
                                "reason": f"Progressive Sentry Advisory (Stage {self._scenario_stage_index})",
                                "baseline": self.baseline_mgr.get_astronaut_baseline(ast_id, latest_pkt.get("mission_state", "REST")),
                                "env": self.baseline_mgr.environmental_baselines
                            })

                if current_active_candidates:
                    asyncio.create_task(self._dispatch_progressive_stage(current_active_candidates, self._scenario_stage_index))

            self.current_tick = (self.current_tick + 1) % self.total_ticks
            return dispatched_packets[0] if dispatched_packets else None
        else:
            packet = self.records[self.current_tick % len(self.records)]
            self.current_tick = (self.current_tick + 1) % len(self.records)
            ast_id = packet["astronaut_id"]
            mission_state = packet["mission_state"]

            if ast_id in self.buffers:
                self.buffers[ast_id].append(packet)

            baseline = self.baseline_mgr.get_astronaut_baseline(ast_id, mission_state)
            env = self.baseline_mgr.environmental_baselines
            severity, confidence, reason = SentryMatrixEngine.evaluate_state(packet, baseline, env)

            packet["evaluated_severity"] = severity
            packet["confidence"] = confidence

            prev_sev = self.last_severities.get(ast_id, "NOMINAL")
            if severity in ("WARNING", "CRITICAL") and (prev_sev != severity or severity == "CRITICAL"):
                self._stage_and_coalesce_alerts([{
                    "ast_id": ast_id,
                    "packet": packet,
                    "severity": severity,
                    "confidence": confidence,
                    "reason": reason,
                    "baseline": baseline,
                    "env": env
                }])

            self.last_severities[ast_id] = severity
            self.repo.log_telemetry(packet)
            await self.ws_manager.broadcast_telemetry(packet)
            return packet

    def _stage_and_coalesce_alerts(self, new_candidates: List[Dict[str, Any]]) -> None:
        """
        Stages newly elevated candidates into the temporal coalescing queue.
        Starts or maintains an asynchronous coalescing timer (1.2s for WARNING, 0.5s for CRITICAL).
        """
        for cand in new_candidates:
            ast_id = cand["ast_id"]
            if self.voice_engine.should_suppress_alert(ast_id, cand["severity"]):
                continue

            existing_idx = next((i for i, c in enumerate(self._staged_candidates) if c["ast_id"] == ast_id), None)
            if existing_idx is not None:
                self._staged_candidates[existing_idx] = cand
            else:
                self._staged_candidates.append(cand)

        if self._staged_candidates and (self._coalesce_timer_task is None or self._coalesce_timer_task.done()):
            is_any_critical = any(c["severity"] == "CRITICAL" for c in self._staged_candidates)
            total_active_crew = len([c for c in self.records_by_astronaut.values() if c])
            if total_active_crew > 0 and len(self._staged_candidates) >= total_active_crew:
                wait_time = 0.05  # Instantaneous 50ms dispatch when entire crew is staged
            elif is_any_critical:
                wait_time = 0.15  # 150ms life-safety emergency dispatch
            else:
                wait_time = 1.0  # 1.0s window for warning correlation
            self._coalesce_timer_task = asyncio.create_task(self._process_coalesced_alerts_window(wait_time))

    async def _process_coalesced_alerts_window(self, wait_seconds: float = 1.2) -> None:
        """
        Temporal Alert Coalescing Window:
        Holds alerts for a short observation window (1.2s default) to aggregate correlated
        crew alerts across staggered 100ms noise crossings before synthesizing and streaming.
        """
        try:
            await asyncio.sleep(wait_seconds)
        except asyncio.CancelledError:
            return

        async with self._coalescing_lock:
            if not self._staged_candidates:
                return
            candidates = list(self._staged_candidates)
            self._staged_candidates.clear()

        # Re-verify against voice_engine suppression (in case state changed in interim)
        valid_candidates = [
            c for c in candidates
            if not self.voice_engine.should_suppress_alert(c["ast_id"], c["severity"])
        ]
        if not valid_candidates:
            return

        total_active_crew = len([c for c in self.records_by_astronaut.values() if c])

        # Priority 4: All active crew or 4+ members elevated -> Vessel-wide collective alert
        if len(valid_candidates) >= 4 or (total_active_crew > 0 and len(valid_candidates) >= total_active_crew):
            await self._dispatch_collective_crew_alert(valid_candidates)

        # Priority 3: Exactly 3 members elevated -> Named Multi-Crew Consolidated Alert
        elif len(valid_candidates) == 3:
            await self._dispatch_multi_crew_alert(valid_candidates)

        # Priority 2: Exactly 2 members elevated -> Joint Alert
        elif len(valid_candidates) == 2:
            c1, c2 = valid_candidates[0], valid_candidates[1]
            phase1 = c1.get("packet", {}).get("scenario_phase", "")
            phase2 = c2.get("packet", {}).get("scenario_phase", "")
            same_issue = (
                c1["reason"] == c2["reason"]
                or (phase1 and phase1 == phase2 and phase1 != "NOMINAL_CRUISE")
                or (c1["severity"] == c2["severity"] and any(
                    kw in c1["reason"].lower() and kw in c2["reason"].lower()
                    for kw in ["cardiac", "co2", "hypoxia", "sepsis", "radiation", "arrhythmia", "dehydration", "thermal", "fatigue", "drift", "elevation"]
                ))
            )
            if same_issue:
                await self._dispatch_joint_crew_alert(c1, c2)
            else:
                for cand in valid_candidates:
                    await self._dispatch_proactive_alert(
                        cand["packet"], cand["severity"], cand["confidence"],
                        cand["reason"], cand["baseline"], cand["env"]
                    )

        # Priority 1: Single astronaut elevated -> Solo Alert
        elif len(valid_candidates) == 1:
            cand = valid_candidates[0]
            await self._dispatch_proactive_alert(
                cand["packet"], cand["severity"], cand["confidence"],
                cand["reason"], cand["baseline"], cand["env"]
            )

    async def _dispatch_progressive_stage(self, candidates: List[Dict[str, Any]], stage_index: int) -> None:
        """Dispatches the next progressive stage advisory for ongoing situations."""
        if not candidates:
            return
        total_active_crew = len([c for c in self.records_by_astronaut.values() if c])
        if len(candidates) >= 4 or (total_active_crew > 0 and len(candidates) >= total_active_crew):
            await self._dispatch_collective_crew_alert(candidates, stage_index=stage_index)
        elif len(candidates) == 3:
            await self._dispatch_multi_crew_alert(candidates, stage_index=stage_index)
        elif len(candidates) == 2:
            await self._dispatch_joint_crew_alert(candidates[0], candidates[1], stage_index=stage_index)
        elif len(candidates) == 1:
            cand = candidates[0]
            await self._dispatch_proactive_alert(
                cand["packet"], cand["severity"], cand["confidence"],
                cand["reason"], cand["baseline"], cand["env"], stage_index=stage_index
            )

    async def _dispatch_proactive_alert(
        self,
        packet: Dict[str, Any],
        severity: str,
        confidence: float,
        reason: str,
        baseline: Dict[str, Any],
        env: Dict[str, Any],
        stage_index: int = 0
    ) -> None:
        """Asynchronously synthesizes voice warnings and logs proactive alerts without blocking telemetry."""
        ast_id = packet["astronaut_id"]
        ast_name = clean_crew_name(packet.get("astronaut_name", ""), ast_id)

        # Synthesize JARVIS voice warning
        voice_warning = await self.voice_engine.create_voice_warning(
            astronaut_id=ast_id,
            astronaut_name=ast_name,
            telemetry=packet,
            severity=severity,
            reason=reason,
            scenario_phase=packet.get("scenario_phase"),
            stage_index=stage_index
        )

        # PRE-WARM TTS CACHE — synthesize audio for this exact speech_text immediately,
        # so by the time the frontend's /api/voice/synthesize request arrives the audio
        # is already in memory and returns in ~2ms instead of 3-4 seconds.
        asyncio.create_task(
            VoiceEngine.synthesize_neural_speech(
                voice_warning["speech_text"],
                severity=severity
            )
        )

        # Structure clinical triage evidence
        triage = DecisionEngine.structure_triage_record(
            astronaut_id=ast_id,
            astronaut_name=ast_name,
            telemetry=packet,
            baseline=baseline,
            env_thresholds=env,
            severity=severity,
            reason=reason
        )

        alert_payload = {
            **voice_warning,
            "triage_diagnosis": triage["primary_diagnosis"],
            "actionable_instruction": triage["actionable_instruction"],
            "confidence": confidence,
            "evidence_breakdown": triage["evidence_breakdown"],
            "telemetry": packet
        }

        # Log to SQLite proactive_alerts table
        self.repo.log_proactive_alert(
            astronaut_id=ast_id,
            severity=severity,
            trigger_reason=reason,
            confidence=confidence,
            evidence=packet,
            voice_text=voice_warning["speech_text"]
        )

        # Broadcast rich JARVIS voice warning to HUD WebSocket
        await self.ws_manager.broadcast_alert(alert_payload)

    async def _dispatch_joint_crew_alert(self, cand1: Dict[str, Any], cand2: Dict[str, Any], stage_index: int = 0) -> None:
        """Asynchronously synthesizes and broadcasts a single joint voice warning addressing both crew members by name."""
        p1 = cand1["packet"]
        p2 = cand2["packet"]
        ast_id1 = cand1["ast_id"]
        ast_id2 = cand2["ast_id"]
        name1 = clean_crew_name(p1.get("astronaut_name", ""), ast_id1)
        name2 = clean_crew_name(p2.get("astronaut_name", ""), ast_id2)
        joint_names = f"{name1} and {name2}"

        is_critical = cand1["severity"] == "CRITICAL" or cand2["severity"] == "CRITICAL"
        severity = "CRITICAL" if is_critical else "WARNING"
        reason = cand1["reason"] if cand1["reason"] == cand2["reason"] else f"{cand1['reason']}; {cand2['reason']}"
        scenario_phase = p1.get("scenario_phase") or p2.get("scenario_phase")

        # Synthesize joint voice warning using VoiceEngine (calls Ollama generate_joint_triage)
        voice_warning = await self.voice_engine.create_joint_voice_warning(
            crew_names=joint_names,
            astronaut_ids=[ast_id1, ast_id2],
            telemetry_1=p1,
            telemetry_2=p2,
            severity=severity,
            reason=reason,
            scenario_phase=scenario_phase,
            stage_index=stage_index
        )

        # PRE-WARM TTS CACHE — audio ready before frontend requests it
        asyncio.create_task(
            VoiceEngine.synthesize_neural_speech(
                voice_warning["speech_text"],
                severity=severity
            )
        )

        alert_payload = {
            **voice_warning,
            "triage_diagnosis": f"Joint Anomaly ({joint_names}): {reason}",
            "actionable_instruction": f"Cross-verify telemetry between {name1} and {name2}. Initiate stabilization protocol.",
            "confidence": max(cand1.get("confidence", 0.95), cand2.get("confidence", 0.95)),
            "evidence_breakdown": [
                {"metric": f"{name1} Heart Rate", "value": p1.get("heart_rate"), "clinical_finding": f"{name1} HR: {p1.get('heart_rate')} bpm"},
                {"metric": f"{name2} Heart Rate", "value": p2.get("heart_rate"), "clinical_finding": f"{name2} HR: {p2.get('heart_rate')} bpm"},
                {"metric": "Primary Condition", "value": reason, "clinical_finding": reason}
            ],
            "telemetry": p1
        }

        # Suppress individual alerts for both crew members
        self.voice_engine.record_alert_dispatched(ast_id1, severity)
        self.voice_engine.record_alert_dispatched(ast_id2, severity)

        # Log to SQLite proactive_alerts table for both astronauts
        for ast_id, pkt in [(ast_id1, p1), (ast_id2, p2)]:
            self.repo.log_proactive_alert(
                astronaut_id=ast_id,
                severity=severity,
                trigger_reason=reason,
                confidence=alert_payload["confidence"],
                evidence=pkt,
                voice_text=voice_warning["speech_text"]
            )

        # Broadcast rich JARVIS voice warning to HUD WebSocket
        await self.ws_manager.broadcast_alert(alert_payload)

    async def _dispatch_multi_crew_alert(self, candidates: List[Dict[str, Any]], stage_index: int = 0) -> None:
        """Asynchronously synthesizes and broadcasts a single consolidated voice warning addressing three crew members by name."""
        packets = [c["packet"] for c in candidates]
        ast_ids = [c["ast_id"] for c in candidates]
        names = [clean_crew_name(p.get("astronaut_name", ""), ast_id) for p, ast_id in zip(packets, ast_ids)]
        multi_names = format_crew_names_list(names)

        is_critical = any(c["severity"] == "CRITICAL" for c in candidates)
        severity = "CRITICAL" if is_critical else "WARNING"

        reasons = list(dict.fromkeys(c["reason"] for c in candidates if c.get("reason")))
        reason = "; ".join(reasons) if reasons else "Elevated physiological fatigue across multiple crew stations"
        scenario_phase = packets[0].get("scenario_phase")

        # Synthesize multi-crew voice warning using VoiceEngine
        voice_warning = await self.voice_engine.create_multi_crew_voice_warning(
            crew_names=multi_names,
            astronaut_ids=ast_ids,
            telemetries=packets,
            severity=severity,
            reason=reason,
            scenario_phase=scenario_phase,
            stage_index=stage_index
        )

        # PRE-WARM TTS CACHE — audio ready before frontend requests it
        asyncio.create_task(
            VoiceEngine.synthesize_neural_speech(
                voice_warning["speech_text"],
                severity=severity
            )
        )

        evidence_breakdown = []
        for p, name in zip(packets, names):
            evidence_breakdown.append({
                "metric": f"{name} Heart Rate",
                "value": p.get("heart_rate"),
                "clinical_finding": f"{name} HR: {p.get('heart_rate')} bpm, SpO₂: {p.get('spo2')}%"
            })
        evidence_breakdown.append({
            "metric": "Primary Condition",
            "value": reason,
            "clinical_finding": reason
        })

        alert_payload = {
            **voice_warning,
            "triage_diagnosis": f"Multi-Crew Advisory ({multi_names}): {reason}",
            "actionable_instruction": f"Cross-verify telemetry across {multi_names}. Initiate synchronized rest and hydration protocol.",
            "confidence": max((c.get("confidence", 0.95) for c in candidates), default=0.95),
            "evidence_breakdown": evidence_breakdown,
            "telemetry": packets[0]
        }

        # Suppress individual alerts for all included crew members
        for ast_id in ast_ids:
            self.voice_engine.record_alert_dispatched(ast_id, severity)

        # Log to SQLite proactive_alerts table for each astronaut
        for ast_id, pkt in zip(ast_ids, packets):
            self.repo.log_proactive_alert(
                astronaut_id=ast_id,
                severity=severity,
                trigger_reason=reason,
                confidence=alert_payload["confidence"],
                evidence=pkt,
                voice_text=voice_warning["speech_text"]
            )

        # Broadcast rich JARVIS voice warning to HUD WebSocket
        await self.ws_manager.broadcast_alert(alert_payload)

    async def _dispatch_collective_crew_alert(self, elevated_candidates: List[Dict[str, Any]], stage_index: int = 0) -> None:
        """Asynchronously synthesizes and broadcasts a single vessel-wide collective voice warning for all crew."""
        is_critical = any(c["severity"] == "CRITICAL" for c in elevated_candidates)
        severity = "CRITICAL" if is_critical else "WARNING"

        if self.voice_engine.should_suppress_alert("ALL_CREW", severity, is_progressive=(stage_index > 0)):
            return

        packets = [c["packet"] for c in elevated_candidates]
        mean_hr = round(sum(p.get("heart_rate", 0) for p in packets) / len(packets), 1)
        mean_spo2 = round(sum(p.get("spo2", 0) for p in packets) / len(packets), 1)
        min_spo2 = min((p.get("spo2", 100) for p in packets), default=90.0)
        max_co2 = max((p.get("cabin_co2", 0) for p in packets), default=0.0)
        scenario_phase = packets[0].get("scenario_phase", "")

        max_rad = max((p.get("radiation_flux", 0) for p in packets), default=0.0)
        max_dose = max((p.get("radiation_dose_gy", 0) for p in packets), default=0.0)
        if "RADIATION" in scenario_phase or "STORM" in scenario_phase or max_rad > 50.0 or max_dose > 0.5:
            reason = "Acute Solar Particle Event and radiation flux surge across all crew quarters"
            script_key = "ALL_CREW_SOLAR_STORM"
        elif max_co2 > 4.5 or min_spo2 < 90.0 or "HYPOXIA" in scenario_phase:
            reason = "Cabin CO₂ scrubber breach with collective crew hypoxia"
            script_key = "ALL_CREW_HYPOXIA"
        else:
            reason = "Vessel-wide physiological strain detected across crew stations"
            script_key = "ALL_CREW_WARNING"


        aggregate_telemetry = {
            "timestamp": packets[0].get("timestamp"),
            "astronaut_id": "ALL_CREW",
            "astronaut_name": "All Crew Stations",
            "heart_rate": mean_hr,
            "spo2": min_spo2,
            "mean_spo2": mean_spo2,
            "cabin_co2": max_co2,
            "mission_state": "ALL_STATIONS",
            "scenario_phase": scenario_phase
        }

        voice_warning = await self.voice_engine.create_collective_voice_warning(
            crew_count=len(elevated_candidates),
            aggregate_telemetry=aggregate_telemetry,
            severity=severity,
            reason=reason,
            scenario_phase=scenario_phase,
            fallback_script_key=script_key,
            stage_index=stage_index
        )

        # PRE-WARM TTS CACHE — audio ready before frontend requests it
        asyncio.create_task(
            VoiceEngine.synthesize_neural_speech(
                voice_warning["speech_text"],
                severity=severity
            )
        )

        alert_payload = {
            **voice_warning,
            "triage_diagnosis": f"Spacecraft-Wide Alert: {reason}",
            "actionable_instruction": "All crew don oxygen masks and verify cabin life-support containment.",
            "confidence": 0.99,
            "evidence_breakdown": [
                {"metric": "Cabin CO₂", "value": max_co2, "clinical_finding": f"Cabin atmosphere accumulation: {max_co2} mmHg"},
                {"metric": "Minimum SpO₂", "value": min_spo2, "clinical_finding": f"Systemic desaturation (Mean: {mean_spo2}%)"},
                {"metric": "Mean Heart Rate", "value": mean_hr, "clinical_finding": f"Compensatory tachycardia across {len(elevated_candidates)} crew"}
            ],
            "telemetry": aggregate_telemetry
        }

        # Suppress individual alerts for all elevated crew
        for cand in elevated_candidates:
            self.voice_engine.record_alert_dispatched(cand["ast_id"], severity)
        self.voice_engine.record_alert_dispatched("ALL_CREW", severity)

        self.repo.log_proactive_alert(
            astronaut_id="ALL_CREW",
            severity=severity,
            trigger_reason=reason,
            confidence=0.99,
            evidence=aggregate_telemetry,
            voice_text=voice_warning["speech_text"]
        )
        await self.ws_manager.broadcast_alert(alert_payload)

    async def run_loop(self) -> None:
        """Continuous 10 Hz loop (100ms interval) with fault tolerance."""
        self.is_running = True
        while self.is_running:
            try:
                await self.step_tick()
            except Exception as e:
                # Log without halting the real-time flight telemetry thread
                print(f"[!] TelemetryFeeder step_tick caught exception: {e}")
            await asyncio.sleep(0.1)  # 10 Hz

    def stop(self) -> None:
        self.is_running = False
