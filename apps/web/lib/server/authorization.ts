import { eq } from "drizzle-orm";

import {
  resolveAuthenticatedUser,
  type AuthenticatedUser,
} from "./authenticated-user";
import { createDatabase, type Database } from "./db";
import { appUsers } from "./db/schema";
import {
  createDrizzleProfileRepository,
  type ProfileRepository,
} from "./profile-repository";

export type AuthorizedUser = {
  id: string;
  privyUserId: string;
  userType: "USER" | "ADMIN";
};

export interface AuthorizationUserRepository {
  resolveUser(
    privyUserId: string,
    walletAddress?: string,
  ): Promise<AuthorizedUser>;
}

export type AuthorizationDependencies = {
  authenticate: (request: Request) => Promise<AuthenticatedUser>;
  users: AuthorizationUserRepository;
};

export class AuthorizationError extends Error {
  readonly code: "admin-required";

  constructor(code: "admin-required") {
    super(code);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function createDrizzleAuthorizationUserRepository(
  database: Database = createDatabase(),
  profiles: ProfileRepository = createDrizzleProfileRepository(database),
): AuthorizationUserRepository {
  return {
    async resolveUser(privyUserId, walletAddress) {
      const user = await profiles.resolveUser(privyUserId, walletAddress);
      const [row] = await database
        .select({ userType: appUsers.userType })
        .from(appUsers)
        .where(eq(appUsers.id, user.id))
        .limit(1);
      if (!row) {
        throw new Error("Authorization user lookup returned no row.");
      }
      return { id: user.id, privyUserId: user.privyUserId, userType: row.userType };
    },
  };
}

export function createInMemoryAuthorizationUserRepository(
  initial: AuthorizedUser[] = [],
): AuthorizationUserRepository & { seed(user: AuthorizedUser): void } {
  const users = new Map(initial.map((user) => [user.privyUserId, user]));
  return {
    seed(user) {
      users.set(user.privyUserId, user);
    },
    async resolveUser(privyUserId) {
      const existing = users.get(privyUserId);
      if (existing) return existing;
      const user: AuthorizedUser = {
        id: crypto.randomUUID(),
        privyUserId,
        userType: "USER",
      };
      users.set(privyUserId, user);
      return user;
    },
  };
}

export async function resolveAuthorizedUser(
  request: Request,
  dependencies: AuthorizationDependencies = {
    authenticate: resolveAuthenticatedUser,
    users: createDrizzleAuthorizationUserRepository(),
  },
) {
  const identity = await dependencies.authenticate(request);
  return dependencies.users.resolveUser(
    identity.privyUserId,
    identity.mode === "privy" ? identity.walletAddress : undefined,
  );
}

export async function requireAdmin(
  request: Request,
  dependencies: AuthorizationDependencies = {
    authenticate: resolveAuthenticatedUser,
    users: createDrizzleAuthorizationUserRepository(),
  },
) {
  const user = await resolveAuthorizedUser(request, dependencies);
  if (user.userType !== "ADMIN") {
    throw new AuthorizationError("admin-required");
  }
  return user;
}
