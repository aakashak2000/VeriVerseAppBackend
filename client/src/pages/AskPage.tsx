import { useState, useEffect, useCallback, useRef } from "react";
import Layout from "@/components/Layout";
import ClaimInputCard from "@/components/ClaimInputCard";
import ResultCard from "@/components/ResultCard";
import { createPrompt, getRun } from "@/lib/api";
import type { RunState } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function AskPage() {
  const [runState, setRunState] = useState<RunState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const pollRunStatus = useCallback(async (id: string, isDemoRun: boolean) => {
    const state = await getRun(id);
    setRunState(state);
    setLastUpdated(new Date());
    
    if (state.status === "completed" || isDemoRun) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleSubmit = async (claim: string) => {
    setIsSubmitting(true);
    setRunState(null);
    setIsDemo(false);
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const response = await createPrompt(claim);
    const isDemoRun = response.run_id.startsWith("demo_run_");
    setIsDemo(isDemoRun);
    
    setRunState({
      run_id: response.run_id,
      status: response.status as RunState["status"],
      provisional_answer: "",
      confidence: 0,
      votes: [],
      evidence: [],
    });
    setLastUpdated(new Date());
    
    await pollRunStatus(response.run_id, isDemoRun);
    
    if (!isDemoRun) {
      pollingRef.current = setInterval(() => {
        pollRunStatus(response.run_id, false);
      }, 3000);
    }
    
    setIsSubmitting(false);
  };

  return (
    <Layout error={isDemo ? "Backend unavailable, running in demo mode" : null}>
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2" data-testid="ask-title">
            Verify a Claim
          </h1>
          <p className="text-muted-foreground" data-testid="ask-subtitle">
            Paste any news headline or claim to check its accuracy with AI-powered analysis and community verification.
          </p>
        </div>

        <div className="space-y-6">
          <ClaimInputCard onSubmit={handleSubmit} isLoading={isSubmitting} />

          {isSubmitting && !runState && (
            <div className="flex items-center justify-center py-12 text-muted-foreground" data-testid="initial-loading">
              <Loader2 className="h-6 w-6 animate-spin mr-3" />
              <span>Submitting claim for verification...</span>
            </div>
          )}

          {runState && (
            <ResultCard 
              runState={runState} 
              lastUpdated={lastUpdated || undefined}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
