import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Search, Globe, FileText, BadgeCheck } from "lucide-react";
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
            <div data-testid="evidence-section">
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
