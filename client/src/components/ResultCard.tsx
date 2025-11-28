import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ThumbsUp, ThumbsDown, Clock, Search, Globe, FileText } from "lucide-react";
import EvidenceModal from "@/components/EvidenceModal";
import type { RunState, Evidence } from "@shared/schema";

interface ResultCardProps {
  runState: RunState;
  lastUpdated?: Date;
}

const statusConfig: Record<RunState["status"], { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-primary/10 text-primary" },
  awaiting_votes: { label: "Awaiting Votes", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

const toolIcons: Record<string, typeof Search> = {
  google_search: Search,
  crawler: Globe,
  default: FileText,
};

export default function ResultCard({ runState, lastUpdated }: ResultCardProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const status = statusConfig[runState.status];
  const confidencePercent = Math.round(runState.confidence * 100);

  const getInitials = (userId: string) => {
    return userId.substring(0, 2).toUpperCase();
  };

  const getToolIcon = (toolName: string) => {
    return toolIcons[toolName] || toolIcons.default;
  };

  const handleEvidenceClick = (evidence: Evidence) => {
    setSelectedEvidence(evidence);
    setModalOpen(true);
  };

  return (
    <>
      <Card className="border shadow-sm" data-testid="result-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Verification Result</h3>
            <Badge 
              variant="secondary" 
              className={status.className}
              data-testid="status-badge"
            >
              {status.label}
            </Badge>
          </div>

          {runState.provisional_answer && (
            <div className="mb-6">
              <p className="text-foreground leading-relaxed" data-testid="provisional-answer">
                {runState.provisional_answer}
              </p>
            </div>
          )}

          {runState.confidence > 0 && (
            <div className="mb-6" data-testid="confidence-section">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Confidence</span>
                <span className="text-sm font-medium text-foreground">{confidencePercent}%</span>
              </div>
              <Progress value={confidencePercent} className="h-2" />
            </div>
          )}

          {runState.evidence && runState.evidence.length > 0 && (
            <div className="mb-6" data-testid="evidence-section">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Evidence Sources
                <span className="text-xs font-normal ml-2">(click to view details)</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {runState.evidence.map((evidence, index) => {
                  const IconComponent = getToolIcon(evidence.tool_name);
                  return (
                    <Tooltip key={index}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleEvidenceClick(evidence)}
                          className="rounded-md"
                          data-testid={`evidence-chip-${index}`}
                        >
                          <Badge
                            variant="outline"
                            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1"
                          >
                            <IconComponent className="h-3 w-3" />
                            <span>{evidence.tool_name}</span>
                          </Badge>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">Click to view full details</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t pt-4" data-testid="crowd-signal-section">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Crowd Signal</h4>
            
            {runState.votes && runState.votes.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {runState.votes.map((vote, index) => (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <div 
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 cursor-help"
                        data-testid={`vote-${index}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(vote.user_id)}
                          </AvatarFallback>
                        </Avatar>
                        {vote.vote === 1 ? (
                          <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <ThumbsDown className="h-4 w-4 text-red-500 dark:text-red-400" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm font-medium">{vote.user_id}</p>
                      <p className="text-xs text-muted-foreground">{vote.rationale}</p>
                      <p className="text-xs text-muted-foreground mt-1">Weight: {vote.weight}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ) : runState.status === "awaiting_votes" ? (
              <p className="text-sm text-muted-foreground italic" data-testid="awaiting-votes-message">
                Waiting for peer reviewers...
              </p>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="no-votes-message">
                No votes yet
              </p>
            )}
          </div>

          {lastUpdated && (
            <div className="flex items-center gap-1.5 mt-4 pt-4 border-t text-xs text-muted-foreground" data-testid="last-updated">
              <Clock className="h-3 w-3" />
              <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <EvidenceModal
        evidence={selectedEvidence}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
