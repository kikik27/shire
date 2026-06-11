import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const map: Record<ApplicationStatus, { label: string; cls: string }> = {
  SAVED: { label: "Saved", cls: "bg-muted text-muted-foreground" },
  APPLIED: { label: "Applied", cls: "bg-primary/10 text-primary" },
  REVIEWED: { label: "Reviewed", cls: "bg-primary/10 text-primary" },
  INTERVIEW: { label: "Interview", cls: "bg-chart-4/15 text-chart-4" },
  OFFERED: { label: "Offered", cls: "bg-success/10 text-success" },
  HIRED: { label: "Hired", cls: "bg-success/15 text-success" },
  REJECTED: { label: "Rejected", cls: "bg-destructive/10 text-destructive" },
  WITHDRAWN: { label: "Withdrawn", cls: "bg-muted text-muted-foreground" },
  DISPUTED: { label: "Disputed", cls: "bg-destructive/10 text-destructive" },
};

export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
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
