import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecruiterDashboard } from "@/lib/server/recruiter-dashboard-repository";

export function TalentReach({
  regions,
}: {
  regions: RecruiterDashboard["talentRegions"];
}) {
  const maximum = Math.max(...regions.map((region) => region.count), 1);
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Talent reach</CardTitle>
        <span className="text-xs text-muted-foreground">Owned job applicants</span>
      </CardHeader>
      <CardContent>
        {regions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Applicant regions will appear here.
          </p>
        ) : (
          <ul className="space-y-3.5">
            {regions.map((region) => (
              <li key={region.region} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm">
                  {region.region}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(region.count / maximum) * 100}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">
                  {region.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
