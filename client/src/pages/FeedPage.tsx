import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchClaims, getStoredUserId, getLoggedInUser } from "@/lib/api";
import type { FeedClaim, Vote } from "@shared/schema";
import { 
  Clock, 
  MapPin, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle2, 
  AlertCircle,
  SlidersHorizontal,
  User,
  Sparkles,
  MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border-none" data-testid="status-completed">
          <CheckCircle2 className="h-3 w-3 mr-1" />Verified
        </Badge>
      );
    case "awaiting_votes":
      return (
        <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-none" data-testid="status-awaiting">
          <AlertCircle className="h-3 w-3 mr-1" />Awaiting Votes
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-none" data-testid="status-progress">
          <Clock className="h-3 w-3 mr-1" />In Progress
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted text-muted-foreground hover:bg-muted border-none" data-testid="status-queued">
          <Clock className="h-3 w-3 mr-1" />Queued
        </Badge>
      );
  }
}

function getCredibilityColor(score: number): string {
  if (score >= 0.8) return "text-green-600 dark:text-green-400";
  if (score >= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getCredibilityBgColor(score: number): string {
  if (score >= 0.8) return "bg-green-50 dark:bg-green-900/20";
  if (score >= 0.6) return "bg-amber-50 dark:bg-amber-900/20";
  return "bg-red-50 dark:bg-red-900/20";
}

function getModeratorVerdictBadge(groundTruth: number | null | undefined, resolvedAt?: string) {
  if (groundTruth === null || groundTruth === undefined) {
    return (
      <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border-none" data-testid="verdict-pending">
        <Clock className="h-3 w-3 mr-1" />Awaiting Moderator Verdict
      </Badge>
    );
  }
  
  const verdictText = groundTruth === 1 ? "TRUE" : groundTruth === -1 ? "FALSE" : "MIXED";
  const colorClasses = groundTruth === 1 
    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
    : groundTruth === -1
    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30";
  
  const resolvedText = resolvedAt 
    ? ` (${formatDistanceToNow(new Date(resolvedAt), { addSuffix: true })})` 
    : "";
    
  return (
    <Badge className={`${colorClasses} border-none`} data-testid={`verdict-${verdictText.toLowerCase()}`}>
      <CheckCircle2 className="h-3 w-3 mr-1" />Verified: {verdictText}{resolvedText}
    </Badge>
  );
}

interface ClaimCardProps {
  claim: FeedClaim;
  userId: string | null;
}

function ClaimCard({ claim, userId }: ClaimCardProps) {
  const [, setLocation] = useLocation();

  const upvotes = claim.votes?.filter((v: Vote) => v.vote === 1).length || 0;
  const downvotes = claim.votes?.filter((v: Vote) => v.vote === -1).length || 0;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('textarea')) {
      return;
    }
    setLocation(`/claim/${claim.id}`);
  };

  return (
    <Card 
      className="mb-4 hover-elevate cursor-pointer" 
      data-testid={`claim-card-${claim.id}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10" data-testid={`avatar-${claim.author?.id}`}>
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {claim.author?.name ? getInitials(claim.author.name) : <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link href={claim.author?.id ? `/profile/${claim.author.id}` : "#"}>
                <p className="font-medium text-foreground hover:text-primary cursor-pointer" data-testid={`author-name-${claim.id}`}>
                  {claim.author?.name || "Anonymous"}
                </p>
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {claim.author?.location && (
                  <span className="flex items-center gap-1" data-testid={`author-location-${claim.id}`}>
                    <MapPin className="h-3 w-3" />
                    {claim.author.location}
                  </span>
                )}
                <span data-testid={`claim-time-${claim.id}`}>
                  {claim.created_at ? formatDistanceToNow(new Date(claim.created_at), { addSuffix: true }) : "Just now"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {getStatusBadge(claim.status || "queued")}
            {getModeratorVerdictBadge(claim.ground_truth, claim.resolved_at)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-foreground mb-4 text-base leading-relaxed" data-testid={`claim-text-${claim.id}`}>
          {claim.text}
        </p>

        {claim.topics && claim.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4" data-testid={`claim-topics-${claim.id}`}>
            {claim.topics.map((topic: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {claim.ai_summary && (
          <div className={`rounded-lg p-3 mb-4 ${getCredibilityBgColor(claim.credibility_score || 0)}`} data-testid={`ai-summary-${claim.id}`}>
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">AI Summary</p>
                <p className="text-sm text-muted-foreground">{claim.ai_summary}</p>
              </div>
            </div>
          </div>
        )}

        {claim.credibility_score !== undefined && claim.credibility_score > 0 && (
          <div className="flex items-center gap-4 mb-4 flex-wrap" data-testid={`credibility-${claim.id}`}>
            <div className={`flex items-center gap-2 ${getCredibilityColor(claim.credibility_score)}`}>
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-lg font-bold">{Math.round(claim.credibility_score * 100)}%</span>
              <span className="text-sm">Credibility</span>
            </div>
            {claim.relevancy_score !== undefined && claim.relevancy_score > 0 && (
              <div className="text-muted-foreground text-sm" data-testid={`relevancy-${claim.id}`}>
                {Math.round(claim.relevancy_score * 100)}% Relevancy to you
              </div>
            )}
          </div>
        )}

        {claim.votes && claim.votes.length > 0 && (
          <div className="space-y-3 mb-4" data-testid={`votes-section-${claim.id}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Expert Votes ({claim.votes.length})
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400" data-testid={`upvotes-${claim.id}`}>
                  <ThumbsUp className="h-4 w-4" />
                  <span className="text-sm font-medium">{upvotes}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600 dark:text-red-400" data-testid={`downvotes-${claim.id}`}>
                  <ThumbsDown className="h-4 w-4" />
                  <span className="text-sm font-medium">{downvotes}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {claim.votes.map((vote: Vote) => (
                <div 
                  key={vote.user_id} 
                  className={`rounded-lg p-3 ${vote.vote === 1 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}
                  data-testid={`vote-${vote.user_id}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(vote.name)}
                      </AvatarFallback>
                    </Avatar>
                    <Link href={`/profile/${vote.user_id}`}>
                      <span className="text-sm font-medium hover:text-primary cursor-pointer">{vote.name}</span>
                    </Link>
                    <Badge variant="secondary" className="text-xs">{vote.domain}</Badge>
                    {vote.location && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {vote.location}
                      </span>
                    )}
                    {vote.vote === 1 ? (
                      <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400 ml-auto" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 text-red-600 dark:text-red-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{vote.rationale}</p>
                  {vote.note && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-foreground" data-testid={`vote-note-${vote.user_id}`}>{vote.note}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex-col items-stretch gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid={`view-details-${claim.id}`}>
            View Details
          </Button>
          <Link href="/ask">
            <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid={`verify-link-${claim.id}`}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Verify Similar
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

function ClaimCardSkeleton() {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-4" />
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export default function FeedPage() {
  const [sortBy, setSortBy] = useState<"relevant" | "latest">("relevant");
  const storedUserId = getStoredUserId();
  const loggedInUser = getLoggedInUser();
  const userId = loggedInUser?.user_id || storedUserId;

  const { data: claims = [], isLoading, isError, refetch } = useQuery<FeedClaim[]>({
    queryKey: ["/api/claims", sortBy, userId],
    queryFn: () => fetchClaims({ userId: userId || undefined, sort: sortBy }),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const isDemo = claims.length > 0 && claims[0].id?.startsWith("demo_");

  return (
    <Layout error={isDemo ? "Backend unavailable, running in demo mode" : null}>
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2" data-testid="feed-title">
            Community Feed
          </h1>
          <p className="text-muted-foreground" data-testid="feed-subtitle">
            Claims verified by AI and the community, personalized for your expertise.
          </p>
        </div>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sort by:</span>
          </div>
          <div className="flex gap-2" data-testid="sort-options">
            <Button
              variant={sortBy === "relevant" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSortBy("relevant")}
              data-testid="sort-relevant"
            >
              Relevant
            </Button>
            <Button
              variant={sortBy === "latest" ? "default" : "ghost"}
              size="sm"
              onClick={() => setSortBy("latest")}
              data-testid="sort-latest"
            >
              Latest
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div data-testid="feed-loading">
            <ClaimCardSkeleton />
            <ClaimCardSkeleton />
            <ClaimCardSkeleton />
          </div>
        ) : isError ? (
          <Card className="p-8 text-center" data-testid="feed-error">
            <p className="text-muted-foreground mb-4">Failed to load claims. Please try again.</p>
            <Button onClick={() => refetch()} data-testid="retry-button">
              Retry
            </Button>
          </Card>
        ) : claims.length === 0 ? (
          <Card className="p-8 text-center" data-testid="feed-empty">
            <p className="text-muted-foreground mb-4">No claims to show yet.</p>
            <Link href="/ask">
              <Button data-testid="submit-first-claim">Submit the First Claim</Button>
            </Link>
          </Card>
        ) : (
          <div data-testid="feed-claims">
            {claims.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                userId={userId}
              />
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center gap-4 flex-wrap" data-testid="feed-actions">
          <Link href="/ask">
            <Button data-testid="submit-claim-button">
              Submit New Claim
            </Button>
          </Link>
          <Link href="/verify">
            <Button variant="outline" data-testid="view-leaderboard-button">
              View Leaderboard
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
