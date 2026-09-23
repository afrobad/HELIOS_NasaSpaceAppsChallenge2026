"""
Unit and Edge-Case Tests for BoundedTelemetryBuffer.
Verifies O(1) bounded memory, FIFO eviction, and vector conversion.
"""

import unittest
import numpy as np
from backend.app.core.circular_buffer import BoundedTelemetryBuffer


class TestBoundedTelemetryBuffer(unittest.TestCase):

    def setUp(self):
        # Buffer of 10 seconds @ 10 Hz = capacity 100
        self.buffer = BoundedTelemetryBuffer(max_seconds=10, sample_rate_hz=10)

    def test_capacity_and_eviction(self):
        """Pushes 150 items into capacity 100 buffer. Verifies length is 100 and oldest are evicted."""
        for i in range(150):
            self.buffer.append({"tick": i, "heart_rate": 60.0 + i})

        self.assertEqual(len(self.buffer), 100)
        latest = self.buffer.get_latest()
        self.assertIsNotNone(latest)
        self.assertEqual(latest["tick"], 149)

        # Oldest should now be tick 50 (0 to 49 evicted)
        vec = self.buffer.get_recent_vector("tick", seconds=10)
        self.assertEqual(len(vec), 100)
        self.assertEqual(vec[0], 50)
        self.assertEqual(vec[-1], 149)

    def test_empty_buffer_safety(self):
        """Edge case: Empty buffer returns empty vector without exceptions."""
        empty_buf = BoundedTelemetryBuffer(max_seconds=5, sample_rate_hz=10)
        self.assertEqual(len(empty_buf), 0)
        self.assertIsNone(empty_buf.get_latest())
        vec = empty_buf.get_recent_vector("heart_rate", seconds=5)
        self.assertIsInstance(vec, np.ndarray)
        self.assertEqual(len(vec), 0)

    def test_invalid_type_rejection(self):
        """Edge case: Non-dict inputs are rejected with TypeError."""
        with self.assertRaises(TypeError):
            self.buffer.append("invalid_string_not_dict") # type: ignore

    def test_missing_and_nan_fields(self):
        """Edge case: Gracefully handles missing fields and NaN values."""
        self.buffer.append({"tick": 1, "heart_rate": 62.0})
        self.buffer.append({"tick": 2}) # heart_rate missing
        self.buffer.append({"tick": 3, "heart_rate": float("nan")}) # NaN value
        self.buffer.append({"tick": 4, "heart_rate": 64.0})

        vec = self.buffer.get_recent_vector("heart_rate", seconds=1)
        self.assertEqual(len(vec), 2)
        self.assertEqual(vec[0], 62.0)
        self.assertEqual(vec[1], 64.0)


if __name__ == "__main__":
    unittest.main()
