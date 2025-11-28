import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, Globe, FileText, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Evidence } from "@shared/schema";

interface EvidenceModalProps {
  evidence: Evidence | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toolConfig: Record<string, { icon: typeof Search; label: string; description: string }> = {
  google_search: {
    icon: Search,
    label: "Google Search",
    description: "Web search results from Google's search engine",
  },
  crawler: {
    icon: Globe,
    label: "Web Crawler",
    description: "Content extracted from web pages",
  },
  default: {
    icon: FileText,
    label: "Document Analysis",
    description: "Content from document analysis",
  },
};

export default function EvidenceModal({ evidence, open, onOpenChange }: EvidenceModalProps) {
  const [copied, setCopied] = useState(false);

  if (!evidence) return null;

  const tool = toolConfig[evidence.tool_name] || toolConfig.default;
  const ToolIcon = tool.icon;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(evidence.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const extractUrls = (content: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content.match(urlRegex) || [];
  };

  const urls = extractUrls(evidence.content);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="evidence-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <ToolIcon className="h-5 w-5 text-primary" />
            </div>
            <span>{tool.label}</span>
          </DialogTitle>
          <DialogDescription>
            {tool.description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="outline" className="text-xs">
              Tool: {evidence.tool_name}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              data-testid="button-copy-evidence"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <ScrollArea className="h-[300px] rounded-lg border p-4 bg-muted/30">
            <pre className="text-sm whitespace-pre-wrap font-mono text-foreground" data-testid="evidence-content">
              {evidence.content}
            </pre>
          </ScrollArea>

          {urls.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">
                  Sources Found ({urls.length})
                </h4>
                <div className="space-y-2" data-testid="evidence-sources">
                  {urls.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover-elevate text-sm text-primary truncate"
                      data-testid={`source-${index}`}
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="truncate">{url}</span>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
