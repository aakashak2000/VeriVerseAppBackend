import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Claim } from "@shared/schema";
import { ArrowLeft, Clock, CheckCircle, Loader2, AlertCircle, Users } from "lucide-react";

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground", icon: Clock },
  in_progress: { label: "In Progress", className: "bg-primary/10 text-primary", icon: Loader2 },
  awaiting_votes: { label: "Awaiting Votes", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Users },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="history-loading">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: claims, isLoading, error } = useQuery<Claim[]>({
    queryKey: ["/api/claims/history"],
    enabled: isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Session Expired",
        description: "Please sign in again.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  if (authLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
          <LoadingSkeleton />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2" data-testid="history-title">
            My Claims History
          </h1>
          <p className="text-muted-foreground" data-testid="history-subtitle">
            View all the claims you've submitted for verification.
          </p>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : claims && claims.length > 0 ? (
          <div className="space-y-4" data-testid="history-list">
            {claims.map((claim, index) => {
              const status = statusConfig[claim.status || "queued"];
              const StatusIcon = status.icon;
              const confidencePercent = claim.confidence ? Math.round(claim.confidence * 100) : 0;
              
              return (
                <Card key={claim.id} className="border hover-elevate" data-testid={`claim-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="font-medium text-foreground line-clamp-2" data-testid={`claim-prompt-${index}`}>
                        {claim.prompt}
                      </p>
                      <Badge 
                        variant="secondary" 
                        className={`${status.className} flex items-center gap-1 shrink-0`}
                        data-testid={`claim-status-${index}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>
                    
                    {claim.provisionalAnswer && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3" data-testid={`claim-answer-${index}`}>
                        {claim.provisionalAnswer}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        {confidencePercent > 0 && (
                          <span data-testid={`claim-confidence-${index}`}>
                            Confidence: {confidencePercent}%
                          </span>
                        )}
                        <span data-testid={`claim-date-${index}`}>
                          {claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border" data-testid="history-empty">
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mb-2">No claims yet</h3>
              <p className="text-muted-foreground mb-6">
                Start verifying claims to build your history.
              </p>
              <Link href="/ask">
                <Button data-testid="button-first-claim">
                  Verify Your First Claim
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex justify-center">
          <Link href="/ask">
            <Button variant="outline" data-testid="button-back-to-ask">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Ask
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
