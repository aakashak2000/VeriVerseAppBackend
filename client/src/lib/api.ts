import type { RunState, Leaderboard, PromptResponse, SignupUser, User, ClaimHistoryItem, FeedClaim, Vote, CommunityNoteWithAuthor } from "@shared/schema";

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

// Login user
export type LoginResult = {
  user_id: string;
  display_name: string;
  location: string;
  expertise: string[];
  email: string | null;
  precision: number;
  points: number;
  tier: string;
  topic_precision: Record<string, number>;
};

const LOGGED_IN_USER_KEY = "veriverse_logged_in_user";

export async function loginUser(loginId: string, password: string): Promise<LoginResult | null> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ login_id: loginId, password }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    setStoredUserId(result.user_id);
    localStorage.setItem(LOGGED_IN_USER_KEY, JSON.stringify(result));
    return result;
  } catch (error) {
    return null;
  }
}

export function getLoggedInUser(): LoginResult | null {
  const stored = localStorage.getItem(LOGGED_IN_USER_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export function logoutUser(): void {
  clearStoredUserId();
  localStorage.removeItem(LOGGED_IN_USER_KEY);
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
      loginId: null,
      passwordHash: null,
      firstName: null,
      lastName: null,
      displayName: data.displayName,
      location: data.location || null,
      expertiseTags: data.expertiseTags || [],
      topicPrecision: {},
      profileImageUrl: null,
      points: 0,
      precision: 0.5,
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
        loginId: null,
        passwordHash: null,
        firstName: null,
        lastName: null,
        displayName: "Demo User",
        location: null,
        expertiseTags: [],
        topicPrecision: {},
        profileImageUrl: null,
        points: 0,
        precision: 0.5,
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

// ========== COMMUNITY FEED API ==========

// Demo feed data for when backend is unavailable
const DEMO_FEED: FeedClaim[] = [
  {
    id: "demo_claim_1",
    text: "Apple is building a new AI data center in Mumbai.",
    topics: ["Technology", "AI", "India"],
    location: "Mumbai",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    status: "completed",
    author: {
      id: "demo_aakash",
      name: "Aakash Kumar",
      location: "Mumbai",
      expertise: ["Technology", "Sports"],
    },
    ai_summary: "Verified by tech experts. Multiple sources confirm Apple's expansion plans in India.",
    provisional_answer: "This claim appears to be accurate. Apple has announced plans for significant infrastructure investment in India.",
    confidence: 0.87,
    credibility_score: 0.89,
    relevancy_score: 0.92,
    votes: [
      { user_id: "demo_aakash", name: "Aakash Kumar", domain: "Technology", location: "Mumbai", vote: 1, weight: 0.95, rationale: "Verified through industry sources", match_reasons: ["domain_expert", "location_match"] },
      { user_id: "demo_parth", name: "Parth Joshi", domain: "Technology", location: "Gujarat", vote: 1, weight: 0.82, rationale: "Consistent with Apple's India strategy", match_reasons: ["domain_expert"] },
    ],
    community_notes: [
      { id: "note_1", note: "I've seen construction activity near the proposed site.", created_at: new Date(Date.now() - 1800000).toISOString(), author: { id: "demo_parth", name: "Parth Joshi", location: "Gujarat" } },
    ],
  },
  {
    id: "demo_claim_2",
    text: "RBI is piloting an AI-based credit scoring system for rural loans.",
    topics: ["Finance", "AI", "India"],
    location: "India",
    created_at: new Date(Date.now() - 7200000).toISOString(),
    status: "completed",
    author: {
      id: "demo_aneesha",
      name: "Aneesha Manke",
      location: "Nagpur",
      expertise: ["Business", "Product", "AI", "Finance"],
    },
    ai_summary: "Finance and AI experts validate this initiative. The RBI has been exploring fintech solutions.",
    provisional_answer: "This claim is verified. RBI has announced pilot programs for AI-based credit scoring.",
    confidence: 0.91,
    credibility_score: 0.93,
    relevancy_score: 0.95,
    votes: [
      { user_id: "demo_aneesha", name: "Aneesha Manke", domain: "Finance", location: "Nagpur", vote: 1, weight: 0.92, rationale: "Verified through RBI publications", match_reasons: ["domain_expert", "verified_professional"] },
      { user_id: "demo_shaurya", name: "Shaurya Negi", domain: "Finance", location: "Dehradun", vote: 1, weight: 0.88, rationale: "Consistent with fintech policy trends", match_reasons: ["domain_expert"] },
    ],
    community_notes: [
      { id: "note_2", note: "RBI has been actively publishing research on this. The pilot is already underway.", created_at: new Date(Date.now() - 3600000).toISOString(), author: { id: "demo_aneesha", name: "Aneesha Manke", location: "Nagpur" } },
    ],
  },
  {
    id: "demo_claim_3",
    text: "BCCI is planning a new T20 league in the USA.",
    topics: ["Sports", "Business"],
    location: "USA",
    created_at: new Date(Date.now() - 10800000).toISOString(),
    status: "completed",
    author: {
      id: "demo_aakash",
      name: "Aakash Kumar",
      location: "Mumbai",
      expertise: ["Technology", "Sports"],
    },
    ai_summary: "Sports industry experts confirm BCCI's expansion plans for North American cricket.",
    provisional_answer: "This claim is likely accurate based on recent BCCI announcements.",
    confidence: 0.82,
    credibility_score: 0.85,
    relevancy_score: 0.78,
    votes: [
      { user_id: "demo_aakash", name: "Aakash Kumar", domain: "Sports", location: "Mumbai", vote: 1, weight: 0.88, rationale: "Confirmed by multiple sports news outlets", match_reasons: ["domain_expert"] },
    ],
    community_notes: [],
  },
  {
    id: "demo_claim_4",
    text: "Organic gardening in Brazil has increased by 40% this year.",
    topics: ["Gardening", "Brazil", "Agriculture"],
    location: "Brazil",
    created_at: new Date(Date.now() - 14400000).toISOString(),
    status: "awaiting_votes",
    author: {
      id: "demo_parth",
      name: "Parth Joshi",
      location: "Gujarat",
      expertise: ["Technology", "Food", "India"],
    },
    ai_summary: "Limited expert coverage for this topic. Claim requires more verification.",
    provisional_answer: "This claim needs more verification. Our experts have limited coverage in Brazilian agriculture.",
    confidence: 0.45,
    credibility_score: 0.40,
    relevancy_score: 0.25,
    votes: [],
    community_notes: [],
  },
];

// Fetch all claims for the feed
export async function fetchClaims(params: { userId?: string; sort?: "relevant" | "latest" }): Promise<FeedClaim[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.userId) queryParams.set("userId", params.userId);
    if (params.sort) queryParams.set("sort", params.sort);

    const response = await fetch(`${API_BASE}/api/claims?${queryParams.toString()}`);

    if (!response.ok) {
      console.warn("Backend unavailable, using demo data");
      return DEMO_FEED;
    }

    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    
    return DEMO_FEED;
  } catch (error) {
    console.warn("Failed to fetch claims, using demo data:", error);
    return DEMO_FEED;
  }
}

// Create a new claim
export async function createClaim(userId: string, text: string, topics?: string[]): Promise<{ claim_id: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/claims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        text,
        topics: topics || [],
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create claim");
    }

    return response.json();
  } catch (error) {
    return { claim_id: `demo_claim_${Date.now()}` };
  }
}

// Add a community note to a claim
export async function addCommunityNote(claimId: string, userId: string, note: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/claims/${claimId}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        note,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to add note");
    }
  } catch (error) {
    console.log("Note added in demo mode");
  }
}

// Seed demo data
export async function seedDemoData(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/seed`, { method: "POST" });
  } catch (error) {
    console.log("Using demo mode");
  }
}
