import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return <AppShell role="recruiter">{children}</AppShell>;
}
