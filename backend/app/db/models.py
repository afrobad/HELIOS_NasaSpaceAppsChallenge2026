"""
backend/app/db/models.py
SQL DDL Schemas for the SQLite WAL Database.
Tables: telemetry_log, personal_baselines, proactive_alerts.
"""

SCHEMA_DDL = """
-- 1. High-frequency telemetry log (indexed by astronaut & timestamp)
CREATE TABLE IF NOT EXISTS telemetry_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    mission_state TEXT NOT NULL,
    heart_rate REAL NOT NULL,
    hrv_rmssd REAL NOT NULL,
    spo2 REAL NOT NULL,
    core_temp REAL NOT NULL,
    sleep_score REAL NOT NULL,
    cabin_co2 REAL NOT NULL,
    potassium REAL,
    hematocrit REAL,
    wbc_count REAL,
    il_6 REAL,
    platelet_count REAL,
    crp REAL,
    radiation_flux REAL,
    lymphocyte_count REAL,
    radiation_dose_gy REAL,
    computed_qtc REAL,
    computed_epi REAL,
    computed_arf REAL,
    computed_trm REAL,
    computed_rsi REAL,
    z_score_hr REAL,
    z_score_hrv REAL,
    alert_severity TEXT NOT NULL,
    data_source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON telemetry_log(astronaut_id, timestamp);


-- 2. Astronaut Personal Baselines
CREATE TABLE IF NOT EXISTS personal_baselines (
    astronaut_id TEXT NOT NULL,
    mission_state TEXT NOT NULL,
    mean_hr REAL NOT NULL,
    std_hr REAL NOT NULL,
    mean_hrv REAL NOT NULL,
    std_hrv REAL NOT NULL,
    mean_spo2 REAL NOT NULL,
    std_spo2 REAL NOT NULL,
    mean_temp REAL NOT NULL,
    std_temp REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (astronaut_id, mission_state)
);

-- 3. Proactive Alert & Event Audit Log
CREATE TABLE IF NOT EXISTS proactive_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    severity TEXT NOT NULL,
    trigger_reason TEXT NOT NULL,
    confidence REAL NOT NULL,
    evidence_json TEXT NOT NULL,
    voice_spoken_text TEXT,
    acknowledged BOOLEAN DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_alerts_sev ON proactive_alerts(severity, timestamp);
"""
