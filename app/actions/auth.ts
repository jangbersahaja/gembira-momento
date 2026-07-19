"use server";

import { verifySession } from "@/lib/auth/dal";
import { defaultRouteForRole, type Role } from "@/lib/auth/roles";
import {
  createSession,
  deleteSession,
  startImpersonation,
  stopImpersonation as stopImpersonationSession,
} from "@/lib/auth/session";
import {
  consumeRegistrationToken,
  createRegistrationToken,
  createUser,
  deleteRegistrationToken,
  deleteUser,
  getRegistrationToken,
  getUserById,
  getUserByIdentifier,
  usernameOrEmailExists,
  verifyPassword,
} from "@/lib/auth/users";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type LoginState = { error?: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectTo = String(formData.get("redirectTo") || "");

  if (!identifier || !password) {
    return { error: "Please enter your username/email and password." };
  }

  const user = await getUserByIdentifier(identifier);
  if (!user) {
    return { error: "Invalid credentials." };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { error: "Invalid credentials." };
  }

  await createSession({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });

  redirect(redirectTo || defaultRouteForRole(user.role));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export type RegisterState = { error?: string; success?: boolean } | undefined;

export async function registerWithToken(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const token = String(formData.get("token") || "");
  const username = String(formData.get("username") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!token) {
    return { error: "Missing registration token." };
  }
  if (!username || !email || !password) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const regToken = await getRegistrationToken(token);
  if (!regToken) {
    return { error: "This registration link is invalid." };
  }
  if (regToken.used_at) {
    return { error: "This registration link has already been used." };
  }

  const exists = await usernameOrEmailExists(username, email);
  if (exists) {
    return { error: "Username or email is already taken." };
  }

  const user = await createUser({
    username,
    email,
    password,
    role: regToken.role as Role,
  });

  const consumed = await consumeRegistrationToken(token, user.id);
  if (!consumed) {
    return {
      error:
        "This registration link has already been used. Please contact an admin.",
    };
  }

  await createSession({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });

  redirect(defaultRouteForRole(user.role));
}

export type GenerateLinkState = { error?: string; link?: string } | undefined;

export async function generateRegistrationLink(
  _prevState: GenerateLinkState,
  formData: FormData,
): Promise<GenerateLinkState> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { error: "Only admins can generate registration links." };
  }

  const role = String(formData.get("role") || "") as Role;
  if (!["ADMIN", "MANAGEMENT", "SUPERVISOR", "STAFF"].includes(role)) {
    return { error: "Please select a valid role." };
  }

  const regToken = await createRegistrationToken(role, session.userId);
  return { link: `/register/${regToken.token}` };
}

export type RemoveLinkState = { error?: string; success?: boolean } | undefined;

export async function removeRegistrationLink(
  _prevState: RemoveLinkState,
  formData: FormData,
): Promise<RemoveLinkState> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { error: "Only admins can remove registration links." };
  }

  const id = Number(formData.get("id"));
  if (!id || Number.isNaN(id)) {
    return { error: "Invalid link." };
  }

  const removed = await deleteRegistrationToken(id);
  if (!removed) {
    return {
      error: "This link could not be removed (it may already be used).",
    };
  }

  revalidatePath("/admin/staff");
  return { success: true };
}

export type RemoveStaffState =
  | { error?: string; success?: boolean }
  | undefined;

export async function removeStaffMember(
  _prevState: RemoveStaffState,
  formData: FormData,
): Promise<RemoveStaffState> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { error: "Only admins can remove staff accounts." };
  }

  const id = Number(formData.get("id"));
  if (!id || Number.isNaN(id)) {
    return { error: "Invalid account." };
  }

  if (id === session.userId) {
    return { error: "You cannot remove your own account." };
  }

  const removed = await deleteUser(id);
  if (!removed) {
    return { error: "This account could not be removed." };
  }

  revalidatePath("/admin/staff");
  return { success: true };
}

export type ImpersonateState = { error?: string } | undefined;

/**
 * Lets an ADMIN "log in as" another account. The admin's own session is
 * stashed so they can return to it later via `stopImpersonation`.
 */
export async function impersonateUser(
  _prevState: ImpersonateState,
  formData: FormData,
): Promise<ImpersonateState> {
  const session = await verifySession();
  if (session.role !== "ADMIN") {
    return { error: "Only admins can access other accounts." };
  }

  const id = Number(formData.get("id"));
  if (!id || Number.isNaN(id)) {
    return { error: "Invalid account." };
  }

  if (id === session.userId) {
    return { error: "You are already signed in as this account." };
  }

  const target = await getUserById(id);
  if (!target) {
    return { error: "That account no longer exists." };
  }

  await startImpersonation({
    id: target.id,
    username: target.username,
    email: target.email,
    role: target.role,
  });

  redirect(defaultRouteForRole(target.role));
}

/** Restores the original admin session after impersonating another user. */
export async function stopImpersonation() {
  const restored = await stopImpersonationSession();
  redirect(restored ? "/admin/staff" : "/login");
}
