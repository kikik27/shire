"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import type { AppRole } from "@/lib/types";
import { useShireStore } from "@/lib/store";
import { roleMeta } from "@/components/layout/app-nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const roles: AppRole[] = ["candidate", "recruiter", "admin"];

export function RoleSwitcher({ current }: { current: AppRole }) {
  const router = useRouter();
  const setActiveRole = useShireStore((s) => s.setActiveRole);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {roleMeta[current].label}
          <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Switch view</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => {
              setActiveRole(role);
              router.push(roleMeta[role].home);
            }}
          >
            <span className="flex-1">{roleMeta[role].label}</span>
            <Check className={cn("size-4", role === current ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
