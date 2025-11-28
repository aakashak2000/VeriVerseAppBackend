import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { log } from "./index";

const FASTAPI_BASE = process.env.FASTAPI_BASE || "http://localhost:8000";
const POLL_INTERVAL = 2000; // Poll every 2 seconds for active runs

const subscriptions: Map<string, Set<WebSocket>> = new Map();
const runCache: Map<string, any> = new Map(); // Cache last known state to detect changes
let wss: WebSocketServer;
let pollIntervalId: NodeJS.Timeout | null = null;

export function setupWebSocket(httpServer: Server) {
  wss = new WebSocketServer({ 
    server: httpServer,
    path: "/ws"
  });

  wss.on("connection", (ws) => {
    log("WebSocket client connected", "ws");

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "subscribe" && data.runId) {
          subscribeToRun(data.runId, ws);
          log(`Client subscribed to run: ${data.runId}`, "ws");
        }
        
        if (data.type === "unsubscribe" && data.runId) {
          unsubscribeFromRun(data.runId, ws);
          log(`Client unsubscribed from run: ${data.runId}`, "ws");
        }
      } catch (err) {
        log(`Error parsing WebSocket message: ${err}`, "ws");
      }
    });

    ws.on("close", () => {
      log("WebSocket client disconnected", "ws");
      // Clean up subscriptions for this client
      subscriptions.forEach((clients, runId) => {
        clients.delete(ws);
        if (clients.size === 0) {
          subscriptions.delete(runId);
          runCache.delete(runId);
        }
      });
    });

    ws.on("error", (err) => {
      log(`WebSocket error: ${err}`, "ws");
    });
  });

  // Start background polling for active subscriptions
  startBackgroundPolling();

  log("WebSocket server initialized on /ws", "ws");
  return wss;
}

function subscribeToRun(runId: string, ws: WebSocket) {
  if (!subscriptions.has(runId)) {
    subscriptions.set(runId, new Set());
  }
  subscriptions.get(runId)!.add(ws);
}

function unsubscribeFromRun(runId: string, ws: WebSocket) {
  const clients = subscriptions.get(runId);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) {
      subscriptions.delete(runId);
      runCache.delete(runId);
    }
  }
}

export function broadcastRunUpdate(runId: string, data: any) {
  const clients = subscriptions.get(runId);
  if (!clients || clients.size === 0) return;

  const message = JSON.stringify({
    type: "run_update",
    runId,
    data,
  });

  let sentCount = 0;
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      sentCount++;
    }
  });
  
  if (sentCount > 0) {
    log(`Broadcast update for run ${runId} to ${sentCount} client(s)`, "ws");
  }
}

export function getSubscriptionCount(runId: string): number {
  return subscriptions.get(runId)?.size || 0;
}

function getActiveRunIds(): string[] {
  return Array.from(subscriptions.keys()).filter(runId => {
    const clients = subscriptions.get(runId);
    return clients && clients.size > 0;
  });
}

async function pollRunStatus(runId: string): Promise<any | null> {
  try {
    const response = await fetch(`${FASTAPI_BASE}/runs/${runId}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    // FastAPI might be unavailable, silently ignore
    return null;
  }
}

function hasRunStateChanged(runId: string, newState: any): boolean {
  const cached = runCache.get(runId);
  if (!cached) return true;
  
  // Compare key fields to detect meaningful changes
  if (cached.status !== newState.status) return true;
  if (cached.confidence !== newState.confidence) return true;
  if (cached.provisional_answer !== newState.provisional_answer) return true;
  if (JSON.stringify(cached.votes) !== JSON.stringify(newState.votes)) return true;
  if (JSON.stringify(cached.evidence) !== JSON.stringify(newState.evidence)) return true;
  
  return false;
}

async function pollActiveRuns() {
  const activeRunIds = getActiveRunIds();
  
  for (const runId of activeRunIds) {
    // Skip demo runs
    if (runId.startsWith("demo_run_")) continue;
    
    const state = await pollRunStatus(runId);
    if (state && hasRunStateChanged(runId, state)) {
      // Update cache
      runCache.set(runId, state);
      
      // Broadcast to subscribers
      broadcastRunUpdate(runId, state);
      
      // Remove completed runs from cache after broadcasting final state
      if (state.status === "completed") {
        setTimeout(() => {
          runCache.delete(runId);
        }, 5000);
      }
    }
  }
}

function startBackgroundPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
  }
  
  pollIntervalId = setInterval(() => {
    const activeCount = getActiveRunIds().length;
    if (activeCount > 0) {
      pollActiveRuns().catch(err => {
        log(`Background poll error: ${err}`, "ws");
      });
    }
  }, POLL_INTERVAL);
  
  log("Background polling started", "ws");
}

export function stopBackgroundPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
    log("Background polling stopped", "ws");
  }
}
