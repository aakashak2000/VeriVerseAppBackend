import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, Clock, Search, Globe, FileText, MapPin, Briefcase, BadgeCheck, Star, Award } from "lucide-react";
import EvidenceModal from "@/components/EvidenceModal";
import type { RunState, Evidence, Vote, VoteMatchReason } from "@shared/schema";

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

const matchReasonConfig: Record<VoteMatchReason, { label: string; icon: typeof BadgeCheck }> = {
  domain_expert: { label: "Domain Expert", icon: Briefcase },
  location_match: { label: "Location Match", icon: MapPin },
  verified_professional: { label: "Verified Professional", icon: BadgeCheck },
  high_reputation: { label: "High Reputation", icon: Star },
  topic_specialist: { label: "Topic Specialist", icon: Award },
};

function getMatchReasonsSummary(votes: Vote[]): string[] {
  const allReasons = new Set<VoteMatchReason>();
  votes.forEach(vote => {
    vote.match_reasons?.forEach(reason => allReasons.add(reason));
  });
  
  const summaries: string[] = [];
  if (allReasons.has("location_match")) summaries.push("Location");
  if (allReasons.has("domain_expert") || allReasons.has("topic_specialist")) summaries.push("Domain");
  if (allReasons.has("verified_professional")) summaries.push("Verified");
  
  return summaries;
}

export default function ResultCard({ runState, lastUpdated }: ResultCardProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const status = statusConfig[runState.status];
  const confidencePercent = Math.round(runState.confidence * 100);

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getToolIcon = (toolName: string) => {
    return toolIcons[toolName] || toolIcons.default;
  };

  const handleEvidenceClick = (evidence: Evidence) => {
    setSelectedEvidence(evidence);
    setModalOpen(true);
  };

  const matchSummary = runState.votes ? getMatchReasonsSummary(runState.votes) : [];

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
            <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" data-testid="confidence-section">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50">
                    <BadgeCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">{confidencePercent}%</div>
                    <div className="text-sm text-green-600 dark:text-green-500">Credibility Score</div>
                  </div>
                </div>
                {confidencePercent >= 80 && (
                  <Badge className="bg-green-600 text-white dark:bg-green-700">
                    Highly Verified
                  </Badge>
                )}
                {confidencePercent >= 60 && confidencePercent < 80 && (
                  <Badge className="bg-amber-500 text-white dark:bg-amber-600">
                    Partially Verified
                  </Badge>
                )}
                {confidencePercent < 60 && (
                  <Badge className="bg-red-500 text-white dark:bg-red-600">
                    Needs Review
                  </Badge>
                )}
              </div>
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

          <div className="border-t pt-4" data-testid="expert-votes-section">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h4 className="text-sm font-medium text-foreground">
                Expert Votes ({runState.votes?.length || 0} total)
              </h4>
              {matchSummary.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {matchSummary.join(" & ")} matched
                </span>
              )}
            </div>
            
            {runState.votes && runState.votes.length > 0 ? (
              <div className="space-y-3" data-testid="votes-list">
                {runState.votes.map((vote, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 hover-elevate"
                    data-testid={`vote-${index}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        {vote.profile_image_url ? (
                          <AvatarImage src={vote.profile_image_url} alt={vote.name} />
                        ) : null}
                        <AvatarFallback className="text-sm bg-primary/10 text-primary">
                          {getInitials(vote.name || vote.user_id)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground truncate" data-testid={`vote-name-${index}`}>
                            {vote.name || vote.user_id}
                          </span>
                          {vote.match_reasons?.includes("verified_professional") && (
                            <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate" data-testid={`vote-details-${index}`}>
                          {vote.domain && vote.location ? (
                            <>{vote.domain} • {vote.location}</>
                          ) : vote.domain || vote.location || "Community Reviewer"}
                        </div>
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="shrink-0 cursor-help">
                          {vote.vote === 1 ? (
                            <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400" data-testid={`vote-up-${index}`} />
                          ) : (
                            <ThumbsDown className="h-5 w-5 text-red-500 dark:text-red-400" data-testid={`vote-down-${index}`} />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm font-medium mb-1">{vote.rationale}</p>
                        {vote.match_reasons && vote.match_reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {vote.match_reasons.map((reason, i) => {
                              const config = matchReasonConfig[reason];
                              const ReasonIcon = config?.icon || BadgeCheck;
                              return (
                                <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                                  <ReasonIcon className="h-3 w-3" />
                                  {config?.label || reason}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Weight: {vote.weight}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            ) : runState.status === "awaiting_votes" ? (
              <p className="text-sm text-muted-foreground italic" data-testid="awaiting-votes-message">
                Waiting for expert reviewers...
              </p>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="no-votes-message">
                No expert votes yet
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
