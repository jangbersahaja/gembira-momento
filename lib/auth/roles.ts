/**
 * Role definitions and route-level authorization map.
 *
 * ADMIN       - all access + can generate one-time registration links
 * MANAGEMENT  - all management pages
 * SUPERVISOR  - sales-dashboard, sales-assessment, products
 * STAFF       - sales-dashboard only
 */
export type Role = "ADMIN" | "MANAGEMENT" | "SUPERVISOR" | "STAFF";

export const ROLES: Role[] = ["ADMIN", "MANAGEMENT", "SUPERVISOR", "STAFF"];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGEMENT: "Management",
  SUPERVISOR: "Supervisor",
  STAFF: "Staff",
};

/**
 * Route prefixes mapped to the roles allowed to access them. Order matters:
 * more specific (longer) prefixes are matched first so that nested routes
 * like `/dashboard/sales-dashboard` can grant broader access than their
 * parent `/dashboard`.
 */
export const ROUTE_ACCESS: Array<{ prefix: string; roles: Role[] }> = [
  {
    prefix: "/dashboard/sales-dashboard",
    roles: ["ADMIN", "MANAGEMENT", "SUPERVISOR", "STAFF"],
  },
  { prefix: "/dashboard", roles: ["ADMIN", "MANAGEMENT"] },
  { prefix: "/reports", roles: ["ADMIN", "MANAGEMENT"] },
  {
    prefix: "/sales-assessment",
    roles: ["ADMIN", "MANAGEMENT", "SUPERVISOR"],
  },
  { prefix: "/products", roles: ["ADMIN", "MANAGEMENT", "SUPERVISOR"] },
  { prefix: "/admin", roles: ["ADMIN"] },
];

/** The default landing page for a given role once authenticated. */
export function defaultRouteForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
    case "MANAGEMENT":
      return "/dashboard";
    case "SUPERVISOR":
      return "/sales-assessment";
    case "STAFF":
      return "/dashboard/sales-dashboard";
    default:
      return "/login";
  }
}

/** Returns the roles allowed for a given pathname, or null if unprotected. */
export function rolesForPath(pathname: string): Role[] | null {
  const match = ROUTE_ACCESS.find((entry) => pathname.startsWith(entry.prefix));
  return match ? match.roles : null;
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const allowed = rolesForPath(pathname);
  if (!allowed) return true; // not a protected route
  return allowed.includes(role);
}
