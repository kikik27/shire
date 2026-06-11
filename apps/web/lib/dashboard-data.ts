/**
 * Typed demo data for the dashboard. No network — these fixtures stand in for the
 * API/DB layer so the UI is fully visible before backend wiring (see tasks.md).
 */

export type Trend = "up" | "down";

export type Kpi = {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: Trend;
  hint: string;
};

export const kpis: Kpi[] = [
  {
    id: "active-applications",
    label: "Active applications",
    value: "125",
    delta: "18%",
    trend: "up",
    hint: "vs. last 30 days",
  },
  {
    id: "pending-stakes",
    label: "Pending stakes",
    value: "42",
    delta: "5%",
    trend: "up",
    hint: "awaiting company match",
  },
  {
    id: "match-rate",
    label: "Match acceptance",
    value: "87%",
    delta: "6%",
    trend: "up",
    hint: "AI suggestions accepted",
  },
  {
    id: "time-to-hire",
    label: "Avg. time-to-hire",
    value: "3d 4h",
    delta: "12%",
    trend: "down",
    hint: "faster than last cycle",
  },
];

export type Region = { name: string; code: string; pct: number };

export const talentRegions: Region[] = [
  { name: "United States", code: "US", pct: 35 },
  { name: "India", code: "IN", pct: 24 },
  { name: "United Kingdom", code: "GB", pct: 16 },
  { name: "Germany", code: "DE", pct: 12 },
  { name: "Nigeria", code: "NG", pct: 8 },
  { name: "Indonesia", code: "ID", pct: 5 },
];

export type JobStatus = "active" | "review" | "closed";

export type JobRow = {
  id: string;
  role: string;
  company: string;
  seniority: string;
  stake: string;
  posted: string;
  status: JobStatus;
};

export const jobCatalog: JobRow[] = [
  {
    id: "JOB-20045",
    role: "Senior Frontend Engineer",
    company: "Aperture Labs",
    seniority: "Senior",
    stake: "120 cUSD",
    posted: "24/05/2026",
    status: "active",
  },
  {
    id: "JOB-78990",
    role: "Product Designer",
    company: "Northwind",
    seniority: "Mid",
    stake: "80 cUSD",
    posted: "12/05/2026",
    status: "active",
  },
  {
    id: "JOB-78698",
    role: "Solidity Engineer",
    company: "Mesh Protocol",
    seniority: "Senior",
    stake: "200 cUSD",
    posted: "10/05/2026",
    status: "review",
  },
  {
    id: "JOB-98979",
    role: "Data Analyst",
    company: "Brightside",
    seniority: "Mid",
    stake: "75 cUSD",
    posted: "02/05/2026",
    status: "active",
  },
  {
    id: "JOB-44120",
    role: "DevOps Engineer",
    company: "Helia Cloud",
    seniority: "Senior",
    stake: "140 cUSD",
    posted: "28/04/2026",
    status: "closed",
  },
];

export type ActivityPoint = { month: string; applications: number; matches: number };

export const activitySeries: ActivityPoint[] = [
  { month: "Jan", applications: 8, matches: 5 },
  { month: "Feb", applications: 11, matches: 7 },
  { month: "Mar", applications: 14, matches: 9 },
  { month: "Apr", applications: 12, matches: 8 },
  { month: "May", applications: 18, matches: 13 },
  { month: "Jun", applications: 16, matches: 11 },
  { month: "Jul", applications: 13, matches: 9 },
  { month: "Aug", applications: 15, matches: 10 },
  { month: "Sep", applications: 19, matches: 14 },
  { month: "Oct", applications: 22, matches: 17 },
  { month: "Nov", applications: 20, matches: 15 },
  { month: "Dec", applications: 24, matches: 19 },
];

export type MatchSlice = { key: string; label: string; value: number };

export const matchQuality: MatchSlice[] = [
  { key: "strong", label: "Strong match", value: 65 },
  { key: "partial", label: "Partial match", value: 25 },
  { key: "weak", label: "Needs review", value: 10 },
];

export const matchTotal = 2548;

export type PipelineBar = { stage: string; total: number; active: number };

export const pipelineBars: PipelineBar[] = [
  { stage: "Sourced", total: 132, active: 96 },
  { stage: "Screened", total: 88, active: 61 },
  { stage: "Interview", total: 47, active: 34 },
  { stage: "Offer", total: 19, active: 14 },
  { stage: "Hired", total: 12, active: 12 },
];

export type LineItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  tone: "info" | "success" | "warning" | "muted";
};

export const candidatePipeline: LineItem[] = [
  {
    id: "cp-1",
    title: "Profiles confirmed",
    subtitle: "AI draft reviewed & approved",
    meta: "7 ready",
    tone: "success",
  },
  {
    id: "cp-2",
    title: "Awaiting CV parse",
    subtitle: "Uploaded, queued for the agent",
    meta: "6 in queue",
    tone: "info",
  },
  {
    id: "cp-3",
    title: "Needs an update",
    subtitle: "Missing skills or salary range",
    meta: "4 flagged",
    tone: "warning",
  },
  {
    id: "cp-4",
    title: "Regions covered",
    subtitle: "Across active candidate pool",
    meta: "5 regions",
    tone: "muted",
  },
];

export const companyActions: LineItem[] = [
  {
    id: "ca-1",
    title: "Stakes to approve",
    subtitle: "Candidate staked, company to match",
    meta: "6 waiting",
    tone: "warning",
  },
  {
    id: "ca-2",
    title: "Offers settled",
    subtitle: "Escrow released to both sides",
    meta: "6 closed",
    tone: "success",
  },
  {
    id: "ca-3",
    title: "Interviews scheduled",
    subtitle: "Within active applications",
    meta: "4 upcoming",
    tone: "info",
  },
  {
    id: "ca-4",
    title: "Open disputes",
    subtitle: "Evidence under resolver review",
    meta: "1 active",
    tone: "muted",
  },
];

export type Notification = {
  id: string;
  text: string;
  time: string;
  unread: boolean;
};

export const notifications: Notification[] = [
  { id: "n1", text: "Mesh Protocol matched your Solidity profile", time: "2m", unread: true },
  { id: "n2", text: "Aperture Labs staked 120 cUSD on your application", time: "1h", unread: true },
  { id: "n3", text: "Your CV draft is ready to review", time: "3h", unread: false },
];
