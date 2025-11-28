import { users, claims, type User, type UpsertUser, type Claim, type InsertClaim } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createClaim(claim: InsertClaim): Promise<Claim>;
  getClaim(id: string): Promise<Claim | undefined>;
  getClaimByRunId(runId: string): Promise<Claim | undefined>;
  getUserClaims(userId: string): Promise<Claim[]>;
  updateClaim(id: string, data: Partial<Claim>): Promise<Claim | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
}

export const storage = new DatabaseStorage();
