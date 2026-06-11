"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { seedNotifications } from "@/lib/seed";

export function NotificationsMenu() {
  const unread = seedNotifications.filter((n) => n.unread).length;
  return (
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
          <span className="text-xs font-normal text-muted-foreground">{unread} unread</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {seedNotifications.map((n) => (
          <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5">
            <span className="flex w-full items-start gap-2 text-sm">
              {n.unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
              <span className={n.unread ? "" : "pl-3.5 text-muted-foreground"}>{n.text}</span>
            </span>
            <span className="pl-3.5 text-xs text-muted-foreground">{n.time} ago</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
