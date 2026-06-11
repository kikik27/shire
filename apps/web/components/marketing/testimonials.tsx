import { Quote } from "lucide-react";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { testimonials } from "@/lib/marketing";

export function Testimonials() {
  const [featured, ...rest] = testimonials;

  return (
    <section className="bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Testimonials"
          title="What people say about Shire"
          align="left"
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {/* featured */}
          <figure className="dark flex flex-col justify-between rounded-2xl bg-primary p-8 text-primary-foreground lg:row-span-1">
            <Quote className="size-8 opacity-40" aria-hidden="true" />
            <blockquote className="mt-6 text-lg font-medium leading-relaxed text-balance">
              “{featured.quote}”
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-3">
              <Avatar className="size-10 border border-white/20">
                <AvatarFallback className="bg-white/15 text-sm font-medium text-primary-foreground">
                  {featured.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{featured.name}</p>
                <p className="text-sm text-primary-foreground/70">{featured.role}</p>
              </div>
            </figcaption>
          </figure>

          {/* supporting */}
          <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
            {rest.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col justify-between rounded-2xl border border-border bg-background p-6"
              >
                <blockquote className="text-base leading-relaxed text-foreground/90">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                      {t.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-sm text-muted-foreground">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
            <div className="flex flex-col justify-center gap-1 rounded-2xl border border-dashed border-border bg-background p-6">
              <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                4.9/5
              </p>
              <p className="text-sm text-muted-foreground">
                Average rating from candidates and recruiters across 1,200+ reviews.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
