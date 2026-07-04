"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const CORRECT_PASSWORD =
    process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "gembira2026";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (password === CORRECT_PASSWORD) {
      // Store auth token in localStorage
      localStorage.setItem("auth_token", "authenticated");
      localStorage.setItem("auth_time", String(Date.now()));

      // Redirect to the intended page or reports
      const referrer = new URLSearchParams(window.location.search).get("from");
      router.push(referrer || "/reports");
      router.refresh();
    } else {
      setError("Incorrect password");
      setPassword("");
    }

    setIsLoading(false);
  };

  return (
    <div className="w-full min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Gembira Momento
            </h1>
            <p className="text-gray-600">Management Portal</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-700 focus:border-transparent"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
            >
              {isLoading ? "Logging in..." : "Access Portal"}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              This is a protected management portal. Unauthorized access is
              prohibited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
