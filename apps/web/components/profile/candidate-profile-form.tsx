"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAccessToken } from "@/lib/auth/use-access-token";
import { PRIVY_ENABLED } from "@/lib/auth/use-auth";
import { saveProfile } from "@/lib/profile-client";
import { candidateProfileSchema, type CandidateProfileValues } from "@/lib/schemas";
import { useShireStore } from "@/lib/store";
import type { CandidateProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SkillInput } from "@/components/profile/skill-input";

const SKILLS = ["React", "TypeScript", "Solidity", "Figma", "Node.js", "SQL", "Tailwind", "viem"];
const ROLES = [
  "Frontend Engineer",
  "Product Designer",
  "Solidity Engineer",
  "Data Analyst",
  "Community Manager",
];
const LANGS = ["English", "Spanish", "Indonesian", "Hindi", "German"];
const EXPERIENCE = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD"] as const;

export function CandidateProfileForm({
  redirectTo,
  draft,
  initialProfile,
}: {
  redirectTo?: string;
  draft?: CandidateProfileValues | null;
  initialProfile?: CandidateProfile | null;
}) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const existing = useShireStore((s) => s.candidateProfile);
  const save = useShireStore((s) => s.saveCandidateProfile);
  const [saving, setSaving] = React.useState(false);
  const current = initialProfile ?? existing;

  const form = useForm<CandidateProfileValues>({
    // zod defaults make input ≠ output; pin the resolver to the output type (RHF v7 + resolvers v5).
    resolver: zodResolver(candidateProfileSchema) as Resolver<CandidateProfileValues>,
    defaultValues: {
      displayName: current?.displayName ?? "",
      bio: current?.bio ?? "",
      skills: current?.skills ?? [],
      roleTargets: current?.roleTargets ?? [],
      experienceLevel: current?.experienceLevel ?? "JUNIOR",
      portfolioUrl: current?.portfolioUrl ?? "",
      githubUrl: current?.githubUrl ?? "",
      linkedinUrl: current?.linkedinUrl ?? "",
      xUrl: current?.xUrl ?? "",
      location: current?.location ?? "",
      timezone: current?.timezone ?? "",
      languages: current?.languages ?? ["English"],
      salaryExpectation: current?.salaryExpectation ?? "",
      visibility: current?.visibility ?? "PUBLIC",
    },
  });

  React.useEffect(() => {
    if (draft) {
      form.reset(draft);
    }
  }, [draft, form]);

  React.useEffect(() => {
    if (!draft && initialProfile) {
      form.reset({
        ...initialProfile,
        portfolioUrl: initialProfile.portfolioUrl ?? "",
        githubUrl: initialProfile.githubUrl ?? "",
        linkedinUrl: initialProfile.linkedinUrl ?? "",
        xUrl: initialProfile.xUrl ?? "",
        location: initialProfile.location ?? "",
        timezone: initialProfile.timezone ?? "",
        salaryExpectation: initialProfile.salaryExpectation ?? "",
      });
    }
  }, [draft, form, initialProfile]);

  async function onSubmit(values: CandidateProfileValues) {
    const normalized = {
      ...values,
      portfolioUrl: values.portfolioUrl || undefined,
      githubUrl: values.githubUrl || undefined,
      linkedinUrl: values.linkedinUrl || undefined,
      xUrl: values.xUrl || undefined,
    };

    setSaving(true);
    try {
      if (PRIVY_ENABLED) {
        const token = await accessToken();
        const persisted = await saveProfile<CandidateProfile>(
          "candidate",
          normalized,
          token,
        );
        save(persisted);
      } else {
        save(normalized);
      }
      toast.success("Profile saved", { description: "AI will use this to match you to roles." });
      if (redirectTo) router.push(redirectTo);
    } catch (error) {
      toast.error("Profile was not saved", {
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input placeholder="Jordan Rivera" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="What you do and what you're looking for." {...field} />
              </FormControl>
              <FormDescription>A line or two recruiters will see first.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="skills"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Skills</FormLabel>
              <FormControl>
                <SkillInput value={field.value} onChange={field.onChange} suggestions={SKILLS} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="roleTargets"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target roles</FormLabel>
              <FormControl>
                <SkillInput
                  value={field.value}
                  onChange={field.onChange}
                  suggestions={ROLES}
                  placeholder="e.g. Frontend Engineer"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="experienceLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Experience level</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EXPERIENCE.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e.charAt(0) + e.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salaryExpectation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary expectation</FormLabel>
                <FormControl>
                  <Input placeholder="$90k" {...field} />
                </FormControl>
                <FormDescription>Kept private. Only used for matching.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Berlin" autoComplete="address-level2" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <FormControl>
                  <Input placeholder="GMT+1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="languages"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Languages</FormLabel>
              <FormControl>
                <SkillInput value={field.value} onChange={field.onChange} suggestions={LANGS} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="portfolioUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Portfolio</FormLabel>
                <FormControl>
                  <Input placeholder="https://" inputMode="url" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="githubUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GitHub</FormLabel>
                <FormControl>
                  <Input placeholder="https://github.com/…" inputMode="url" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-border p-4">
              <div className="space-y-0.5">
                <FormLabel>Public profile</FormLabel>
                <FormDescription>Let verified recruiters discover you.</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value === "PUBLIC"}
                  onCheckedChange={(c) => field.onChange(c ? "PUBLIC" : "PRIVATE")}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving..." : "Confirm & Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
