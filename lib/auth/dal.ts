import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "./roles";
import { getSession } from "./session";

/**
 * Verifies the current session (secure check, close to the data layer).
 * Redirects to /login if there is no valid session. Memoized per-request.
 */
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

/**
 * Verifies the session AND that the user's role is one of `allowedRoles`.
 * Redirects to /login if unauthenticated, or to the role's default page if
 * unauthorized.
 */
export async function requireRole(allowedRoles: Role[]) {
  const session = await verifySession();
  if (!allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }
  return session;
}
