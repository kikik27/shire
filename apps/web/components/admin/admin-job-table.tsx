"use client";

import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useShireStore } from "@/lib/store";
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

export function AdminJobTable() {
  const jobs = useShireStore((s) => s.jobs);
  const moderateJob = useShireStore((s) => s.moderateJob);

  const sorted = [...jobs].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
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
                      onClick={() => {
                        moderateJob(job.id, "approve");
                        toast.success("Job approved");
                      }}
                    >
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        moderateJob(job.id, "flag");
                        toast("Job flagged for review");
                      }}
                    >
                      Flag as risky
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        moderateJob(job.id, "close");
                        toast("Job closed");
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
