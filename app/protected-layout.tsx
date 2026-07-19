import { logout } from "@/app/actions/auth";
import { verifySession } from "@/lib/auth/dal";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Secure check close to the data layer — Proxy already performs an
  // optimistic redirect, but we verify again here per Next.js guidance.
  const session = await verifySession();

  return (
    <div>
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
