"use client";

import { FileText } from "lucide-react";
import { useCandidateApplications } from "@/lib/selectors";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationCard } from "@/components/applications/application-card";
import { EmptyState } from "@/components/shared/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CandidateApplicationsPage() {
  const applications = useCandidateApplications();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My applications"
        description={`${applications.length} total`}
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No applications yet"
          description="Apply to a job to see your tracker here."
          action={
            <Button asChild size="sm">
              <Link href="/candidate/jobs">Browse jobs</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {applications.map((app) => (
            <ApplicationCard key={app.id} application={app} />
          ))}
        </div>
      )}
    </div>
  );
}
