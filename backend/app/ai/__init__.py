"""
backend/app/ai/__init__.py
Autonomous Clinical Decision Engine & JARVIS Voice Warning Subsystem.
"""

from .fallback_templates import FALLBACK_VOICE_SCRIPTS, get_fallback_script
from .clinical_prompts import JARVIS_SYSTEM_PROMPT, build_clinical_prompt
from .decision_engine import DecisionEngine
from .ollama_client import OllamaClient
from .voice_engine import VoiceEngine

__all__ = [
    "FALLBACK_VOICE_SCRIPTS",
    "get_fallback_script",
    "JARVIS_SYSTEM_PROMPT",
    "build_clinical_prompt",
    "DecisionEngine",
    "OllamaClient",
    "VoiceEngine",
]
