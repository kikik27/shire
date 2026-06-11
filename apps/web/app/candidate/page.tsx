"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, FileText, Sparkles } from "lucide-react";
import { useShireStore } from "@/lib/store";
import { useCandidateApplications, useActiveJobs } from "@/lib/selectors";
import { computeMatch } from "@/lib/ai";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { JobCard } from "@/components/jobs/job-card";
import { ApplicationCard } from "@/components/applications/application-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function ProfileCompleteness() {
  const profile = useShireStore((s) => s.candidateProfile);
  if (!profile) return null;

  const checks = [
    !!profile.displayName,
    !!profile.bio,
    profile.skills.length > 0,
    profile.roleTargets.length > 0,
    !!profile.location,
    !!profile.portfolioUrl || !!profile.githubUrl,
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Profile completeness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-2xl font-semibold tabular-nums">{pct}%</span>
          {pct < 100 && (
            <Button asChild size="sm" variant="outline">
              <Link href="/candidate/profile">Complete profile</Link>
            </Button>
          )}
        </div>
        <Progress value={pct} className="h-2" />
      </CardContent>
    </Card>
  );
}

export default function CandidatePage() {
  const profile = useShireStore((s) => s.candidateProfile);
  const applications = useCandidateApplications();
  const allJobs = useActiveJobs();

  const activeApps = applications.filter(
    (a) => !["HIRED", "REJECTED", "WITHDRAWN"].includes(a.status),
  );

  const recommended = allJobs
    .filter((j) => !applications.some((a) => a.jobId === j.id))
    .map((j) => ({ job: j, match: computeMatch(j, profile) }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore)
    .slice(0, 3)
    .map(({ job }) => job);

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <PageHeader
        title={profile ? `Welcome back, ${profile.displayName.split(" ")[0]}` : "Candidate hub"}
        description="Your AI-matched job board and application tracker."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Active applications"
          value={String(activeApps.length)}
          icon={FileText}
        />
        <StatTile
          label="Jobs available"
          value={String(allJobs.length)}
          icon={Briefcase}
        />
        <StatTile
          label="Saved jobs"
          value={String(useShireStore.getState().savedJobIds.length)}
          icon={Sparkles}
        />
      </div>

      <ProfileCompleteness />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recommended for you</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/candidate/jobs">
              All jobs <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {recommended.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No new recommendations"
            description="You've applied to all current matches — check back soon."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((job) => (
              <JobCard key={job.id} job={job} href={`/candidate/jobs/${job.id}`} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Active applications</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/candidate/applications">
              All <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {activeApps.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No active applications"
            description="Apply to a job to get started."
            action={
              <Button asChild size="sm">
                <Link href="/candidate/jobs">Browse jobs</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {activeApps.slice(0, 4).map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
