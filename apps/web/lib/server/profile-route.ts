import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type { z } from "zod";

import {
  persistedCandidateProfileSchema,
  persistedRecruiterProfileSchema,
  storedRecruiterProfileSchema,
} from "../schemas";
import {
  AuthenticatedUserConfigurationError,
  AuthenticatedUserError,
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "./authenticated-user";
import {
  createDatabase,
  DatabaseConfigurationError,
  type Database,
} from "./db";
import { recruiterProfiles } from "./db/schema";
import {
  buildProfileUserOnboardingDoneQuery,
  buildProfileUserUpsertQuery,
  buildRoleProfileUpsertQuery,
  createDrizzleProfileRepository,
  ProfileRepositoryError,
  type ProfileRepository,
  type ProfileRole,
} from "./profile-repository";

type ResolveAuthenticatedUser = (
  request: Request,
) => Promise<AuthenticatedUser>;

export type ProfileRouteDependencies = {
  resolveAuthenticatedUser?: ResolveAuthenticatedUser;
  repository?: ProfileRepository;
  database?: Database;
};

const defaultRecruiterMetrics = {
  verificationStatus: "UNVERIFIED" as const,
  trustLevel: 30,
  completedHires: 0,
  disputeCount: 0,
};

function inputSchema(role: ProfileRole) {
  return role === "candidate"
    ? persistedCandidateProfileSchema
    : persistedRecruiterProfileSchema;
}

function storedSchema(role: ProfileRole) {
  return role === "candidate"
    ? persistedCandidateProfileSchema
    : storedRecruiterProfileSchema;
}

async function saveRecruiterProfileAtomically(
  privyUserId: string,
  walletAddress: string | undefined,
  editableProfile: Record<string, unknown>,
  database: Database,
) {
  try {
    return await database.transaction(async (transaction) => {
      const [user] = await buildProfileUserUpsertQuery(
        transaction,
        privyUserId,
        walletAddress,
      );
      if (!user) {
        throw new Error("User upsert returned no row.");
      }
      const [existing] = await transaction
        .select({ profile: recruiterProfiles.profile })
        .from(recruiterProfiles)
        .where(eq(recruiterProfiles.userId, user.id))
        .limit(1);
      const metrics = existing
        ? storedRecruiterProfileSchema.parse(existing.profile)
        : defaultRecruiterMetrics;
      const profile = {
        ...editableProfile,
        verificationStatus: metrics.verificationStatus,
        trustLevel: metrics.trustLevel,
        completedHires: metrics.completedHires,
        disputeCount: metrics.disputeCount,
      };
      const [saved] = await buildRoleProfileUpsertQuery(
        transaction,
        user.id,
        "recruiter",
        profile,
      );
      if (!saved) {
        throw new Error("Recruiter profile upsert returned no row.");
      }
      const [onboardedUser] = await buildProfileUserOnboardingDoneQuery(
        transaction,
        user.id,
      );
      if (!onboardedUser) {
        throw new Error("User onboarding update returned no row.");
      }
      return { user: onboardedUser, profile: saved.profile };
    });
  } catch (error) {
    if (
      error instanceof DatabaseConfigurationError ||
      error instanceof ProfileRepositoryError
    ) {
      throw error;
    }
    throw new ProfileRepositoryError(
      "Failed to save recruiter profile for Privy user.",
      { cause: error },
    );
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthenticatedUserError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (error instanceof AuthenticatedUserConfigurationError) {
    return NextResponse.json(
      { error: "authentication-configuration-error" },
      { status: 500 },
    );
  }
  if (error instanceof DatabaseConfigurationError) {
    return NextResponse.json(
      { error: "missing-database-configuration" },
      { status: 500 },
    );
  }
  if (error instanceof ProfileRepositoryError) {
    return NextResponse.json({ error: "database-error" }, { status: 500 });
  }
  return NextResponse.json({ error: "database-error" }, { status: 500 });
}

export function createProfileRouteHandlers(
  role: ProfileRole,
  dependencies: ProfileRouteDependencies = {},
) {
  const authenticate =
    dependencies.resolveAuthenticatedUser ?? resolveAuthenticatedUser;
  const repository = () =>
    dependencies.repository ?? createDrizzleProfileRepository();
  const requestSchema: z.ZodType = inputSchema(role);
  const responseSchema: z.ZodType = storedSchema(role);

  async function GET(request: Request) {
    try {
      const authenticatedUser = await authenticate(request);
      const store = repository();
      const user = await store.resolveUser(
        authenticatedUser.privyUserId,
        authenticatedUser.walletAddress,
      );
      const storedProfile = await store.getProfile(user.id, role);
      if (storedProfile === null) {
        // Not-onboarded is a normal state, not an error. Return an empty profile
        // so the client can render the onboarding/empty form without treating a
        // missing profile as a 404 failure.
        return NextResponse.json({ profile: null });
      }
      const parsed = responseSchema.safeParse(storedProfile);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "database-error" },
          { status: 500 },
        );
      }
      return NextResponse.json({ profile: parsed.data });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async function PUT(request: Request) {
    try {
      const authenticatedUser = await authenticate(request);
      const payload = await request.json().catch(() => undefined);
      const parsed = requestSchema.safeParse(payload);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid-profile" },
          { status: 400 },
        );
      }
      let saved;
      if (role === "recruiter") {
        if (dependencies.repository) {
          const store = dependencies.repository;
          const user = await store.resolveUser(
            authenticatedUser.privyUserId,
            authenticatedUser.walletAddress,
          );
          const existing = await store.getProfile(user.id, role);
          const metrics = existing
            ? storedRecruiterProfileSchema.parse(existing)
            : defaultRecruiterMetrics;
          saved = await store.saveProfileForPrivyUser(
            authenticatedUser.privyUserId,
            role,
            {
              ...(parsed.data as Record<string, unknown>),
              verificationStatus: metrics.verificationStatus,
              trustLevel: metrics.trustLevel,
              completedHires: metrics.completedHires,
              disputeCount: metrics.disputeCount,
            },
            authenticatedUser.walletAddress,
          );
        } else {
          saved = await saveRecruiterProfileAtomically(
            authenticatedUser.privyUserId,
            authenticatedUser.walletAddress,
            parsed.data as Record<string, unknown>,
            dependencies.database ?? createDatabase(),
          );
        }
      } else {
        saved = await repository().saveProfileForPrivyUser(
          authenticatedUser.privyUserId,
          role,
          parsed.data,
          authenticatedUser.walletAddress,
        );
      }
      const persisted = responseSchema.safeParse(saved.profile);
      if (!persisted.success) {
        return NextResponse.json(
          { error: "database-error" },
          { status: 500 },
        );
      }
      return NextResponse.json({ profile: persisted.data });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { GET, PUT };
}
