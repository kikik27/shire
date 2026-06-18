import {
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  candidatePipeline,
  companyActions,
  type LineItem,
} from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const toneStyles: Record<LineItem["tone"], { icon: LucideIcon; className: string }> = {
  info: { icon: FileText, className: "bg-primary/10 text-primary" },
  success: { icon: CheckCircle2, className: "bg-success/10 text-success" },
  warning: { icon: Clock, className: "bg-warning/15 text-warning-foreground" },
  muted: { icon: Layers, className: "bg-muted text-muted-foreground" },
};

function ListCard({ title, items }: { title: string; items: LineItem[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => {
          const tone = toneStyles[item.tone];
          const Icon = tone.icon;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/60"
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tone.className)}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {item.meta}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function PipelineLists() {
  return (
    <div className="flex gap-4">
      <ListCard title="Candidate pipeline" items={candidatePipeline} />
      <ListCard title="Company actions" items={companyActions} />
    </div>
  );
}
