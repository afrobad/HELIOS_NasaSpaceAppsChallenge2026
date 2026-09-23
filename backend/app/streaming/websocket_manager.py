"""
backend/app/streaming/websocket_manager.py
Manages real-time WebSocket connections and simulates deep-space communication delays.
"""

import asyncio
import json
from typing import Set, Dict, Any
from fastapi import WebSocket


class WebSocketManager:
    """Manages connected HUD clients and dispatches telemetry frames."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.mars_delay_enabled: bool = False
        self.simulated_delay_seconds: float = 22.0 * 60.0  # 22 minutes (1320s)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    def set_mars_delay(self, enabled: bool) -> None:
        self.mars_delay_enabled = enabled

    async def broadcast_telemetry(self, packet: Dict[str, Any]) -> None:
        """Dispatches telemetry packet to all connected clients."""
        if not self.active_connections:
            return

        payload = {
            "type": "TELEMETRY_FRAME",
            "data": packet,
            "mars_delay_active": self.mars_delay_enabled,
            "delay_seconds": self.simulated_delay_seconds if self.mars_delay_enabled else 0.0
        }
        text = json.dumps(payload)

        # Broadcast to all live sockets; prune dead sockets silently
        dead_sockets = set()
        for ws in list(self.active_connections):
            try:
                await ws.send_text(text)
            except Exception:
                dead_sockets.add(ws)

        for dead in dead_sockets:
            self.disconnect(dead)

    async def broadcast_alert(self, alert_payload: Dict[str, Any]) -> None:
        """Broadcasts high-priority proactive voice / klaxon alerts."""
        if not self.active_connections:
            return

        payload = {
            "type": "PROACTIVE_ALERT",
            "data": alert_payload
        }
        text = json.dumps(payload)
        for ws in list(self.active_connections):
            try:
                await ws.send_text(text)
            except Exception:
                self.disconnect(ws)
