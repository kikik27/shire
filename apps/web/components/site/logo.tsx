import { cn } from "@/lib/utils";

/**
 * Shire wordmark. The glyph is a stylized escrow "lock + link": two interlocking
 * rings that read as a handshake/agreement secured onchain.
 */
export function Logo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-[18px]"
          aria-hidden="true"
        >
          <path
            d="M12 3 5 6.5v5c0 4.2 2.9 7.3 7 9 4.1-1.7 7-4.8 7-9v-5L12 3Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="m8.8 12 2.2 2.3 4.2-4.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWord && (
        <span className="text-lg font-semibold tracking-tight">Shire</span>
      )}
    </span>
  );
}
