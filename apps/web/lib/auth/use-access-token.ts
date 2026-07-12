"use client";

import * as React from "react";

/**
 * Returns a function that resolves the current auth token, if any.
 *
 * Auth is now cookie-based ("Sign in with Stellar"): the session cookie is sent
 * automatically on same-origin requests, so client fetches do not need to
 * attach a Bearer token. This hook therefore resolves to `undefined`, and the
 * shared `authorizationHeaders(undefined)` helpers no-op — every data hook
 * keeps working unchanged, just authenticated via the cookie instead.
 */
export function useAccessToken(): () => Promise<string | undefined> {
  return React.useCallback(async () => undefined, []);
}
