import { NextResponse } from "next/server";

import {
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "./authenticated-user";
import {
  createDrizzleCandidateDashboardRepository,
  type CandidateDashboardRepository,
} from "./candidate-dashboard-repository";
import {
  createDrizzleProfileRepository,
  type ProfileRepository,
} from "./profile-repository";
import { serverErrorResponse } from "./route-errors";

type ResolveAuthenticatedUser = (request: Request) => Promise<AuthenticatedUser>;

export type CandidateDashboardRouteDependencies = {
  resolveAuthenticatedUser?: ResolveAuthenticatedUser;
  profileRepository?: ProfileRepository;
  candidateDashboardRepository?: CandidateDashboardRepository;
};

export function createCandidateDashboardRouteHandlers(
  dependencies: CandidateDashboardRouteDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const profiles = () =>
    dependencies.profileRepository ?? createDrizzleProfileRepository();
  const dashboard = () =>
    dependencies.candidateDashboardRepository ??
    createDrizzleCandidateDashboardRepository();

  async function GET(request: Request) {
    try {
      const authenticated = await authenticate(request);
      const user = await profiles().resolveUser(
        authenticated.privyUserId,
        authenticated.walletAddress,
      );
      return NextResponse.json(
        await dashboard().getCandidateDashboard(user.id),
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  return { GET };
}
