"use client";

import * as React from "react";
import { Scale, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { PlatformDispute } from "@/lib/types";
import { useAdminDisputes, useResolveDispute } from "@/lib/hooks/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

const statusCls: Record<PlatformDispute["status"], string> = {
  OPEN: "bg-warning/15 text-warning-foreground",
  UNDER_REVIEW: "bg-primary/10 text-primary",
  RESOLVED: "bg-success/10 text-success",
  REJECTED: "bg-muted text-muted-foreground",
};

export function DisputeReviewPanel() {
  const { data, isLoading, isError } = useAdminDisputes();
  const resolveDispute = useResolveDispute();
  const disputes = data?.disputes ?? [];

  const [target, setTarget] = React.useState<PlatformDispute | null>(null);
  const [decision, setDecision] = React.useState("");
  const [slash, setSlash] = React.useState(true);

  if (isLoading) {
    return (
      <EmptyState
        icon={Scale}
        title="Loading disputes"
        description="Fetching persisted dispute records."
      />
    );
  }
  if (isError || disputes.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title={isError ? "Disputes unavailable" : "No disputes"}
        description={
          isError
            ? "Admin dispute data could not be loaded."
            : "Open disputes will appear here."
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {disputes.map((d) => {
          const resolved = d.status === "RESOLVED" || d.status === "REJECTED";
          return (
            <Card key={d.id}>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">
                    Dispute {d.id.slice(0, 8)}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Reported {formatDate(d.createdAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    statusCls[d.status],
                  )}
                >
                  {d.status.replace("_", " ").toLowerCase()}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-foreground/90">{d.reason}</p>
                {d.aiSummary && (
                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-3">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-primary">
                        AI dispute summary
                      </p>
                      <p className="mt-1 text-sm text-foreground/90">{d.aiSummary}</p>
                    </div>
                  </div>
                )}
                {resolved ? (
                  <p className="text-sm text-muted-foreground">
                    Decision: {d.adminDecision ?? "Closed"}
                  </p>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setTarget(d);
                      setDecision("");
                      setSlash(true);
                    }}
                  >
                    <Scale className="size-4" /> Review & resolve
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve dispute</DialogTitle>
            <DialogDescription>
              The resolver decides. The AI only summarizes. Your decision settles any staked funds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="slash-toggle">Slash the staked funds</Label>
                <p className="text-xs text-muted-foreground">Off = refund to the staker.</p>
              </div>
              <Switch id="slash-toggle" checked={slash} onCheckedChange={setSlash} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decision">Decision note</Label>
              <Textarea
                id="decision"
                rows={3}
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                placeholder="Summarize the ruling and rationale."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!decision.trim() || resolveDispute.isPending}
              onClick={() => {
                if (!target) return;
                resolveDispute.mutate(
                  {
                    id: target.id,
                    status: "RESOLVED",
                    decision: decision.trim(),
                    stakeStatus: target.stakeId
                      ? slash
                        ? "SLASHED"
                        : "REFUNDED"
                      : undefined,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Dispute resolved", {
                        description: target.stakeId
                          ? slash
                            ? "Stake slashed."
                            : "Stake refunded."
                          : "Decision recorded.",
                      });
                      setTarget(null);
                    },
                    onError: () =>
                      toast.error("Dispute resolution failed"),
                  },
                );
              }}
            >
              Confirm decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
