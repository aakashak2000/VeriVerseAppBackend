import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { signupUserSchema, insertCommunityNoteSchema, type ClaimHistoryItem, type Vote, type CreateClaimRequest, type AddNoteRequest, type LoginRequest } from "@shared/schema";
import { z } from "zod";

const FASTAPI_BASE = process.env.FASTAPI_BASE || "http://localhost:8000";

const loginSchema = z.object({
  login_id: z.string().min(1),
  password: z.string().min(1),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication
  await setupAuth(app);

  // Password-based login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request" });
      }
      
      const { login_id, password } = parsed.data;
      const authUser = await storage.validateLogin(login_id, password);
      
      if (!authUser) {
        return res.status(401).json({ error: "Invalid login ID or password" });
      }
      
      res.json({
        user_id: authUser.id,
        display_name: authUser.displayName,
        location: authUser.location || "",
        expertise: authUser.expertiseTags,
        email: authUser.email,
        precision: authUser.precision,
        points: authUser.points,
        tier: authUser.tier,
        topic_precision: authUser.topicPrecision,
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Auth routes (Replit Auth)
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
      // Support both Replit Auth and password-based login
      const userId = (req as any).user?.claims?.sub || req.body.user_id;
      
      let data: any = null;
      
      // Try to call FastAPI
      try {
        const response = await fetch(`${FASTAPI_BASE}/prompts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
        });

        if (response.ok) {
          data = await response.json();
        }
      } catch (fastApiError) {
        console.log("FastAPI unavailable, using local-only mode:", fastApiError);
      }
      
      // Store claim in database if user is authenticated
      if (userId) {
        const claim = await storage.createClaim({
          userId,
          prompt: req.body.prompt,
          runId: data?.run_id || null,
          status: data?.status || "queued",
          provisionalAnswer: data?.provisional_answer || null,
          confidence: data?.confidence || null,
          votes: data?.votes || [],
          evidence: data?.evidence || [],
        });
        
        // Return combined response
        res.json({
          claim_id: claim.id,
          run_id: data?.run_id || `local_${claim.id}`,
          status: data?.status || "queued",
          provisional_answer: data?.provisional_answer,
          confidence: data?.confidence,
          votes: data?.votes || [],
          evidence: data?.evidence || [],
        });
        return;
      }
      
      // If no user, just return FastAPI response or error
      if (data) {
        res.json(data);
      } else {
        res.status(503).json({ error: "Backend unavailable" });
      }
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

  // Get all claims for the feed (enriched with latest run data from FastAPI)
  app.get("/api/claims", async (req: Request, res: Response) => {
    try {
      const sort = (req.query.sort as string) === "latest" ? "latest" : "relevant";
      const userId = req.query.userId as string | undefined;
      
      const claims = await storage.getAllClaims(sort, userId);

      // Enrich each claim with fresh run data from FastAPI (if available)
      const enrichedClaims = await Promise.all(
        claims.map(async (claim) => {
          if (!claim.run_id) return claim;
          
          try {
            const runResponse = await fetch(`${FASTAPI_BASE}/runs/${claim.run_id}`);
            if (runResponse.ok) {
              const runData = await runResponse.json();
              return {
                ...claim,
                status: runData.status || claim.status,
                provisional_answer: runData.provisional_answer || claim.provisional_answer,
                confidence: runData.confidence ?? claim.confidence,
                votes: runData.votes || claim.votes,
                evidence: runData.evidence || claim.evidence,
              };
            }
          } catch (e) {
            // FastAPI unavailable, use local data
          }
          return claim;
        })
      );

      res.json(enrichedClaims);
    } catch (error) {
      console.error("Error fetching claims:", error);
      res.status(500).json({ error: "Failed to fetch claims" });
    }
  });

  // Create a new claim (stores locally AND triggers FastAPI)
  app.post("/api/claims", async (req: Request, res: Response) => {
    try {
      const createClaimSchema = z.object({
        userId: z.string().optional(),
        user_id: z.string().optional(),
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

      const userId = parsed.data.userId || parsed.data.user_id || (req as any).user?.claims?.sub || "anonymous";
      const { text, topics, location } = parsed.data;

      // Step 1: Try to create run in FastAPI (triggers AI)
      let runData: any = null;
      try {
        const fastApiResponse = await fetch(`${FASTAPI_BASE}/prompts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt: text,
            user_id: userId 
          }),
        });

        if (fastApiResponse.ok) {
          runData = await fastApiResponse.json();
        }
      } catch (fastApiError) {
        console.log("FastAPI unavailable, storing claim locally:", fastApiError);
      }

      // Step 2: Store claim in local DB with run link (if available)
      const claim = await storage.createClaim({
        userId: userId,
        prompt: text,
        topics: topics,
        location: location || null,
        runId: runData?.run_id || null,
        status: runData?.status || "queued",
        provisionalAnswer: runData?.provisional_answer || null,
        confidence: runData?.confidence || null,
        votes: runData?.votes || [],
        evidence: runData?.evidence || [],
      });

      res.json({
        claim_id: claim.id,
        run_id: runData?.run_id || null,
        status: runData?.status || "queued",
        provisional_answer: runData?.provisional_answer,
        confidence: runData?.confidence,
        votes: runData?.votes || [],
        evidence: runData?.evidence || [],
      });
    } catch (error) {
      console.error("Error creating claim:", error);
      res.status(503).json({ error: "Failed to create claim" });
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

      if (claim.userId === user_id) {
        return res.status(403).json({ error: "Cannot add a note to your own claim" });
      }

      const hasExistingNote = await storage.hasUserAddedNote(claimId, user_id);
      if (hasExistingNote) {
        return res.status(403).json({ error: "You have already added a note to this claim" });
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

  // Submit a vote on a claim
  app.post("/api/claims/:claimId/vote", async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      
      const voteSchema = z.object({
        user_id: z.string().min(1),
        vote: z.union([z.literal(1), z.literal(-1)]),
        rationale: z.string().min(1).max(500),
      });

      const parsed = voteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parsed.error.errors 
        });
      }

      const { user_id, vote, rationale } = parsed.data;

      const result = await storage.addVote(claimId, user_id, vote, rationale);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        success: true, 
        claim_id: claimId,
        confidence: result.claim?.confidence,
        status: result.claim?.status,
      });
    } catch (error) {
      console.error("Error submitting vote:", error);
      res.status(500).json({ error: "Failed to submit vote" });
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

  // Add a note to a vote on a claim
  app.post("/api/claims/:claimId/votes/:userId/note", async (req: Request, res: Response) => {
    try {
      const { claimId, userId: voteUserId } = req.params;
      
      const addVoteNoteSchema = z.object({
        note: z.string().min(1).max(500),
      });

      const parsed = addVoteNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: parsed.error.errors 
        });
      }

      const { note } = parsed.data;

      const success = await storage.addVoteNote(claimId, voteUserId, note);
      if (!success) {
        return res.status(404).json({ error: "Vote not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error adding vote note:", error);
      res.status(500).json({ error: "Failed to add vote note" });
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
