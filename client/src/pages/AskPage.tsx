import { useState, useEffect, useCallback, useRef } from "react";
import { useSearch, Link } from "wouter";
import Layout from "@/components/Layout";
import ClaimInputCard from "@/components/ClaimInputCard";
import ResultCard from "@/components/ResultCard";
import { Button } from "@/components/ui/button";
import { createPrompt, getRun } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { RunState, AIStep } from "@shared/schema";
import { Loader2, Wifi, WifiOff, ExternalLink, Brain, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function AskPage() {
  const searchString = useSearch();
  const [runId, setRunId] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(false);
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
    setRunState(null);
    setRunId(null);
    setClaimId(null);
    setIsDemo(false);
    setThinkingOpen(false);
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setIsProcessing(true);
    setRunState({
      run_id: "pending",
      status: "in_progress",
      provisional_answer: "",
      confidence: 0,
      votes: [],
      evidence: [],
    });
    setLastUpdated(new Date());

    const response = await createPrompt(claim);
    const isDemoRun = response.run_id.startsWith("demo_run_");
    setIsDemo(isDemoRun);
    setRunId(response.run_id);
    if (response.claim_id) {
      setClaimId(response.claim_id);
    }
    
    await pollRunStatus(response.run_id, isDemoRun);
    
    setIsProcessing(false);
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
          <ClaimInputCard onSubmit={handleSubmit} isLoading={isProcessing} />

          {isProcessing && runState?.status === "in_progress" && !runState.provisional_answer && (
            <div className="flex items-center justify-center py-12 text-muted-foreground" data-testid="processing-loading">
              <Loader2 className="h-6 w-6 animate-spin mr-3" />
              <span>Agent doing its magic...</span>
            </div>
          )}

          {runState && runState.provisional_answer && (
            <>
              <ResultCard 
                runState={runState} 
                lastUpdated={lastUpdated || undefined}
              />

              {runState.steps && runState.steps.length > 0 && (
                <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen}>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full justify-between text-muted-foreground hover:text-foreground"
                      data-testid="thinking-toggle"
                    >
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        <span>View AI Thinking Process</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${thinkingOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 bg-muted/30 rounded-lg border border-border/50 space-y-4" data-testid="thinking-content">
                      {runState.steps.map((s: AIStep) => (
                        <div key={s.step} className="space-y-1" data-testid={`step-${s.step}`}>
                          <p className="text-sm font-medium text-foreground">
                            <span className="text-primary">Step {s.step}:</span> {s.thought}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Tool:</span> {s.tool}
                          </p>
                          {s.tool_output && (
                            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-1 line-clamp-3">
                              <span className="font-medium">Output:</span> {s.tool_output}
                            </p>
                          )}
                        </div>
                      ))}
                      
                      {runState.citations && runState.citations.length > 0 && (
                        <div className="pt-3 border-t border-border/50" data-testid="citations-section">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Citations:</p>
                          <div className="flex flex-wrap gap-2">
                            {runState.citations.map((url, i) => (
                              <a 
                                key={i} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline truncate max-w-[200px]"
                                data-testid={`citation-${i}`}
                              >
                                {url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
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
