import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const map: Record<JobStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  ACTIVE: { label: "Active", cls: "bg-success/10 text-success" },
  CLOSED: { label: "Closed", cls: "bg-muted text-muted-foreground" },
  EXPIRED: { label: "Expired", cls: "bg-muted text-muted-foreground" },
  FLAGGED: { label: "Flagged", cls: "bg-destructive/10 text-destructive" },
};

export function JobStatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const s = map[status];
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
