import {
  Briefcase,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Scale,
  Settings,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Talent", href: "/dashboard#talent", icon: Users },
  { label: "Jobs", href: "/dashboard#jobs", icon: Briefcase },
  { label: "Applications", href: "/dashboard#applications", icon: FileText, badge: 6 },
  { label: "Disputes", href: "/dashboard#disputes", icon: Scale, badge: 1 },
];

export const navFooterItems: NavItem[] = [
  { label: "Settings", href: "/dashboard#settings", icon: Settings },
];
