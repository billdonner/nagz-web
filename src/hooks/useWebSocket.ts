import { useEffect, useRef, useState, useCallback } from "react";
import { getStoredToken } from "../auth";

/** Event types received from the server WebSocket. */
export type NagEventType =
  | "nag_created"
  | "nag_updated"
  | "nag_status_changed"
  | "excuse_submitted"
  | "member_added"
  | "member_removed";

export interface NagWsEvent {
  event: NagEventType;
  family_id: string;
  actor_id: string | null;
  data: Record<string, unknown>;
  ts: string;
}

interface UseWebSocketReturn {
  /** Whether the WebSocket is currently connected. */
  isConnected: boolean;
  /** The most recently received event (null if none yet). */
  lastEvent: NagWsEvent | null;
  /** Sequence number that increments on every event (useful as a refresh key). */
  eventCount: number;
}

const RECONNECT_DELAY_INITIAL = 1000;
const RECONNECT_DELAY_MAX = 30000;
const PING_INTERVAL = 25000;

/**
 * React hook for real-time WebSocket events from the nagzerver.
 *
 * Connects to `ws(s)://server/api/v1/ws?token=...&family_id=...`,
 * auto-reconnects with exponential backoff, and provides the latest event.
 *
 * Usage:
 * ```tsx
 * const { lastEvent, eventCount } = useWebSocket(familyId);
 * useEffect(() => { reload(); }, [eventCount]);
 * ```
 */
export function useWebSocket(familyId: string | null): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<NagWsEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_INITIAL);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldReconnectRef = useRef(true);

  const cleanup = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!familyId) return;

    const token = getStoredToken();
    if (!token) return;

    // Build WebSocket URL from the API base URL
    const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:9800";
    const wsBase = apiBase
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");
    const url = `${wsBase}/api/v1/ws?token=${encodeURIComponent(token)}&family_id=${familyId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectDelayRef.current = RECONNECT_DELAY_INITIAL;

      // Start ping interval
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as { event: string } & Record<string, unknown>;
        // Ignore ping/pong
        if (parsed.event === "ping" || parsed.event === "pong") return;

        const event = parsed as unknown as NagWsEvent;
        setLastEvent(event);
        setEventCount((c) => c + 1);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }

      if (shouldReconnectRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            RECONNECT_DELAY_MAX
          );
          connect();
        }, reconnectDelayRef.current);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnect
    };
  }, [familyId]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return { isConnected, lastEvent, eventCount };
}
