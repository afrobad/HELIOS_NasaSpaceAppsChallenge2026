"""
backend/app/core/baselines.py
Loads NASA OSDR spaceflight baseline profiles and manages astronaut-specific parameters.
"""

import os
import json
from typing import Dict, Any, Optional

DEFAULT_BASELINES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data",
    "nasa_astronaut_baselines.json"
)

class BaselineManager:
    """Manages crew baseline distributions derived from NASA spaceflight data."""

    def __init__(self, baselines_path: str = DEFAULT_BASELINES_PATH):
        self.baselines_path = baselines_path
        self.crew_profiles: Dict[str, Any] = {}
        self.environmental_baselines: Dict[str, Any] = {}
        self.load_baselines()

    def load_baselines(self) -> None:
        if not os.path.exists(self.baselines_path):
            raise FileNotFoundError(f"NASA baseline configuration not found at {self.baselines_path}")

        with open(self.baselines_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.crew_profiles = data.get("crew_profiles", {})
        self.environmental_baselines = data.get("environmental_baselines", {})

    def get_astronaut_baseline(self, astronaut_id: str, mission_state: str = "REST") -> Dict[str, Dict[str, float]]:
        """
        Retrieves the baseline parameters (mean, std) for a given astronaut and state.
        Falls back to REST if the requested mission state is not defined.
        """
        profile = self.crew_profiles.get(astronaut_id)
        if not profile:
            # Fallback to first available profile if ID is unrecognized
            profile = next(iter(self.crew_profiles.values())) if self.crew_profiles else {}

        baselines = profile.get("baselines", {})
        state_baseline = baselines.get(mission_state) or baselines.get("REST", {})
        return state_baseline

    def get_astronaut_ids(self) -> list:
        return list(self.crew_profiles.keys())
