import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "./roles";

const SESSION_COOKIE = "gm_session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  console.warn(
    "[auth] SESSION_SECRET is not set. Set it in .env.local for secure sessions.",
  );
}
const encodedKey = new TextEncoder().encode(secretKey || "insecure-dev-secret");

export type SessionPayload = {
  userId: number;
  username: string;
  email: string;
  role: Role;
  expiresAt: number;
};

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(encodedKey);
}

export async function decryptSession(
  session: string | undefined,
): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(user: {
  id: number;
  username: string;
  email: string;
  role: Role;
}) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const session = await encryptSession({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  return decryptSession(raw);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
