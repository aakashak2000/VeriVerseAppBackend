import { users, claims, communityNotes, type User, type UpsertUser, type Claim, type InsertClaim, type SignupUser, type CommunityNote, type InsertCommunityNote, type FeedClaim, type Vote, type CommunityNoteWithAuthor } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUserFromSignup(data: SignupUser): Promise<User>;
  createClaim(claim: InsertClaim): Promise<Claim>;
  getClaim(id: string): Promise<Claim | undefined>;
  getClaimByRunId(runId: string): Promise<Claim | undefined>;
  getUserClaims(userId: string): Promise<Claim[]>;
  updateClaim(id: string, data: Partial<Claim>): Promise<Claim | undefined>;
  getAllClaims(sort: "relevant" | "latest", viewerId?: string): Promise<FeedClaim[]>;
  addCommunityNote(data: InsertCommunityNote): Promise<CommunityNote>;
  getClaimNotes(claimId: string): Promise<CommunityNoteWithAuthor[]>;
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
      .orderBy(sort === "latest" ? desc(claims.createdAt) : desc(claims.relevancyScore));

    const feedClaims: FeedClaim[] = [];

    for (const claim of allClaims) {
      const author = claim.userId ? await this.getUser(claim.userId) : null;
      const notes = await this.getClaimNotes(claim.id);

      feedClaims.push({
        id: claim.id,
        text: claim.prompt,
        topics: (claim.topics as string[]) || [],
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
        confidence: claim.confidence || 0,
        credibility_score: claim.credibilityScore || 0,
        relevancy_score: claim.relevancyScore || 0,
        votes: (claim.votes as Vote[]) || [],
        community_notes: notes,
      });
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

  async seedDemoData(): Promise<void> {
    const existingClaims = await db.select().from(claims).limit(1);
    if (existingClaims.length > 0) {
      console.log("Demo data already seeded, skipping...");
      return;
    }

    console.log("Seeding demo data...");

    const demoUsers = [
      {
        id: "demo_aakash",
        email: "aakashak2000@gmail.com",
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
        const existingByEmail = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        if (existingByEmail.length === 0) {
          await db.insert(users).values(user).onConflictDoNothing();
        }
      } catch (e) {
        console.log(`User ${user.id} already exists or has conflict`);
      }
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
        confidence: 0.87,
        credibilityScore: 0.89,
        relevancyScore: 0.92,
        votes: [
          { user_id: aakashUserId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: 1, weight: 0.95, rationale: "Verified through industry sources", match_reasons: ["domain_expert", "location_match"] },
          { user_id: "demo_parth", name: "Parth Joshi", domain: "Technology", location: "Gujarat", vote: 1, weight: 0.82, rationale: "Consistent with Apple's India strategy", match_reasons: ["domain_expert"] },
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
        confidence: 0.82,
        credibilityScore: 0.85,
        relevancyScore: 0.78,
        votes: [
          { user_id: aakashUserId, name: "Aakash Kumar", domain: "Sports", location: "Mumbai", vote: 1, weight: 0.88, rationale: "Confirmed by multiple sports news outlets", match_reasons: ["domain_expert"] },
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
        confidence: 0.91,
        credibilityScore: 0.93,
        relevancyScore: 0.95,
        votes: [
          { user_id: "demo_aneesha", name: "Aneesha Manke", domain: "Finance", location: "Nagpur", vote: 1, weight: 0.92, rationale: "Verified through RBI publications", match_reasons: ["domain_expert", "verified_professional"] },
          { user_id: "demo_shaurya", name: "Shaurya Negi", domain: "Finance", location: "Dehradun", vote: 1, weight: 0.88, rationale: "Consistent with fintech policy trends", match_reasons: ["domain_expert"] },
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
        confidence: 0.88,
        credibilityScore: 0.90,
        relevancyScore: 0.88,
        votes: [
          { user_id: "demo_aneesha", name: "Aneesha Manke", domain: "AI", location: "Nagpur", vote: 1, weight: 0.96, rationale: "Confirmed through tech industry sources", match_reasons: ["domain_expert", "topic_specialist"] },
          { user_id: aakashUserId, name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: 1, weight: 0.95, rationale: "Verified via OpenAI announcements", match_reasons: ["domain_expert"] },
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
        confidence: 0.85,
        credibilityScore: 0.87,
        relevancyScore: 0.75,
        votes: [
          { user_id: "demo_shaurya", name: "Shaurya Negi", domain: "Geography", location: "Dehradun", vote: 1, weight: 0.80, rationale: "Verified as local resident", match_reasons: ["domain_expert", "location_match"] },
          { user_id: "demo_parth", name: "Parth Joshi", domain: "India", location: "Gujarat", vote: 1, weight: 0.80, rationale: "Confirmed through government sources", match_reasons: ["topic_specialist"] },
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
        confidence: 0.79,
        credibilityScore: 0.81,
        relevancyScore: 0.70,
        votes: [
          { user_id: "demo_parth", name: "Parth Joshi", domain: "Food", location: "Gujarat", vote: 1, weight: 0.76, rationale: "Verified through FSSAI guidelines", match_reasons: ["domain_expert"] },
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
        confidence: 0.45,
        credibilityScore: 0.40,
        relevancyScore: 0.25,
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
        confidence: 0.30,
        credibilityScore: 0.25,
        relevancyScore: 0.15,
        votes: [],
      },
    ];

    for (const claim of demoClaims) {
      await db.insert(claims).values(claim).onConflictDoNothing();
    }

    const demoNotes = [
      { id: "note_1", claimId: "claim_tech_apple", userId: "demo_parth", note: "I've seen construction activity near the proposed site. This seems legit." },
      { id: "note_2", claimId: "claim_finance_rbi", userId: "demo_aneesha", note: "RBI has been actively publishing research on this. The pilot is already underway in select states." },
      { id: "note_3", claimId: "claim_business_openai", userId: aakashUserId, note: "Spoke with someone at an OpenAI partner company. They confirmed the India plans." },
      { id: "note_4", claimId: "claim_geo_expressway", userId: "demo_parth", note: "The project was officially inaugurated last month. Construction is on schedule." },
    ];

    for (const note of demoNotes) {
      await db.insert(communityNotes).values(note).onConflictDoNothing();
    }

    console.log("Demo data seeded successfully!");
  }
}

export const storage = new DatabaseStorage();
