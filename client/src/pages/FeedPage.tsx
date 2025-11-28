import { useState, useEffect } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchClaims, addCommunityNote, getStoredUserId } from "@/lib/api";
import type { FeedClaim, Vote, CommunityNoteWithAuthor } from "@shared/schema";
import { 
  Clock, 
  MapPin, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  Send,
  SlidersHorizontal,
  User,
  Sparkles
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
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none" data-testid="status-completed"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
    case "awaiting_votes":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none" data-testid="status-awaiting"><AlertCircle className="h-3 w-3 mr-1" />Awaiting Votes</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none" data-testid="status-progress"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground hover:bg-muted border-none" data-testid="status-queued"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
  }
}

function getCredibilityColor(score: number): string {
  if (score >= 0.8) return "text-green-600";
  if (score >= 0.6) return "text-amber-600";
  return "text-red-600";
}

function getCredibilityBgColor(score: number): string {
  if (score >= 0.8) return "bg-green-50";
  if (score >= 0.6) return "bg-amber-50";
  return "bg-red-50";
}

interface ClaimCardProps {
  claim: FeedClaim;
  onAddNote?: (claimId: string, note: string) => Promise<void>;
  userId?: string | null;
}

function ClaimCard({ claim, onAddNote, userId }: ClaimCardProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitNote = async () => {
    if (!noteText.trim() || !onAddNote) return;
    setIsSubmitting(true);
    await onAddNote(claim.id, noteText.trim());
    setNoteText("");
    setShowNoteInput(false);
    setIsSubmitting(false);
  };

  const upvotes = claim.votes?.filter((v: Vote) => v.vote === 1).length || 0;
  const downvotes = claim.votes?.filter((v: Vote) => v.vote === -1).length || 0;
  const topVoter = claim.votes?.[0];

  return (
    <Card className="mb-4 hover-elevate" data-testid={`claim-card-${claim.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10" data-testid={`avatar-${claim.author?.id}`}>
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {claim.author?.name ? getInitials(claim.author.name) : <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground" data-testid={`author-name-${claim.id}`}>
                {claim.author?.name || "Anonymous"}
              </p>
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
          {getStatusBadge(claim.status || "queued")}
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
          <div className="flex items-center gap-4 mb-4" data-testid={`credibility-${claim.id}`}>
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
          <div className="space-y-2 mb-4" data-testid={`votes-section-${claim.id}`}>
            <p className="text-sm font-medium text-muted-foreground">
              Expert Votes ({claim.votes.length})
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-green-600" data-testid={`upvotes-${claim.id}`}>
                <ThumbsUp className="h-4 w-4" />
                <span className="text-sm font-medium">{upvotes}</span>
              </div>
              <div className="flex items-center gap-1 text-red-600" data-testid={`downvotes-${claim.id}`}>
                <ThumbsDown className="h-4 w-4" />
                <span className="text-sm font-medium">{downvotes}</span>
              </div>
              {topVoter && (
                <div className="text-xs text-muted-foreground" data-testid={`top-voter-${claim.id}`}>
                  Top expert: <span className="font-medium">{topVoter.name}</span> ({topVoter.domain})
                </div>
              )}
            </div>
          </div>
        )}

        {claim.community_notes && claim.community_notes.length > 0 && (
          <div className="border-t pt-3 mt-3" data-testid={`notes-section-${claim.id}`}>
            <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Community Notes ({claim.community_notes.length})
            </p>
            <div className="space-y-2">
              {claim.community_notes.map((note: CommunityNoteWithAuthor) => (
                <div key={note.id} className="bg-muted/50 rounded-lg p-3" data-testid={`note-${note.id}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {note.author?.name ? getInitials(note.author.name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{note.author?.name || "Anonymous"}</span>
                    {note.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{note.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex-col items-stretch gap-3">
        {showNoteInput ? (
          <div className="w-full space-y-2" data-testid={`note-form-${claim.id}`}>
            <Textarea
              placeholder="Add your insight or context..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="resize-none"
              rows={2}
              data-testid={`note-input-${claim.id}`}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNoteInput(false);
                  setNoteText("");
                }}
                data-testid={`note-cancel-${claim.id}`}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitNote}
                disabled={!noteText.trim() || isSubmitting}
                data-testid={`note-submit-${claim.id}`}
              >
                <Send className="h-3 w-3 mr-1" />
                {isSubmitting ? "Posting..." : "Post Note"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {userId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowNoteInput(true)}
                data-testid={`add-note-${claim.id}`}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            )}
            <Link href="/ask">
              <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid={`verify-link-${claim.id}`}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Verify Similar
              </Button>
            </Link>
          </div>
        )}
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
  const [claims, setClaims] = useState<FeedClaim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [sortBy, setSortBy] = useState<"relevant" | "latest">("relevant");
  const userId = getStoredUserId();

  const loadClaims = async () => {
    setIsLoading(true);
    const data = await fetchClaims({ userId: userId || undefined, sort: sortBy });
    setClaims(data);
    
    const isDemoData = data.length > 0 && data[0].id?.startsWith("demo_");
    setIsDemo(isDemoData);
    
    setIsLoading(false);
  };

  useEffect(() => {
    loadClaims();
  }, [sortBy, userId]);

  const handleAddNote = async (claimId: string, note: string) => {
    if (!userId) return;
    await addCommunityNote(claimId, userId, note);
    await loadClaims();
  };

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

        <div className="flex items-center justify-between mb-6">
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
                onAddNote={handleAddNote}
                userId={userId}
              />
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center gap-4" data-testid="feed-actions">
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
