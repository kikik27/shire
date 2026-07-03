"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import type { Application, Job } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MatchScoreBadge } from "@/components/trust/scores";
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge";
import { initials, timeAgo } from "@/lib/format";

const terminal = ["HIRED", "REJECTED", "WITHDRAWN"];

export function ApplicationCard({
  application,
  job,
  onWithdraw,
}: {
  application: Application;
  job: Job;
  onWithdraw?: (applicationId: string) => void;
}) {
  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Avatar className="size-10">
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initials(job.companyName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <Link
          href={`/candidate/jobs/${job.id}`}
          className="truncate font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {job.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {job.companyName} · applied {timeAgo(application.appliedAt)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ApplicationStatusBadge status={application.status} />
          <MatchScoreBadge score={application.matchScore} />
        </div>
      </div>
      {!terminal.includes(application.status) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Application actions">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/candidate/jobs/${job.id}`}>View job</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                onWithdraw?.(application.id);
                toast("Application withdrawn");
              }}
              disabled={!onWithdraw}
            >
              Withdraw
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
