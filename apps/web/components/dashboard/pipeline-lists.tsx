import {
  Clock,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { timeAgo } from "@/lib/format";
import type { RecruiterDashboard } from "@/lib/server/recruiter-dashboard-repository";

export function PipelineLists({
  recentApplicants,
  pipeline,
}: {
  recentApplicants: RecruiterDashboard["recentApplicants"];
  pipeline: RecruiterDashboard["pipeline"];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Recent applicants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {recentApplicants.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              New applicants will appear here.
            </p>
          ) : (
            recentApplicants.slice(0, 4).map((applicant) => (
              <div
                key={applicant.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {applicant.candidate?.displayName ??
                      `Candidate ${applicant.candidateUserId.slice(0, 8)}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {applicant.jobTitle} - {timeAgo(applicant.createdAt)}
                  </p>
                </div>
                <ApplicationStatusBadge status={applicant.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Pipeline status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {pipeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pipeline counts will appear here.
            </p>
          ) : (
            pipeline.map((item) => (
              <div
                key={item.status}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Clock className="size-5" aria-hidden="true" />
                </span>
                <ApplicationStatusBadge status={item.status} />
                <span className="ml-auto font-mono text-sm font-semibold tabular-nums">
                  {item.count}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
