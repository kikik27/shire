import {
  AuthenticatedUserError,
  AuthenticatedUserConfigurationError,
  resolveAuthenticatedUser,
} from "./authenticated-user";

export { AuthenticatedUserError as CandidateAuthenticationError };
export {
  AuthenticatedUserConfigurationError as CandidateAuthenticationConfigurationError,
};

export async function resolveCandidateIdentity(request: Request) {
  return (await resolveAuthenticatedUser(request)).privyUserId;
}
