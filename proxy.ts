import { defaultRouteForRole, rolesForPath, type Role } from "@/lib/auth/roles";
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "gm_session";
const secretKey = process.env.SESSION_SECRET || "insecure-dev-secret";
const encodedKey = new TextEncoder().encode(secretKey);

const publicRoutes = ["/login"];

async function getSessionFromCookie(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as {
      userId: number;
      username: string;
      role: Role;
    };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Registration links are validated on the page itself (token lookup),
  // so let them through untouched.
  if (pathname.startsWith("/register/")) {
    return NextResponse.next();
  }

  const session = await getSessionFromCookie(request);
  const isPublicRoute = publicRoutes.includes(pathname);
  const requiredRoles = rolesForPath(pathname);

  // Not authenticated but hitting a protected route -> send to login.
  if (requiredRoles && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated but role isn't allowed for this route -> send to their home.
  if (requiredRoles && session && !requiredRoles.includes(session.role)) {
    return NextResponse.redirect(
      new URL(defaultRouteForRole(session.role), request.url),
    );
  }

  // Already logged in and visiting /login -> send to their dashboard.
  if (isPublicRoute && session) {
    return NextResponse.redirect(
      new URL(defaultRouteForRole(session.role), request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|css|js)$).*)",
  ],
};
