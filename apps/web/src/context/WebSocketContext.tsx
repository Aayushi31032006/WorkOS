import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext.js";

export type WsStatus = "connected" | "reconnecting" | "offline";

interface WebSocketContextType {
  status: WsStatus;
  lastEvent: { type: string; payload: unknown; ts: string } | null;
  sendJson: (data: unknown) => void;
  subscribe: (conversationId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<WsStatus>("offline");
  const [lastEvent, setLastEvent] = useState<{ type: string; payload: unknown; ts: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!token) {
      setStatus("offline");
      return;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
    }

    setStatus("reconnecting");
    const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send auth frame explicitly as well for redundancy
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "auth_ack") {
          setStatus("connected");
        }
        setLastEvent({
          type: parsed.type ?? "message",
          payload: parsed,
          ts: new Date().toISOString(),
        });
      } catch {
        // ignore non-json
      }
    };

    ws.onclose = () => {
      setStatus("offline");
      if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, [connect]);

  const sendJson = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribe = useCallback((conversationId: string) => {
    sendJson({ type: "subscribe", conversationId });
  }, [sendJson]);

  return (
    <WebSocketContext.Provider value={{ status, lastEvent, sendJson, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return ctx;
}
