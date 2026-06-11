import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function CandidateLayout({ children }: { children: ReactNode }) {
  return <AppShell role="candidate">{children}</AppShell>;
}
