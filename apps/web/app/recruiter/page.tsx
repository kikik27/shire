"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, Users, Zap } from "lucide-react";
import { useRecruiterApplicants, useRecruiterJobs, useRecruiterStakes } from "@/lib/selectors";
import { useShireStore } from "@/lib/store";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { Button } from "@/components/ui/button";
import { JobCard } from "@/components/jobs/job-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MatchScoreBadge } from "@/components/trust/scores";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { formatToken, initials, timeAgo } from "@/lib/format";
import { StakeType } from "@/lib/types";

export default function RecruiterPage() {
  const profile = useShireStore((s) => s.recruiterProfile);
  const jobs = useRecruiterJobs();
  const applicants = useRecruiterApplicants();
  const stakes = useRecruiterStakes();

  const activeJobs = jobs.filter((j) => j.status === "ACTIVE");
  const lockedStakes = stakes.filter((s) => s.status === 1 && s.stakeType === StakeType.JobPost);
  const totalStaked = lockedStakes.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <PageHeader
        title={profile ? profile.companyName : "Recruiter hub"}
        description="Overview of your jobs, applicants, and escrow."
      >
        <Button asChild size="sm">
          <Link href="/recruiter/jobs/new">Post a job</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Active jobs" value={String(activeJobs.length)} icon={Briefcase} />
        <StatTile label="Applicants" value={String(applicants.length)} icon={Users} />
        <StatTile
          label="Total staked"
          value={totalStaked > 0 ? formatToken(totalStaked, "cUSD") : "0 cUSD"}
          icon={Zap}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">My jobs</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/recruiter/jobs">
              All jobs <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs posted yet"
            description="Post your first stake-backed role to start receiving applications."
            action={
              <Button asChild size="sm">
                <Link href="/recruiter/jobs/new">Post a job</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.slice(0, 3).map((job) => (
              <JobCard key={job.id} job={job} href={`/recruiter/jobs/${job.id}`} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent applicants</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/recruiter/applicants">
              All <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {applicants.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No applicants yet"
            description="Stake a job to activate it and start receiving applications."
          />
        ) : (
          <div className="space-y-2">
            {applicants.slice(0, 5).map((app) => {
              const job = useShireStore.getState().jobs.find((j) => j.id === app.jobId);
              return (
                <div key={app.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 text-xs text-primary">
                      {initials(app.candidateId)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {job?.title ?? "Unknown role"}
                    </p>
                    <p className="text-xs text-muted-foreground">{timeAgo(app.appliedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MatchScoreBadge score={app.matchScore} />
                    <ApplicationStatusBadge status={app.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
