import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { listRegistrationTokens } from "@/lib/auth/users";
import GenerateLinkForm from "./GenerateLinkForm";

export default async function RegisterLinkPage() {
  await requireRole(["ADMIN"]);
  const tokens = await listRegistrationTokens();

  return (
    <div className="w-full bg-white min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Generate Registration Link
        </h1>
        <p className="text-gray-600 mb-8">
          Create a one-time invite link for a new team member. Each link can
          only be used once to create a single account with the selected role.
        </p>

        <GenerateLinkForm />

        <div className="mt-12">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Recent Links
          </h2>
          <div className="border border-gray-200 rounded-lg divide-y">
            {tokens.length === 0 && (
              <p className="p-4 text-sm text-gray-500">
                No registration links generated yet.
              </p>
            )}
            {tokens.map((t) => (
              <div
                key={t.id}
                className="p-4 flex items-center justify-between gap-4 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {ROLE_LABELS[t.role as keyof typeof ROLE_LABELS]}
                  </p>
                  <p className="text-gray-500 font-mono text-xs break-all">
                    /register/{t.token}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    t.used_at
                      ? "bg-gray-100 text-gray-600"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {t.used_at ? "Used" : "Unused"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
