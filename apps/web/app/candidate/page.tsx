"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, FileText, RotateCw, Sparkles } from "lucide-react";
import { useCandidateApiJobs } from "@/lib/hooks/use-jobs";
import { useMyApplications } from "@/lib/hooks/use-applications";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/stat-tile";
import { JobCard } from "@/components/jobs/job-card";
import { CandidateRecommendations } from "@/components/dashboard/recommendation-list";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/format";

function ProfilePrompt() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Candidate profile
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Keep your profile current so matching can use real account data.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/candidate/profile">Update profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CandidatePage() {
  const {
    data: applications = [],
    isLoading: applicationsLoading,
    isError: applicationsError,
    isFetching: applicationsFetching,
    refetch: refetchApplications,
  } = useMyApplications();
  const {
    data: allJobs = [],
    isLoading: jobsLoading,
    isError: jobsError,
    isFetching: jobsFetching,
    refetch: refetchJobs,
  } = useCandidateApiJobs();

  const activeApps = applications.filter(
    (a) => !["HIRED", "REJECTED", "WITHDRAWN"].includes(a.status),
  );

  const recommended = allJobs
    .filter((j) => !applications.some((a) => a.jobId === j.id))
    .slice(0, 3);

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <PageHeader
        title="Candidate hub"
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
          label="New matches"
          value={String(recommended.length)}
          icon={Sparkles}
        />
      </div>

      <ProfilePrompt />

      <CandidateRecommendations />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recommended for you</h2>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/candidate/jobs">
              All jobs <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {jobsLoading ? (
          <EmptyState
            icon={Sparkles}
            title="Loading recommendations"
            description="Fetching live jobs from the database."
          />
        ) : jobsError ? (
          <EmptyState
            icon={Briefcase}
            title="Jobs unavailable"
            description="We could not load live jobs. Retry the request or check your connection."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetchJobs()}
                disabled={jobsFetching}
              >
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            }
          />
        ) : recommended.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No new recommendations"
            description="You've applied to all current matches. Check back soon."
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
        {applicationsLoading ? (
          <EmptyState
            icon={FileText}
            title="Loading applications"
            description="Fetching your applications from the database."
          />
        ) : applicationsError ? (
          <EmptyState
            icon={FileText}
            title="Applications unavailable"
            description="We could not load your applications. Retry the request or check your connection."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetchApplications()}
                disabled={applicationsFetching}
              >
                <RotateCw className="size-4" aria-hidden="true" />
                Retry
              </Button>
            }
          />
        ) : activeApps.length === 0 ? (
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
              <Link
                key={app.id}
                href={`/candidate/jobs/${app.jobId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-[box-shadow] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">Application {app.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    Applied {timeAgo(app.appliedAt)}
                  </p>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
