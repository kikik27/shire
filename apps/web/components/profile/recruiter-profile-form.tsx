"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAccessToken } from "@/lib/auth/use-access-token";
import { saveProfile } from "@/lib/profile-client";
import { recruiterProfileSchema, type RecruiterProfileValues } from "@/lib/schemas";
import type { RecruiterProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function RecruiterProfileForm({
  redirectTo,
  initialProfile,
}: {
  redirectTo?: string;
  initialProfile?: RecruiterProfile | null;
}) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const [saving, setSaving] = React.useState(false);
  const current = initialProfile;

  const form = useForm<RecruiterProfileValues>({
    resolver: zodResolver(recruiterProfileSchema),
    defaultValues: {
      companyName: current?.companyName ?? "",
      companyWebsite: current?.companyWebsite ?? "",
      companyDescription: current?.companyDescription ?? "",
      contactEmail: current?.contactEmail ?? "",
      location: current?.location ?? "",
    },
  });

  React.useEffect(() => {
    if (initialProfile) {
      form.reset({
        companyName: initialProfile.companyName,
        companyWebsite: initialProfile.companyWebsite ?? "",
        companyDescription: initialProfile.companyDescription,
        contactEmail: initialProfile.contactEmail ?? "",
        location: initialProfile.location ?? "",
      });
    }
  }, [form, initialProfile]);

  async function onSubmit(values: RecruiterProfileValues) {
    const editableProfile = {
      companyName: values.companyName,
      companyWebsite: values.companyWebsite || undefined,
      companyDescription: values.companyDescription,
      contactEmail: values.contactEmail || undefined,
      location: values.location || undefined,
    };
    setSaving(true);
    try {
      const token = await accessToken();
      await saveProfile<RecruiterProfile, typeof editableProfile>(
        "recruiter",
        editableProfile,
        token,
      );
      toast.success("Company profile saved");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error("Company profile was not saved", {
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
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company name</FormLabel>
              <FormControl>
                <Input placeholder="Aperture Labs" autoComplete="organization" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="companyWebsite"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input placeholder="https://" inputMode="url" {...field} />
              </FormControl>
              <FormDescription>Verified websites raise your trust score.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="companyDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>About the company</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="What you build and who you're hiring." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="contactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="talent@company.com" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Remote / GMT+1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving..." : "Save company"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
