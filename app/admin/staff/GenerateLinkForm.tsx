"use client";

import {
  generateRegistrationLink,
  type GenerateLinkState,
} from "@/app/actions/auth";
import { ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { useActionState, useState } from "react";

export default function GenerateLinkForm() {
  const [state, formAction, pending] = useActionState<
    GenerateLinkState,
    FormData
  >(generateRegistrationLink, undefined);
  const [copied, setCopied] = useState(false);

  const fullLink =
    state?.link && typeof window !== "undefined"
      ? `${window.location.origin}${state.link}`
      : state?.link;

  const handleCopy = async () => {
    if (!fullLink) return;
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
      <form
        action={formAction}
        className="flex flex-col sm:flex-row items-end gap-4"
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
      </form>

      {state?.error && (
        <p className="text-red-700 text-sm font-medium mt-4">{state.error}</p>
      )}

      {fullLink && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-green-800 text-sm font-medium mb-1">
              Registration link created:
            </p>
            <code className="text-xs break-all text-slate-800">{fullLink}</code>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-green-300 text-green-800 hover:bg-green-100 transition-colors whitespace-nowrap"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
