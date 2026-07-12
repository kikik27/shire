import { NextResponse } from "next/server";

import {
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "./authenticated-user";
import {
  createDrizzleProfileRepository,
  type ProfileRepository,
} from "./profile-repository";
import {
  createDrizzleRecruiterDashboardRepository,
  type RecruiterDashboardRepository,
} from "./recruiter-dashboard-repository";
import { serverErrorResponse } from "./route-errors";

type ResolveAuthenticatedUser = (request: Request) => Promise<AuthenticatedUser>;

export type RecruiterDashboardRouteDependencies = {
  resolveAuthenticatedUser?: ResolveAuthenticatedUser;
  profileRepository?: ProfileRepository;
  recruiterDashboardRepository?: RecruiterDashboardRepository;
};

export function createRecruiterDashboardRouteHandlers(
  dependencies: RecruiterDashboardRouteDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const profiles = () =>
    dependencies.profileRepository ?? createDrizzleProfileRepository();
  const dashboard = () =>
    dependencies.recruiterDashboardRepository ??
    createDrizzleRecruiterDashboardRepository();

  async function GET(request: Request) {
    try {
      const authenticated = await authenticate(request);
      const user = await profiles().resolveUser(
        authenticated.privyUserId,
        authenticated.walletAddress,
      );
      return NextResponse.json(
        await dashboard().getRecruiterDashboard(user.id),
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  return { GET };
}
