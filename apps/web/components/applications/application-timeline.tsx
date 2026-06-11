import { Check } from "lucide-react";
import { APPLICATION_FLOW, type ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  APPLIED: "Applied",
  REVIEWED: "Reviewed",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  HIRED: "Hired",
};

export function ApplicationTimeline({ status }: { status: ApplicationStatus }) {
  // Terminal states render the flow with the relevant marker.
  const terminal = status === "REJECTED" || status === "WITHDRAWN" || status === "DISPUTED";
  const currentIndex = APPLICATION_FLOW.indexOf(status as (typeof APPLICATION_FLOW)[number]);

  return (
    <ol className="space-y-0">
      {APPLICATION_FLOW.map((step, i) => {
        const done = !terminal && currentIndex >= 0 && i <= currentIndex;
        const active = !terminal && i === currentIndex;
        const last = i === APPLICATION_FLOW.length - 1;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full border text-[10px]",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              {!last && (
                <span
                  className={cn("h-7 w-px", done && i < currentIndex ? "bg-primary" : "bg-border")}
                />
              )}
            </div>
            <div className={cn("pb-2", active && "font-medium")}>
              <p className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>
                {labels[step]}
              </p>
            </div>
          </li>
        );
      })}
      {terminal && (
        <li className="mt-2 text-sm font-medium text-destructive">
          {status === "WITHDRAWN" ? "Withdrawn" : status === "DISPUTED" ? "In dispute" : "Not selected"}
        </li>
      )}
    </ol>
  );
}
