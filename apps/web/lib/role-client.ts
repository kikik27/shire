import { getProfile, type ProfileRole } from "./profile-client";

export type ActiveRoleState = {
  candidate: boolean;
  recruiter: boolean;
};

export const switchableRoles = ["candidate", "recruiter"] as const;
export type SwitchableRole = (typeof switchableRoles)[number];
type OnboardingChoice = SwitchableRole | "both";

const roleHomes = {
  candidate: "/candidate",
  recruiter: "/recruiter",
} as const;

const onboardingRoutes = {
  candidate: "/onboarding/candidate",
  recruiter: "/onboarding/recruiter",
} as const;

async function isRoleActive(
  role: ProfileRole,
  accessToken?: string,
  fetcher: typeof fetch = fetch,
) {
  // A null profile means the user has not onboarded that role yet — i.e. the
  // role is inactive. Any auth/server error still propagates from getProfile.
  const profile = await getProfile(role, accessToken, fetcher);
  return profile !== null;
}

export async function getActiveRoleState(
  accessToken?: string,
  fetcher: typeof fetch = fetch,
): Promise<ActiveRoleState> {
  const [candidate, recruiter] = await Promise.all([
    isRoleActive("candidate", accessToken, fetcher),
    isRoleActive("recruiter", accessToken, fetcher),
  ]);

  return { candidate, recruiter };
}

export function roleDestination(
  role: SwitchableRole,
  activeRoles: ActiveRoleState,
) {
  return activeRoles[role] ? roleHomes[role] : onboardingRoutes[role];
}

export function onboardingChoiceDestination(choice: OnboardingChoice) {
  if (choice === "both") {
    return `${onboardingRoutes.candidate}?next=${encodeURIComponent(onboardingRoutes.recruiter)}`;
  }
  return onboardingRoutes[choice];
}

export function postOnboardingDestination(activeRoles: ActiveRoleState) {
  if (activeRoles.candidate) {
    return roleHomes.candidate;
  }
  if (activeRoles.recruiter) {
    return roleHomes.recruiter;
  }
  return null;
}
