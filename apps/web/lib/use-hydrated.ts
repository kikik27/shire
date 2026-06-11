"use client";

import { useShireStore } from "@/lib/store";

/** True once the persisted store has loaded from localStorage (client-only). */
export function useHydrated() {
  return useShireStore((s) => s.hydrated);
}
