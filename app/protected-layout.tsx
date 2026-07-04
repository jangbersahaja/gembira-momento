"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("auth_token");
      const authTime = localStorage.getItem("auth_time");

      if (token === "authenticated" && authTime) {
        // Session expires after 24 hours
        const elapsedTime = Date.now() - Number(authTime);
        const oneDayInMs = 24 * 60 * 60 * 1000;

        if (elapsedTime < oneDayInMs) {
          setIsAuthenticated(true);
          return;
        }
      }

      // Not authenticated or session expired
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_time");
      setIsAuthenticated(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated === null) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-amber-700 rounded-full animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      {/* Auth Header with Logout */}
      <div className="fixed top-0 right-0 p-4 z-50">
        <button
          onClick={() => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_time");
            router.push("/login");
            router.refresh();
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
