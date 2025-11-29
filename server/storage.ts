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
          console.log(`Updated user ${user.loginId} with login credentials`);
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
          console.log(`Created user ${user.loginId}`);
        }
      } catch (e) {
        console.log(`User ${user.id} error:`, e);
      }
    }

    const existingClaims = await db.select().from(claims).limit(1);
    if (existingClaims.length > 0) {
      console.log("Claims already seeded, skipping claims...");
      return;
    }

    const existingUserByEmail = await db.select().from(users).where(eq(users.email, "aakashak2000@gmail.com")).limit(1);
    const aakashUserId = existingUserByEmail.length > 0 ? existingUserByEmail[0].id : "demo_aakash";

    const demoClaims = [
      {
        id: "claim_tech_apple",
        userId: aakashUserId,
        prompt: "Apple is building a new AI data center in Mumbai.",
        topics: ["Technology", "AI", "India"],
        location: "Mumbai",
        status: "completed",
        aiSummary: "Verified by tech experts. Multiple sources confirm Apple's expansion plans in India with a focus on AI infrastructure.",
        provisionalAnswer: "This claim appears to be accurate. Apple has announced plans for significant infrastructure investment in India.",
        thinking: "First, I searched for recent news about Apple's infrastructure investments in India. Found multiple credible sources including Economic Times and TechCrunch reporting on Apple's expansion plans. Then I cross-referenced with Apple's official announcements and found consistency with their stated commitment to Indian manufacturing and services. The Mumbai location aligns with Apple's existing presence in the region.",
        confidence: 0.87,
        credibilityScore: 0.89,
        relevancyScore: 0.92,
        groundTruth: 1,
        votes: [
          { user_id: "demo_parth", name: "Parth Joshi", domain: "Technology", location: "Gujarat", vote: 1, weight: 0.82, rationale: "Consistent with Apple's India strategy. Multiple tech sources confirm this.", match_reasons: ["domain_expert"] },
          { user_id: "demo_aneesha", name: "Aneesha Manke", domain: "AI", location: "Nagpur", vote: 1, weight: 0.96, rationale: "Verified through industry contacts and tech publications.", match_reasons: ["domain_expert", "topic_specialist"] },
        ],
      },
      {
        id: "claim_sports_bcci",
        userId: aakashUserId,
        prompt: "BCCI is planning a new T20 league in the USA.",
        topics: ["Sports", "Business"],
        location: "USA",
        status: "completed",
        aiSummary: "Sports industry experts confirm BCCI's expansion plans. The league aims to tap into the growing cricket market in North America.",
        provisionalAnswer: "This claim is likely accurate based on recent BCCI announcements and cricket's growing popularity in the USA.",
        thinking: "I analyzed recent BCCI press releases and sports news. The Major League Cricket (MLC) has been announced and is gaining traction. Multiple sources including ESPN Cricinfo confirm BCCI's involvement in US cricket expansion. The claim aligns with documented efforts to grow cricket in North America.",
        confidence: 0.82,
        credibilityScore: 0.85,
        relevancyScore: 0.78,
        groundTruth: 1,
        votes: [
          { user_id: "demo_shaurya", name: "Shaurya Negi", domain: "Sports", location: "Dehradun", vote: 1, weight: 0.85, rationale: "Confirmed by multiple sports news outlets and BCCI statements.", match_reasons: ["domain_knowledge"] },
        ],
      },
      {
        id: "claim_finance_rbi",
        userId: "demo_aneesha",
        prompt: "RBI is piloting an AI-based credit scoring system for rural loans.",
        topics: ["Finance", "AI", "India"],
        location: "India",
        status: "completed",
        aiSummary: "Finance and AI experts validate this initiative. The RBI has been actively exploring fintech solutions for financial inclusion.",
        provisionalAnswer: "This claim is verified. RBI has announced pilot programs for AI-based credit scoring to improve rural lending.",
        thinking: "Searched RBI's official publications and found references to fintech initiatives for financial inclusion. Cross-referenced with banking industry reports and found multiple programs using alternative credit scoring. The claim is consistent with RBI's stated goals for rural banking access.",
        confidence: 0.91,
        credibilityScore: 0.93,
        relevancyScore: 0.95,
        groundTruth: 1,
        votes: [
          { user_id: "demo_shaurya", name: "Shaurya Negi", domain: "Finance", location: "Dehradun", vote: 1, weight: 0.88, rationale: "Consistent with fintech policy trends. RBI has been publishing research on this.", match_reasons: ["domain_expert"] },
          { user_id: aakashUserId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: 1, weight: 0.90, rationale: "Verified through fintech industry sources.", match_reasons: ["tech_expert"] },
        ],
      },
      {
        id: "claim_business_openai",
        userId: "demo_aneesha",
        prompt: "OpenAI is launching an India-focused enterprise plan.",
        topics: ["Business", "AI", "Technology"],
        location: "India",
        status: "completed",
        aiSummary: "Business and AI experts confirm OpenAI's expansion into the Indian enterprise market with localized solutions.",
        provisionalAnswer: "This claim is accurate. OpenAI has announced plans for an enterprise offering tailored to Indian businesses.",
        thinking: "Analyzed OpenAI's recent announcements and partnership news. Found evidence of Microsoft Azure partnership expanding to India. Also found reports of enterprise pricing and features being made available in the Indian market. The claim is consistent with OpenAI's global expansion strategy.",
        confidence: 0.88,
        credibilityScore: 0.90,
        relevancyScore: 0.88,
        groundTruth: 1,
        votes: [
          { user_id: aakashUserId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: 1, weight: 0.95, rationale: "Verified via OpenAI announcements and tech industry sources.", match_reasons: ["domain_expert"] },
          { user_id: "demo_parth", name: "Parth Joshi", domain: "Technology", location: "Gujarat", vote: 1, weight: 0.82, rationale: "Consistent with OpenAI's expansion strategy.", match_reasons: ["domain_expert"] },
        ],
      },
      {
        id: "claim_geo_expressway",
        userId: "demo_shaurya",
        prompt: "A new expressway between Delhi and Dehradun will cut travel time by 2 hours.",
        topics: ["Geography", "India", "Infrastructure"],
        location: "India",
        status: "completed",
        aiSummary: "Infrastructure and geography experts validate this claim. The expressway project has been officially announced.",
        provisionalAnswer: "This claim is verified. The Delhi-Dehradun expressway is under construction and will significantly reduce travel time.",
        thinking: "Searched for official government infrastructure announcements. Found NHAI (National Highways Authority of India) documentation on the Delhi-Dehradun expressway project. Current travel time is approximately 6 hours, and the expressway is projected to reduce it to around 2.5-3 hours. The 2-hour reduction claim is accurate.",
        confidence: 0.85,
        credibilityScore: 0.87,
        relevancyScore: 0.75,
        groundTruth: 1,
        votes: [
          { user_id: "demo_parth", name: "Parth Joshi", domain: "India", location: "Gujarat", vote: 1, weight: 0.80, rationale: "Confirmed through government sources. Project officially inaugurated.", match_reasons: ["topic_specialist"] },
          { user_id: aakashUserId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: 1, weight: 0.75, rationale: "Verified through infrastructure news sources.", match_reasons: ["general_knowledge"] },
        ],
      },
      {
        id: "claim_food_mumbai",
        userId: "demo_parth",
        prompt: "Mumbai's street food vendors will need new hygiene certification by 2026.",
        topics: ["Food", "India", "Regulation"],
        location: "Mumbai",
        status: "completed",
        aiSummary: "Food safety experts confirm new regulations are being implemented for street vendors in major Indian cities.",
        provisionalAnswer: "This claim is accurate. FSSAI has announced new hygiene certification requirements for street food vendors.",
        thinking: "Reviewed FSSAI (Food Safety and Standards Authority of India) guidelines and announcements. Found the 'Clean Street Food Hub' initiative and new certification requirements for street vendors. The 2026 timeline is partially accurate - implementation is phased across different cities. Mumbai is among the priority cities.",
        confidence: 0.79,
        credibilityScore: 0.81,
        relevancyScore: 0.70,
        groundTruth: 0,
        votes: [
          { user_id: "demo_aneesha", name: "Aneesha Manke", domain: "Business", location: "Nagpur", vote: 1, weight: 0.85, rationale: "FSSAI guidelines confirm new requirements.", match_reasons: ["regulatory_knowledge"] },
          { user_id: aakashUserId, name: "Aakash Kumar", domain: "India", location: "Mumbai", vote: -1, weight: 0.80, rationale: "Timeline is unclear - implementation is phased, not a hard 2026 deadline.", match_reasons: ["location_match"] },
        ],
      },
      {
        id: "claim_no_match_gardening",
        userId: "demo_parth",
        prompt: "Organic gardening in Brazil has increased by 40% this year.",
        topics: ["Gardening", "Brazil", "Agriculture"],
        location: "Brazil",
        status: "awaiting_votes",
        aiSummary: "Limited expert coverage for this topic. Claim requires more verification from agricultural specialists.",
        provisionalAnswer: "This claim needs more verification. Our experts have limited coverage in Brazilian agriculture.",
        thinking: "Searched for data on Brazilian organic agriculture but found limited authoritative sources. Some reports suggest growth in organic farming but specific percentage claims are difficult to verify. Would need specialized agricultural data sources to confirm the 40% figure.",
        confidence: 0.45,
        credibilityScore: 0.40,
        relevancyScore: 0.25,
        groundTruth: null,
        votes: [],
      },
      {
        id: "claim_no_match_fishing",
        userId: "demo_shaurya",
        prompt: "Scandinavian fishing policy will ban commercial fishing by 2030.",
        topics: ["Fishing", "Scandinavia", "Policy"],
        location: "Scandinavia",
        status: "awaiting_votes",
        aiSummary: "No matching experts found. This claim is outside our community's expertise areas.",
        provisionalAnswer: "This claim cannot be verified. Our community lacks experts in Scandinavian fishing policy.",
        thinking: "This claim appears to be an overstatement. While there are discussions about sustainable fishing policies in Scandinavian countries, a complete ban on commercial fishing by 2030 is not supported by any official policy documents I could find. Nordic countries have strict fishing regulations but no plans for a complete ban.",
        confidence: 0.30,
        credibilityScore: 0.25,
        relevancyScore: 0.15,
        groundTruth: -1,
        votes: [],
      },
    ];

    for (const claim of demoClaims) {
      await db.insert(claims).values(claim).onConflictDoNothing();
    }

    console.log("Demo data seeded successfully!");
  }
}

export const storage = new DatabaseStorage();
