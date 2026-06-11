import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { talentRegions } from "@/lib/dashboard-data";

/** Decorative dotted-globe panel — evokes global reach without shipping a heavy map path. */
function GlobeDecoration() {
  const dots: { cx: number; cy: number; r: number; o: number }[] = [];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 16; x++) {
      // carve a rough landmass silhouette out of the grid
      const inLand =
        (x > 1 && x < 5 && y > 1 && y < 5) ||
        (x > 6 && x < 12 && y > 0 && y < 6) ||
        (x > 12 && x < 15 && y > 2 && y < 5);
      if (!inLand) continue;
      // deterministic "scatter" so render stays pure (no Math.random)
      const jitter = ((x * 7 + y * 13) % 10) / 10;
      dots.push({ cx: 14 + x * 18, cy: 16 + y * 18, r: 2, o: 0.25 + jitter * 0.5 });
    }
  }
  return (
    <svg
      viewBox="0 0 300 140"
      className="h-32 w-full text-primary"
      role="img"
      aria-label="Talent distributed across global regions"
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="currentColor" opacity={d.o} />
      ))}
      {/* a few active hubs */}
      {[
        [60, 52],
        [170, 40],
        [232, 70],
      ].map(([cx, cy], i) => (
        <g key={`hub-${i}`}>
          <circle cx={cx} cy={cy} r={6} fill="currentColor" opacity={0.18} />
          <circle cx={cx} cy={cy} r={2.5} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

export function TalentReach() {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Talent reach</CardTitle>
        <Badge variant="secondary" className="font-normal text-muted-foreground">
          Last 7 days
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl bg-muted/50 px-2">
          <GlobeDecoration />
        </div>

        <ul className="space-y-3.5">
          {talentRegions.map((region) => (
            <li key={region.code} className="flex items-center gap-3">
              <span className="grid w-9 shrink-0 place-items-center rounded-md border border-border bg-card text-[11px] font-semibold text-muted-foreground">
                {region.code}
              </span>
              <span className="w-28 shrink-0 truncate text-sm">{region.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${region.pct}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground">
                {region.pct}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
