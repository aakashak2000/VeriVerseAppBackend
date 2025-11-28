import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type Vote = {
  user_id: string;
  vote: 1 | -1;
  weight: number;
  rationale: string;
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
