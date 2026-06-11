"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jobDraftSchema, type JobDraftValues } from "@/lib/schemas";
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

export function JobDraftForm({ onSubmit }: { onSubmit: (values: JobDraftValues) => void }) {
  const form = useForm<JobDraftValues>({
    // zod defaults/coerce make input ≠ output; pin the resolver to the output type (RHF v7 + resolvers v5).
    resolver: zodResolver(jobDraftSchema) as Resolver<JobDraftValues>,
    defaultValues: {
      title: "",
      description: "",
      location: "Remote",
      remote: true,
      salaryRange: "",
      jobType: "FULL_TIME",
      experienceLevel: "MID",
      skillsRequired: [],
      candidateStakeRequired: false,
      candidateStakeAmount: 0,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job title</FormLabel>
              <FormControl>
                <Input placeholder="Senior Solidity Engineer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="What does the role involve? Who are you looking for?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="skillsRequired"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Required skills</FormLabel>
              <FormControl>
                <SkillInput
                  value={field.value}
                  onChange={field.onChange}
                  suggestions={SKILLS}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="jobType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full-time</SelectItem>
                    <SelectItem value="PART_TIME">Part-time</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="FREELANCE">Freelance</SelectItem>
                    <SelectItem value="INTERNSHIP">Internship</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
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
                    <SelectItem value="INTERN">Intern</SelectItem>
                    <SelectItem value="JUNIOR">Junior</SelectItem>
                    <SelectItem value="MID">Mid-level</SelectItem>
                    <SelectItem value="SENIOR">Senior</SelectItem>
                    <SelectItem value="LEAD">Lead</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Input placeholder="Berlin / Remote" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salaryRange"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary range</FormLabel>
                <FormControl>
                  <Input placeholder="$80k–$120k" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="remote"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-border p-4">
              <div className="space-y-0.5">
                <FormLabel>Remote-friendly</FormLabel>
                <FormDescription>Candidates can work from anywhere.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="candidateStakeRequired"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border border-border p-4">
              <div className="space-y-0.5">
                <FormLabel>Require candidate stake</FormLabel>
                <FormDescription>
                  Candidates must lock cUSD to apply — reduces low-effort applications.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Continue to stake
          </Button>
        </div>
      </form>
    </Form>
  );
}
