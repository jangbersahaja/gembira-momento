import { logout, stopImpersonation } from "@/app/actions/auth";
import { verifySession } from "@/lib/auth/dal";
import { getImpersonatorSession } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Secure check close to the data layer — Proxy already performs an
  // optimistic redirect, but we verify again here per Next.js guidance.
  const session = await verifySession();
  const impersonator = await getImpersonatorSession();

  return (
    <div>
      {impersonator && (
        <div className="w-full bg-amber-600 text-white text-xs">
          <div className="mx-auto max-w-7xl px-6 py-1.5 flex items-center justify-between gap-3">
            <span>
              Signed in as <strong>{session.username}</strong> — accessed by{" "}
              {impersonator.username}
            </span>
            <form action={stopImpersonation}>
              <button
                type="submit"
                className="text-white underline underline-offset-2 hover:text-amber-100"
              >
                Return to admin
              </button>
            </form>
          </div>
        </div>
      )}
      <div className="w-full bg-slate-900 text-white text-xs">
        <div className="mx-auto max-w-7xl px-6 py-1.5 flex items-center justify-end gap-3">
          <span className="text-slate-300">{session.username} </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-slate-300 hover:text-white underline underline-offset-2"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
      {/* Page Content */}
      {children}
    </div>
  );
}
