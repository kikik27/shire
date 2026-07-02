import { Card } from "@/components/ui/card";
import type { RecruiterDashboardKpis } from "@/lib/server/recruiter-dashboard-repository";

const definitions: Array<{
  key: keyof RecruiterDashboardKpis;
  label: string;
  hint: string;
}> = [
  { key: "activeJobs", label: "Active jobs", hint: "Accepting applicants" },
  { key: "applicants", label: "Applicants", hint: "Across your jobs" },
  { key: "interviews", label: "Interviews", hint: "In interview stage" },
  { key: "offers", label: "Offers", hint: "Offers extended" },
];

export function KpiCards({ kpis }: { kpis: RecruiterDashboardKpis }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {definitions.map((definition) => (
        <Card key={definition.key} className="gap-0 p-5">
          <p className="text-sm text-muted-foreground">{definition.label}</p>
          <p className="mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums">
            {kpis[definition.key]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {definition.hint}
          </p>
        </Card>
      ))}
    </div>
  );
}
