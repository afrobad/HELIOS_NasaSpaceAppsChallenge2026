"""
backend/app/db/repository.py
High-throughput data access repository for telemetry ingestion and alert logging.
"""

import sqlite3
import json
from typing import Dict, Any, List, Optional
from .database import get_connection


class TelemetryRepository:
    """Repository handling CRUD operations for telemetry and proactive alerts."""

    def __init__(self, conn: Optional[sqlite3.Connection] = None):
        self.conn = conn or get_connection()

    def log_telemetry(self, packet: Dict[str, Any]) -> int:
        """Inserts a single telemetry packet in sub-millisecond time."""
        sql = """
        INSERT INTO telemetry_log (
            astronaut_id, timestamp, mission_state, heart_rate, hrv_rmssd,
            spo2, core_temp, sleep_score, cabin_co2,
            potassium, hematocrit, wbc_count, il_6, platelet_count, crp,
            radiation_flux, lymphocyte_count, radiation_dose_gy,
            computed_qtc, computed_epi, computed_arf, computed_trm, computed_rsi,
            z_score_hr, z_score_hrv, alert_severity, data_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        cursor = self.conn.cursor()
        cursor.execute(sql, (
            packet["astronaut_id"],
            packet["timestamp"],
            packet.get("mission_state", "REST"),
            packet["heart_rate"],
            packet["hrv_rmssd"],
            packet["spo2"],
            packet["core_temp"],
            packet["sleep_score"],
            packet["cabin_co2"],
            packet.get("potassium"),
            packet.get("hematocrit"),
            packet.get("wbc_count"),
            packet.get("il_6"),
            packet.get("platelet_count"),
            packet.get("crp"),
            packet.get("radiation_flux"),
            packet.get("lymphocyte_count"),
            packet.get("radiation_dose_gy"),
            packet.get("computed_qtc"),
            packet.get("computed_epi"),
            packet.get("computed_arf"),
            packet.get("computed_trm"),
            packet.get("computed_rsi"),
            packet.get("z_score_hr", 0.0),
            packet.get("z_score_hrv", 0.0),
            packet.get("alert_severity", "NOMINAL"),
            packet.get("data_source", "REAL_NASA_DERIVED_10HZ_STREAM")
        ))
        self.conn.commit()
        return cursor.lastrowid or 0

    def batch_log_telemetry(self, packets: List[Dict[str, Any]]) -> int:
        """Executes a high-speed multi-row batch insert inside a single transaction."""
        if not packets:
            return 0

        sql = """
        INSERT INTO telemetry_log (
            astronaut_id, timestamp, mission_state, heart_rate, hrv_rmssd,
            spo2, core_temp, sleep_score, cabin_co2,
            potassium, hematocrit, wbc_count, il_6, platelet_count, crp,
            radiation_flux, lymphocyte_count, radiation_dose_gy,
            computed_qtc, computed_epi, computed_arf, computed_trm, computed_rsi,
            z_score_hr, z_score_hrv, alert_severity, data_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        rows = [
            (
                p["astronaut_id"],
                p["timestamp"],
                p.get("mission_state", "REST"),
                p["heart_rate"],
                p["hrv_rmssd"],
                p["spo2"],
                p["core_temp"],
                p["sleep_score"],
                p["cabin_co2"],
                p.get("potassium"),
                p.get("hematocrit"),
                p.get("wbc_count"),
                p.get("il_6"),
                p.get("platelet_count"),
                p.get("crp"),
                p.get("radiation_flux"),
                p.get("lymphocyte_count"),
                p.get("radiation_dose_gy"),
                p.get("computed_qtc"),
                p.get("computed_epi"),
                p.get("computed_arf"),
                p.get("computed_trm"),
                p.get("computed_rsi"),
                p.get("z_score_hr", 0.0),
                p.get("z_score_hrv", 0.0),
                p.get("alert_severity", "NOMINAL"),
                p.get("data_source", "REAL_NASA_DERIVED_10HZ_STREAM")
            )
            for p in packets
        ]

        cursor = self.conn.cursor()
        cursor.executemany(sql, rows)
        self.conn.commit()
        return len(rows)

    def log_proactive_alert(
        self,
        astronaut_id: str,
        severity: str,
        trigger_reason: str,
        confidence: float,
        evidence: Dict[str, Any],
        voice_text: Optional[str] = None
    ) -> int:
        """Audits a proactive alert event with its multi-signal evidence payload."""
        sql = """
        INSERT INTO proactive_alerts (
            astronaut_id, severity, trigger_reason, confidence, evidence_json, voice_spoken_text
        ) VALUES (?, ?, ?, ?, ?, ?)
        """
        cursor = self.conn.cursor()
        cursor.execute(sql, (
            astronaut_id,
            severity,
            trigger_reason,
            confidence,
            json.dumps(evidence),
            voice_text or ""
        ))
        self.conn.commit()
        return cursor.lastrowid or 0

    def get_recent_telemetry(self, astronaut_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM telemetry_log
        WHERE astronaut_id = ?
        ORDER BY id DESC
        LIMIT ?
        """
        cursor = self.conn.cursor()
        cursor.execute(sql, (astronaut_id, limit))
        rows = cursor.fetchall()
        return [dict(row) for row in reversed(rows)]

    def get_recent_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        sql = """
        SELECT * FROM proactive_alerts
        ORDER BY id DESC
        LIMIT ?
        """
        cursor = self.conn.cursor()
        cursor.execute(sql, (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
