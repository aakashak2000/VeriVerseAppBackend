import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getClaim, submitVote, getLoggedInUser } from "@/lib/api";
import type { FeedClaim, Vote, Evidence } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft,
  Clock, 
  MapPin, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle2, 
  AlertCircle,
  Send,
  User,
  Sparkles,
  ExternalLink,
  Search,
  Globe,
  ChevronDown,
  Brain
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

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-500";
  if (confidence >= 0.6) return "bg-amber-500";
  return "bg-red-500";
}

function getEvidenceIcon(toolName: string) {
  switch (toolName.toLowerCase()) {
    case "google_search":
    case "search":
      return <Search className="h-4 w-4" />;
    case "crawler":
    case "web":
      return <Globe className="h-4 w-4" />;
    default:
      return <ExternalLink className="h-4 w-4" />;
  }
}

function getModeratorVerdictBadge(groundTruth: number | null | undefined) {
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
    
  return (
    <Badge className={`${colorClasses} border-none`} data-testid={`verdict-${verdictText.toLowerCase()}`}>
      <CheckCircle2 className="h-3 w-3 mr-1" />Moderator Verified: {verdictText}
    </Badge>
  );
}

export default function ClaimDetailPage() {
  const [, params] = useRoute("/claim/:claimId");
  const claimId = params?.claimId;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const loggedInUser = getLoggedInUser();
  const userId = loggedInUser?.user_id;

  const [showVoteForm, setShowVoteForm] = useState(false);
  const [voteValue, setVoteValue] = useState<1 | -1 | null>(null);
  const [voteRationale, setVoteRationale] = useState("");
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const { data: claim, isLoading, isError } = useQuery<FeedClaim | null>({
    queryKey: ["/api/claims", claimId],
    queryFn: () => getClaim(claimId!),
    enabled: !!claimId,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ vote, rationale }: { vote: 1 | -1; rationale: string }) => {
      if (!userId || !claimId) throw new Error("Not logged in");
      return submitVote(claimId, userId, vote, rationale);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Vote submitted", description: "Your vote has been recorded." });
        queryClient.invalidateQueries({ queryKey: ["/api/claims", claimId] });
        setShowVoteForm(false);
        setVoteValue(null);
        setVoteRationale("");
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    },
  });

  const handleVoteClick = (vote: 1 | -1) => {
    setVoteValue(vote);
    setShowVoteForm(true);
  };

  const handleSubmitVote = () => {
    if (!voteValue || !voteRationale.trim()) return;
    voteMutation.mutate({ vote: voteValue, rationale: voteRationale.trim() });
  };

  const hasUserVoted = claim?.votes?.some((v: Vote) => v.user_id === userId);
  const isOwnClaim = claim?.author?.id === userId;
  const canVote = userId && !hasUserVoted && !isOwnClaim;

  const upvotes = claim?.votes?.filter((v: Vote) => v.vote === 1).length || 0;
  const downvotes = claim?.votes?.filter((v: Vote) => v.vote === -1).length || 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full mb-4" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (isError || !claim) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Claim Not Found</h1>
          <p className="text-muted-foreground mb-6">The claim you're looking for doesn't exist or has been removed.</p>
          <Link href="/feed">
            <Button data-testid="back-to-feed">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/feed">
          <Button variant="ghost" size="sm" className="mb-6" data-testid="back-link">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Feed
          </Button>
        </Link>

        <Card data-testid="claim-detail-card">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10" data-testid="author-avatar">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {claim.author?.name ? getInitials(claim.author.name) : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Link href={claim.author?.id ? `/profile/${claim.author.id}` : "#"}>
                    <p className="font-medium text-foreground hover:text-primary cursor-pointer" data-testid="author-name">
                      {claim.author?.name || "Anonymous"}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {claim.author?.location && (
                      <span className="flex items-center gap-1" data-testid="author-location">
                        <MapPin className="h-3 w-3" />
                        {claim.author.location}
                      </span>
                    )}
                    <span data-testid="claim-time">
                      {claim.created_at ? formatDistanceToNow(new Date(claim.created_at), { addSuffix: true }) : "Just now"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                {getStatusBadge(claim.status || "queued")}
                {getModeratorVerdictBadge(claim.ground_truth)}
              </div>
            </div>

            <h1 className="text-xl font-semibold text-foreground leading-relaxed" data-testid="claim-text">
              {claim.text}
            </h1>

            {claim.topics && claim.topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3" data-testid="claim-topics">
                {claim.topics.map((topic: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {claim.provisional_answer && (
              <div className="bg-muted/50 rounded-lg p-4" data-testid="provisional-answer">
                <div className="flex items-start gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <h3 className="font-semibold text-foreground">AI Verification Result</h3>
                </div>
                <p className="text-foreground leading-relaxed">{claim.provisional_answer}</p>
              </div>
            )}

            {claim.confidence !== undefined && claim.confidence > 0 && (
              <div data-testid="confidence-section">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Confidence Score</span>
                  <span className="text-lg font-bold text-foreground">{Math.round(claim.confidence * 100)}%</span>
                </div>
                <Progress 
                  value={claim.confidence * 100} 
                  className={`h-2 ${getConfidenceColor(claim.confidence)}`}
                />
              </div>
            )}

            {claim.evidence && claim.evidence.length > 0 && (
              <div data-testid="evidence-section">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Evidence Sources</h3>
                <div className="space-y-2">
                  {claim.evidence.map((ev: Evidence, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg" data-testid={`evidence-${i}`}>
                      <div className="text-muted-foreground mt-0.5">
                        {getEvidenceIcon(ev.tool_name)}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">{ev.tool_name.replace("_", " ")}</p>
                        <p className="text-sm text-foreground">{ev.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {claim.thinking && (
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
                      <span>AI Thinking Process</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${thinkingOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 p-4 bg-muted/30 rounded-lg border border-border/50" data-testid="thinking-content">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {claim.thinking}
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {canVote && !showVoteForm && (
              <div className="border-t pt-4" data-testid="vote-buttons">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Cast Your Vote</h3>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-green-300 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20"
                    onClick={() => handleVoteClick(1)}
                    data-testid="vote-agree"
                  >
                    <ThumbsUp className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                    Agree
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => handleVoteClick(-1)}
                    data-testid="vote-disagree"
                  >
                    <ThumbsDown className="h-4 w-4 mr-2 text-red-600 dark:text-red-400" />
                    Disagree
                  </Button>
                </div>
              </div>
            )}

            {showVoteForm && (
              <div className="border-t pt-4 space-y-3" data-testid="vote-form">
                <div className="flex items-center gap-2">
                  {voteValue === 1 ? (
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      <ThumbsUp className="h-3 w-3 mr-1" /> Agreeing
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                      <ThumbsDown className="h-3 w-3 mr-1" /> Disagreeing
                    </Badge>
                  )}
                </div>
                <Textarea
                  placeholder="Explain your reasoning..."
                  value={voteRationale}
                  onChange={(e) => setVoteRationale(e.target.value)}
                  className="resize-none"
                  rows={3}
                  data-testid="vote-rationale-input"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowVoteForm(false);
                      setVoteValue(null);
                      setVoteRationale("");
                    }}
                    data-testid="vote-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitVote}
                    disabled={!voteRationale.trim() || voteMutation.isPending}
                    data-testid="vote-submit"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    {voteMutation.isPending ? "Submitting..." : "Submit Vote"}
                  </Button>
                </div>
              </div>
            )}

            {!userId && (
              <div className="border-t pt-4 text-center" data-testid="login-prompt">
                <p className="text-muted-foreground mb-3">Log in to vote on this claim</p>
                <Link href="/login">
                  <Button variant="outline" data-testid="login-to-vote">Log In to Vote</Button>
                </Link>
              </div>
            )}

            {claim.votes && claim.votes.length > 0 && (
              <div className="border-t pt-4" data-testid="votes-section">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Expert Votes ({claim.votes.length})
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400" data-testid="upvotes-count">
                      <ThumbsUp className="h-4 w-4" />
                      <span className="text-sm font-medium">{upvotes}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400" data-testid="downvotes-count">
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
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                      <p className="text-sm text-muted-foreground">{vote.rationale}</p>
                      {vote.note && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-foreground">{vote.note}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
