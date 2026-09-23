"""
backend/app/core/circular_buffer.py
O(1) Bounded circular memory ring buffer for high-frequency biosignals.
Guarantees constant memory consumption and zero memory leakage over long missions.
"""

from collections import deque
from typing import Dict, Any, List, Optional
import numpy as np


class BoundedTelemetryBuffer:
    """
    Fixed-size circular memory buffer.
    Guarantees O(1) push and O(1) eviction with zero memory growth over time.
    """
    def __init__(self, max_seconds: int = 360, sample_rate_hz: int = 10):
        if max_seconds <= 0 or sample_rate_hz <= 0:
            raise ValueError("max_seconds and sample_rate_hz must be positive integers.")
        self.max_seconds = max_seconds
        self.sample_rate_hz = sample_rate_hz
        self.capacity = max_seconds * sample_rate_hz
        self._buffer: deque = deque(maxlen=self.capacity)

    def append(self, telemetry_point: Dict[str, Any]) -> None:
        """Appends a new telemetry point; automatically evicts oldest when capacity is exceeded."""
        if not isinstance(telemetry_point, dict):
            raise TypeError("telemetry_point must be a dictionary.")
        self._buffer.append(telemetry_point)

    def get_latest(self) -> Optional[Dict[str, Any]]:
        """Returns the most recent telemetry point in O(1) time."""
        if not self._buffer:
            return None
        return self._buffer[-1]

    def get_recent_vector(self, field: str, seconds: int = 60) -> np.ndarray:
        """
        Extracts a NumPy vector of values for a specific field over the last N seconds.
        Safe against empty buffers and missing fields.
        """
        if not self._buffer:
            return np.empty(0, dtype=np.float32)

        n_samples = min(len(self._buffer), max(1, seconds * self.sample_rate_hz))
        # Efficient reverse slice extraction
        values = []
        for i in range(1, n_samples + 1):
            val = self._buffer[-i].get(field)
            if val is not None and isinstance(val, (int, float)) and not np.isnan(val):
                values.append(val)

        if not values:
            return np.empty(0, dtype=np.float32)

        # Reverse to chronological order [oldest ... newest]
        values.reverse()
        return np.array(values, dtype=np.float32)

    def __len__(self) -> int:
        return len(self._buffer)

    def clear(self) -> None:
        self._buffer.clear()
