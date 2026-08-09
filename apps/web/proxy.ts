import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = [
  "/candidate",
  "/recruiter",
  "/admin",
  "/dashboard",
  "/onboarding",
];

/**
 * Proxy (formerly "middleware" in Next < 16): gate protected dashboard and
 * onboarding routes on the "Sign in with Stellar" session cookie. Users without
 * a `shire_session` are redirected to /connect. The cookie's contents are
 * verified server-side in each API route (resolveAuthenticatedUser); this proxy
 * only checks presence for the redirect UX.
 *
 * Next 16 renamed middleware → proxy and always runs it on the Node.js runtime.
 */
function hasSession(request: NextRequest) {
  return Boolean(request.cookies.get("shire_session")?.value);
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const protectedPath = protectedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (!protectedPath || hasSession(request)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/connect";
  url.searchParams.set("next", path);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/candidate/:path*",
    "/recruiter/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/onboarding/:path*",
  ],
};
