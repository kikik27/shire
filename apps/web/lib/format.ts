import type { TokenSymbol } from "@/lib/types";

export function truncateAddress(address?: string | null, size = 4): string {
  if (!address) return "";
  if (address.length <= size * 2 + 2) return address;
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}

export function formatToken(amount: number, token: TokenSymbol = "cUSD"): string {
  const decimals = token === "CELO" ? 2 : 2;
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : decimals,
    maximumFractionDigits: decimals,
  })} ${token}`;
}

export function initials(name?: string): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function relativeDeadline(ts: number): string {
  const diff = ts - Date.now();
  const days = Math.round(diff / 86400000);
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "1 day left";
  if (days < 30) return `${days} days left`;
  return `${Math.round(days / 30)}mo left`;
}

const DAY = 86400000;
export const day = (n: number) => n * DAY;
