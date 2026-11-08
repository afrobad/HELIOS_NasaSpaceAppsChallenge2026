# HELIOS Local AI & Offline Setup Guide

## 1. Zero-Cloud Spaceflight Operational Invariant
Deep space exploration (Earth-Moon L2, Lunar Gateway, Mars Transit) operates across distance delays ranging from 1.3 seconds (Lunar) to 24+ minutes (Mars one-way, 48+ minutes round-trip). Under standard spaceflight conditions, relying on terrestrial cloud infrastructure (e.g., cloud-hosted LLMs, remote speech APIs, or centralized databases) is a catastrophic mission hazard.

**HELIOS enforces a strict 100% Zero-Cloud Invariant:**
- **Zero Remote Dependencies:** All clinical detection, alert prioritization, speech synthesis, and telemetry logging run natively on edge avionics (Linux/x86_64 or ARM64).
- **Sub-100ms Deterministic Sentry Matrix:** Clinical alarming uses deterministic closed-loop mathematical modeling (Z-Score deviation vectors, NASA-STD-3001 threshold fences) rather than stochastic LLMs.
- **Fail-Safe Offline Mode:** If optional local inference engines are uninitialized or experiencing GPU contention, HELIOS automatically falls back to deterministic pre-compiled aerospace voice templates (`FALLBACK_VOICE_SCRIPTS`) with zero degradation in crew life safety.

---

## 2. Local Architecture Topology

```
+--------------------------------------------------------------------------+
|                       HELIOS ONBOARD EDGE AVIONICS                       |
+--------------------------------------------------------------------------+
|  [Edge Sensors / Bio-Harness / ECLSS Buses]                             |
|          | (10 Hz Telemetry Stream via RS-422 / UDP / MIL-STD-1553)       |
|          v                                                               |
|  [FastAPI Asynchronous Gateway & In-Memory Ring Buffers]                 |
|          |                                                               |
|          +---> [Deterministic Sentry Matrix (NASA-STD-3001)] (<=25ms)    |
|          |           |                                                   |
|          |           +---> [Immediate Critical Alert Dispatch]          |
|          |           +---> [SQLite WAL Telemetry Store (Local Disk)]     |
|          |                                                               |
|          +---> [Local Speech & Audio Engine]                             |
|          |           |                                                   |
|          |           +---> Fast-Path: Pre-compiled Aerospace WAVs (0ms) |
|          |           +---> Dynamic: Local Edge TTS Piper / Kokoro (95ms) |
|          |                                                               |
|          +---> [Local Medical LLM Inference: Optional Advisory Only]     |
|                      |                                                   |
|                      +---> Ollama / llama.cpp / ONNX Runtime             |
|                      +---> Model: BioMistral-7B / MedGemma-4B (4-bit)    |
|                      +---> Non-blocking background worker thread          |
+--------------------------------------------------------------------------+
```

---

## 3. Hardware Requirements & Edge Sizing

| Component | Minimum Flight Edge (Gateway/Suit) | Recommended Habitat Workstation (Orion/Transit) |
| :--- | :--- | :--- |
| **CPU** | 4-Core x86_64 / ARM Cortex-A78 | 8-Core AMD Ryzen Embedded / Apple Silicon / Intel i7 |
| **RAM** | 8 GB LPDDR4x | 16–32 GB DDR5 ECC |
| **Storage** | 16 GB NVMe (eMMC Class 10+) | 128 GB NVMe Solid-State Storage |
| **GPU / NPU** | Integrated graphics / CPU only | 6 GB VRAM (RTX 3060 Mobile, Jetson Orin Nano, or NPU) |
| **OS** | Linux (Ubuntu 22.04 LTS / Debian 12 / Rocky Linux) | Linux / Windows 11 WSL2 / macOS Darwin |

---

## 4. Local Tooling & Model Setup

### A. Environment Configuration
Set the mandatory zero-cloud environment variable to guarantee offline safety:
```bash
export HELIOS_ZERO_CLOUD=1
export HELIOS_LOCAL_TTS=1
export HELIOS_DATABASE_PATH="./backend/data/helios_telemetry.db"
```

### B. Local Advisory LLM (Optional Advisory Tier)
Install Ollama or llama.cpp for fully offline edge clinical advisory:
```bash
# 1. Install Ollama locally
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull edge-quantized medical model (BioMistral 7B quantized 4-bit)
ollama pull biomistral:7b-q4_K_M

# 3. Configure backend endpoint in backend/.env
HELIOS_OLLAMA_URL="http://localhost:11434"
HELIOS_LOCAL_MODEL="biomistral:7b-q4_K_M"
```

### C. Local Edge TTS & Jarvis Voice
HELIOS provides a dual-mode voice pipeline:
1. **Zero-Latency Cached Path (Default):** Pre-synthesized NASA Standard-3001 tactical alerts stored directly in `frontend/public/audio/alerts/`.
2. **Local Piper TTS Edge Engine:**
   ```bash
   pip install piper-tts
   # Voice model: en_US-lessac-medium (40MB, 120ms latency on CPU)
   ```

---

## 5. Offline Integrity Verification
Execute the offline test suite to ensure no network calls are initiated under any scenario:
```bash
# Runs full zero-cloud verification suite
python -m unittest backend/tests/test_offline_verification.py
```
Verification checks include:
1. Cloud API connectors return `is_available() == False` without hanging.
2. Simulated network disconnect causes zero dropped sensor frames.
3. Audio fallback triggers instantly when TTS service is unreachable.
4. SQLite WAL handles 1,000 continuous writes per second with sub-millisecond commit latency.

