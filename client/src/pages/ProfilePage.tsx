import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoggedInUser, getStoredUserId, fetchClaims, type LoginResult } from "@/lib/api";
import type { FeedClaim, Vote, User } from "@shared/schema";
import { 
  Trophy, 
  Target, 
  Star, 
  MapPin, 
  FileText,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Award,
  TrendingUp,
  Clock
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

function getTierColor(tier: string): string {
  switch (tier?.toLowerCase()) {
    case "diamond":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400";
    case "gold":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
    case "silver":
      return "bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-400";
    default:
      return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
  }
}

interface StatCardProps {
  icon: typeof Trophy;
  label: string;
  value: string | number;
  subValue?: string;
}

function StatCard({ icon: Icon, label, value, subValue }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
            {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ClaimPreviewCardProps {
  claim: FeedClaim;
}

function ClaimPreviewCard({ claim }: ClaimPreviewCardProps) {
  const upvotes = claim.votes?.filter((v: Vote) => v.vote === 1).length || 0;
  const downvotes = claim.votes?.filter((v: Vote) => v.vote === -1).length || 0;

  return (
    <Card className="mb-3 hover-elevate">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-2 mb-2">{claim.text}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {claim.created_at ? formatDistanceToNow(new Date(claim.created_at), { addSuffix: true }) : "Recently"}
              </span>
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <ThumbsUp className="h-3 w-3" />
                {upvotes}
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <ThumbsDown className="h-3 w-3" />
                {downvotes}
              </span>
            </div>
          </div>
          <Badge variant="secondary" className={`${claim.credibility_score >= 0.8 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : claim.credibility_score >= 0.6 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
            {Math.round(claim.credibility_score * 100)}%
          </Badge>
        </div>
        {claim.topics && claim.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {claim.topics.slice(0, 3).map((topic, i) => (
              <Badge key={i} variant="outline" className="text-xs">{topic}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface VotePreviewCardProps {
  claim: FeedClaim;
  vote: Vote;
}

function VotePreviewCard({ claim, vote }: VotePreviewCardProps) {
  return (
    <Card className="mb-3 hover-elevate">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${vote.vote === 1 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            {vote.vote === 1 ? (
              <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <ThumbsDown className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground line-clamp-2 mb-1">{claim.text}</p>
            <p className="text-xs text-muted-foreground mb-2">{vote.rationale}</p>
            {vote.note && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="line-clamp-2">{vote.note}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ userId?: string }>();
  const [userData, setUserData] = useState<LoginResult | null>(null);
  
  const viewingUserId = params.userId;
  const isOwnProfile = !viewingUserId;

  useEffect(() => {
    const loggedIn = getLoggedInUser();
    if (loggedIn) {
      setUserData(loggedIn);
    } else if (isOwnProfile) {
      const storedId = getStoredUserId();
      if (!storedId) {
        setLocation("/login");
      }
    }
  }, [setLocation, isOwnProfile]);

  const { data: claims = [], isLoading } = useQuery<FeedClaim[]>({
    queryKey: ["/api/claims", "latest"],
    queryFn: () => fetchClaims({ sort: "latest" }),
    staleTime: 30000,
  });

  const { data: viewedUser } = useQuery<User>({
    queryKey: ["/api/users", viewingUserId],
    enabled: !!viewingUserId,
  });

  const userId = viewingUserId || userData?.user_id || getStoredUserId();

  const userClaims = claims.filter(c => c.author?.id === userId);

  const userVotes: { claim: FeedClaim; vote: Vote }[] = [];
  claims.forEach(claim => {
    const userVote = claim.votes?.find(v => v.user_id === userId);
    if (userVote) {
      userVotes.push({ claim, vote: userVote });
    }
  });

  const votesWithNotes = userVotes.filter(v => v.vote.note);

  if (!userId && isOwnProfile) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Please Log In</h1>
          <p className="text-muted-foreground mb-6">You need to be logged in to view your profile.</p>
          <Link href="/login">
            <Button data-testid="button-login-redirect">Log In</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const profileData = viewedUser 
    ? {
        displayName: viewedUser.displayName || "User",
        location: viewedUser.location || "",
        expertise: (viewedUser.expertiseTags as string[]) || [],
        precision: viewedUser.precision || 0,
        points: viewedUser.points || 0,
        tier: viewedUser.tier || "Bronze",
        topicPrecision: (viewedUser.topicPrecision as Record<string, number>) || {},
      }
    : {
        displayName: userData?.display_name || "User",
        location: userData?.location || "",
        expertise: userData?.expertise || [],
        precision: userData?.precision || 0,
        points: userData?.points || 0,
        tier: userData?.tier || "Bronze",
        topicPrecision: userData?.topic_precision || {},
      };

  const { displayName, location, expertise, precision, points, tier, topicPrecision } = profileData;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground" data-testid="profile-name">
                    {displayName}
                  </h1>
                  <Badge className={getTierColor(tier)} data-testid="profile-tier">
                    <Award className="h-3 w-3 mr-1" />
                    {tier}
                  </Badge>
                </div>

                {location && (
                  <p className="text-muted-foreground flex items-center gap-1 mb-3" data-testid="profile-location">
                    <MapPin className="h-4 w-4" />
                    {location}
                  </p>
                )}

                {expertise.length > 0 && (
                  <div className="flex flex-wrap gap-2" data-testid="profile-expertise">
                    {expertise.map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Trophy}
            label="Points"
            value={points.toLocaleString()}
          />
          <StatCard
            icon={Target}
            label="Precision"
            value={`${Math.round(precision * 100)}%`}
          />
          <StatCard
            icon={FileText}
            label="Posts"
            value={userClaims.length}
          />
          <StatCard
            icon={Star}
            label="Votes"
            value={userVotes.length}
          />
        </div>

        {Object.keys(topicPrecision).length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Topic Expertise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(topicPrecision).map(([topic, score]) => (
                  <div key={topic} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">{topic}</span>
                    <Badge variant="secondary">{Math.round(score * 100)}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="posts" data-testid="tab-posts">
              Posts ({userClaims.length})
            </TabsTrigger>
            <TabsTrigger value="votes" data-testid="tab-votes">
              Votes ({userVotes.length})
            </TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">
              Notes ({votesWithNotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" data-testid="posts-content">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : userClaims.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">You haven't posted any claims yet.</p>
                <Link href="/ask">
                  <Button>Submit Your First Claim</Button>
                </Link>
              </Card>
            ) : (
              <div>
                {userClaims.map(claim => (
                  <ClaimPreviewCard key={claim.id} claim={claim} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="votes" data-testid="votes-content">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : userVotes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">You haven't voted on any claims yet.</p>
                <Link href="/feed">
                  <Button>Explore the Feed</Button>
                </Link>
              </Card>
            ) : (
              <div>
                {userVotes.map(({ claim, vote }) => (
                  <VotePreviewCard key={`${claim.id}-${vote.user_id}`} claim={claim} vote={vote} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" data-testid="notes-content">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ) : votesWithNotes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground mb-4">You haven't added notes to any votes yet.</p>
                <Link href="/feed">
                  <Button>Explore the Feed</Button>
                </Link>
              </Card>
            ) : (
              <div>
                {votesWithNotes.map(({ claim, vote }) => (
                  <VotePreviewCard key={`note-${claim.id}-${vote.user_id}`} claim={claim} vote={vote} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
