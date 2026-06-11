import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "@/components/marketing/section-heading";
import { faqs } from "@/lib/marketing";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading
              eyebrow="FAQ"
              title="Questions, answered"
              description="Everything you need to know about matching, staking, and getting hired on Shire."
              align="left"
            />
            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              <p className="text-sm font-medium">Still curious?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Talk to the team and we&apos;ll walk you through a live hire.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/dashboard">Talk to an expert</Link>
              </Button>
            </div>
          </div>

          <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={faq.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
