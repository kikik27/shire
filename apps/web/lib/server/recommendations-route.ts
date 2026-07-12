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
  createDrizzleRecommendationsRepository,
  type RecommendationsRepository,
} from "./recommendations-repository";
import { serverErrorResponse } from "./route-errors";

type ResolveAuthenticatedUser = (request: Request) => Promise<AuthenticatedUser>;

export type RecommendationsRouteDependencies = {
  resolveAuthenticatedUser?: ResolveAuthenticatedUser;
  profileRepository?: ProfileRepository;
  recommendationsRepository?: RecommendationsRepository;
};

async function authenticatedUserId(
  request: Request,
  authenticate: ResolveAuthenticatedUser,
  profiles: ProfileRepository,
) {
  const authenticated = await authenticate(request);
  const user = await profiles.resolveUser(
    authenticated.privyUserId,
    authenticated.walletAddress,
  );
  return user.id;
}

export function createCandidateRecommendationsRouteHandlers(
  dependencies: RecommendationsRouteDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const profiles = () =>
    dependencies.profileRepository ?? createDrizzleProfileRepository();
  const recommendations = () =>
    dependencies.recommendationsRepository ??
    createDrizzleRecommendationsRepository();

  async function GET(request: Request) {
    try {
      const userId = await authenticatedUserId(
        request,
        authenticate,
        profiles(),
      );
      return NextResponse.json({
        recommendations:
          await recommendations().listRecommendationsForCandidate(userId),
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  return { GET };
}

export function createRecruiterRecommendationsRouteHandlers(
  dependencies: RecommendationsRouteDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const profiles = () =>
    dependencies.profileRepository ?? createDrizzleProfileRepository();
  const recommendations = () =>
    dependencies.recommendationsRepository ??
    createDrizzleRecommendationsRepository();

  async function GET(request: Request) {
    try {
      const userId = await authenticatedUserId(
        request,
        authenticate,
        profiles(),
      );
      return NextResponse.json({
        recommendations:
          await recommendations().listRecommendationsForRecruiter(userId),
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }

  return { GET };
}
