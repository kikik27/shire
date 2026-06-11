"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type AppRole,
  type Application,
  type ApplicationStatus,
  type CandidateProfile,
  type Dispute,
  type Job,
  type JobStatus,
  type RecruiterProfile,
  type RoleType,
  type Stake,
  StakeStatus,
  StakeType,
  type TokenSymbol,
} from "@/lib/types";
import { computeMatch, computeRisk } from "@/lib/ai";
import {
  jobs as seedJobs,
  recruiters,
  seedApplications,
  seedDisputes,
  seedStakes,
  talents,
} from "@/lib/seed";

/** The demo user manages the "Aperture Labs" recruiter identity when in recruiter mode. */
export const ME_RECRUITER_ID = "rec_aperture";
export const ME_CANDIDATE_ID = "me_candidate";

const ALFAJORES_CHAIN_ID = 44787;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function demoAddress() {
  const hex = Array.from({ length: 40 }, () =>
    "0123456789abcdef".charAt(Math.floor(Math.random() * 16)),
  ).join("");
  return `0x${hex}`;
}

function randomTx() {
  return "0x" + Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64);
}

type ShireState = {
  hydrated: boolean;

  // wallet
  address: string | null;
  chainId: number;
  connecting: boolean;

  // onchain registry (current user)
  roleType: RoleType;
  registeredOnchain: boolean;
  profileVersion: number;

  // profiles
  candidateProfile: CandidateProfile | null;
  recruiterProfile: RecruiterProfile | null;

  // data
  jobs: Job[];
  applications: Application[];
  stakes: Stake[];
  disputes: Dispute[];
  savedJobIds: string[];

  // ui
  activeRole: AppRole;

  // actions
  connect: () => Promise<void>;
  disconnect: () => void;
  setActiveRole: (role: AppRole) => void;
  registerUser: (roleType: RoleType) => void;
  saveCandidateProfile: (p: CandidateProfile) => void;
  saveRecruiterProfile: (p: RecruiterProfile) => void;
  createJob: (draft: JobDraft) => Job;
  stakeForJob: (jobId: string, amount: number, token: TokenSymbol) => string;
  applyToJob: (
    jobId: string,
    message: string,
    opts?: { stakeAmount?: number; token?: TokenSymbol },
  ) => void;
  withdrawApplication: (appId: string) => void;
  toggleSaveJob: (jobId: string) => void;
  updateApplicationStatus: (appId: string, status: ApplicationStatus) => void;
  moderateJob: (jobId: string, action: "approve" | "flag" | "close") => void;
  refundStake: (stakeId: string) => void;
  slashStake: (stakeId: string, amount: number, reason: string) => void;
  resolveDispute: (id: string, decision: string, slash: boolean) => void;
  resetDemo: () => void;
};

export type JobDraft = {
  title: string;
  description: string;
  location: string;
  remote: boolean;
  salaryRange: string;
  jobType: Job["jobType"];
  experienceLevel: Job["experienceLevel"];
  skillsRequired: string[];
  candidateStakeRequired: boolean;
  candidateStakeAmount?: number;
};

const initialData = () => ({
  jobs: seedJobs.map((j) => ({ ...j })),
  applications: seedApplications.map((a) => ({ ...a })),
  stakes: seedStakes.map((s) => ({ ...s })),
  disputes: seedDisputes.map((d) => ({ ...d })),
});

