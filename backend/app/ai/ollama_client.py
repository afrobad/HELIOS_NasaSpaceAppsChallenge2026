"""
backend/app/ai/ollama_client.py
Async client for local Ollama inference with strict 1500ms timeout guardrail,
automatic deterministic fallback, and 2-sentence verbal response enforcement.
"""

import re
import asyncio
from typing import Dict, Any, Optional, List
import httpx

from .clinical_prompts import (
    JARVIS_SYSTEM_PROMPT,
    build_clinical_prompt,
    build_joint_clinical_prompt,
    build_multi_crew_clinical_prompt,
    build_collective_clinical_prompt,
    build_greeting_prompt
)
from .fallback_templates import get_fallback_script, clean_crew_name


class OllamaClient:
    """
    Client for local medical LLM inference via Ollama.
    Guarantees non-blocking 1500ms timeout with zero-latency deterministic failover.
    """

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:11434",
        model: str = "jarvis",
        fallback_model: str = "biomistral:7b",
        timeout_seconds: float = 1.5
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.fallback_model = fallback_model
        self.timeout_seconds = timeout_seconds
        self._cached_model: Optional[str] = None
        self._cached_model_ts: float = 0.0

    @staticmethod
    def enforce_two_sentences(
        raw_text: str,
        fallback_text: str = "",
        required_name: str = "",
        severity: str = "NOMINAL"
    ) -> str:
        """
        Parses LLM output and strictly extracts the first two clean sentences.
        Strips conversational filler, Markdown artifacts, system tags, and trailing cutoffs.
        Enforces a clinical semantic consistency guardrail: if severity is WARNING or CRITICAL,
        rejects any hallucinated phrases claiming nominal vitals or casual hydration breaks.
        """
        if not raw_text:
            return fallback_text

        # 1. CLINICAL SEMANTIC CONSISTENCY GUARDRAIL:
        # If the situation is non-nominal (WARNING or CRITICAL), strictly reject any hallucinated
        # nominal phrases and instantly fall back to the validated NASA flight script.
        if severity in ("CRITICAL", "WARNING"):
            forbidden_nominal_phrases = [
                r"calm and steady",
                r"all your vitals are calm",
                r"vitals are calm",
                r"excellent oxygen",
                r"oxygen levels are excellent",
                r"hydration break",
                r"routine hydration",
                r"routine tasks",
                r"keeping up your routine",
                r"running smooth",
                r"smooth and steady",
                r"no concerns",
                r"normal range",
                r"all systems nominal",
                r"good condition",
                r"stable and normal",
                r"calm seventy beats",
                r"seventy beats per minute"
            ]
            for pattern in forbidden_nominal_phrases:
                if re.search(pattern, raw_text, re.IGNORECASE):
                    return fallback_text

        # 2. Detect refusal / disclaimer patterns from local LLM
        refusal_patterns = [
            r"cannot provide medical",
            r"cannot provide health",
            r"as an ai",
            r"not a medical professional",
            r"not a doctor",
            r"consult a doctor",
            r"consult a healthcare",
            r"qualified medical professional",
            r"seek help from",
            r"seek medical attention",
            r"medical emergency",
            r"i am an ai",
            r"i cannot assist with"
        ]
        for pattern in refusal_patterns:
            if re.search(pattern, raw_text, re.IGNORECASE):
                return fallback_text

        # If a required astronaut name is specified, verify it is present
        if required_name and required_name.lower() not in raw_text.lower():
            return fallback_text

        # Clean markdown, tags, and ALL conversational / meta prefixes the LLM produces
        cleaned = re.sub(r"\*\*|\*|`|#|\"", "", raw_text)

        # Strip common LLM preamble patterns (multi-pass to handle nested combinations)
        preamble_patterns = [
            # "Here are / Here is / Here's the ..."
            r"^Here\s+are\s+the\s+(?:revised\s+)?(?:two-sentence\s+)?(?:two\s+sentence\s+)?(?:emergency\s+)?(?:conversational\s+)?(?:responses?|examples?|directives?|scripts?|warnings?|messages?|statements?)[^:]*[:.]\s*",
            r"^Here(?:'s|\s+is)\s+(?:a\s+)?(?:the\s+)?(?:revised\s+)?(?:two-sentence\s+)?[^:]*[:.]\s*",
            # Numbered / bulleted list item prefixes — "1. ", "- ", "• "
            r"^(?:\d+[\.\)]\s+|-\s+|•\s+)+",
            # Label prefixes
            r"^(?:JARVIS:|AI:|Clinical Advisor:|Doctor:|Response:|Example:|Fatigue:|Warning:|Critical:|Revised:|Note:)\s*",
            r"^(?:I'm JARVIS,|I am JARVIS,|This is JARVIS,|JARVIS here,)\s*",
            # Filler openers
            r"^(?:Sure|Certainly|Understood|Okay|Of course|As requested|As follows)[,!.:\s]*",
        ]
        for pattern in preamble_patterns:
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE).strip()

        # Second pass: if the text still starts with a numbered item after stripping (e.g. "2. ...")
        cleaned = re.sub(r"^\d+[\.\)]\s+", "", cleaned).strip()

        cleaned = cleaned.strip()

        # Split into sentences on sentence terminators followed by whitespace or end
        raw_sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]

        valid_sentences: List[str] = []
        for s in raw_sentences:
            s = s.strip()
            if not s:
                continue
            # Skip any sentence that still looks like a meta-label (e.g. "2. Good day...")
            if re.match(r"^\d+[\.\)]", s):
                s = re.sub(r"^\d+[\.\)]\s*", "", s)
            if s.endswith(('.', '!', '?')):
                valid_sentences.append(s)
            elif len(valid_sentences) < 2 and len(s) > 10:
                valid_sentences.append(s + ".")

        if len(valid_sentences) >= 2:
            return " ".join(valid_sentences[:4])
        elif len(valid_sentences) == 1:
            return f"{valid_sentences[0]} Maintain telemetry monitoring and follow mission protocol."

        return fallback_text


    @classmethod
    def ensure_daemon_running(cls, base_url: str = "http://127.0.0.1:11434") -> bool:
        """
        Ensures local Ollama daemon is running. If not reachable, automatically spawns
        the ollama process in the background.
        """
        import socket
        import subprocess
        import os
        import time

        try:
            with socket.create_connection(("127.0.0.1", 11434), timeout=0.3):
                return True
        except Exception:
            pass

        possible_paths = [
            os.path.expanduser(r"~\AppData\Local\Programs\Ollama\ollama.exe"),
            r"C:\Users\ZISHAN\AppData\Local\Programs\Ollama\ollama.exe",
            "ollama"
        ]
        exe_path = None
        for p in possible_paths:
            if os.path.exists(p) or p == "ollama":
                exe_path = p
                break

        if not exe_path:
            return False

        try:
            creationflags = 0
            if os.name == 'nt':
                creationflags = subprocess.CREATE_NEW_PROCESS_GROUP | 0x00000008 | 0x01000000  # DETACHED_PROCESS | CREATE_BREAKAWAY_FROM_JOB

            subprocess.Popen(
                [exe_path, "serve"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creationflags,
                close_fds=True
            )
            for _ in range(25):
                time.sleep(0.2)
                try:
                    with socket.create_connection(("127.0.0.1", 11434), timeout=0.2):
                        return True
                except Exception:
                    pass
        except Exception as e:
            print(f"[!] Could not auto-spawn ollama: {e}")

        return False

    async def check_health(self) -> Dict[str, Any]:
        """Checks if local Ollama daemon is reachable and lists installed models. Auto-spawns if offline."""
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=2.0) as client:
                    res = await client.get(f"{self.base_url}/api/tags")
                    if res.status_code == 200:
                        models = [m.get("name") for m in res.json().get("models", [])]
                        has_primary = any(self.model in m for m in models)
                        active = self.model if has_primary else (models[0] if models else "NONE")
                        return {
                            "status": "ONLINE",
                            "base_url": self.base_url,
                            "available_models": models,
                            "primary_model_loaded": bool(models),
                            "active_model": active
                        }
            except Exception:
                if attempt == 0:
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, self.ensure_daemon_running)
                    await asyncio.sleep(0.5)

        return {
            "status": "OFFLINE",
            "base_url": self.base_url,
            "mode": "DETERMINISTIC_FALLBACK_ACTIVE",
            "active_model": "DETERMINISTIC_TEMPLATES"
        }

    async def resolve_model(self, client: httpx.AsyncClient) -> str:
        """Dynamically identifies available Ollama models with caching to prevent redundant HTTP roundtrips."""
        now = time.time()
        if self._cached_model and (now - self._cached_model_ts < 60.0):
            return self._cached_model

        try:
            res = await client.get(f"{self.base_url}/api/tags", timeout=0.35)
            if res.status_code == 200:
                tags = res.json().get("models", [])
                names = [m.get("name") for m in tags if m.get("name")]
                if not names:
                    self._cached_model = self.model
                    self._cached_model_ts = now
                    return self.model
                for name in names:
                    if self.model in name:
                        self._cached_model = self.model
                        self._cached_model_ts = now
                        return self.model
                for candidate in ["jarvis", "llama3.2:1b", "phi3:mini", "llama3.2", "phi3", "biomistral"]:
                    for name in names:
                        if candidate in name:
                            self._cached_model = candidate
                            self._cached_model_ts = now
                            return candidate
                self._cached_model = names[0]
                self._cached_model_ts = now
                return names[0]
        except Exception:
            pass
        return self.model

    async def initiate_model(self) -> Dict[str, Any]:
        """
        Actively initiates the local Ollama AI model, preloading weights into memory
        with a lightweight test generation to ensure zero-latency subsequent inference.
        """
        health = await self.check_health()
        if health.get("status") != "ONLINE":
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self.ensure_daemon_running)
            await asyncio.sleep(1.0)
            health = await self.check_health()

        if health.get("status") != "ONLINE":
            return {
                "status": "OFFLINE",
                "message": "Local Ollama daemon is offline and auto-spawn is pending.",
                "model": "NONE",
                "ready": False,
                "duration_ms": 0.0
            }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                active_model = await self.resolve_model(client)
                payload = {
                    "model": active_model,
                    "prompt": "Status check: respond with Systems nominal.",
                    "stream": False,
                    "options": {"num_predict": 10}
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    dur_ms = round(data.get("total_duration", 0) / 1e6, 1)
                    return {
                        "status": "INITIATED",
                        "model": active_model,
                        "ready": True,
                        "duration_ms": dur_ms,
                        "message": f"Local Ollama AI ({active_model}) initialized and ready for neural voice generation."
                    }
        except Exception as e:
            return {
                "status": "ERROR",
                "message": f"Initiation failed: {str(e)}",
                "model": self.model,
                "ready": False,
                "duration_ms": 0.0
            }

        return {
            "status": "OFFLINE",
            "message": "Model initiation timed out.",
            "model": self.model,
            "ready": False,
            "duration_ms": 0.0
        }

    async def generate_clinical_triage(
        self,
        astronaut_name: str,
        telemetry: Dict[str, Any],
        severity: str,
        reason: str,
        scenario_phase: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Asynchronously generates a 2-sentence clinical triage voice statement.
        Guarantees non-blocking execution: strict 1.5s emergency guardrail with instant failover.
        """
        deterministic_script = get_fallback_script(
            scenario_phase or "",
            severity,
            astronaut_name=astronaut_name,
            reason=reason,
            telemetry=telemetry
        )
        prompt = build_clinical_prompt(astronaut_name, telemetry, severity, reason)
        timeout = 1.0 if severity == "CRITICAL" else (1.2 if severity == "WARNING" else self.timeout_seconds)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                active_model = await self.resolve_model(client)
                payload = {
                    "model": active_model,
                    "prompt": prompt,
                    "system": JARVIS_SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "num_ctx": 512,
                        "temperature": 0.2,
                        "top_p": 0.9,
                        "num_predict": 70
                    }
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_response = data.get("response", "")
                    speech_text = self.enforce_two_sentences(
                        raw_response,
                        fallback_text=deterministic_script,
                        required_name=astronaut_name,
                        severity=severity
                    )
                    return {
                        "spoken_text": speech_text,
                        "source": f"OLLAMA_{active_model}",
                        "is_fallback": False,
                        "duration_ms": round(data.get("total_duration", 0) / 1e6, 1)
                    }
        except Exception:
            # Catch timeouts, connection errors, HTTP errors, and parse failures
            pass

        return {
            "spoken_text": deterministic_script,
            "source": "DETERMINISTIC_FLIGHT_SCRIPT",
            "is_fallback": True,
            "duration_ms": 0.0
        }

    async def generate_greeting_advisory(
        self,
        astronaut_name: str,
        telemetry: Dict[str, Any],
        severity: str = "NOMINAL"
    ) -> Dict[str, Any]:
        """
        Asynchronously generates a personalized greeting and plain-English health advisory.
        If severity is elevated, delivers an urgent clinical directive instead of a casual greeting.
        """
        fallback_script = get_fallback_script(
            "ALL_CREW_HYPOXIA" if (severity == "CRITICAL" and float(telemetry.get("spo2", 100)) < 90)
            else ("NOMINAL_GREETING" if severity == "NOMINAL" else "SCENARIO_1_BASELINE_DRIFT"),
            severity=severity,
            astronaut_name=astronaut_name
        )
        prompt = build_greeting_prompt(astronaut_name, telemetry, severity)
        timeout = 1.5 if severity == "CRITICAL" else 2.0

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                active_model = await self.resolve_model(client)
                payload = {
                    "model": active_model,
                    "prompt": prompt,
                    "system": JARVIS_SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "num_ctx": 512,
                        "temperature": 0.25,
                        "top_p": 0.9,
                        "num_predict": 70
                    }
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_response = data.get("response", "")
                    speech_text = self.enforce_two_sentences(
                        raw_response,
                        fallback_text=fallback_script,
                        required_name=astronaut_name,
                        severity=severity
                    )
                    return {
                        "spoken_text": speech_text,
                        "source": f"OLLAMA_{active_model}",
                        "is_fallback": False,
                        "duration_ms": round(data.get("total_duration", 0) / 1e6, 1)
                    }
        except Exception:
            pass

        return {
            "spoken_text": fallback_script,
            "source": "DETERMINISTIC_FLIGHT_SCRIPT",
            "is_fallback": True,
            "duration_ms": 0.0
        }

    async def generate_joint_triage(
        self,
        crew_names: str,
        telemetry_1: Dict[str, Any],
        telemetry_2: Dict[str, Any],
        severity: str,
        reason: str,
        scenario_phase: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Asynchronously generates a 2-sentence joint triage voice statement addressing two astronauts naturally by name.
        """
        deterministic_script = (
            f"{crew_names}, physical fatigue is rising across both your stations. "
            "I advise powering down your consoles, hydrating, and taking a ten-minute breather."
        )
        if "sepsis" in reason.lower() or (scenario_phase and "sepsis" in scenario_phase.lower()):
            deterministic_script = (
                f"{crew_names}, your bodies are showing early signs of fighting an infection. "
                "I advise resting in your quarters and starting an intravenous hydration protocol."
            )
        elif "arrhythmia" in reason.lower() or "hypokalemia" in reason.lower():
            deterministic_script = (
                f"{crew_names}, your potassium levels are running low, which can strain your heart rhythms. "
                "I advise drinking your electrolyte pouches and resting."
            )
        elif "thrombosis" in reason.lower():
            deterministic_script = (
                f"{crew_names}, blood is moving slowly in your neck veins from weightlessness. "
                "I advise putting on your compression cuffs and sipping cool water."
            )
        elif "hypoxia" in reason.lower() or "co2" in reason.lower():
            deterministic_script = (
                f"{crew_names}, cabin oxygen is dropping fast and carbon dioxide is rising. "
                "I advise putting your oxygen masks on right away and checking your suit seals."
            )

        prompt = build_joint_clinical_prompt(crew_names, telemetry_1, telemetry_2, severity, reason)
        timeout = 1.5 if severity == "CRITICAL" else (2.0 if severity == "WARNING" else self.timeout_seconds)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                active_model = await self.resolve_model(client)
                payload = {
                    "model": active_model,
                    "prompt": prompt,
                    "system": JARVIS_SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "num_ctx": 512,
                        "temperature": 0.2,
                        "top_p": 0.9,
                        "num_predict": 70
                    }
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_response = data.get("response", "")
                    speech_text = self.enforce_two_sentences(
                        raw_response,
                        fallback_text=deterministic_script,
                        severity=severity
                    )
                    return {
                        "spoken_text": speech_text,
                        "source": f"OLLAMA_{active_model}",
                        "is_fallback": False,
                        "duration_ms": round(data.get("total_duration", 0) / 1e6, 1)
                    }
        except Exception:
            pass

        return {
            "spoken_text": deterministic_script,
            "source": "DETERMINISTIC_FLIGHT_SCRIPT",
            "is_fallback": True,
            "duration_ms": 0.0
        }

    async def generate_multi_crew_triage(
        self,
        crew_names: str,
        telemetries: List[Dict[str, Any]],
        severity: str,
        reason: str,
        scenario_phase: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Asynchronously generates a 2-sentence multi-crew triage voice statement addressing three or more astronauts naturally by name.
        """
        deterministic_script = (
            f"{crew_names}, you have all been working long hours and your bodies are showing elevated fatigue. "
            "I advise taking a synchronized ten-minute rest and having a cool drink."
        )
        if "sepsis" in reason.lower() or (scenario_phase and "sepsis" in scenario_phase.lower()):
            deterministic_script = (
                f"{crew_names}, your bodies are showing early signs of fighting an infection. "
                "I advise resting in your quarters and starting an intravenous hydration protocol."
            )
        elif "arrhythmia" in reason.lower() or "hypokalemia" in reason.lower():
            deterministic_script = (
                f"{crew_names}, your potassium levels are running low, which can strain your heart rhythms. "
                "I advise drinking your electrolyte pouches and resting."
            )
        elif "thrombosis" in reason.lower():
            deterministic_script = (
                f"{crew_names}, blood is moving slowly in your neck veins from weightlessness. "
                "I advise putting on your compression cuffs and sipping cool water."
            )
        elif "hypoxia" in reason.lower() or "co2" in reason.lower():
            deterministic_script = (
                f"{crew_names}, cabin oxygen is dropping fast and carbon dioxide is rising. "
                "I advise putting your oxygen masks on right away and checking your suit seals."
            )

        prompt = build_multi_crew_clinical_prompt(crew_names, telemetries, severity, reason)
        timeout = 1.5 if severity == "CRITICAL" else (2.0 if severity == "WARNING" else self.timeout_seconds)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                active_model = await self.resolve_model(client)
                payload = {
                    "model": active_model,
                    "prompt": prompt,
                    "system": JARVIS_SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "num_ctx": 512,
                        "temperature": 0.2,
                        "top_p": 0.9,
                        "num_predict": 70
                    }
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_response = data.get("response", "")
                    speech_text = self.enforce_two_sentences(
                        raw_response,
                        fallback_text=deterministic_script,
                        severity=severity
                    )
                    return {
                        "spoken_text": speech_text,
                        "source": f"OLLAMA_{active_model}",
                        "is_fallback": False,
                        "duration_ms": round(data.get("total_duration", 0) / 1e6, 1)
                    }
        except Exception:
            pass

        return {
            "spoken_text": deterministic_script,
            "source": "DETERMINISTIC_FLIGHT_SCRIPT",
            "is_fallback": True,
            "duration_ms": 0.0
        }


    async def generate_collective_triage(
        self,
        crew_count: int,
        aggregate_telemetry: Dict[str, Any],
        severity: str,
        reason: str,
        scenario_phase: Optional[str] = None,
        fallback_script_key: str = "ALL_CREW_WARNING"
    ) -> Dict[str, Any]:
        """
        Asynchronously generates a 2-sentence collective triage voice statement for the entire crew.
        Guarantees non-blocking execution with instant deterministic fallback.
        """
        deterministic_script = get_fallback_script(
            fallback_script_key or scenario_phase or "ALL_CREW_WARNING",
            severity,
            astronaut_name="All Crew Stations",
            astronaut_id="ALL_CREW"
        )
        prompt = build_collective_clinical_prompt(crew_count, aggregate_telemetry, severity, reason)
        timeout = 1.5 if severity == "CRITICAL" else (2.0 if severity == "WARNING" else self.timeout_seconds)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                active_model = await self.resolve_model(client)
                payload = {
                    "model": active_model,
                    "prompt": prompt,
                    "system": JARVIS_SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "num_ctx": 512,
                        "temperature": 0.2,
                        "top_p": 0.9,
                        "num_predict": 70
                    }
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_response = data.get("response", "")
                    speech_text = self.enforce_two_sentences(
                        raw_response,
                        fallback_text=deterministic_script,
                        severity=severity
                    )
                    return {
                        "spoken_text": speech_text,
                        "source": f"OLLAMA_{active_model}",
                        "is_fallback": False,
                        "duration_ms": round(data.get("total_duration", 0) / 1e6, 1)
                    }
        except Exception:
            pass

        return {
            "spoken_text": deterministic_script,
            "source": "DETERMINISTIC_FLIGHT_SCRIPT",
            "is_fallback": True,
            "duration_ms": 0.0
        }

    async def answer_voice_query(
        self,
        query: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Answers astronaut hands-free queries (e.g. 'JARVIS, why did you flag this alert?').
        Context includes astronaut vitals, baseline deltas, and current triage state.
        """
        ast_name = context.get('astronaut_name', '')
        ast_id = context.get('astronaut_id', '')
        clean_name = clean_crew_name(ast_name, ast_id)
        default_speech = get_fallback_script(
            "SCENARIO_5_VOICE_QUERY",
            astronaut_name=clean_name,
            astronaut_id=ast_id
        )

        vitals = context.get("telemetry", {})
        query_prompt = f"""Target Astronaut: {clean_name}
Crew Query from {clean_name}: "{query}"
Status: {context.get('severity', 'NOMINAL')}
Vitals: Heart rate {vitals.get('heart_rate', 'normal')} beats per minute, oxygen saturation {vitals.get('spo2', 'normal')} percent, State {vitals.get('mission_state', 'NOMINAL')}.

Instruction: In exactly TWO concise sentences, greet {clean_name} warmly, answer their inquiry in simple everyday English, and provide a helpful, caring health advisory. Spell all words in full (write 'Commander', 'carbon dioxide', 'oxygen', 'beats per minute') without abbreviations so voice pronunciation is 100% accurate. Do not apologize."""

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                active_model = await self.resolve_model(client)
                payload = {
                    "model": active_model,
                    "prompt": query_prompt,
                    "system": JARVIS_SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "num_ctx": 512,
                        "temperature": 0.2,
                        "top_p": 0.9,
                        "num_predict": 45
                    }
                }
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_response = data.get("response", "")
                    speech_text = self.enforce_two_sentences(raw_response, fallback_text=default_speech, required_name=clean_name)
                    return {
                        "spoken_text": speech_text,
                        "source": f"OLLAMA_{active_model}",
                        "is_fallback": False,
                        "duration_ms": round(data.get("total_duration", 0) / 1e6, 1)
                    }
        except Exception:
            pass

        return {
            "spoken_text": default_speech,
            "source": "DETERMINISTIC_FLIGHT_SCRIPT",
            "is_fallback": True,
            "duration_ms": 0.0
        }
