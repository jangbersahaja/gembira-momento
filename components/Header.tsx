"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Publish the header's real rendered height as a CSS variable so any
  // page-level sticky sub-headers (e.g. /products, /reports) can stick
  // *below* this header instead of colliding with it at the same top:0.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const setHeight = () => {
      document.documentElement.style.setProperty(
        "--app-header-height",
        `${el.offsetHeight}px`,
      );
    };

    setHeight();

    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pathname, mobileMenuOpen]);

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
    <header
      ref={headerRef}
      className="w-full bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50"
    >
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
                href="https://maps.app.goo.gl/5vWdi4qrUgKq91ff7"
                target="_blank"
                rel="noreferrer"
                className="hover:text-amber-600 transition-colors"
              >
                Get Directions
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="mailto:gembiraceo@gmail.com"
                className="hover:text-amber-600 transition-colors"
              >
                Email
              </a>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/GM Logo.png"
              alt="Gembira Momento"
              width={160}
              height={48}
              priority
              className="h-10 w-auto object-contain"
            />
          </Link>

          {/* Center Navigation Links - Desktop Only */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium absolute left-1/2 -translate-x-1/2">
            {currentLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors ${
                  pathname === link.href
                    ? "text-amber-600 font-semibold"
                    : "text-gray-700 hover:text-amber-600"
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
                href="https://maps.app.goo.gl/5vWdi4qrUgKq91ff7"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-full shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-sm whitespace-nowrap"
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
                href="https://maps.app.goo.gl/5vWdi4qrUgKq91ff7"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-full shadow-sm transition-all duration-200 text-xs whitespace-nowrap"
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
                      ? "bg-amber-50 text-amber-600 font-semibold"
                      : "text-gray-700 hover:bg-gray-50 hover:text-amber-600"
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
