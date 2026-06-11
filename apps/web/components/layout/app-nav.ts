import {
  Briefcase,
  FileText,
  Home,
  type LucideIcon,
  PlusCircle,
  Scale,
  Coins,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";
import type { AppRole } from "@/lib/types";

export type AppNavItem = { label: string; href: string; icon: LucideIcon };

export const navConfig: Record<AppRole, AppNavItem[]> = {
  candidate: [
    { label: "Home", href: "/candidate", icon: Home },
    { label: "Jobs", href: "/candidate/jobs", icon: Briefcase },
    { label: "Applications", href: "/candidate/applications", icon: FileText },
    { label: "Stakes", href: "/candidate/stakes", icon: Coins },
    { label: "Profile", href: "/candidate/profile", icon: User },
  ],
  recruiter: [
    { label: "Home", href: "/recruiter", icon: Home },
    { label: "Jobs", href: "/recruiter/jobs", icon: Briefcase },
    { label: "Post", href: "/recruiter/jobs/new", icon: PlusCircle },
    { label: "Applicants", href: "/recruiter/applicants", icon: Users },
    { label: "Stakes", href: "/recruiter/stakes", icon: Coins },
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: ShieldAlert },
    { label: "Jobs", href: "/admin/jobs", icon: Briefcase },
    { label: "Stakes", href: "/admin/stakes", icon: Coins },
    { label: "Disputes", href: "/admin/disputes", icon: Scale },
  ],
};

export const roleMeta: Record<AppRole, { label: string; home: string }> = {
  candidate: { label: "Candidate", home: "/candidate" },
  recruiter: { label: "Recruiter", home: "/recruiter" },
  admin: { label: "Admin", home: "/admin" },
};
