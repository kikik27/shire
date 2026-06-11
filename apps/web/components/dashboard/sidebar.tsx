"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/site/logo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navFooterItems, navItems, type NavItem } from "@/components/dashboard/nav";
import { cn } from "@/lib/utils";

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative grid size-11 place-items-center rounded-xl transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            active
              ? "bg-sidebar-primary/10 text-sidebar-primary"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
          {item.badge ? (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {item.badge}
            </span>
          ) : null}
          {active && (
            <span
              aria-hidden="true"
              className="absolute -left-3 h-5 w-1 rounded-r-full bg-sidebar-primary"
            />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center border-r border-sidebar-border bg-sidebar py-4 lg:flex">
      <Link
        href="/dashboard"
        aria-label="Shire dashboard home"
        className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Logo showWord={false} />
      </Link>

      <nav className="mt-8 flex flex-1 flex-col items-center gap-1.5">
        {navItems.map((item) => (
          <RailLink
            key={item.label}
            item={item}
            active={pathname === item.href || (item.href === "/dashboard" && pathname === "/dashboard")}
          />
        ))}
      </nav>

      <div className="flex flex-col items-center gap-1.5">
        {navFooterItems.map((item) => (
          <RailLink key={item.label} item={item} active={false} />
        ))}
      </div>
    </aside>
  );
}
