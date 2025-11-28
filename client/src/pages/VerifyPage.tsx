import { useState, useEffect } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import LeaderboardTable from "@/components/LeaderboardTable";
import { Button } from "@/components/ui/button";
import { getLeaderboard } from "@/lib/api";
import type { LeaderboardEntry } from "@shared/schema";
import { ArrowLeft } from "lucide-react";

export default function VerifyPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const data = await getLeaderboard();
      setEntries(data.entries);
      
      const isDemoData = data.entries.length > 0 && 
        data.entries[0].user_id === "u1" && 
        data.entries[0].name === "Aarav";
      setIsDemo(isDemoData);
      
      setIsLoading(false);
    };

    fetchLeaderboard();
  }, []);

  return (
    <Layout error={isDemo ? "Backend unavailable, running in demo mode" : null}>
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2" data-testid="verify-title">
            Community Trust Board
          </h1>
          <p className="text-muted-foreground" data-testid="verify-subtitle">
            Meet the top reviewers who help keep VeriVerse accurate and trustworthy.
          </p>
        </div>

        <LeaderboardTable entries={entries} isLoading={isLoading} />

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
