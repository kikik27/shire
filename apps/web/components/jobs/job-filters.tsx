"use client";

import { Search } from "lucide-react";
import type { JobType } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export type JobFilterState = {
  query: string;
  type: JobType | "ALL";
  remoteOnly: boolean;
  hideHighRisk: boolean;
};

const TYPES: { value: JobType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "FULL_TIME", label: "Full-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "FREELANCE", label: "Freelance" },
];

export function JobFilters({
  value,
  onChange,
}: {
  value: JobFilterState;
  onChange: (next: JobFilterState) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <Label htmlFor="job-search" className="sr-only">
          Search jobs
        </Label>
        <Input
          id="job-search"
          type="search"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
          placeholder="Search role, company, or skill…"
          className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          value={value.type}
          onValueChange={(v) => v && onChange({ ...value, type: v as JobType | "ALL" })}
          variant="outline"
          size="sm"
          className="flex-wrap"
        >
          {TYPES.map((t) => (
            <ToggleGroupItem key={t.value} value={t.value} className="text-xs">
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center gap-2">
          <Switch
            id="remote-only"
            checked={value.remoteOnly}
            onCheckedChange={(c) => onChange({ ...value, remoteOnly: c })}
          />
          <Label htmlFor="remote-only" className="text-sm text-muted-foreground">
            Remote
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="hide-risk"
            checked={value.hideHighRisk}
            onCheckedChange={(c) => onChange({ ...value, hideHighRisk: c })}
          />
          <Label htmlFor="hide-risk" className="text-sm text-muted-foreground">
            Hide high-risk
          </Label>
        </div>
      </div>
    </div>
  );
}
