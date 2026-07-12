"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if we're on a management page
  const isManagementPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/sales-assessment") ||
    pathname.startsWith("/products");

  const managementLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/sales-dashboard", label: "Live Monitor" },
    { href: "/reports", label: "Reports" },
    { href: "/sales-assessment", label: "Sales Analytics" },
    { href: "/products", label: "Products" },
  ];

  const publicLinks = [
    { href: "#curation", label: "The Curation" },
    { href: "/about", label: "Our Story" },
    { href: "/partners", label: "Partners" },
    { href: "/contact", label: "Corporate Gifting" },
    { href: "#", label: "Find Us" },
  ];

  const currentLinks = isManagementPage ? managementLinks : publicLinks;

  return (
    <header className="w-full bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-6">
        {/* Top Info Bar - Only show on public pages */}
        {!isManagementPage && (
          <div className="hidden md:flex items-center justify-between text-xs text-gray-600 border-b border-gray-100 py-3">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-amber-700 font-semibold">📍</span>
                <span>Rubber Park @ KLCC • Kampung Baru, KL</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-700 font-semibold">⏰</span>
                <span>
                  Open Daily: Weekdays - 1:00 PM – 11:00 PM • Weekends - 11:00
                  AM – 11:00 PM
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://share.google/FuUQcoGAe3SJJBGbm"
                target="_blank"
                rel="noreferrer"
                className="hover:text-amber-700 transition-colors"
              >
                Google Business
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="mailto:hello@gembiramomento.my"
                className="hover:text-amber-700 transition-colors"
              >
                Email
              </a>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex flex-col items-start gap-0 shrink-0">
            <div className="text-2xl font-bold text-slate-900">Gembira</div>
            <div className="text-xs font-semibold text-amber-700 tracking-wider">
              MOMENTO
            </div>
          </Link>

          {/* Center Navigation Links - Desktop Only */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium absolute left-1/2 -translate-x-1/2">
            {currentLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors ${
                  pathname === link.href
                    ? "text-amber-700 font-semibold"
                    : "text-gray-700 hover:text-amber-700"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA Button - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-4">
            {isManagementPage ? (
              <Link
                href="/"
                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-full transition-colors duration-200 text-sm whitespace-nowrap"
              >
                Back to Shop
              </Link>
            ) : (
              <a
                href="https://share.google/FuUQcoGAe3SJJBGbm"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-full transition-colors duration-200 text-sm whitespace-nowrap"
              >
                Plan Your Visit
              </a>
            )}
          </div>

          {/* Mobile Menu Button & Mobile CTA */}
          <div className="md:hidden flex items-center gap-2 shrink-0">
            {isManagementPage ? (
              <Link
                href="/"
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-full transition-colors duration-200 text-xs whitespace-nowrap"
              >
                Shop
              </Link>
            ) : (
              <a
                href="https://share.google/FuUQcoGAe3SJJBGbm"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-full transition-colors duration-200 text-xs whitespace-nowrap"
              >
                Visit
              </a>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-900 text-2xl p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 border-t border-gray-100">
            <div className="space-y-1">
              {currentLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 text-sm font-medium transition-colors rounded ${
                    pathname === link.href
                      ? "bg-amber-50 text-amber-700 font-semibold"
                      : "text-gray-700 hover:bg-gray-50 hover:text-amber-700"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
