"use client";

import {
  generateRegistrationLink,
  type GenerateLinkState,
} from "@/app/actions/auth";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { useActionState } from "react";

export default function GenerateLinkForm() {
  const [state, formAction, pending] = useActionState<
    GenerateLinkState,
    FormData
  >(generateRegistrationLink, undefined);

  const fullLink =
    state?.link && typeof window !== "undefined"
      ? `${window.location.origin}${state.link}`
      : state?.link;

  return (
    <form
      action={formAction}
      className="bg-gray-50 border border-gray-200 rounded-lg p-6 flex flex-col sm:flex-row items-end gap-4"
    >
      <div className="w-full sm:w-auto flex-1">
        <label
          htmlFor="role"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Role for new account
        </label>
        <select
          id="role"
          name="role"
          defaultValue="STAFF"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent bg-white"
          disabled={pending}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full sm:w-auto px-6 py-3 bg-amber-700 hover:bg-amber-800 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap"
      >
        {pending ? "Generating..." : "Generate Link"}
      </button>

      {state?.error && (
        <p className="text-red-700 text-sm font-medium w-full">{state.error}</p>
      )}

      {fullLink && (
        <div className="w-full bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-800 text-sm font-medium mb-1">
            Registration link created:
          </p>
          <code className="text-xs break-all text-slate-800">{fullLink}</code>
        </div>
      )}
    </form>
  );
}
