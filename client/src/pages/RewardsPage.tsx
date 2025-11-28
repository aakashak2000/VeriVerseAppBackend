import { useEffect } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trophy, Gift, Star, Zap, Coffee, Ticket, Crown } from "lucide-react";
import type { Perk } from "@shared/schema";

const tierConfig: Record<string, { className: string; icon: typeof Trophy; nextTier: string; pointsNeeded: number }> = {
  Bronze: { 
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", 
    icon: Trophy,
    nextTier: "Silver",
    pointsNeeded: 500
  },
  Silver: { 
    className: "bg-gray-200 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300", 
    icon: Trophy,
    nextTier: "Gold",
    pointsNeeded: 1000
  },
  Gold: { 
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", 
    icon: Trophy,
    nextTier: "Platinum",
    pointsNeeded: 2000
  },
  Platinum: { 
    className: "bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300", 
    icon: Star,
    nextTier: "Diamond",
    pointsNeeded: 5000
  },
  Diamond: { 
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", 
    icon: Crown,
    nextTier: "Diamond",
    pointsNeeded: 10000
  },
};

const availablePerks: Perk[] = [
  {
    id: "1",
    name: "Coffee Voucher",
    description: "Get a free coffee at partner cafes",
    pointsCost: 200,
    category: "Food & Drink",
    available: true,
  },
  {
    id: "2",
    name: "Priority Verification",
    description: "Your claims get verified faster",
    pointsCost: 500,
    category: "Platform",
    available: true,
  },
  {
    id: "3",
    name: "Event Ticket",
    description: "Access to exclusive VeriVerse community events",
    pointsCost: 1000,
    category: "Events",
    available: true,
  },
  {
    id: "4",
    name: "Premium Badge",
    description: "Show off your contribution with a special profile badge",
    pointsCost: 750,
    category: "Platform",
    available: true,
  },
  {
    id: "5",
    name: "Merch Store Credit",
    description: "$25 credit for the VeriVerse merchandise store",
    pointsCost: 2000,
    category: "Merchandise",
    available: false,
  },
];

const perkIcons: Record<string, typeof Gift> = {
  "Food & Drink": Coffee,
  "Platform": Zap,
  "Events": Ticket,
  "Merchandise": Gift,
};

export default function RewardsPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  const userTier = user?.tier || "Bronze";
  const userPoints = user?.points || 0;
  const tierInfo = tierConfig[userTier];
  const TierIcon = tierInfo.icon;
  const progressToNext = userTier === "Diamond" 
    ? 100 
    : Math.min(100, (userPoints / tierInfo.pointsNeeded) * 100);

  const handleRedeem = (perk: Perk) => {
    if (userPoints < perk.pointsCost) {
      toast({
        title: "Not enough points",
        description: `You need ${perk.pointsCost - userPoints} more points to redeem this perk.`,
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Coming Soon",
      description: "Perk redemption will be available in a future update!",
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2" data-testid="rewards-title">
            Rewards & Perks
          </h1>
          <p className="text-muted-foreground" data-testid="rewards-subtitle">
            Earn points by accurately verifying claims and reviewing AI responses.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="border" data-testid="points-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Your Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-foreground mb-4" data-testid="user-points">
                {userPoints.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                Keep verifying claims to earn more points!
              </p>
            </CardContent>
          </Card>

          <Card className="border" data-testid="tier-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TierIcon className="h-5 w-5 text-primary" />
                Current Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <Badge 
                  variant="secondary" 
                  className={`${tierInfo.className} text-lg px-3 py-1`}
                  data-testid="user-tier"
                >
                  {userTier}
                </Badge>
              </div>
              
              {userTier !== "Diamond" ? (
                <>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress to {tierInfo.nextTier}</span>
                    <span className="font-medium">{userPoints} / {tierInfo.pointsNeeded}</span>
                  </div>
                  <Progress value={progressToNext} className="h-2" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You've reached the highest tier. Congratulations!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border mb-8" data-testid="perks-card">
          <CardHeader>
            <CardTitle>Available Perks</CardTitle>
            <CardDescription>Redeem your points for exclusive rewards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="perks-list">
              {availablePerks.map((perk) => {
                const PerkIcon = perkIcons[perk.category] || Gift;
                const canAfford = userPoints >= perk.pointsCost;
                
                return (
                  <Card 
                    key={perk.id} 
                    className={`border ${!perk.available ? 'opacity-60' : ''}`}
                    data-testid={`perk-${perk.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <PerkIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground text-sm">
                            {perk.name}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {perk.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {perk.pointsCost.toLocaleString()} pts
                        </Badge>
                        <Button 
                          size="sm" 
                          disabled={!perk.available || !canAfford}
                          onClick={() => handleRedeem(perk)}
                          data-testid={`redeem-${perk.id}`}
                        >
                          {!perk.available ? "Coming Soon" : canAfford ? "Redeem" : "Not Enough"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border" data-testid="how-to-earn">
          <CardHeader>
            <CardTitle>How to Earn Points</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">+10</span>
                <span>Submit a claim for verification</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">+25</span>
                <span>Correctly vote on a claim before it's completed</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">+50</span>
                <span>Your vote matches the final consensus</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">+100</span>
                <span>Reach a new tier milestone</span>
              </li>
            </ul>
          </CardContent>
        </Card>

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
