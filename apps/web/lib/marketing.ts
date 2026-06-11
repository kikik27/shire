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
  "Solidity Developer",
  "Data Analyst",
  "Growth Marketer",
  "DevOps Engineer",
] as const;

export const trustLogos = [
  "Aperture",
  "Northwind",
  "Mesh",
  "Brightside",
  "Helia",
  "Outline",
] as const;

export type Stat = { value: string; label: string };

export const stats: Stat[] = [
  { value: "70,000+", label: "Roles matched by AI every week" },
  { value: "40 hrs", label: "Saved per hire on screening" },
  { value: "35,000+", label: "Placements settled onchain" },
  { value: "100%", label: "Stake protected by escrow" },
];

export type Step = { num: string; title: string; body: string };

export const steps: Step[] = [
  {
    num: "01",
    title: "Sign in & upload",
    body: "Sign in with email or wallet — we create a secure wallet for you — and drop in your CV or open role. No long forms.",
  },
  {
    num: "02",
    title: "AI builds & matches",
    body: "Shire drafts a structured profile and surfaces ranked matches with clear reasons.",
  },
  {
    num: "03",
    title: "Approve & settle",
    body: "You approve the move. Stablecoin escrow on Celo locks the stake and settles on success.",
  },
];

export type FeatureIcon =
  | "LayoutGrid"
  | "Sparkles"
  | "FileText"
  | "Users"
  | "Activity"
  | "ShieldCheck"
  | "Scale"
  | "MessageSquare"
  | "BellRing";

export type Feature = {
  title: string;
  body: string;
  icon: FeatureIcon;
};

export const features: Feature[] = [
  {
    title: "Integrated applications",
    body: "Apply from anywhere in Shire. One profile, tracked end-to-end across every role.",
    icon: "LayoutGrid",
  },
  {
    title: "AI match engine",
    body: "Rule-based skill overlap plus reasoning surfaces the matches that actually fit.",
    icon: "Sparkles",
  },
  {
    title: "Smart CV parsing",
    body: "Upload a resume; get a clean, structured profile draft you can edit and confirm.",
    icon: "FileText",
  },
  {
    title: "Talent recommendations",
    body: "Companies get ranked candidates with match scores and the reasons behind them.",
    icon: "Users",
  },
  {
    title: "Real-time tracking",
    body: "Every application's status, stake, and next step in one live dashboard.",
    icon: "Activity",
  },
  {
    title: "Onchain escrow",
    body: "Stablecoin stake on Celo locks commitment from both sides and settles on completion.",
    icon: "ShieldCheck",
  },
  {
    title: "Dispute resolution",
    body: "Structured evidence and an AI summary give the resolver a clear, fair picture.",
    icon: "Scale",
  },
  {
    title: "Interview readiness",
    body: "Role-specific prep and gaps to close before you walk into the conversation.",
    icon: "MessageSquare",
  },
  {
    title: "Daily match digest",
    body: "A short, relevant digest of new matches — not another noisy inbox.",
    icon: "BellRing",
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "I uploaded my CV at night and woke up to three strong matches with reasons attached. The escrow made the company actually commit.",
    name: "Sara Lindgren",
    role: "Frontend Engineer",
    initials: "SL",
  },
  {
    quote:
      "We cut screening time in half. The match reasons are specific enough that our recruiters trust them.",
    name: "Daniel Okafor",
    role: "Head of Talent, Mesh",
    initials: "DO",
  },
  {
    quote:
      "Staking sounds scary until you do it once. Funds are locked, not spent, and released the moment we both confirm.",
    name: "Priya Nair",
    role: "Engineering Manager",
    initials: "PN",
  },
];

export const integrations = [
  "Slack",
  "Notion",
  "GitHub",
  "Linear",
  "Gmail",
  "Calendar",
  "Greenhouse",
  "Zoom",
] as const;

export type Faq = { q: string; a: string };

export const faqs: Faq[] = [
  {
    q: "How does the AI matching work?",
    a: "Shire turns your CV or job post into a structured profile, then ranks matches using skill overlap plus reasoning. Every match comes with the reasons behind it — and the AI never applies or stakes on your behalf.",
  },
  {
    q: "What is staking, and is my money safe?",
    a: "When you apply or accept, a small stablecoin stake is locked in escrow on Celo — not spent. It signals real commitment from both sides and is released automatically when you both confirm completion.",
  },
  {
    q: "Do I need crypto experience to use Shire?",
    a: "No. You sign in with a wallet (including MiniPay), and the staking flow is a single approval. Amounts are shown in stablecoins like cUSD, and you always approve before anything happens.",
  },
  {
    q: "Can I be both a candidate and a company?",
    a: "Yes. One wallet is one identity that can find work, find talent, or both. Switch modes anytime — your permissions are contextual, not locked to a role.",
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
