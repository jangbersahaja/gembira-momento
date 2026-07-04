"use client";

import Link from "next/link";

export default function DashboardPage() {
  const managementPages = [
    {
      title: "Monthly Reports",
      description: "Financial reports, revenue analysis, and expense breakdown",
      href: "/reports",
      icon: "📊",
      color: "bg-blue-50 border-blue-200",
      iconBg: "bg-blue-100 text-blue-700",
    },
    {
      title: "Sales Assessment",
      description:
        "Detailed sales breakdown by time, product, staff, and supplier",
      href: "/sales-assessment",
      icon: "📈",
      color: "bg-green-50 border-green-200",
      iconBg: "bg-green-100 text-green-700",
    },
    {
      title: "Products Inventory",
      description: "Product listing, sales performance, and stock levels",
      href: "/products",
      icon: "📦",
      color: "bg-purple-50 border-purple-200",
      iconBg: "bg-purple-100 text-purple-700",
    },
  ];

  const quickActions = [
    {
      id: "top-products",
      label: "View Top Products",
      href: "/sales-assessment",
      icon: "⭐",
    },
    {
      id: "stock-levels",
      label: "Check Stock Levels",
      href: "/products",
      icon: "📊",
    },
    {
      id: "revenue-report",
      label: "Revenue Report",
      href: "/reports",
      icon: "💰",
    },
    {
      id: "staff-performance",
      label: "Staff Performance",
      href: "/sales-assessment",
      icon: "👥",
    },
  ];

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-6 py-12 border-b border-gray-200">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Management Portal
          </h1>
          <p className="text-gray-600">
            Access all management tools and reports for Gembira Momento
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Management Pages Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Management Pages
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {managementPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className={`border rounded-lg p-6 transition-all hover:shadow-lg hover:scale-105 cursor-pointer ${page.color}`}
              >
                <div
                  className={`inline-block ${page.iconBg} rounded-lg p-3 mb-4 text-2xl`}
                >
                  {page.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {page.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4">{page.description}</p>
                <div className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Open →
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="bg-linear-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{action.icon}</span>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">
                      {action.label}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Info Cards */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            📌 Portal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">
                Session Duration
              </h4>
              <p className="text-gray-600 text-sm">
                Your session is valid for 24 hours. After that, you&rsquo;ll
                need to log in again.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">
                Data Updates
              </h4>
              <p className="text-gray-600 text-sm">
                All reports and metrics are updated in real-time based on the
                latest transaction data.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Security</h4>
              <p className="text-gray-600 text-sm">
                Remember to logout when finished. Use the logout button in the
                top-right corner.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
