import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, varchar, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - supports both Replit Auth and custom onboarding
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  loginId: varchar("login_id").unique(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  displayName: varchar("display_name"),
  location: varchar("location"),
  expertiseTags: text("expertise_tags").array(),
  topicPrecision: jsonb("topic_precision").default({}),
  profileImageUrl: varchar("profile_image_url"),
  points: integer("points").default(0),
  precision: real("precision").default(0.5),
  attempts: integer("attempts").default(0),
  tier: varchar("tier").default("Bronze"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Claims table - stores user verification history and community posts
export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prompt: text("prompt").notNull(),
  topics: text("topics").array().default([]),
  location: varchar("location"),
  runId: varchar("run_id"),
  status: varchar("status").default("queued"),
  provisionalAnswer: text("provisional_answer"),
  aiSummary: text("ai_summary"),
  confidence: real("confidence").default(0),
  credibilityScore: real("credibility_score").default(0),
  relevancyScore: real("relevancy_score").default(0),
  evidence: jsonb("evidence").default([]),
  votes: jsonb("votes").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Community notes table - user-submitted notes on claims
export const communityNotes = pgTable("community_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").references(() => claims.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

// Schema for custom signup form
export const signupUserSchema = createInsertSchema(users).pick({
  displayName: true,
  email: true,
  location: true,
  expertiseTags: true,
}).extend({
  displayName: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  location: z.string().optional(),
  expertiseTags: z.array(z.string()).default([]),
});

export type SignupUser = z.infer<typeof signupUserSchema>;

export const insertClaimSchema = createInsertSchema(claims).pick({
  userId: true,
  prompt: true,
  topics: true,
  location: true,
  runId: true,
});

export const insertCommunityNoteSchema = createInsertSchema(communityNotes).pick({
  claimId: true,
  userId: true,
  note: true,
});

export type CommunityNote = typeof communityNotes.$inferSelect;
export type InsertCommunityNote = z.infer<typeof insertCommunityNoteSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export type Claim = typeof claims.$inferSelect;
export type InsertClaim = typeof claims.$inferInsert;

// API types for FastAPI integration
export type VoteMatchReason = 
  | "domain_expert"
  | "location_match"
  | "verified_professional"
  | "high_reputation"
  | "topic_specialist";

export type Vote = {
  id?: string;
  user_id: string;
  name: string;
  domain: string;
  location: string;
  vote: 1 | -1;
  weight: number;
  rationale: string;
  match_reasons: VoteMatchReason[];
  profile_image_url?: string;
  note?: string;
};

// Authentication types
export type LoginRequest = {
  login_id: string;
  password: string;
};

export type LoginResponse = {
  user_id: string;
  display_name: string;
  location: string;
  expertise: string[];
};

export type AuthUser = {
  id: string;
  displayName: string;
  email: string | null;
  location: string | null;
  expertiseTags: string[];
  profileImageUrl: string | null;
  precision: number;
  points: number;
  tier: string;
  topicPrecision: Record<string, number>;
};

export type Evidence = {
  tool_name: string;
  content: string;
};

export type RunState = {
  run_id: string;
  status: "queued" | "in_progress" | "awaiting_votes" | "completed";
  provisional_answer: string;
  confidence: number;
  votes: Vote[];
  evidence: Evidence[];
};

export type LeaderboardEntry = {
  user_id: string;
  name: string;
  precision: number;
  attempts: number;
  points: number;
  tier: string;
};

export type Leaderboard = { entries: LeaderboardEntry[] };

export type PromptResponse = {
  run_id: string;
  status: string;
};

// User history response type
export type ClaimHistoryItem = {
  id: string;
  run_id: string | null;
  prompt: string;
  status: string;
  provisional_answer: string | null;
  confidence: number;
  vote_count: number;
  created_at: string;
};

// Rewards types
export type Perk = {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  category: string;
  available: boolean;
};

export type Reward = {
  id: string;
  userId: string;
  perkId: string;
  redeemedAt: Date;
};

// Community Note with author info for display
export type CommunityNoteWithAuthor = {
  id: string;
  note: string;
  created_at: string;
  author: {
    id: string;
    name: string;
    location?: string;
  };
};

// Feed claim type with all enriched data for the community feed
export type FeedClaim = {
  id: string;
  text: string;
  topics: string[];
  location?: string;
  created_at: string;
  run_id?: string;
  status: string;
  author: {
    id: string;
    name: string;
    location?: string;
    expertise: string[];
    profile_image_url?: string;
  };
  ai_summary?: string;
  provisional_answer?: string;
  confidence: number;
  credibility_score: number;
  relevancy_score: number;
  votes: Vote[];
  community_notes: CommunityNoteWithAuthor[];
};

// Create claim request type
export type CreateClaimRequest = {
  user_id: string;
  text: string;
  topics?: string[];
  location?: string;
};

// Add note request type
export type AddNoteRequest = {
  user_id: string;
  note: string;
};
