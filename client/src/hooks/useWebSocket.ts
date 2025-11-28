import { useEffect, useRef, useCallback, useState } from "react";
import type { RunState } from "@shared/schema";

interface WebSocketMessage {
  type: string;
  runId: string;
  data: RunState;
}

interface UseWebSocketOptions {
  runId: string | null;
  onUpdate?: (data: RunState) => void;
  enabled?: boolean;
}

export function useWebSocket({ runId, onUpdate, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Use refs to track current values for callbacks to avoid stale closures
  const runIdRef = useRef(runId);
  const enabledRef = useRef(enabled);
  const onUpdateRef = useRef(onUpdate);
  
  // Keep refs in sync with props
  useEffect(() => {
    runIdRef.current = runId;
  }, [runId]);
  
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      const currentRunId = runIdRef.current;
      // Unsubscribe before closing
      if (currentRunId && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "unsubscribe",
          runId: currentRunId,
        }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    const currentRunId = runIdRef.current;
    const currentEnabled = enabledRef.current;
    
    if (!currentRunId || !currentEnabled) {
      disconnect();
      return;
    }

    // If already connected and subscribed to the same run, do nothing
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        
        const subRunId = runIdRef.current;
        if (subRunId) {
          // Subscribe to run updates
          ws.send(JSON.stringify({
            type: "subscribe",
            runId: subRunId,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          const currentRunId = runIdRef.current;
          
          if (message.type === "run_update" && message.runId === currentRunId) {
            setLastUpdate(new Date());
            onUpdateRef.current?.(message.data);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        wsRef.current = null;
        
        // Only reconnect if still enabled and have a valid runId
        const shouldReconnect = enabledRef.current && runIdRef.current;
        if (shouldReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
    }
  }, [disconnect]);

  // Effect to manage connection based on enabled/runId changes
  useEffect(() => {
    if (enabled && runId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, runId, connect, disconnect]);

  return {
    isConnected,
    lastUpdate,
    reconnect: connect,
  };
}
