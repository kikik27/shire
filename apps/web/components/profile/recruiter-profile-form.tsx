"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { recruiterProfileSchema, type RecruiterProfileValues } from "@/lib/schemas";
import { getRecruiterById, ME_RECRUITER_ID, useShireStore } from "@/lib/store";
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

export function RecruiterProfileForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const recruiterProfile = useShireStore((s) => s.recruiterProfile);
  const save = useShireStore((s) => s.saveRecruiterProfile);
  const current = getRecruiterById({ recruiterProfile }, ME_RECRUITER_ID);

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

  function onSubmit(values: RecruiterProfileValues) {
    save({
      companyName: values.companyName,
      companyWebsite: values.companyWebsite || undefined,
      companyDescription: values.companyDescription,
      contactEmail: values.contactEmail || undefined,
      location: values.location || undefined,
      verificationStatus: current?.verificationStatus ?? "UNVERIFIED",
      trustLevel: current?.trustLevel ?? 30,
      completedHires: current?.completedHires ?? 0,
      disputeCount: current?.disputeCount ?? 0,
    });
    toast.success("Company profile saved");
    if (redirectTo) router.push(redirectTo);
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
                  <Input placeholder="Remote · GMT+1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="lg">
            Save company
          </Button>
        </div>
      </form>
    </Form>
  );
}
