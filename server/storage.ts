import { users, claims, communityNotes, type User, type UpsertUser, type Claim, type InsertClaim, type SignupUser, type CommunityNote, type InsertCommunityNote, type FeedClaim, type Vote, type CommunityNoteWithAuthor, type AuthUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByLoginId(loginId: string): Promise<User | undefined>;
  validateLogin(loginId: string, password: string): Promise<AuthUser | null>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUserFromSignup(data: SignupUser): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;
  createClaim(claim: InsertClaim): Promise<Claim>;
  getClaim(id: string): Promise<Claim | undefined>;
  getClaimByRunId(runId: string): Promise<Claim | undefined>;
  getUserClaims(userId: string): Promise<Claim[]>;
  updateClaim(id: string, data: Partial<Claim>): Promise<Claim | undefined>;
  getAllClaims(sort: "relevant" | "latest", viewerId?: string): Promise<FeedClaim[]>;
  addCommunityNote(data: InsertCommunityNote): Promise<CommunityNote>;
  getClaimNotes(claimId: string): Promise<CommunityNoteWithAuthor[]>;
  addVoteNote(claimId: string, voteUserId: string, note: string): Promise<boolean>;
  addVote(claimId: string, userId: string, vote: 1 | -1, rationale: string): Promise<{ success: boolean; error?: string; claim?: Claim }>;
  hasUserVoted(claimId: string, userId: string): Promise<boolean>;
  hasUserAddedNote(claimId: string, userId: string): Promise<boolean>;
  seedDemoData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByLoginId(loginId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.loginId, loginId));
    return user;
  }

  async validateLogin(loginId: string, password: string): Promise<AuthUser | null> {
    const user = await this.getUserByLoginId(loginId);
    if (!user || !user.passwordHash) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }
    
    return {
      id: user.id,
      displayName: user.displayName || "",
      email: user.email,
      location: user.location,
      expertiseTags: (user.expertiseTags as string[]) || [],
      profileImageUrl: user.profileImageUrl,
      precision: user.precision || 0,
      points: user.points || 0,
      tier: user.tier || "Bronze",
      topicPrecision: (user.topicPrecision as Record<string, number>) || {},
    };
  }

  async createUserFromSignup(data: SignupUser): Promise<User> {
    const existingUser = data.email ? await this.getUserByEmail(data.email) : undefined;
    
    if (existingUser) {
      const [updated] = await db
        .update(users)
        .set({
          displayName: data.displayName,
          location: data.location,
          expertiseTags: data.expertiseTags,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updated;
    }

    const [user] = await db
      .insert(users)
      .values({
        displayName: data.displayName,
        email: data.email || null,
        location: data.location,
        expertiseTags: data.expertiseTags,
        points: 0,
        precision: 0,
        attempts: 0,
        tier: "Bronze",
      })
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createClaim(claimData: InsertClaim): Promise<Claim> {
    const [claim] = await db
      .insert(claims)
      .values(claimData)
      .returning();
    return claim;
  }

  async getClaim(id: string): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.id, id));
    return claim;
  }

  async getClaimByRunId(runId: string): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(eq(claims.runId, runId));
    return claim;
  }

  async getUserClaims(userId: string): Promise<Claim[]> {
    return await db
      .select()
      .from(claims)
      .where(eq(claims.userId, userId))
      .orderBy(desc(claims.createdAt));
  }

  async updateClaim(id: string, data: Partial<Claim>): Promise<Claim | undefined> {
    const [claim] = await db
      .update(claims)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    return claim;
  }

  async getAllClaims(sort: "relevant" | "latest", viewerId?: string): Promise<FeedClaim[]> {
    const allClaims = await db
      .select()
      .from(claims)
      .orderBy(desc(claims.createdAt));

    const viewer = viewerId ? await this.getUser(viewerId) : null;
    const viewerExpertise = (viewer?.expertiseTags as string[]) || [];
    const viewerLocation = viewer?.location?.toLowerCase() || "";
    const viewerTopicPrecision = (viewer?.topicPrecision as Record<string, number>) || {};

    const feedClaims: FeedClaim[] = [];

    for (const claim of allClaims) {
      const author = claim.userId ? await this.getUser(claim.userId) : null;
      const claimTopics = (claim.topics as string[]) || [];
      const claimLocation = claim.location?.toLowerCase() || "";

      let relevancyScore = claim.relevancyScore || 0.3;

      if (viewer) {
        let dynamicRelevancy = 0;
        let factors = 0;

        const matchingTopics = claimTopics.filter(topic => 
          viewerExpertise.some(exp => 
            exp.toLowerCase() === topic.toLowerCase()
          )
        );
        if (matchingTopics.length > 0) {
          const topicScore = Math.min(matchingTopics.length / claimTopics.length, 1);
          dynamicRelevancy += topicScore * 0.5;
          factors++;
        }

        if (claimLocation && viewerLocation && 
            (claimLocation.includes(viewerLocation) || viewerLocation.includes(claimLocation))) {
          dynamicRelevancy += 0.3;
          factors++;
        }

        const topicPrecisionScores = matchingTopics.map(topic => {
          const normalizedTopic = Object.keys(viewerTopicPrecision).find(
            k => k.toLowerCase() === topic.toLowerCase()
          );
          return normalizedTopic ? viewerTopicPrecision[normalizedTopic] : 0;
        });
        if (topicPrecisionScores.length > 0) {
          const avgPrecision = topicPrecisionScores.reduce((a, b) => a + b, 0) / topicPrecisionScores.length;
          dynamicRelevancy += avgPrecision * 0.2;
          factors++;
        }

        if (factors > 0) {
          relevancyScore = Math.min(dynamicRelevancy + 0.2, 1);
        } else {
          relevancyScore = 0.3;
        }
      }

      feedClaims.push({
        id: claim.id,
        text: claim.prompt,
        topics: claimTopics,
        location: claim.location || undefined,
        created_at: claim.createdAt?.toISOString() || new Date().toISOString(),
        run_id: claim.runId || undefined,
        status: claim.status || "queued",
        author: {
          id: author?.id || "unknown",
          name: author?.displayName || "Anonymous",
          location: author?.location || undefined,
          expertise: (author?.expertiseTags as string[]) || [],
          profile_image_url: author?.profileImageUrl || undefined,
        },
        ai_summary: claim.aiSummary || undefined,
        provisional_answer: claim.provisionalAnswer || undefined,
        thinking: claim.thinking || undefined,
        confidence: claim.confidence || 0,
        credibility_score: claim.credibilityScore || 0,
        relevancy_score: relevancyScore,
        votes: (claim.votes as Vote[]) || [],
        evidence: (claim.evidence as { tool_name: string; content: string }[]) || [],
        ground_truth: claim.groundTruth,
        resolved_by: claim.resolvedBy || undefined,
        resolved_at: claim.resolvedAt?.toISOString() || undefined,
        verification_sources: (claim.verificationSources as string[]) || [],
      });
    }

    if (sort === "relevant") {
      feedClaims.sort((a, b) => b.relevancy_score - a.relevancy_score);
    }

    return feedClaims;
  }

  async addCommunityNote(data: InsertCommunityNote): Promise<CommunityNote> {
    const [note] = await db
      .insert(communityNotes)
      .values(data)
      .returning();
    return note;
  }

  async getClaimNotes(claimId: string): Promise<CommunityNoteWithAuthor[]> {
    const notes = await db
      .select()
      .from(communityNotes)
      .where(eq(communityNotes.claimId, claimId))
      .orderBy(desc(communityNotes.createdAt));

    const notesWithAuthors: CommunityNoteWithAuthor[] = [];

    for (const note of notes) {
      const author = await this.getUser(note.userId);
      notesWithAuthors.push({
        id: note.id,
        note: note.note,
        created_at: note.createdAt?.toISOString() || new Date().toISOString(),
        author: {
          id: author?.id || "unknown",
          name: author?.displayName || "Anonymous",
          location: author?.location || undefined,
        },
      });
    }

    return notesWithAuthors;
  }

  async addVoteNote(claimId: string, voteUserId: string, note: string): Promise<boolean> {
    const claim = await this.getClaim(claimId);
    if (!claim) return false;
    
    const votes = (claim.votes as Vote[]) || [];
    const voteIndex = votes.findIndex(v => v.user_id === voteUserId);
    
    if (voteIndex === -1) return false;
    
    votes[voteIndex].note = note;
    
    await db.update(claims)
      .set({ votes: votes, updatedAt: new Date() })
      .where(eq(claims.id, claimId));
    
    return true;
  }

  async hasUserVoted(claimId: string, userId: string): Promise<boolean> {
    const claim = await this.getClaim(claimId);
    if (!claim) return false;
    
    const votes = (claim.votes as Vote[]) || [];
    return votes.some(v => v.user_id === userId);
  }

  async hasUserAddedNote(claimId: string, userId: string): Promise<boolean> {
    const notes = await db
      .select()
      .from(communityNotes)
      .where(eq(communityNotes.claimId, claimId));
    
    return notes.some(n => n.userId === userId);
  }

  async addVote(claimId: string, userId: string, vote: 1 | -1, rationale: string): Promise<{ success: boolean; error?: string; claim?: Claim }> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      return { success: false, error: "Claim not found" };
    }

    const existingVotes = (claim.votes as Vote[]) || [];
    
    if (existingVotes.some(v => v.user_id === userId)) {
      return { success: false, error: "User has already voted on this claim" };
    }

    const user = await this.getUser(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const newVote: Vote = {
      user_id: userId,
      name: user.displayName || "Anonymous",
      domain: (user.expertiseTags as string[])?.[0] || "General",
      location: user.location || "",
      vote: vote,
      weight: user.precision || 0.5,
      rationale: rationale,
      match_reasons: [],
    };

    const updatedVotes = [...existingVotes, newVote];

    const upvotes = updatedVotes.filter(v => v.vote === 1).length;
    const downvotes = updatedVotes.filter(v => v.vote === -1).length;
    const totalVotes = updatedVotes.length;
    
    const weightedSum = updatedVotes.reduce((sum, v) => sum + (v.vote * v.weight), 0);
    const totalWeight = updatedVotes.reduce((sum, v) => sum + v.weight, 0);
    const newConfidence = totalWeight > 0 
      ? Math.max(0, Math.min(1, 0.5 + (weightedSum / totalWeight) * 0.5))
      : 0.5;

    const newCredibilityScore = totalVotes > 0 
      ? upvotes / totalVotes 
      : 0;

    const newStatus = totalVotes >= 2 ? "completed" : "awaiting_votes";

    const [updatedClaim] = await db
      .update(claims)
      .set({
        votes: updatedVotes,
        confidence: newConfidence,
        credibilityScore: newCredibilityScore,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(claims.id, claimId))
      .returning();

    return { success: true, claim: updatedClaim };
  }

  async seedDemoData(): Promise<void> {
    console.log("Seeding demo data with authentication...");

    const demoUsers = [
      {
        id: "demo_aakash",
        email: "aakashak2000@gmail.com",
        loginId: "aakash",
        password: "aakash123",
        displayName: "Aakash Kumar",
        location: "Mumbai",
        expertiseTags: ["Technology", "Sports"],
        topicPrecision: { Technology: 0.95, Sports: 0.88 },
        precision: 0.90,
        attempts: 40,
        points: 1300,
        tier: "Diamond",
      },
      {
        id: "demo_aneesha",
        email: "aneeshamanke@gmail.com",
        loginId: "aneesha",
        password: "aneesha123",
        displayName: "Aneesha Manke",
        location: "Nagpur",
        expertiseTags: ["Business", "Product", "AI", "Finance"],
        topicPrecision: { AI: 0.96, Finance: 0.92, Business: 0.90, Product: 0.88 },
        precision: 0.93,
        attempts: 50,
        points: 1500,
        tier: "Diamond",
      },
      {
        id: "demo_shaurya",
        email: "shauryanegi17@gmail.com",
        loginId: "shaurya",
        password: "shaurya123",
        displayName: "Shaurya Negi",
        location: "Dehradun",
        expertiseTags: ["Finance", "Geography", "Tech"],
        topicPrecision: { Finance: 0.88, Geography: 0.80, Tech: 0.78 },
        precision: 0.82,
        attempts: 30,
        points: 1000,
        tier: "Gold",
      },
      {
        id: "demo_parth",
        email: "parth010872@gmail.com",
        loginId: "parth",
        password: "parth123",
        displayName: "Parth Joshi",
        location: "Gujarat",
        expertiseTags: ["Technology", "Food", "India"],
        topicPrecision: { Technology: 0.82, Food: 0.76, India: 0.80 },
        precision: 0.78,
        attempts: 25,
        points: 850,
        tier: "Gold",
      },
    ];

    const userIdMap: Record<string, string> = {};
    
    for (const user of demoUsers) {
      try {
        const passwordHash = await bcrypt.hash(user.password, 10);
        const existingByEmail = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        
        if (existingByEmail.length > 0) {
          await db.update(users)
            .set({ 
              loginId: user.loginId, 
              passwordHash: passwordHash,
              displayName: user.displayName,
              location: user.location,
              expertiseTags: user.expertiseTags,
              topicPrecision: user.topicPrecision,
              precision: user.precision,
              attempts: user.attempts,
              points: user.points,
              tier: user.tier,
              updatedAt: new Date()
            })
            .where(eq(users.email, user.email));
          userIdMap[user.id] = existingByEmail[0].id;
          console.log(`Updated user ${user.loginId} with login credentials (ID: ${existingByEmail[0].id})`);
        } else {
          await db.insert(users).values({
            id: user.id,
            email: user.email,
            loginId: user.loginId,
            passwordHash: passwordHash,
            displayName: user.displayName,
            location: user.location,
            expertiseTags: user.expertiseTags,
            topicPrecision: user.topicPrecision,
            precision: user.precision,
            attempts: user.attempts,
            points: user.points,
            tier: user.tier,
          }).onConflictDoNothing();
          userIdMap[user.id] = user.id;
          console.log(`Created user ${user.loginId}`);
        }
      } catch (e) {
        console.log(`User ${user.id} error:`, e);
      }
    }

    const aakashId = userIdMap["demo_aakash"] || "demo_aakash";
    const aneeshaId = userIdMap["demo_aneesha"] || "demo_aneesha";
    const shauryaId = userIdMap["demo_shaurya"] || "demo_shaurya";
    const parthId = userIdMap["demo_parth"] || "demo_parth";

    await db.delete(claims);
    console.log("Cleared existing claims for fresh demo data...");

    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const demoClaims = [
      {
        id: "demo_claim_1",
        userId: aakashId,
        prompt: "Apple announced new manufacturing expansion in India for 2025",
        topics: ["Technology", "Business"],
        location: "India",
        status: "verified",
        aiSummary: "VERIFIED: Apple has officially announced significant manufacturing expansion in India. Multiple sources confirm the investment in new facilities and workforce expansion for 2025.",
        provisionalAnswer: "This claim is TRUE. Apple has confirmed plans to expand manufacturing operations in India as part of their supply chain diversification strategy.",
        thinking: "Step 1: Used web_search to find recent Apple India announcements.\nStep 2: Found Reuters and Economic Times articles confirming Apple's $2 billion investment in new manufacturing facilities.\nStep 3: Cross-referenced with Apple's official press releases.\nStep 4: Verified through Wikipedia that Apple has been expanding India operations since 2017.\nConclusion: The claim is accurate based on multiple credible sources.",
        confidence: 0.95,
        credibilityScore: 0.95,
        relevancyScore: 0.90,
        groundTruth: 1,
        resolvedBy: "system_moderator",
        resolvedAt: daysAgo(5),
        verificationSources: ["https://reuters.com/technology/apple-india-expansion", "https://economictimes.com/apple-manufacturing-2025", "https://apple.com/newsroom/india"],
        votes: [
          { user_id: aneeshaId, name: "Aneesha Manke", domain: "Business", location: "Nagpur", vote: 1, weight: 0.93, rationale: "Confirmed through multiple business news sources. Apple's India expansion is well-documented.", match_reasons: ["domain_expert"] },
          { user_id: shauryaId, name: "Shaurya Negi", domain: "Tech", location: "Dehradun", vote: 1, weight: 0.82, rationale: "Tech industry reports confirm this expansion plan.", match_reasons: ["tech_knowledge"] },
          { user_id: parthId, name: "Parth Joshi", domain: "Technology", location: "Gujarat", vote: 1, weight: 0.78, rationale: "Verified via Apple investor relations documents.", match_reasons: ["domain_expert"] },
        ],
      },
      {
        id: "demo_claim_2",
        userId: aneeshaId,
        prompt: "RBI increased repo rate by 25 basis points in November 2025",
        topics: ["Finance", "Economy"],
        location: "India",
        status: "verified",
        aiSummary: "VERIFIED: The Reserve Bank of India's Monetary Policy Committee announced a 25 basis point increase in the repo rate during their November 2025 meeting.",
        provisionalAnswer: "This claim is TRUE. RBI's MPC raised the repo rate by 25 bps to combat inflation pressures.",
        thinking: "Step 1: Searched RBI official website for MPC meeting minutes.\nStep 2: Found November 2025 policy statement confirming rate hike.\nStep 3: Verified through financial news sources including Bloomberg and Mint.\nStep 4: Cross-checked with banking sector analysts' reports.\nConclusion: The 25 basis point increase is officially confirmed.",
        confidence: 0.92,
        credibilityScore: 0.94,
        relevancyScore: 0.88,
        groundTruth: 1,
        resolvedBy: "system_moderator",
        resolvedAt: daysAgo(3),
        verificationSources: ["https://rbi.org.in/monetary-policy", "https://bloomberg.com/rbi-rate-hike", "https://livemint.com/economy/rbi-november-2025"],
        votes: [
          { user_id: shauryaId, name: "Shaurya Negi", domain: "Finance", location: "Dehradun", vote: 1, weight: 0.88, rationale: "RBI's official statement confirms this. Standard monetary policy adjustment.", match_reasons: ["domain_expert"] },
          { user_id: aakashId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: 1, weight: 0.90, rationale: "Banking sector sources confirm the rate change.", match_reasons: ["general_knowledge"] },
          { user_id: parthId, name: "Parth Joshi", domain: "India", location: "Gujarat", vote: 1, weight: 0.78, rationale: "Widely reported across financial media.", match_reasons: ["location_expert"] },
        ],
      },
      {
        id: "demo_claim_3",
        userId: shauryaId,
        prompt: "India won the home Test series against South Africa 2-1",
        topics: ["Sports", "Cricket"],
        location: "India",
        status: "verified",
        aiSummary: "VERIFIED: India defeated South Africa 2-1 in the home Test series. The victory was secured with wins in the second and third Tests after a first Test loss.",
        provisionalAnswer: "This claim is TRUE. India's home dominance continued with a 2-1 series victory over the Proteas.",
        thinking: "Step 1: Searched ESPN Cricinfo for India vs South Africa Test series results.\nStep 2: Found match reports confirming India won matches at Pune and Ranchi.\nStep 3: Verified final series scoreline through ICC official records.\nStep 4: Cross-referenced with Cricbuzz and Wisden for accuracy.\nConclusion: Series result is confirmed at 2-1 in India's favor.",
        confidence: 0.88,
        credibilityScore: 0.92,
        relevancyScore: 0.85,
        groundTruth: 1,
        resolvedBy: "system_moderator",
        resolvedAt: daysAgo(7),
        verificationSources: ["https://espncricinfo.com/series/ind-vs-sa-2025", "https://icc-cricket.com/rankings", "https://cricbuzz.com/series-results"],
        votes: [
          { user_id: aakashId, name: "Aakash Kumar", domain: "Sports", location: "Mumbai", vote: 1, weight: 0.88, rationale: "Watched the matches live. Clear 2-1 victory for India.", match_reasons: ["domain_expert"] },
          { user_id: aneeshaId, name: "Aneesha Manke", domain: "Business", location: "Nagpur", vote: 1, weight: 0.85, rationale: "Sports news widely covered this series outcome.", match_reasons: ["general_knowledge"] },
          { user_id: parthId, name: "Parth Joshi", domain: "India", location: "Gujarat", vote: 1, weight: 0.78, rationale: "Cricket results are well-documented. India won convincingly.", match_reasons: ["location_expert"] },
        ],
      },
      {
        id: "demo_claim_4",
        userId: parthId,
        prompt: "Mumbai's air pollution is solely caused by volcanic ash from Ethiopia",
        topics: ["Environment", "Science"],
        location: "Mumbai",
        status: "verified",
        aiSummary: "FALSE: Mumbai's air pollution is caused by multiple factors including vehicle emissions, industrial activity, construction dust, and crop burning - not volcanic ash from Ethiopia.",
        provisionalAnswer: "This claim is FALSE. Air quality experts confirm Mumbai pollution comes from local sources, not African volcanic activity.",
        thinking: "Step 1: Searched for scientific studies on Mumbai air pollution sources.\nStep 2: Found CPCB and IIT Bombay research identifying primary pollutants.\nStep 3: Checked for any Ethiopian volcanic activity - no major eruptions recently.\nStep 4: Consulted atmospheric science resources on transoceanic pollution patterns.\nConclusion: The claim is demonstrably false. No credible evidence supports the volcanic ash theory.",
        confidence: 0.15,
        credibilityScore: 0.12,
        relevancyScore: 0.75,
        groundTruth: -1,
        resolvedBy: "system_moderator",
        resolvedAt: daysAgo(4),
        verificationSources: ["https://cpcb.nic.in/air-quality-data", "https://iitb.ac.in/research/pollution", "https://who.int/air-quality"],
        votes: [
          { user_id: aneeshaId, name: "Aneesha Manke", domain: "AI", location: "Nagpur", vote: -1, weight: 0.93, rationale: "No scientific evidence supports this claim. Mumbai pollution is primarily from local sources.", match_reasons: ["analytical_thinking"] },
          { user_id: shauryaId, name: "Shaurya Negi", domain: "Geography", location: "Dehradun", vote: -1, weight: 0.80, rationale: "Geography makes this implausible. Transoceanic ash transport at this scale is not documented.", match_reasons: ["domain_expert"] },
          { user_id: aakashId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: -1, weight: 0.90, rationale: "Living in Mumbai - pollution is clearly from vehicles and construction. This claim is absurd.", match_reasons: ["location_expert"] },
        ],
      },
      {
        id: "demo_claim_5",
        userId: aneeshaId,
        prompt: "The Great Wall of China is visible from space with the naked eye",
        topics: ["Science", "History"],
        location: "China",
        status: "verified",
        aiSummary: "FALSE: This is a popular myth. The Great Wall is too narrow to be seen from space without aid. Astronauts have confirmed it's not visible to the naked eye from orbit.",
        provisionalAnswer: "This claim is FALSE. NASA and astronauts have debunked this myth multiple times.",
        thinking: "Step 1: Searched NASA archives for astronaut observations.\nStep 2: Found statements from multiple astronauts including Yang Liwei and Chris Hadfield.\nStep 3: Calculated wall width (5-8 meters) vs. human visual acuity limits from orbit.\nStep 4: Reviewed Wikipedia article on Great Wall visibility myth.\nConclusion: Scientific consensus is clear - the wall is not visible from space unaided.",
        confidence: 0.20,
        credibilityScore: 0.15,
        relevancyScore: 0.70,
        groundTruth: -1,
        resolvedBy: "system_moderator",
        resolvedAt: daysAgo(6),
        verificationSources: ["https://nasa.gov/great-wall-myth", "https://scientificamerican.com/space-visibility", "https://en.wikipedia.org/wiki/Great_Wall_of_China"],
        votes: [
          { user_id: aakashId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: -1, weight: 0.90, rationale: "This is a well-known myth debunked by NASA and astronauts.", match_reasons: ["scientific_knowledge"] },
          { user_id: shauryaId, name: "Shaurya Negi", domain: "Geography", location: "Dehradun", vote: -1, weight: 0.80, rationale: "Geography experts know this is false. Wall is 5-8m wide, invisible from 400km altitude.", match_reasons: ["domain_expert"] },
          { user_id: parthId, name: "Parth Joshi", domain: "Technology", location: "Gujarat", vote: -1, weight: 0.78, rationale: "Simple physics - human eye resolution can't detect such narrow structures from orbit.", match_reasons: ["analytical_thinking"] },
        ],
      },
      {
        id: "demo_claim_6",
        userId: shauryaId,
        prompt: "Microsoft planning to build AI research center in Bangalore",
        topics: ["Technology", "AI"],
        location: "Bangalore",
        status: "pending",
        aiSummary: "Under investigation. Some reports suggest Microsoft is expanding AI research capabilities in India, but official confirmation is pending.",
        provisionalAnswer: "This claim requires further verification. Microsoft has existing research facilities in India but new center announcements need official confirmation.",
        thinking: "Step 1: Searched for Microsoft India expansion announcements.\nStep 2: Found mentions in tech blogs but no official press release.\nStep 3: Microsoft Research India exists but new AI center not confirmed.\nStep 4: Industry sources suggest expansion is possible but unconfirmed.\nConclusion: Claim is plausible but awaiting official confirmation.",
        confidence: 0.78,
        credibilityScore: 0.65,
        relevancyScore: 0.88,
        groundTruth: null,
        votes: [
          { user_id: aakashId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: 1, weight: 0.90, rationale: "Microsoft has been expanding India presence. This is consistent with their strategy.", match_reasons: ["domain_expert"] },
          { user_id: aneeshaId, name: "Aneesha Manke", domain: "AI", location: "Nagpur", vote: 1, weight: 0.93, rationale: "Tech industry sources indicate Microsoft is investing heavily in India AI.", match_reasons: ["domain_expert"] },
        ],
      },
      {
        id: "demo_claim_7",
        userId: aakashId,
        prompt: "Indian cricket team to tour Australia in December 2025",
        topics: ["Sports", "Cricket"],
        location: "Australia",
        status: "pending",
        aiSummary: "Under investigation. Cricket schedule announcements typically come from BCCI and Cricket Australia. Current FTP schedule needs verification.",
        provisionalAnswer: "This claim needs verification from official cricket board announcements.",
        thinking: "Step 1: Searched ICC Future Tours Programme for India-Australia fixtures.\nStep 2: Found tentative schedules but specific dates not yet confirmed.\nStep 3: BCCI website doesn't show confirmed December 2025 Australia tour.\nStep 4: Sports news sites report discussions but no official announcement.\nConclusion: Plausible based on cricket calendar patterns but awaiting confirmation.",
        confidence: 0.85,
        credibilityScore: 0.70,
        relevancyScore: 0.82,
        groundTruth: null,
        votes: [
          { user_id: shauryaId, name: "Shaurya Negi", domain: "Finance", location: "Dehradun", vote: 1, weight: 0.82, rationale: "India typically tours Australia around this time. Schedule seems realistic.", match_reasons: ["general_knowledge"] },
        ],
      },
      {
        id: "demo_claim_8",
        userId: parthId,
        prompt: "Tesla considering India entry with local manufacturing by 2026",
        topics: ["Technology", "Business"],
        location: "India",
        status: "pending",
        aiSummary: "Under investigation. Tesla has shown interest in India before but no confirmed manufacturing plans. Import duty negotiations ongoing.",
        provisionalAnswer: "This claim requires verification. Tesla's India entry has been discussed for years but faces regulatory hurdles.",
        thinking: "Step 1: Searched for recent Tesla India announcements.\nStep 2: Found ongoing discussions about import duty reduction.\nStep 3: No confirmed factory or manufacturing commitment found.\nStep 4: Previous Tesla India plans have not materialized.\nConclusion: Claim is speculative. Tesla interest exists but concrete plans unconfirmed.",
        confidence: 0.72,
        credibilityScore: 0.55,
        relevancyScore: 0.85,
        groundTruth: null,
        votes: [],
      },
    ];

    for (const claim of demoClaims) {
      await db.insert(claims).values(claim).onConflictDoNothing();
    }

    console.log("Demo data seeded successfully with 8 high-quality claims!");
  }
}

export const storage = new DatabaseStorage();
