# HELIOS Communication Resilience & Delay Modeling

## 1. Orbital Delay Regimes & Mission Scenarios
HELIOS models high-fidelity deep space communication dynamics across four operational orbits:

| Mission Phase / Orbit | Distance from Earth | One-Way Light Time (OWLT) | Round-Trip Delay (RTT) | Bandwidth & Link State |
| :--- | :--- | :--- | :--- | :--- |
| **Low Earth Orbit (LEO / ISS)** | 400 km | ~1.3 milliseconds | ~2.6 milliseconds | High Bandwidth (TDRSS Ka/Ku-band, 150 Mbps) |
| **Lunar Vicinity (Artemis Gateway)** | ~384,400 km | ~1.28 seconds | ~2.56 seconds | Medium Bandwidth (Deep Space Network, 10–50 Mbps) |
| **Earth-Moon Lagrange 2 (EM-L2)** | ~449,000 km | ~1.50 seconds | ~3.00 seconds | DSN / Lunar Relay Satellite |
| **Mars Transit / Insertion** | 54.6M to 401M km | 3.0 to 22.3 minutes | 6.0 to 44.6 minutes | Low Bandwidth / High Latency (DSN 34m/70m, 50 kbps–2 Mbps) |

---

## 2. Delay-Tolerant Networking (DTN) Architecture

```
+-------------------------------------------------------------------------------+
|                        SPACECRAFT AUTONOMY (ORION / TRANSIT)                  |
+-------------------------------------------------------------------------------+
|  [Real-Time Telemetry Bus (10 Hz)]                                            |
|          |                                                                    |
|          v                                                                    |
|  [Onboard Sentry Engine: Autonomous Local Decision Loop]                     |
|          |                                                                    |
|          +---> Local Crew Triage Display (0 ms delay)                        |
|          |                                                                    |
|          v                                                                    |
|  [DTN Bundle Protocol Engine (RFC 5050 / CCSDS 734.2-B-1)]                    |
|          |                                                                    |
|          +---> Storage: Persistent SQLite WAL Bundle Custody Queue            |
|          +---> Priority Queuing: Tier 1 Critical > Tier 2 Warning > Bio-Log   |
|          +---> Compression: Delta-encoded biomarker packets (92% reduction)   |
+-------------------------------------------------------------------------------+
                                       |
                                       | [Deep Space Network (DSN) Radio Link]
                                       | Propagation Delay: T + 22.3 minutes
                                       v
+-------------------------------------------------------------------------------+
|                       MISSION CONTROL CENTER (EARTH MCC)                      |
+-------------------------------------------------------------------------------+
|  [Ingestion Gateway: Reconstitute Asynchronous Bundle Streams]               |
|  [Dual-Clock Timeline Engine: Spacecraft Event Time (SCET) vs Earth Time (ERT)]|
|  [MCC Asynchronous Consultation & Delayed Telemedical Uplink]                |
+-------------------------------------------------------------------------------+
```

---

## 3. Communication Blackout & Solar Conjunction Resilience
During **Solar Conjunction** (occurring every 26 months for Mars missions), the Sun sits directly between Earth and Mars, creating complete radio silence lasting 10 to 14 days.

### HELIOS Autonomy Strategy During Radio Silence:
1. **Full Onboard Sovereignty:** The Sentry Matrix and Chief Medical Officer interface operate completely independent of Earth Ground Control.
2. **Local Bundling & Storage:** High-rate sensor telemetry is compressed and retained on local solid-state storage with verifiable cryptographic checksums.
3. **Automated Catch-Up Transmission:** Upon re-establishing carrier signal lock, high-priority clinical incident snapshots are transmitted first, followed by downsampled baseline logs.
4. **Dual Time Representation:** The user interface explicitly presents both Earth Received Time (ERT) and Spacecraft Event Time (SCET) to eliminate temporal disorientation among flight controllers.

