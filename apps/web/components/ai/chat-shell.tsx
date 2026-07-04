"use client";

import { usePathname } from "next/navigation";

import { ChatPanel } from "./chat-panel";
import { resolveChatScopeForPathname } from "@/lib/chat/context";
import type { AppRole } from "@/lib/types";

export function ChatShell({ role }: { role: AppRole }) {
  const pathname = usePathname();

  if (role === "admin") {
    return null;
  }

  const scope = resolveChatScopeForPathname({
    role,
    pathname,
  });

  return (
    <ChatPanel
      api={`/api/chat/${scope.resourceType ? "resource" : "general"}`}
      scope={scope}
      title="Shire assistant"
    />
  );
}
