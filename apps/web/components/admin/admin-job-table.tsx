"use client";

import { Briefcase, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useAdminJobs, useModerateJob } from "@/lib/hooks/use-admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RiskScoreBadge } from "@/components/trust/scores";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { EmptyState } from "@/components/shared/empty-state";

export function AdminJobTable() {
  const { data, isLoading, isError } = useAdminJobs();
  const moderateJob = useModerateJob();
  const jobs = data?.jobs ?? [];

  const sorted = [...jobs].sort((a, b) => b.riskScore - a.riskScore);

  if (isLoading) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Loading jobs"
        description="Fetching moderation records."
      />
    );
  }
  if (isError) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Jobs unavailable"
        description="Admin job data could not be loaded."
      />
    );
  }
  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No jobs"
        description="Job moderation records will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Role</TableHead>
            <TableHead className="hidden sm:table-cell">Risk</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="pr-4 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="pl-4">
                <p className="font-medium">{job.title}</p>
                <p className="text-xs text-muted-foreground">{job.companyName}</p>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <RiskScoreBadge level={job.riskLevel} score={job.riskScore} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <JobStatusBadge status={job.status} />
              </TableCell>
              <TableCell className="pr-4 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Moderate ${job.title}`}>
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={moderateJob.isPending}
                      onClick={() => {
                        moderateJob.mutate(
                          { id: job.id, action: "approve" },
                          {
                            onSuccess: () => toast.success("Job approved"),
                            onError: () => toast.error("Job update failed"),
                          },
                        );
                      }}
                    >
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={moderateJob.isPending}
                      onClick={() => {
                        moderateJob.mutate(
                          { id: job.id, action: "flag" },
                          {
                            onSuccess: () => toast("Job flagged for review"),
                            onError: () => toast.error("Job update failed"),
                          },
                        );
                      }}
                    >
                      Flag as risky
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={moderateJob.isPending}
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        moderateJob.mutate(
                          { id: job.id, action: "close" },
                          {
                            onSuccess: () => toast("Job closed"),
                            onError: () => toast.error("Job update failed"),
                          },
                        );
                      }}
                    >
                      Close job
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
