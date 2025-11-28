import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";

const FASTAPI_BASE = process.env.FASTAPI_BASE || "http://localhost:8000";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/prompts", async (req: Request, res: Response) => {
    try {
      const response = await fetch(`${FASTAPI_BASE}/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        throw new Error(`FastAPI responded with status ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error proxying to /prompts:", error);
      res.status(503).json({ error: "Backend unavailable" });
    }
  });

  app.get("/api/runs/:runId", async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const response = await fetch(`${FASTAPI_BASE}/runs/${runId}`);

      if (!response.ok) {
        throw new Error(`FastAPI responded with status ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error proxying to /runs:", error);
      res.status(503).json({ error: "Backend unavailable" });
    }
  });

  app.get("/api/leaderboard", async (req: Request, res: Response) => {
    try {
      const response = await fetch(`${FASTAPI_BASE}/leaderboard`);

      if (!response.ok) {
        throw new Error(`FastAPI responded with status ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error proxying to /leaderboard:", error);
      res.status(503).json({ error: "Backend unavailable" });
    }
  });

  return httpServer;
}
