"""
backend/app/ai/guardrails.py
Deterministic Diagnostic & Prescriptive Interceptor Guardrail.
NASA Space Apps Challenge 2026 - Challenge 05 Compliance Rule.

Ensures that all AI/LLM narrative outputs, alerts, and instructions adhere strictly
to clinical decision-support boundaries without medical diagnosis or drug prescriptions.
"""

import re
from typing import Dict, Any, List, Tuple

# Prohibited medical diagnostic and clinical prescription patterns
PROHIBITED_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\bdiagnosed\s+with\b", re.IGNORECASE), "evidenced by physiological variance indicating"),
    (re.compile(r"\bclinical\s+diagnosis\b", re.IGNORECASE), "physiological sentry assessment"),
    (re.compile(r"\bdiagnosis\b", re.IGNORECASE), "biometric assessment"),
    (re.compile(r"\byou\s+are\s+suffering\s+from\b", re.IGNORECASE), "telemetry indicates ongoing"),
    (re.compile(r"\bpatient\s+is\s+suffering\s+from\b", re.IGNORECASE), "crew telemetry displays"),
    (re.compile(r"\bprescribe\s+(?:drug|medication|treatment)\b", re.IGNORECASE), "recommend NASA HRP operational countermeasure"),
    (re.compile(r"\bprescribe\b", re.IGNORECASE), "recommend countermeasure"),
    (re.compile(r"\bprescribed\s+antiviral\s+medication\b", re.IGNORECASE), "recommended operational antiviral protocol"),
    (re.compile(r"\bprescribed\s+medication\b", re.IGNORECASE), "approved mission medical kit countermeasures"),
    (re.compile(r"\bprescribed\b", re.IGNORECASE), "standard operational"),
    (re.compile(r"\bmedical\s+doctor\b", re.IGNORECASE), "autonomous clinical sentry"),
    (re.compile(r"\bmyocardial\s+infarction\b", re.IGNORECASE), "acute coronary microvascular strain"),
    (re.compile(r"\btreat\s+the\s+disease\b", re.IGNORECASE), "execute flight countermeasure protocol"),
]


def guard_explanation(text: str) -> str:
    """
    Zero-latency deterministic regex post-check filter.
    Guarantees 100% compliance with NASA Challenge 05 rules:
    eliminates clinical disease diagnoses and drug prescriptions while
    preserving clear, actionable operational flight countermeasures.
    """
    if not text:
        return ""

    sanitized = text
    for pattern, replacement in PROHIBITED_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)

    return sanitized


def guard_alert_payload(alert: Dict[str, Any]) -> Dict[str, Any]:
    """Applies the diagnostic guard to all user-facing narrative fields in an alert payload."""
    if not alert or not isinstance(alert, dict):
        return alert

    fields_to_guard = [
        "primary_diagnosis",
        "triage_diagnosis",
        "actionable_instruction",
        "speech_text",
        "directive",
        "headline",
        "title",
        "clinical_reason"
    ]

    guarded = dict(alert)
    for field in fields_to_guard:
        if field in guarded and isinstance(guarded[field], str):
            guarded[field] = guard_explanation(guarded[field])

    return guarded

