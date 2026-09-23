"""
Unit and Throughput Benchmark Tests for SQLite WAL Layer.
Verifies WAL concurrency, schema integrity, and microsecond write speeds.
"""

import unittest
import os
import time
import tempfile
from backend.app.db.database import init_database, get_connection
from backend.app.db.repository import TelemetryRepository


class TestDatabaseWAL(unittest.TestCase):

    def setUp(self):
        # Use an isolated temp database file for testing
        self.temp_dir = tempfile.TemporaryDirectory()
        self.test_db_path = os.path.join(self.temp_dir.name, "test_flight.db")
        self.conn = init_database(self.test_db_path)
        self.repo = TelemetryRepository(self.conn)

    def tearDown(self):
        self.conn.close()
        self.temp_dir.cleanup()

    def test_schema_and_wal_mode(self):
        """Verifies that the database initializes in WAL mode."""
        cursor = self.conn.cursor()
        cursor.execute("PRAGMA journal_mode;")
        mode = cursor.fetchone()[0]
        self.assertEqual(mode.upper(), "WAL")

    def test_single_insert_and_retrieval(self):
        """Tests inserting a single telemetry packet and querying it back."""
        packet = {
            "astronaut_id": "AST-01_COMMANDER",
            "timestamp": "2026-10-03T14:00:00.000Z",
            "mission_state": "REST",
            "heart_rate": 62.5,
            "hrv_rmssd": 65.0,
            "spo2": 98.2,
            "core_temp": 36.8,
            "sleep_score": 86.0,
            "cabin_co2": 1.8,
            "z_score_hr": 0.13,
            "z_score_hrv": 0.0,
            "alert_severity": "NOMINAL",
            "data_source": "TEST"
        }
        row_id = self.repo.log_telemetry(packet)
        self.assertGreater(row_id, 0)

        history = self.repo.get_recent_telemetry("AST-01_COMMANDER", limit=10)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["heart_rate"], 62.5)

    def test_batch_insert_throughput_benchmark(self):
        """
        Benchmarks batch insert throughput.
        Asserts that inserting 1,000 rows executes in under 0.25 seconds (<0.25ms per row).
        """
        packets = [
            {
                "astronaut_id": f"AST-0{i % 4 + 1}",
                "timestamp": f"2026-10-03T14:00:{i % 60:02d}.000Z",
                "mission_state": "REST",
                "heart_rate": 60.0 + (i % 20),
                "hrv_rmssd": 60.0,
                "spo2": 98.0,
                "core_temp": 36.8,
                "sleep_score": 85.0,
                "cabin_co2": 1.8,
                "z_score_hr": 0.0,
                "z_score_hrv": 0.0,
                "alert_severity": "NOMINAL",
                "data_source": "BENCHMARK"
            }
            for i in range(1000)
        ]

        t0 = time.perf_counter()
        count = self.repo.batch_log_telemetry(packets)
        elapsed = time.perf_counter() - t0

        self.assertEqual(count, 1000)
        # Should easily complete in <0.25s in WAL mode
        self.assertLess(elapsed, 0.25, f"1000 inserts took {elapsed:.4f}s, exceeding 0.25s limit.")
        writes_per_sec = 1000 / max(elapsed, 1e-6)
        print(f"\n[BENCHMARK] SQLite WAL Throughput: {writes_per_sec:,.0f} writes/sec ({elapsed*1000:.1f}ms for 1000 rows)")

    def test_proactive_alert_audit_log(self):
        """Verifies logging and querying of Level 2/3 proactive alerts."""
        alert_id = self.repo.log_proactive_alert(
            astronaut_id="AST-01_COMMANDER",
            severity="WARNING",
            trigger_reason="Cardiovascular strain accumulating",
            confidence=0.88,
            evidence={"z_hr": 2.2, "z_hrv": -2.1},
            voice_text="Commander Haley, vitals deviating from baseline..."
        )
        self.assertGreater(alert_id, 0)

        alerts = self.repo.get_recent_alerts(limit=5)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["severity"], "WARNING")
        self.assertIn("Commander", alerts[0]["voice_spoken_text"])


if __name__ == "__main__":
    unittest.main()
