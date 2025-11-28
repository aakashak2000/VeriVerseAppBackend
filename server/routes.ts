import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { signupUserSchema, insertCommunityNoteSchema, type ClaimHistoryItem, type Vote, type CreateClaimRequest, type AddNoteRequest } from "@shared/schema";
import { z } from "zod";

const FASTAPI_BASE = process.env.FASTAPI_BASE || "http://localhost:8000";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Claims history for authenticated users
  app.get('/api/claims/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const claims = await storage.getUserClaims(userId);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching claims history:", error);
      res.status(500).json({ message: "Failed to fetch claims history" });
    }
  });

  // Create a new claim (proxy to FastAPI and store in DB)
  app.post("/api/prompts", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      
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
      
      // Store claim in database if user is authenticated
      if (userId) {
        await storage.createClaim({
          userId,
          prompt: req.body.prompt,
          runId: data.run_id,
          status: data.status,
        });
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error proxying to /prompts:", error);
      res.status(503).json({ error: "Backend unavailable" });
    }
  });

  // Get run status (proxy to FastAPI and update DB)
  app.get("/api/runs/:runId", async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;
      const response = await fetch(`${FASTAPI_BASE}/runs/${runId}`);

      if (!response.ok) {
        throw new Error(`FastAPI responded with status ${response.status}`);
      }

      const data = await response.json();
      
      // Update claim in database
      const existingClaim = await storage.getClaimByRunId(runId);
      if (existingClaim) {
        await storage.updateClaim(existingClaim.id, {
          status: data.status,
          provisionalAnswer: data.provisional_answer,
          confidence: data.confidence,
          evidence: data.evidence,
          votes: data.votes,
        });
      }
      
      res.json(data);
    } catch (error) {
      console.error("Error proxying to /runs:", error);
      res.status(503).json({ error: "Backend unavailable" });
    }
  });

  // Get leaderboard (proxy to FastAPI)
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

  // Create or update user (custom signup)
  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const parsed = signupUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parsed.error.errors 
        });
      }

      const user = await storage.createUserFromSignup(parsed.data);
      res.json({ user_id: user.id, ...user });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Get user by ID
  app.get("/api/users/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Get user history
  app.get("/api/users/:userId/history", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const claims = await storage.getUserClaims(userId);
      
      const history: ClaimHistoryItem[] = claims.map(claim => ({
        id: claim.id,
        run_id: claim.runId,
        prompt: claim.prompt,
        status: claim.status || "queued",
        provisional_answer: claim.provisionalAnswer,
        confidence: claim.confidence || 0,
        vote_count: (claim.votes as Vote[] || []).length,
        created_at: claim.createdAt?.toISOString() || new Date().toISOString(),
      }));
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching user history:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // ========== COMMUNITY FEED ROUTES ==========

  // Get all claims for the feed
  app.get("/api/claims", async (req: Request, res: Response) => {
    try {
      const sort = (req.query.sort as string) === "latest" ? "latest" : "relevant";
      const userId = req.query.userId as string | undefined;
      
      const claims = await storage.getAllClaims(sort, userId);
      res.json(claims);
    } catch (error) {
      console.error("Error fetching claims:", error);
      res.status(500).json({ error: "Failed to fetch claims" });
    }
  });

  // Create a new claim for the feed
  app.post("/api/claims", async (req: Request, res: Response) => {
    try {
      const createClaimSchema = z.object({
        user_id: z.string().min(1),
        text: z.string().min(1),
        topics: z.array(z.string()).optional().default([]),
        location: z.string().optional(),
      });

      const parsed = createClaimSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parsed.error.errors 
        });
      }

      const { user_id, text, topics, location } = parsed.data;

      const claim = await storage.createClaim({
        userId: user_id,
        prompt: text,
        topics: topics,
        location: location || null,
      });

      res.json({ claim_id: claim.id });
    } catch (error) {
      console.error("Error creating claim:", error);
      res.status(500).json({ error: "Failed to create claim" });
    }
  });

  // Add a community note to a claim
  app.post("/api/claims/:claimId/notes", async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      
      const addNoteSchema = z.object({
        user_id: z.string().min(1),
        note: z.string().min(1).max(500),
      });

      const parsed = addNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parsed.error.errors 
        });
      }

      const { user_id, note } = parsed.data;

      const claim = await storage.getClaim(claimId);
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      const communityNote = await storage.addCommunityNote({
        claimId,
        userId: user_id,
        note,
      });

      res.json({ note_id: communityNote.id });
    } catch (error) {
      console.error("Error adding community note:", error);
      res.status(500).json({ error: "Failed to add note" });
    }
  });

  // Get a single claim with full details
  app.get("/api/claims/:claimId", async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const claim = await storage.getClaim(claimId);
      
      if (!claim) {
        return res.status(404).json({ error: "Claim not found" });
      }

      const author = claim.userId ? await storage.getUser(claim.userId) : null;
      const notes = await storage.getClaimNotes(claimId);

      res.json({
        id: claim.id,
        text: claim.prompt,
        topics: claim.topics || [],
        location: claim.location,
        created_at: claim.createdAt?.toISOString(),
        run_id: claim.runId,
        status: claim.status,
        author: {
          id: author?.id || "unknown",
          name: author?.displayName || "Anonymous",
          location: author?.location,
          expertise: author?.expertiseTags || [],
          profile_image_url: author?.profileImageUrl,
        },
        ai_summary: claim.aiSummary,
        provisional_answer: claim.provisionalAnswer,
        confidence: claim.confidence,
        credibility_score: claim.credibilityScore,
        relevancy_score: claim.relevancyScore,
        votes: claim.votes || [],
        community_notes: notes,
      });
    } catch (error) {
      console.error("Error fetching claim:", error);
      res.status(500).json({ error: "Failed to fetch claim" });
    }
  });

  // Seed demo data on startup
  app.post("/api/seed", async (req: Request, res: Response) => {
    try {
      await storage.seedDemoData();
      res.json({ success: true, message: "Demo data seeded" });
    } catch (error) {
      console.error("Error seeding demo data:", error);
      res.status(500).json({ error: "Failed to seed demo data" });
    }
  });

  return httpServer;
}
