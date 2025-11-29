import { useState, useEffect, useCallback, useRef } from "react";
import { useSearch, Link } from "wouter";
import Layout from "@/components/Layout";
import ClaimInputCard from "@/components/ClaimInputCard";
import ResultCard from "@/components/ResultCard";
import { Button } from "@/components/ui/button";
import { createPrompt, getRun } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { RunState } from "@shared/schema";
import { Loader2, Wifi, WifiOff, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AskPage() {
  const searchString = useSearch();
  const [runId, setRunId] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isCompleted = runState?.status === "completed";

  const handleWebSocketUpdate = useCallback((data: RunState) => {
    setRunState(data);
    setLastUpdated(new Date());
    
    // Clear polling when we get a WebSocket update
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const { isConnected } = useWebSocket({
    runId: isDemo ? null : runId,
    onUpdate: handleWebSocketUpdate,
    enabled: !isDemo && !isCompleted,
  });

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

  // Start/stop polling based on WebSocket connection status
  useEffect(() => {
    // Only poll if:
    // - We have a runId
    // - Not in demo mode
    // - Not completed
    // - WebSocket is NOT connected
    const shouldPoll = runId && !isDemo && !isCompleted && !isConnected;
    
    if (shouldPoll) {
      // Clear any existing polling first
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      
      // Start polling as fallback
      pollingRef.current = setInterval(() => {
        pollRunStatus(runId, false);
      }, 3000);
    } else if (pollingRef.current) {
      // Stop polling when WebSocket is connected or run is complete
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [runId, isDemo, isCompleted, isConnected, pollRunStatus]);

  const handleSubmit = async (claim: string) => {
    setIsSubmitting(true);
    setRunState(null);
    setRunId(null);
    setClaimId(null);
    setIsDemo(false);
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const response = await createPrompt(claim);
    const isDemoRun = response.run_id.startsWith("demo_run_");
    setIsDemo(isDemoRun);
    setRunId(response.run_id);
    if (response.claim_id) {
      setClaimId(response.claim_id);
    }
    
    setRunState({
      run_id: response.run_id,
      status: response.status as RunState["status"],
      provisional_answer: "",
      confidence: 0,
      votes: [],
      evidence: [],
    });
    setLastUpdated(new Date());
    
    // Fetch initial state
    await pollRunStatus(response.run_id, isDemoRun);
    
    setIsSubmitting(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const urlRunId = params.get("run_id");
    if (urlRunId) {
      setRunId(urlRunId);
      const isDemoRun = urlRunId.startsWith("demo_run_");
      setIsDemo(isDemoRun);
      pollRunStatus(urlRunId, isDemoRun);
    }
  }, [searchString, pollRunStatus]);

  return (
    <Layout error={isDemo ? "Backend unavailable, running in demo mode" : null}>
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="ask-title">
              Verify a Claim
            </h1>
            {runId && !isDemo && !isCompleted && (
              <Badge 
                variant="outline" 
                className={isConnected ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}
                data-testid="connection-status"
              >
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3 mr-1" />
                    Live
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 mr-1" />
                    Polling
                  </>
                )}
              </Badge>
            )}
          </div>
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

          {isCompleted && claimId && (
            <div className="flex justify-center gap-3 mt-6" data-testid="completed-actions">
              <Link href={`/claim/${claimId}`}>
                <Button data-testid="view-claim-button">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Claim Details
                </Button>
              </Link>
              <Link href="/feed">
                <Button variant="outline" data-testid="view-feed-button">
                  View in Feed
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
