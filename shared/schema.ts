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
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  displayName: varchar("display_name"),
  location: varchar("location"),
  expertiseTags: text("expertise_tags").array(),
  profileImageUrl: varchar("profile_image_url"),
  points: integer("points").default(0),
  precision: real("precision").default(0),
  attempts: integer("attempts").default(0),
  tier: varchar("tier").default("Bronze"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Claims table - stores user verification history
export const claims = pgTable("claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prompt: text("prompt").notNull(),
  runId: varchar("run_id"),
  status: varchar("status").default("queued"),
  provisionalAnswer: text("provisional_answer"),
  confidence: real("confidence").default(0),
  evidence: jsonb("evidence").default([]),
  votes: jsonb("votes").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  runId: true,
});

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
  user_id: string;
  name: string;
  domain: string;
  location: string;
  vote: 1 | -1;
  weight: number;
  rationale: string;
  match_reasons: VoteMatchReason[];
  profile_image_url?: string;
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
