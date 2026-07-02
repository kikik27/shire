import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { formatToken, timeAgo } from "@/lib/format";
import type { RecruiterDashboard } from "@/lib/server/recruiter-dashboard-repository";

export function CatalogTable({
  jobs,
}: {
  jobs: RecruiterDashboard["catalog"];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Job catalog</CardTitle>
        <Link
          href="/recruiter/jobs"
          className="rounded text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="px-0">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Briefcase className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">No jobs yet</p>
            <p className="text-sm text-muted-foreground">
              Post your first role to start matching talent.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Role</TableHead>
                <TableHead className="hidden sm:table-cell">Seniority</TableHead>
                <TableHead className="hidden md:table-cell">Stake</TableHead>
                <TableHead className="hidden lg:table-cell">Posted</TableHead>
                <TableHead className="pr-6 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {job.companyName
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{job.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {job.companyName} - {job.applicantCount} applicants
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="font-normal">
                      {job.experienceLevel.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                    {formatToken(job.stakeAmount, job.stakeToken)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-sm tabular-nums text-muted-foreground lg:table-cell">
                    {timeAgo(job.createdAt)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <JobStatusBadge status={job.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
