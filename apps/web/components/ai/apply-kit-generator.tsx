"use client";

import * as React from "react";
import { Check, Copy, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { Job } from "@/lib/types";
import { useShireStore } from "@/lib/store";
import { generateApplyKit } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const tabs = [
  { key: "coverLetter", label: "Cover letter" },
  { key: "recruiterDM", label: "Recruiter DM" },
  { key: "shortIntro", label: "Intro" },
  { key: "followUp", label: "Follow-up" },
] as const;

export function ApplyKitGenerator({ job }: { job: Job }) {
  const candidateProfile = useShireStore((s) => s.candidateProfile);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const kit = React.useMemo(() => generateApplyKit(job, candidateProfile), [job, candidateProfile]);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Wand2 className="size-4" />
          Generate apply kit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Apply kit
          </DialogTitle>
          <DialogDescription>
            AI-drafted from your profile and this role. Review and personalize before sending.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="coverLetter">
          <TabsList className="w-full">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="flex-1 text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key} className="space-y-2">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-sans text-sm text-foreground/90">
                {kit[t.key]}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => copy(t.key, kit[t.key])}
              >
                {copied === t.key ? (
                  <>
                    <Check className="size-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-4" /> Copy
                  </>
                )}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
