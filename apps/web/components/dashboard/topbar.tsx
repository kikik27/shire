"use client";

import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { navFooterItems, navItems } from "@/components/dashboard/nav";
import { notifications } from "@/lib/dashboard-data";

export function Topbar() {
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile nav */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="text-left">
              <Logo />
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            {[...navItems, ...navFooterItems].map((item) => {
              const Icon = item.icon;
              return (
                <SheetClose asChild key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                    {item.label}
                    {item.badge ? (
                      <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col">
        <h1 className="text-base font-semibold tracking-tight">Dashboard</h1>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Your hiring and applications at a glance
        </p>
      </div>

      {/* Search */}
      <div className="ml-auto hidden items-center gap-2 rounded-lg border border-border bg-card px-3 md:flex">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="dash-search" className="sr-only">
          Search
        </label>
        <input
          id="dash-search"
          type="search"
          placeholder="Search jobs, talent, applications…"
          className="h-9 w-56 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <span className="text-xs font-normal text-muted-foreground">
                {unread} unread
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="flex w-full items-start gap-2 text-sm">
                  {n.unread && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <span className={n.unread ? "" : "pl-3.5 text-muted-foreground"}>
                    {n.text}
                  </span>
                </span>
                <span className="pl-3.5 text-xs text-muted-foreground">{n.time} ago</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Account menu"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  AI
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight">Amira Idris</span>
                <span className="block text-xs leading-tight text-muted-foreground">
                  Recruiter
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>My account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Switch to candidate mode</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">Log out</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
