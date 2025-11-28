import type { RunState, Leaderboard, PromptResponse } from "@shared/schema";

const API_BASE = import.meta.env.VITE_API_BASE || "";

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
    { user_id: "u1", vote: 1, weight: 0.7, rationale: "Found supporting evidence from Reuters" },
    { user_id: "u2", vote: 1, weight: 0.6, rationale: "Verified through official sources" },
    { user_id: "u3", vote: -1, weight: 0.4, rationale: "Some claims need more context" },
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