export const useShireStore = create<ShireState>()(
  persist(
    (set, get) => ({
      hydrated: false,

      address: null,
      chainId: ALFAJORES_CHAIN_ID,
      connecting: false,

      roleType: 0,
      registeredOnchain: false,
      profileVersion: 0,

      candidateProfile: null,
      recruiterProfile: null,

      ...initialData(),
      savedJobIds: [],

      activeRole: "candidate",

      connect: async () => {
        set({ connecting: true });
        await new Promise((r) => setTimeout(r, 600));
        set({ address: get().address ?? demoAddress(), connecting: false });
      },

      disconnect: () => set({ address: null }),

      setActiveRole: (role) => set({ activeRole: role }),

      registerUser: (roleType) =>
        set({
          roleType,
          registeredOnchain: true,
          profileVersion: get().profileVersion + 1,
          activeRole:
            roleType === 2 ? "recruiter" : roleType === 3 ? get().activeRole : "candidate",
        }),

      saveCandidateProfile: (p) =>
        set((s) => ({
          candidateProfile: p,
          registeredOnchain: true,
          roleType: s.roleType === 2 ? 3 : s.roleType === 0 ? 1 : s.roleType,
        })),

      saveRecruiterProfile: (p) =>
        set((s) => ({
          recruiterProfile: p,
          registeredOnchain: true,
          roleType: s.roleType === 1 ? 3 : s.roleType === 0 ? 2 : s.roleType,
        })),

      createJob: (draft) => {
        const recruiter = getRecruiterById(get(), ME_RECRUITER_ID);
        const base: Job = {
          id: uid("job"),
          recruiterId: ME_RECRUITER_ID,
          title: draft.title,
          description: draft.description,
          companyName: recruiter?.companyName ?? "Your company",
          location: draft.location,
          remote: draft.remote,
          salaryRange: draft.salaryRange,
          jobType: draft.jobType,
          experienceLevel: draft.experienceLevel,
          skillsRequired: draft.skillsRequired,
          status: "DRAFT",
          stakeAmount: 0,
          stakeToken: "cUSD",
          stakeStatus: StakeStatus.Cancelled,
          candidateStakeRequired: draft.candidateStakeRequired,
          candidateStakeAmount: draft.candidateStakeAmount,
          riskLevel: "UNKNOWN",
          riskScore: 0,
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 86400000,
        };
        const risk = computeRisk(base, recruiter);
        const job = { ...base, riskLevel: risk.riskLevel, riskScore: risk.riskScore };
        set((s) => ({ jobs: [job, ...s.jobs] }));
        return job;
      },

      stakeForJob: (jobId, amount, token) => {
        const stakeId = uid("stk");
        const now = Date.now();
        const job = get().jobs.find((j) => j.id === jobId);

        // seed a couple of demo applicants so the recruiter view comes alive
        const demoApplicants: Application[] = job
          ? talents
              .map((t) => ({
                t,
                overlap: t.skills.filter((sk) =>
                  job.skillsRequired.map((x) => x.toLowerCase()).includes(sk.toLowerCase()),
                ).length,
              }))
              .sort((a, b) => b.overlap - a.overlap)
              .slice(0, 2)
              .map(({ t }, i) => ({
                id: uid("app"),
                jobId,
                candidateId: t.id,
                status: "APPLIED" as ApplicationStatus,
                message: "Excited about this role — staked and ready to talk.",
                matchScore: computeMatch(job, t).matchScore,
                riskScore: job.riskScore,
                appliedAt: now - i * 3600000,
                updatedAt: now - i * 3600000,
              }))
          : [];

        set((s) => ({
          stakes: [
            {
              id: stakeId,
              userId: ME_RECRUITER_ID,
              jobId,
              stakeType: StakeType.JobPost,
              amount,
              token,
              status: StakeStatus.Locked,
              txHash: randomTx(),
              createdAt: now,
              updatedAt: now,
            },
            ...s.stakes,
          ],
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  stakeAmount: amount,
                  stakeToken: token,
                  stakeStatus: StakeStatus.Locked,
                  status: "ACTIVE" as JobStatus,
                }
              : j,
          ),
          applications: [...demoApplicants, ...s.applications],
        }));
        return stakeId;
      },

      applyToJob: (jobId, message, opts) => {
        const state = get();
        if (state.applications.some((a) => a.jobId === jobId && a.candidateId === ME_CANDIDATE_ID))
          return;
        const job = state.jobs.find((j) => j.id === jobId);
        if (!job) return;
        const match = computeMatch(job, state.candidateProfile);
        const now = Date.now();
        const appId = uid("app");
        let stakeId: string | undefined;
        const stakes = [...state.stakes];
        if (opts?.stakeAmount) {
          stakeId = uid("stk");
          stakes.unshift({
            id: stakeId,
            userId: ME_CANDIDATE_ID,
            jobId,
            applicationId: appId,
            stakeType: StakeType.Application,
            amount: opts.stakeAmount,
            token: opts.token ?? "cUSD",
            status: StakeStatus.Locked,
            txHash: randomTx(),
            createdAt: now,
            updatedAt: now,
          });
        }
        set({
          stakes,
          applications: [
            {
              id: appId,
              jobId,
              candidateId: ME_CANDIDATE_ID,
              status: "APPLIED",
              message,
              matchScore: match.matchScore,
              riskScore: job.riskScore,
              stakeId,
              appliedAt: now,
              updatedAt: now,
            },
            ...state.applications,
          ],
        });
      },

      withdrawApplication: (appId) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === appId ? { ...a, status: "WITHDRAWN", updatedAt: Date.now() } : a,
          ),
        })),

      toggleSaveJob: (jobId) =>
        set((s) => ({
          savedJobIds: s.savedJobIds.includes(jobId)
            ? s.savedJobIds.filter((id) => id !== jobId)
            : [jobId, ...s.savedJobIds],
        })),

      updateApplicationStatus: (appId, status) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === appId ? { ...a, status, updatedAt: Date.now() } : a,
          ),
        })),

      moderateJob: (jobId, action) =>
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status:
                    action === "approve" ? "ACTIVE" : action === "close" ? "CLOSED" : "FLAGGED",
                }
              : j,
          ),
        })),

      refundStake: (stakeId) =>
        set((s) => ({
          stakes: s.stakes.map((st) =>
            st.id === stakeId
              ? { ...st, status: StakeStatus.Refunded, updatedAt: Date.now() }
              : st,
          ),
        })),

      slashStake: (stakeId, amount, reason) =>
        set((s) => ({
          stakes: s.stakes.map((st) =>
            st.id === stakeId
              ? { ...st, status: StakeStatus.Slashed, amount, reason, updatedAt: Date.now() }
              : st,
          ),
        })),

      resolveDispute: (id, decision, slash) =>
        set((s) => {
          const dispute = s.disputes.find((d) => d.id === id);
          const stakes = slash
            ? s.stakes.map((st) =>
                st.id === dispute?.stakeId
                  ? { ...st, status: StakeStatus.Slashed, reason: decision, updatedAt: Date.now() }
                  : st,
              )
            : s.stakes;
          return {
            stakes,
            disputes: s.disputes.map((d) =>
              d.id === id ? { ...d, status: "RESOLVED", adminDecision: decision } : d,
            ),
          };
        }),

      resetDemo: () =>
        set({
          ...initialData(),
          savedJobIds: [],
          address: null,
          roleType: 0,
          registeredOnchain: false,
          candidateProfile: null,
          recruiterProfile: null,
          activeRole: "candidate",
        }),
    }),
    {
      name: "shire-store-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

// ---- Selectors (pure) ----

export function getRecruiterById(
  s: Pick<ShireState, "recruiterProfile">,
  id: string,
): (RecruiterProfile & { id: string }) | undefined {
  if (id === ME_RECRUITER_ID && s.recruiterProfile) {
    return { ...s.recruiterProfile, id };
  }
  const seed = recruiters.find((r) => r.id === id);
  return seed ? { ...seed } : undefined;
}

export function getCandidateById(id: string) {
  return talents.find((t) => t.id === id);
}

export function candidateDisplay(id: string, me: CandidateProfile | null) {
  if (id === ME_CANDIDATE_ID) return me?.displayName ?? "You";
  return getCandidateById(id)?.displayName ?? "Candidate";
}
