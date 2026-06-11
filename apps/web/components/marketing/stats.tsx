import { stats } from "@/lib/marketing";

export function Stats() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card p-6 sm:p-8">
            <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">
              {stat.value}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
