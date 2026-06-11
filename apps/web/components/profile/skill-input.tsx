"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SkillInput({
  value,
  onChange,
  placeholder = "Type a skill and press Enter",
  suggestions = [],
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  id?: string;
}) {
  const [draft, setDraft] = React.useState("");

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (value.some((s) => s.toLowerCase() === v.toLowerCase())) return;
    onChange([...value, v]);
    setDraft("");
  };

  const remove = (skill: string) => onChange(value.filter((s) => s !== skill));

  const open = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent p-1.5 focus-within:ring-2 focus-within:ring-ring">
        {value.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 py-0.5 pl-2 pr-1 text-xs font-medium text-primary"
          >
            {skill}
            <button
              type="button"
              onClick={() => remove(skill)}
              className="grid size-4 place-items-center rounded transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Remove ${skill}`}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          placeholder={value.length ? "" : placeholder}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      {open.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {open.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cn(
                "rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
