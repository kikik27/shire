import { trustLogos } from "@/lib/marketing";

export function Logos() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Teams and candidates hiring better with Shire
        </p>
        <div className="mt-6 grid grid-cols-3 items-center gap-x-8 gap-y-6 sm:grid-cols-6">
          {trustLogos.map((name) => (
            <div
              key={name}
              className="flex items-center justify-center text-lg font-semibold tracking-tight text-muted-foreground/70 grayscale transition-[color,opacity] duration-200 hover:text-foreground"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
