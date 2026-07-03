"use client";

import * as React from "react";
import { FileText, LoaderCircle, RotateCcw, Upload } from "lucide-react";

import { useAccessToken } from "@/lib/auth/use-access-token";
import type { CandidateProfile } from "@/lib/types";
import { mapAgentProfileToForm } from "@/lib/cv-profile-draft";
import {
  getCandidateCvJob,
  submitCandidateCv,
  type CvJobState,
} from "@/lib/cv-upload-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const acceptedTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const maxFileBytes = 5 * 1024 * 1024;

function statusCopy(state: CvJobState | null) {
  if (!state) return null;
  if (state.status === "queued") {
    return { title: "CV queued", description: "Waiting for the worker.", value: 20 };
  }
  if (state.status === "active") {
    return { title: "Processing CV", description: "Extracting and generating your profile.", value: 65 };
  }
  if (state.status === "delayed") {
    return {
      title: "Retry scheduled",
      description: `Temporary provider issue. Attempt ${state.attempts ?? 1} of ${state.maxAttempts ?? 3}.`,
      value: 45,
    };
  }
  return null;
}

export function CandidateCvUpload({
  onDraft,
  existingProfile,
}: {
  onDraft: (draft: CandidateProfile) => void;
  existingProfile?: CandidateProfile | null;
}) {
  const accessToken = useAccessToken();
  const [file, setFile] = React.useState<File | null>(null);
  const [state, setState] = React.useState<CvJobState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const generationRef = React.useRef(0);

  React.useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  async function poll(jobId: string, token: string | undefined, generation: number) {
    let networkFailures = 0;
    while (generationRef.current === generation) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      try {
        const next = await getCandidateCvJob(jobId, token);
        networkFailures = 0;
        if (generationRef.current !== generation) return;
        setState(next);
        if (next.status === "completed") {
          onDraft(mapAgentProfileToForm(next.profile, existingProfile));
          return;
        }
        if (next.status === "failed") {
          setError(next.message);
          return;
        }
      } catch (pollError) {
        networkFailures += 1;
        if (networkFailures >= 3) {
          setError(
            pollError instanceof Error
              ? pollError.message
              : "Could not retrieve CV status.",
          );
          return;
        }
      }
    }
  }

  async function upload() {
    if (!file) {
      setError("Select a PDF or DOCX CV first.");
      return;
    }
    if (!acceptedTypes.includes(file.type)) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }
    if (file.size > maxFileBytes) {
      setError("The CV file must be 5 MiB or smaller.");
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setSubmitting(true);
    setError(null);
    setState({ status: "queued" });
    try {
      const token = await accessToken();
      const accepted = await submitCandidateCv(file, token);
      await poll(accepted.jobId, token, generation);
    } catch (uploadError) {
      setState(null);
      setError(
        uploadError instanceof Error ? uploadError.message : "CV upload failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const progress = statusCopy(state);
  const completed = state?.status === "completed";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Import profile from CV</h2>
            <Badge variant="secondary">PDF or DOCX</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            AI creates a draft. Nothing is saved until you review and confirm the form.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={submitting}
          onChange={(event) => {
            generationRef.current += 1;
            setState(null);
            setError(null);
            setFile(event.target.files?.[0] ?? null);
          }}
        />
        <Button type="button" disabled={!file || submitting} onClick={upload}>
          {submitting ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Upload />
          )}
          {submitting ? "Processing" : "Upload CV"}
        </Button>
      </div>

      {progress ? (
        <div
          aria-live="polite"
          className="mt-4 space-y-2 rounded-xl border border-border bg-muted/30 p-4"
        >
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{progress.title}</span>
            {state?.status === "delayed" ? (
              <RotateCcw className="size-4 text-muted-foreground" />
            ) : null}
          </div>
          <Progress value={progress.value} />
          <p className="text-xs text-muted-foreground">{progress.description}</p>
        </div>
      ) : null}

      {completed ? (
        <Alert aria-live="polite" className="mt-4">
          <FileText />
          <AlertTitle>Draft ready for review</AlertTitle>
          <AlertDescription>
            The form below has been updated. Check missing or uncertain details, then select Confirm & Save.
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert aria-live="assertive" variant="destructive" className="mt-4">
          <AlertTitle>CV processing failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
