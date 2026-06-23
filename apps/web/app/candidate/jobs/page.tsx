"use client";

import { useState, useMemo } from "react";
import { Briefcase, RotateCw } from "lucide-react";
import { useCandidateApiJobs } from "@/lib/hooks/use-jobs";
import { PageHeader } from "@/components/shared/page-header";
import { JobFilters, type JobFilterState } from "@/components/jobs/job-filters";
import { JobCard } from "@/components/jobs/job-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

const defaultFilters: JobFilterState = {
  query: "",
  type: "ALL",
  remoteOnly: false,
  hideHighRisk: false,
};

export default function CandidateJobsPage() {
  const {
    data: jobs = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useCandidateApiJobs();
  const [filters, setFilters] = useState<JobFilterState>(defaultFilters);

  const visible = useMemo(() => {
    const q = filters.query.toLowerCase();
    return jobs
      .filter((j) => j.status === "ACTIVE")
      .filter((j) => {
        if (q) {
          return (
            j.title.toLowerCase().includes(q) ||
            j.companyName.toLowerCase().includes(q) ||
            j.skillsRequired.some((s) => s.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .filter((j) => filters.type === "ALL" || j.jobType === filters.type)
      .filter((j) => !filters.remoteOnly || j.remote)
      .filter((j) => !filters.hideHighRisk || j.riskLevel !== "HIGH");
  }, [jobs, filters]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Job feed"
        description={`${visible.length} active role${visible.length !== 1 ? "s" : ""}`}
      />
      <JobFilters value={filters} onChange={setFilters} />

      {isLoading ? (
        <EmptyState
          icon={Briefcase}
          title="Loading job feed"
          description="Fetching active roles from the database."
        />
      ) : isError ? (
        <EmptyState
          icon={Briefcase}
          title="Job feed unavailable"
          description="We could not load active roles. Retry the request or check your connection."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs match your filters"
          description="Try adjusting the search or clearing filters."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((job) => (
            <JobCard key={job.id} job={job} href={`/candidate/jobs/${job.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
