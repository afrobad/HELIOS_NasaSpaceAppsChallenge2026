"""
backend/app/ai/gemini_client.py
High-Speed Google Gemini AI Client for JARVIS Clinical Telemetry Voice Generation.
Supports real-time 2-sentence conversational triage and asynchronous lookahead pipelining.
"""

import os
import re
import json
import time
import asyncio
from typing import Dict, Any, Optional
import httpx

JARVIS_GEMINI_SYSTEM_INSTRUCTION = (
    "You are JARVIS, an autonomous aerospace medical officer and life-support intelligence aboard a deep-space spacecraft. "
    "Your communication standard is inspired by NASA flight surgeons and JARVIS: calm, highly intelligent, precise, and authoritative. "
    "RULES:\n"
    "1. You must address the astronaut by their specific name (e.g. 'Doctor Sian', 'Commander Haley', 'Pilot Chris', 'Specialist Leo').\n"
    "2. ALWAYS state what actually happened clinically, citing specific biometric values and physiological markers (e.g., serum potassium, QTc interval, SpO2, heart rate, cabin CO2, radiation flux).\n"
    "3. Provide exactly two concise sentences: Sentence 1 states the diagnosis and live biometrics. Sentence 2 gives the actionable clinical countermeasure.\n"
    "4. Do NOT include markdown, asterisks, bullet points, numbered lists, or prefixes like 'JARVIS:'. Output plain spoken text only."
)


class GeminiClient:
    """
    High-performance asynchronous Google Gemini client for real-time aerospace medical triage.
    Supports asynchronous lookahead pre-generation (double-buffering) to eliminate LLM latency.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gemini-1.5-flash",
        timeout_seconds: float = 2.5
    ):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        # In-memory pipeline cache for lookahead double-buffered messages: (key -> payload)
        self._lookahead_cache: Dict[str, Dict[str, Any]] = {}

    def is_available(self) -> bool:
        """Returns True if a valid Gemini API key is configured."""
        return bool(self.api_key and len(self.api_key.strip()) > 10)

    def _build_prompt(
        self,
        astronaut_name: str,
        telemetry: Dict[str, Any],
        severity: str,
        reason: str,
        stage_index: int = 0
    ) -> str:
        """Constructs an information-dense clinical telemetry prompt for Gemini."""
        hr = telemetry.get("heart_rate", "nominal")
        hrv = telemetry.get("hrv_rmssd", "nominal")
        spo2 = telemetry.get("spo2", "nominal")
        k = telemetry.get("potassium", "nominal")
        co2 = telemetry.get("cabin_co2", "nominal")
        qtc = telemetry.get("computed_qtc", "nominal")
        arf = telemetry.get("computed_arf", "nominal")
        trm = telemetry.get("computed_trm", "nominal")
        epi = telemetry.get("computed_epi", "nominal")
        rsi = telemetry.get("computed_rsi", "nominal")
        rad_flux = telemetry.get("radiation_flux", "nominal")

        stage_context = ""
        if stage_index > 0:
            stage_context = (
                f"This is Progressive Follow-up Stage {stage_index} (16 seconds after initial detection). "
                f"Give an updated situational status report on how the astronaut's condition is evolving, "
                f"referencing ongoing stabilization or next medical protocol steps."
            )
        else:
            stage_context = (
                "This is the immediate initial detection. Clearly state the exact physiological anomaly, "
                "the key numbers, and the immediate countermeasure."
            )

        return (
            f"Astronaut: {astronaut_name}\n"
            f"Alert Severity: {severity}\n"
            f"Clinical Diagnostic Trigger: {reason}\n"
            f"Live Biometrics: HR={hr} bpm, HRV={hrv} ms, SpO2={spo2}%, Potassium={k} mmol/L, "
            f"Cabin CO2={co2} mmHg, QTc={qtc} ms, ARF={arf}, TRM={trm}, EPI={epi}, RSI={rsi}, Flux={rad_flux} mGy/h.\n"
            f"Context: {stage_context}\n\n"
            f"Generate the exact two-sentence conversational spoken statement for JARVIS to speak right now."
        )

    async def generate_clinical_triage(
        self,
        astronaut_name: str,
        telemetry: Dict[str, Any],
        severity: str,
        reason: str,
        stage_index: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Asynchronously generates a natural, clinically grounded 2-sentence voice advisory via Gemini API.
        Checks lookahead cache first for instantaneous sub-1ms delivery.
        """
        cache_key = f"{astronaut_name}_{severity}_{stage_index}_{reason[:30]}"
        if cache_key in self._lookahead_cache:
            cached = self._lookahead_cache.pop(cache_key)
            return cached

        if not self.is_available():
            return None

        prompt = self._build_prompt(astronaut_name, telemetry, severity, reason, stage_index)
        url = f"{self.base_url}/{self.model}:generateContent?key={self.api_key}"

        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": JARVIS_GEMINI_SYSTEM_INSTRUCTION}]
            },
            "generationConfig": {
                "temperature": 0.25,
                "maxOutputTokens": 100,
                "topP": 0.95
            }
        }

        start_t = time.time()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            raw_text = parts[0].get("text", "").strip()
                            clean_text = self._clean_gemini_output(raw_text, astronaut_name)
                            dur_ms = round((time.time() - start_t) * 1000, 1)
                            return {
                                "spoken_text": clean_text,
                                "source": f"GEMINI_{self.model.upper()}",
                                "is_fallback": False,
                                "duration_ms": dur_ms
                            }
        except Exception:
            pass

        return None

    def queue_lookahead_pregeneration(
        self,
        astronaut_name: str,
        telemetry: Dict[str, Any],
        severity: str,
        reason: str,
        next_stage_index: int
    ) -> None:
        """
        Speculative Lookahead Pipeline:
        While Message N is transmitting / speaking in the browser, speculatively pre-generates
        Message N+1 in the background so that future progressive follow-ups have ZERO latency.
        """
        if not self.is_available():
            return

        async def _run_pregen():
            cache_key = f"{astronaut_name}_{severity}_{next_stage_index}_{reason[:30]}"
            res = await self.generate_clinical_triage(
                astronaut_name=astronaut_name,
                telemetry=telemetry,
                severity=severity,
                reason=reason,
                stage_index=next_stage_index
            )
            if res:
                self._lookahead_cache[cache_key] = res

        asyncio.create_task(_run_pregen())

    def _clean_gemini_output(self, text: str, required_name: str) -> str:
        """Cleans markdown, formatting artifacts, and ensures exactly 2 spoken sentences."""
        cleaned = re.sub(r"\*\*|\*|`|#|\"", "", text).strip()
        cleaned = re.sub(r"^(?:JARVIS:|AI:|Response:|Directive:)\s*", "", cleaned, flags=re.IGNORECASE).strip()

        # Split on sentence boundaries
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", cleaned) if s.strip()]
        if len(sentences) >= 2:
            final_text = f"{sentences[0]} {sentences[1]}"
        elif len(sentences) == 1:
            final_text = sentences[0]
        else:
            final_text = cleaned

        # Ensure astronaut name is present
        if required_name and required_name.lower() not in final_text.lower():
            final_text = f"{required_name}, {final_text}"

        return final_text
