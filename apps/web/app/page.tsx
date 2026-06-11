import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Logos } from "@/components/marketing/logos";
import { Stats } from "@/components/marketing/stats";
import { Steps } from "@/components/marketing/steps";
import { Features } from "@/components/marketing/features";
import { Testimonials } from "@/components/marketing/testimonials";
import { Integrations } from "@/components/marketing/integrations";
import { StakeModel } from "@/components/marketing/stake-model";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";
import { Footer } from "@/components/marketing/footer";

export default function Page() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Logos />
        <Stats />
        <Steps />
        <Features />
        <Testimonials />
        <Integrations />
        <StakeModel />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
