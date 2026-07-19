"use client";

import {
  impersonateUser,
  removeRegistrationLink,
  removeStaffMember,
  type ImpersonateState,
  type RemoveLinkState,
  type RemoveStaffState,
} from "@/app/actions/auth";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import type { RegistrationToken, User } from "@/lib/auth/users";
import { useActionState } from "react";
import GenerateLinkForm from "./GenerateLinkForm";

export default function StaffManagementClient({
  users,
  unusedTokens,
  currentUserId,
}: {
  users: User[];
  unusedTokens: RegistrationToken[];
  currentUserId: number;
}) {
  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Invite New Staff
        </h2>
        <GenerateLinkForm />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Staff Accounts
        </h2>
        <div className="border border-gray-200 rounded-lg divide-y">
          {users.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No accounts found.</p>
          )}
          {users.map((u) => (
            <StaffRow key={u.id} user={u} currentUserId={currentUserId} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Unused Registration Links
        </h2>
        <div className="border border-gray-200 rounded-lg divide-y">
          {unusedTokens.length === 0 && (
            <p className="p-4 text-sm text-gray-500">
              No unused registration links.
            </p>
          )}
          {unusedTokens.map((t) => (
            <TokenRow key={t.id} token={t} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StaffRow({
  user,
  currentUserId,
}: {
  user: User;
  currentUserId: number;
}) {
  const [state, formAction, pending] = useActionState<
    RemoveStaffState,
    FormData
  >(removeStaffMember, undefined);
  const [accessState, accessAction, accessPending] = useActionState<
    ImpersonateState,
    FormData
  >(impersonateUser, undefined);

  const isSelf = user.id === currentUserId;
  const removed = state?.success;

  if (removed) return null;

  return (
    <div className="p-4 flex items-center justify-between gap-4 text-sm">
      <div>
        <p className="font-medium text-slate-900">{user.username}</p>
        <p className="text-gray-500 text-xs">{user.email}</p>
        {state?.error && (
          <p className="text-red-700 text-xs font-medium mt-1">{state.error}</p>
        )}
        {accessState?.error && (
          <p className="text-red-700 text-xs font-medium mt-1">
            {accessState.error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-slate-100 text-slate-700">
          {ROLE_LABELS[user.role as Role]}
        </span>
        <form action={accessAction}>
          <input type="hidden" name="id" value={user.id} />
          <button
            type="submit"
            disabled={accessPending || isSelf}
            title={
              isSelf ? "You are already signed in as this account" : undefined
            }
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {accessPending ? "Accessing..." : "Access"}
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="id" value={user.id} />
          <button
            type="submit"
            disabled={pending || isSelf}
            title={isSelf ? "You cannot remove your own account" : undefined}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? "Removing..." : "Remove"}
          </button>
        </form>
      </div>
    </div>
  );
}

function TokenRow({ token }: { token: RegistrationToken }) {
  const [state, formAction, pending] = useActionState<
    RemoveLinkState,
    FormData
  >(removeRegistrationLink, undefined);

  const removed = state?.success;

  if (removed) return null;

  return (
    <div className="p-4 flex items-center justify-between gap-4 text-sm">
      <div>
        <p className="font-medium text-slate-900">
          {ROLE_LABELS[token.role as Role]}
        </p>
        <p className="text-gray-500 font-mono text-xs break-all">
          /register/{token.token}
        </p>
        {state?.error && (
          <p className="text-red-700 text-xs font-medium mt-1">{state.error}</p>
        )}
      </div>
      <form action={formAction} className="shrink-0">
        <input type="hidden" name="id" value={token.id} />
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 transition-colors"
        >
          {pending ? "Removing..." : "Remove"}
        </button>
      </form>
    </div>
  );
}
