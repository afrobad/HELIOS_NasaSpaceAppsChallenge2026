/**
 * frontend/src/services/websocketService.ts
 * Resilient real-time WebSocket connection to the 10 Hz telemetry sentry stream.
 */

import type { TelemetryPacket, AlertPayload } from '../types/telemetry';

type TelemetryListener = (packet: TelemetryPacket) => void;
type AlertListener = (alert: AlertPayload) => void;
type StatusListener = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectTimer: number | null = null;
  private reconnectAttempts: number = 0;
  private pingInterval: number | null = null;
  private isExplicitClose: boolean = false;

  private telemetryListeners: Set<TelemetryListener> = new Set();
  private alertListeners: Set<AlertListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  public connect(customUrl?: string): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitClose = false;

    if (customUrl) {
      this.url = customUrl;
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const host = (isLocalDev && window.location.port !== '8000') ? `${window.location.hostname}:8000` : window.location.host;
      this.url = `${protocol}//${host}/ws/telemetry`;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus(true);
        this.startKeepalive();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (event.data === 'PONG') return;

        try {
          const raw = JSON.parse(event.data);
          if (raw.type === 'ALERT' || raw.type === 'PROACTIVE_ALERT' || raw.tone || raw.speech_text) {
            this.notifyAlert(raw.data || raw.payload || raw);
          } else if (raw.type === 'TELEMETRY_FRAME' && raw.data) {
            this.notifyTelemetry(raw.data);
          } else {
            this.notifyTelemetry(raw);
          }
        } catch {
          // Non-JSON frame
        }
      };

      this.ws.onclose = () => {
        this.notifyStatus(false);
        this.stopKeepalive();
        if (!this.isExplicitClose) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.notifyStatus(false);
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitClose = true;
    this.reconnectAttempts = 0;
    this.stopKeepalive();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus(false);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    // Exponential backoff: 2s -> 3s -> 4.5s -> 6.7s -> 10s -> max 25s
    const delay = Math.min(25000, Math.round(2000 * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 6))));
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('PING');
      }
    }, 10000);
  }

  private stopKeepalive(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  public subscribeAlert(listener: AlertListener): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyTelemetry(packet: TelemetryPacket): void {
    this.telemetryListeners.forEach((fn) => fn(packet));
  }

  private notifyAlert(alert: AlertPayload): void {
    this.alertListeners.forEach((fn) => fn(alert));
  }

  private notifyStatus(connected: boolean): void {
    this.statusListeners.forEach((fn) => fn(connected));
  }
}

export const wsService = new WebSocketService();
