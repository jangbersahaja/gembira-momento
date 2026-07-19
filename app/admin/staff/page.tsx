import { requireRole } from "@/lib/auth/dal";
import { listRegistrationTokens, listUsers } from "@/lib/auth/users";
import StaffManagementClient from "./StaffManagementClient";

export default async function StaffManagementPage() {
  const session = await requireRole(["ADMIN"]);
  const [users, tokens] = await Promise.all([
    listUsers(),
    listRegistrationTokens(),
  ]);

  const unusedTokens = tokens.filter((t) => !t.used_at);

  return (
    <div className="w-full bg-white min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Staff Management
        </h1>
        <p className="text-gray-600 mb-8">
          Invite new team members, view all staff accounts, and remove unused
          registration links.
        </p>

        <StaffManagementClient
          users={users}
          unusedTokens={unusedTokens}
          currentUserId={session.userId}
        />
      </div>
    </div>
  );
}
