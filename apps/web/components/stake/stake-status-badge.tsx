import { StakeStatus, StakeType } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusMap: Record<number, { label: string; cls: string }> = {
  [StakeStatus.Locked]: { label: "Locked", cls: "bg-primary/10 text-primary" },
  [StakeStatus.Refunded]: { label: "Refunded", cls: "bg-success/10 text-success" },
  [StakeStatus.Slashed]: { label: "Slashed", cls: "bg-destructive/10 text-destructive" },
  [StakeStatus.Released]: { label: "Released", cls: "bg-success/10 text-success" },
  [StakeStatus.Cancelled]: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

export const stakeTypeLabel: Record<number, string> = {
  [StakeType.JobPost]: "Job post",
  [StakeType.Application]: "Application",
  [StakeType.Interview]: "Interview",
  [StakeType.Offer]: "Offer",
  [StakeType.Bounty]: "Bounty",
};

export function StakeStatusBadge({ status, className }: { status: StakeStatus; className?: string }) {
  const s = statusMap[status] ?? statusMap[StakeStatus.Cancelled];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        s.cls,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {s.label}
    </span>
  );
}
