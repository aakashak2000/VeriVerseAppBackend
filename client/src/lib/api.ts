import type { RunState, Leaderboard, PromptResponse, SignupUser, User, ClaimHistoryItem } from "@shared/schema";

const API_BASE = import.meta.env.VITE_API_BASE || "";

// Demo history data
const DEMO_HISTORY: ClaimHistoryItem[] = [
  {
    id: "demo_1",
    run_id: "demo_run_1",
    prompt: "Scientists discover water has memory and can store information",
    status: "completed",
    provisional_answer: "This claim is partially accurate. While water molecules can form temporary structures, there is no scientific evidence that water can 'store information' in a meaningful way.",
    confidence: 0.72,
    vote_count: 4,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo_2",
    run_id: "demo_run_2",
    prompt: "New study shows 5G towers cause health problems",
    status: "completed",
    provisional_answer: "This claim is false. Multiple peer-reviewed studies have found no evidence linking 5G technology to health problems.",
    confidence: 0.89,
    vote_count: 6,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

const DEMO_LEADERBOARD: Leaderboard = {
  entries: [
    { user_id: "u1", name: "Aarav", precision: 0.91, attempts: 37, points: 1200, tier: "Diamond" },
    { user_id: "u2", name: "Maya", precision: 0.84, attempts: 21, points: 980, tier: "Platinum" },
    { user_id: "u3", name: "Priya", precision: 0.79, attempts: 45, points: 850, tier: "Gold" },
    { user_id: "u4", name: "Arjun", precision: 0.72, attempts: 18, points: 620, tier: "Silver" },
    { user_id: "u5", name: "Anika", precision: 0.68, attempts: 12, points: 420, tier: "Bronze" },
  ],
};

const createDemoRunState = (runId: string, prompt: string): RunState => ({
  run_id: runId,
  status: "completed",
  provisional_answer: `Based on our analysis using multiple verification tools, the claim "${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}" appears to be partially accurate. We found corroborating evidence from trusted sources, though some details could not be independently verified. Community reviewers have weighed in with additional context.`,
  confidence: 0.78,
  votes: [
    { 
      user_id: "u1", 
      name: "Dr. Sarah Chen",
      domain: "ML Engineering",
      location: "San Francisco",
      vote: 1, 
      weight: 0.9, 
      rationale: "Found supporting evidence from Reuters and verified through peer-reviewed sources",
      match_reasons: ["domain_expert", "location_match", "verified_professional"],
    },
    { 
      user_id: "u2", 
      name: "Alex Kumar",
      domain: "DevOps",
      location: "London",
      vote: 1, 
      weight: 0.7, 
      rationale: "Verified through official technical documentation and industry standards",
      match_reasons: ["domain_expert", "high_reputation"],
    },
    { 
      user_id: "u3", 
      name: "Jordan Martinez",
      domain: "Cloud Architecture",
      location: "New York",
      vote: 1, 
      weight: 0.6, 
      rationale: "Cross-referenced with cloud provider best practices documentation",
      match_reasons: ["topic_specialist", "location_match"],
    },
    { 
      user_id: "u4", 
      name: "Emma Thompson",
      domain: "Data Science",
      location: "Berlin",
      vote: -1, 
      weight: 0.5, 
      rationale: "Some claims require additional statistical validation",
      match_reasons: ["domain_expert"],
    },
  ],
  evidence: [
    { tool_name: "google_search", content: "Found 3 relevant articles from major news outlets discussing this topic with similar claims." },
    { tool_name: "crawler", content: "Verified claim appears in official press releases and government documents." },
  ],
});

let demoPromptCounter = 0;
let storedDemoPrompt = "";

export async function createPrompt(prompt: string): Promise<PromptResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/prompts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error("Failed to create prompt");
    }

    return response.json();
  } catch (error) {
    demoPromptCounter++;
    storedDemoPrompt = prompt;
    return {
      run_id: `demo_run_${demoPromptCounter}`,
      status: "queued",
    };
  }
}

export async function getRun(runId: string): Promise<RunState> {
  if (runId.startsWith("demo_run_")) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return createDemoRunState(runId, storedDemoPrompt);
  }

  try {
    const response = await fetch(`${API_BASE}/api/runs/${runId}`);

    if (!response.ok) {
      throw new Error("Failed to get run status");
    }

    return response.json();
  } catch (error) {
    return createDemoRunState(runId, "your claim");
  }
}

export async function getLeaderboard(): Promise<Leaderboard> {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard`);

    if (!response.ok) {
      throw new Error("Failed to get leaderboard");
    }

    return response.json();
  } catch (error) {
    return DEMO_LEADERBOARD;
  }
}

export function isDemoMode(): boolean {
  return true;
}

// User ID storage functions
const USER_ID_KEY = "veriverse_user_id";

export function getStoredUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

export function setStoredUserId(userId: string): void {
  localStorage.setItem(USER_ID_KEY, userId);
}

export function clearStoredUserId(): void {
  localStorage.removeItem(USER_ID_KEY);
}

// Create user (signup)
export async function createUser(data: SignupUser): Promise<{ user_id: string } & User> {
  try {
    const response = await fetch(`${API_BASE}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create user");
    }

    const result = await response.json();
    setStoredUserId(result.user_id);
    return result;
  } catch (error) {
    // Demo mode fallback
    const demoUserId = `demo_user_${Date.now()}`;
    setStoredUserId(demoUserId);
    return {
      user_id: demoUserId,
      id: demoUserId,
      email: data.email || null,
      firstName: null,
      lastName: null,
      displayName: data.displayName,
      location: data.location || null,
      expertiseTags: data.expertiseTags || [],
      profileImageUrl: null,
      points: 0,
      precision: 0,
      attempts: 0,
      tier: "Bronze",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

// Get user by ID
export async function getUser(userId: string): Promise<User | null> {
  try {
    const response = await fetch(`${API_BASE}/api/users/${userId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error("Failed to fetch user");
    }

    return response.json();
  } catch (error) {
    // Demo mode fallback
    if (userId.startsWith("demo_user_")) {
      return {
        id: userId,
        email: null,
        firstName: null,
        lastName: null,
        displayName: "Demo User",
        location: null,
        expertiseTags: [],
        profileImageUrl: null,
        points: 0,
        precision: 0,
        attempts: 0,
        tier: "Bronze",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return null;
  }
}

// Get user history
export async function getUserHistory(userId: string): Promise<ClaimHistoryItem[]> {
  if (userId === "demo" || userId.startsWith("demo_user_")) {
    return DEMO_HISTORY;
  }

  try {
    const response = await fetch(`${API_BASE}/api/users/${userId}/history`);

    if (!response.ok) {
      return DEMO_HISTORY;
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return DEMO_HISTORY;
    }
    return data;
  } catch (error) {
    return DEMO_HISTORY;
  }
}
