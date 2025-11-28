import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

interface ClaimInputCardProps {
  onSubmit: (claim: string) => void;
  isLoading?: boolean;
}

export default function ClaimInputCard({ onSubmit, isLoading }: ClaimInputCardProps) {
  const [claim, setClaim] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (claim.trim() && !isLoading) {
      onSubmit(claim.trim());
    }
  };

  return (
    <Card className="border shadow-sm" data-testid="claim-input-card">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit}>
          <label 
            htmlFor="claim-input" 
            className="block text-sm font-medium text-foreground mb-3"
          >
            Paste a claim or headline
          </label>
          <Textarea
            id="claim-input"
            placeholder="e.g., 'Scientists discover new species in the Amazon rainforest'"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            className="min-h-[120px] resize-none text-base"
            disabled={isLoading}
            data-testid="input-claim"
          />
          <div className="mt-4 flex justify-end">
            <Button
              type="submit"
              disabled={!claim.trim() || isLoading}
              data-testid="button-verify"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2">Verifying...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span className="ml-2">Run Verification</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
