import { BadgeCheck, Clock4, ShieldX, TrendingUp, Users } from "lucide-react";
import type { RecruiterProfile, VerificationStatus } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScoreMeter } from "@/components/trust/scores";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const verifyStyle: Record<VerificationStatus, { label: string; cls: string; Icon: typeof BadgeCheck }> = {
  VERIFIED: { label: "Verified", cls: "bg-success/10 text-success", Icon: BadgeCheck },
  PENDING: { label: "Pending review", cls: "bg-warning/15 text-warning-foreground", Icon: Clock4 },
  UNVERIFIED: { label: "Unverified", cls: "bg-muted text-muted-foreground", Icon: ShieldX },
};

export function RecruiterTrustCard({
  recruiter,
}: {
  recruiter: RecruiterProfile & { id?: string };
}) {
  const v = verifyStyle[recruiter.verificationStatus];
  const tone = recruiter.trustLevel >= 70 ? "success" : recruiter.trustLevel >= 40 ? "warning" : "destructive";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Avatar className="size-11">
          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
            {initials(recruiter.companyName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{recruiter.companyName}</p>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", v.cls)}>
              <v.Icon className="size-3" aria-hidden="true" />
              {v.label}
            </span>
          </div>
          {recruiter.companyWebsite ? (
            <a
              href={recruiter.companyWebsite}
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-primary hover:underline"
            >
              {recruiter.companyWebsite.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">No website provided</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Trust level</span>
          <span className="font-mono font-medium tabular-nums">{recruiter.trustLevel}/100</span>
        </div>
        <ScoreMeter value={recruiter.trustLevel} tone={tone} className="mt-1.5" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono font-medium tabular-nums">{recruiter.completedHires}</span>
          <span className="text-muted-foreground">hires</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono font-medium tabular-nums">{recruiter.disputeCount}</span>
          <span className="text-muted-foreground">disputes</span>
        </div>
      </div>
    </div>
  );
}
