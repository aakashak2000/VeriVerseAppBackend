import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardEntry } from "@shared/schema";
import { Trophy, Medal, Award, Star, Crown } from "lucide-react";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  isLoading?: boolean;
}

const tierConfig: Record<string, { className: string; icon: typeof Trophy }> = {
  Diamond: { 
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", 
    icon: Crown 
  },
  Platinum: { 
    className: "bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300", 
    icon: Star 
  },
  Gold: { 
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", 
    icon: Trophy 
  },
  Silver: { 
    className: "bg-gray-200 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300", 
    icon: Medal 
  },
  Bronze: { 
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", 
    icon: Award 
  },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3" data-testid="leaderboard-loading">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardTable({ entries, isLoading }: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <Card className="border shadow-sm" data-testid="leaderboard-card">
        <CardHeader>
          <CardTitle>Community Trust Board</CardTitle>
          <CardDescription>These are the top reviewers helping VeriVerse stay accurate</CardDescription>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm" data-testid="leaderboard-card">
      <CardHeader>
        <CardTitle>Community Trust Board</CardTitle>
        <CardDescription>These are the top reviewers helping VeriVerse stay accurate</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="leaderboard-empty">
            No reviewers yet. Be the first to join!
          </div>
        ) : (
          <div className="space-y-2" data-testid="leaderboard-list">
            <div className="hidden md:grid grid-cols-5 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Name</span>
              <span className="text-center">Precision</span>
              <span className="text-center">Attempts</span>
              <span className="text-center">Tier</span>
              <span className="text-right">Points</span>
            </div>
            
            {entries.map((entry, index) => {
              const tier = tierConfig[entry.tier] || tierConfig.Bronze;
              const TierIcon = tier.icon;
              
              return (
                <div
                  key={entry.user_id}
                  className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 items-center p-4 rounded-lg bg-muted/30 hover-elevate"
                  data-testid={`leaderboard-row-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold text-muted-foreground w-6">
                      {index + 1}
                    </span>
                    <span className="font-medium text-foreground" data-testid={`name-${entry.user_id}`}>
                      {entry.name}
                    </span>
                  </div>
                  
                  <div className="text-right md:text-center">
                    <span className="text-sm font-medium text-foreground" data-testid={`precision-${entry.user_id}`}>
                      {Math.round(entry.precision * 100)}%
                    </span>
                  </div>
                  
                  <div className="text-left md:text-center">
                    <span className="text-sm text-muted-foreground" data-testid={`attempts-${entry.user_id}`}>
                      {entry.attempts}
                    </span>
                  </div>
                  
                  <div className="flex justify-start md:justify-center">
                    <Badge 
                      variant="secondary" 
                      className={`${tier.className} flex items-center gap-1`}
                      data-testid={`tier-${entry.user_id}`}
                    >
                      <TierIcon className="h-3 w-3" />
                      <span>{entry.tier}</span>
                    </Badge>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground" data-testid={`points-${entry.user_id}`}>
                      {entry.points.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 pt-6 border-t">
          <p className="text-sm text-muted-foreground text-center" data-testid="leaderboard-info">
            Reviewers earn points when they correctly upvote/downvote AI responses. In a full product, these points convert to rewards (goodies, coupons, perks).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
