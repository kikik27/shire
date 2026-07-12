/** Static content for the marketing landing page. */

export const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Staking", href: "#stake" },
  { label: "FAQ", href: "#faq" },
] as const;

export const heroChips = [
  "Frontend Engineer",
  "Product Designer",
  "Soroban Developer",
  "Data Analyst",
  "Growth Marketer",
  "DevOps Engineer",
] as const;

/** The three beats of the story-driven hero workflow card. */
export type HeroStep = {
  id: "match" | "stake" | "settle";
  num: string;
  title: string;
  detail: string;
};

export const heroSteps: HeroStep[] = [
  {
    id: "match",
    num: "1",
    title: "Match",
    detail: "Senior Frontend Engineer · 94% fit",
  },
  {
    id: "stake",
    num: "2",
    title: "Stake",
    detail: "250 XLM locked in escrow",
  },
  {
    id: "settle",
    num: "3",
    title: "Settle",
    detail: "Funds released on confirm",
  },
];

export type TrustLogo = { name: string; metric: string };

/** Realistic placeholder companies with a specific outcome metric each. */
export const trustLogos: TrustLogo[] = [
  { name: "Meridian", metric: "12 hires · $4.2k avg stake" },
  { name: "Outpost", metric: "9 hires · zero no-shows" },
  { name: "Northbound", metric: "6 hires · 38h to signed" },
  { name: "Lattice", metric: "14 hires · $5.1k avg stake" },
  { name: "Harbor", metric: "4 hires · zero disputes" },
  { name: "Cadence", metric: "11 hires · 31h to signed" },
];

export type Stat = { value: string; label: string };

export const stats: Stat[] = [
  { value: "2,400+", label: "Matches ranked every week" },
  { value: "$1.2M", label: "Held in escrow right now" },
  { value: "48h", label: "Average time to a verified hire" },
  { value: "100%", label: "Stake protected until confirmed" },
];

export type Step = { num: string; title: string; body: string };

export const steps: Step[] = [
  {
    num: "01",
    title: "Sign in & upload",
    body: "Sign in with email or Google. Shire sets up your account, then you drop in your CV or open role. No long forms, no crypto setup.",
  },
  {
    num: "02",
    title: "AI builds & matches",
    body: "Shire drafts a structured profile and surfaces ranked matches, each with the reasons behind it so you can trust the pick.",
  },
  {
    num: "03",
    title: "Approve & settle",
    body: "You approve the move. A refundable stake locks in escrow and releases automatically the moment both sides confirm.",
  },
];

export type Feature = {
  title: string;
  body: string;
  /** Optional match demo: renders an animated match-score bar on hover. */
  match?: { score: number; skills: string[] };
};

/** Editorial feature grid with title and one line, no heavy cards. */
export const features: Feature[] = [
  {
    title: "AI match engine",
    body: "Skill overlap plus reasoning surfaces the matches that fit, with the reasons attached.",
    match: { score: 94, skills: ["React", "TypeScript", "Stellar"] },
  },
  {
    title: "Smart CV parsing",
    body: "Upload a resume and get a clean, structured profile draft you can edit and confirm.",
  },
  {
    title: "Onchain escrow",
    body: "A refundable stake locks commitment from both sides and settles on completion. Locked, never spent.",
  },
  {
    title: "Live tracking",
    body: "Every application's status, stake, and next step in one dashboard. No inbox archaeology.",
  },
  {
    title: "Fair dispute resolution",
    body: "Structured evidence and an AI summary give a human resolver a clear, neutral picture.",
  },
  {
    title: "Daily match digest",
    body: "A short, relevant digest of new matches, not another noisy inbox to clear.",
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
};

/** One big pull-quote for the editorial flow (UserJot-style). */
export const featuredQuote: Testimonial = {
  quote:
    "The stake is what changed everything. Once both sides had skin in the game, the ghosting stopped overnight. Three hires in, zero no-shows.",
  name: "Sara Lindgren",
  role: "Head of Talent, Meridian",
  initials: "SL",
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "We cut screening time in half. The match reasons are specific enough that our recruiters actually trust them.",
    name: "Daniel Okafor",
    role: "Recruiting Lead, Outpost",
    initials: "DO",
  },
  {
    quote:
      "Staking sounded scary until I did it once. Funds are locked, not spent, and released the moment we both confirm.",
    name: "Priya Nair",
    role: "Engineering Manager",
    initials: "PN",
  },
];

export type Metric = { value: string; label: string };

/** Big-number band with outcome stats, not vanity volume. */
export const metrics: Metric[] = [
  { value: "4×", label: "Faster from match to signed offer" },
  { value: "40%", label: "Less screening time per role" },
  { value: "0", label: "Ghosted hires after a stake locks" },
];

export type Faq = { q: string; a: string };

export const faqs: Faq[] = [
  {
    q: "What exactly is the stake, and is my money safe?",
    a: "When you apply or accept, a small stablecoin stake is locked in escrow, not spent and not paid to us. It signals real commitment from both sides and is released automatically when you both confirm completion. Funds never leave escrow until that point.",
  },
  {
    q: "How does the AI matching work?",
    a: "Shire turns your CV or job post into a structured profile, then ranks matches using skill overlap plus reasoning. Every match comes with the reasons behind it, and the AI never applies or stakes on your behalf.",
  },
  {
    q: "Do I need crypto experience to use Shire?",
    a: "No. You sign in with email or Google and Shire sets up your account. The staking flow is a single approval, amounts show in USD-pegged XLM, and you always approve before anything happens.",
  },
  {
    q: "Can I be both a candidate and a company?",
    a: "Yes. One account is one identity that can find work, find talent, or both. Switch modes anytime. Your permissions are contextual, not locked to a role.",
  },
  {
    q: "What happens if there's a dispute?",
    a: "Either side can open a dispute with evidence. An AI summary gives a human resolver a clear picture, and only the resolver can settle the escrow. The AI never decides outcomes.",
  },
];

export const footerColumns = [
  {
    title: "Product",
    links: ["Features", "How it works", "Staking", "Changelog", "Status"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Blog", "Press", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security", "Cookies"],
  },
] as const;
