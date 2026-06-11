import { SearchX } from "lucide-react";
import type { Job } from "@/lib/types";
import { JobCard } from "@/components/jobs/job-card";
import { EmptyState } from "@/components/shared/empty-state";

export function JobList({
  jobs,
  hrefBase,
  emptyTitle = "No jobs match your filters",
  emptyDescription = "Try clearing a filter or broadening your search.",
}: {
  jobs: Job[];
  hrefBase: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (jobs.length === 0) {
    return <EmptyState icon={SearchX} title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} href={`${hrefBase}/${job.id}`} />
      ))}
    </div>
  );
}
