"use client";

import { Users } from "lucide-react";
import { useRecruiterApplicants } from "@/lib/selectors";
import { useShireStore, getCandidateById, ME_CANDIDATE_ID } from "@/lib/store";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MatchScoreBadge } from "@/components/trust/scores";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, timeAgo } from "@/lib/format";
import Link from "next/link";

export default function RecruiterApplicantsPage() {
  const applicants = useRecruiterApplicants();
  const jobs = useShireStore((s) => s.jobs);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="All applicants"
        description={`${applicants.length} across your jobs`}
      />

      {applicants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No applicants yet"
          description="Post and stake a job to start receiving applications."
        />
      ) : (
        <div className="space-y-2">
          {applicants.map((app) => {
            const isMe = app.candidateId === ME_CANDIDATE_ID;
            const candidate = isMe ? null : getCandidateById(app.candidateId);
            const displayName = isMe
              ? "You (demo)"
              : candidate?.displayName ?? "Candidate";
            const job = jobs.find((j) => j.id === app.jobId);

            return (
              <Link
                key={app.id}
                href={`/recruiter/jobs/${app.jobId}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-[box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {job?.title ?? "Unknown role"} · {timeAgo(app.appliedAt)}
                    {app.stakeId && " · Staked"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <MatchScoreBadge score={app.matchScore} />
                  <ApplicationStatusBadge status={app.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
