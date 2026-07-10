"use client";

import {
  useProducts,
  useTimesheets,
  useTransactions,
} from "@/lib/useStorehubApi";
import { toCanvas } from "html-to-image";
import jsPDF from "jspdf";
import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Helper Functions ────────────────────────────────────────────────────────

const parseTime = (timeString: string): Date | null => {
  // Format: "2026-04-15T17:42:00Z" (ISO format from API)
  try {
    return new Date(timeString);
  } catch {
    return null;
  }
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const formatCurrency = (value: number) => {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// ─── Data Aggregation ────────────────────────────────────────────────────────

interface DailyData {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

interface HourlyData {
  hour: number;
  label: string;
  revenue: number;
  transactions: number;
}

interface ReportData {
  month: string;
  year: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  dailyData: DailyData[];
  hourlyData: HourlyData[];
  paymentBreakdown: Record<string, number>;
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
    cost: number;
  }>;
  laborCost: number;
  laborBreakdown: Record<string, { hours: number; cost: number }>;
  rentalCost: number;
  gtoCost: number;
  utilitiesCost: number;
  marketingCost: number;
  claimCost: number;
  totalExpenses: number;
  netProfit: number;
}

function getMonthData(
  year: number,
  month: number,
  transactions: any[],
  products: any[] = [],
  timesheets: any[] = [],
): ReportData {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const reportData: ReportData = {
    month: monthNames[month],
    year,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    dailyData: [],
    hourlyData: [],
    paymentBreakdown: {},
    topProducts: [],
    laborCost: 0,
    laborBreakdown: {},
    rentalCost: 1500,
    gtoCost: 0,
    utilitiesCost: 0,
    marketingCost: 0,
    claimCost: 0,
    totalExpenses: 0,
    netProfit: 0,
  };

  // Build product lookup map with SKU and ID
  const productMap = new Map<
    string,
    { sku: string; name: string; cost: number; id: string }
  >();
  for (const product of products) {
    productMap.set(`id:${product.id}`, {
      sku: product.sku,
      name: product.name,
      cost: product.cost || 0,
      id: product.id,
    });
    productMap.set(`sku:${product.sku}`, {
      sku: product.sku,
      name: product.name,
      cost: product.cost || 0,
      id: product.id,
    });
  }

  // Calculate labor cost from timesheets
  // Assuming default hourly rate of RM15 (adjust as needed)
  const DEFAULT_HOURLY_RATE = 15;
  const laborMap = new Map<string, { hours: number; cost: number }>();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  for (const timesheet of timesheets) {
    const clockIn = parseTime(timesheet.clockInTime);
    const clockOut = parseTime(timesheet.clockOutTime);

    if (!clockIn || !clockOut) continue;

    // Only count timesheets in the selected month
    if (clockIn.getMonth() !== month || clockIn.getFullYear() !== year) {
      continue;
    }

    const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    const laborCost = hours * DEFAULT_HOURLY_RATE;

    const employeeId = timesheet.employeeId || "Unknown";
    const current = laborMap.get(employeeId) || { hours: 0, cost: 0 };
    current.hours += hours;
    current.cost += laborCost;
    laborMap.set(employeeId, current);
  }

  reportData.laborBreakdown = Object.fromEntries(laborMap);
  reportData.laborCost = Array.from(laborMap.values()).reduce(
    (sum, d) => sum + d.cost,
    0,
  );

  // Aggregate transaction data
  const dailyDataMap = new Map<string, { revenue: number; cost: number }>();
  const hourlyDataMap = new Map<
    number,
    { revenue: number; transactions: number }
  >();
  const topProductsMap = new Map<
    string,
    { name: string; qty: number; revenue: number; cost: number }
  >();

  // Process transactions
  for (const tx of transactions) {
    const timestamp = tx.timestamp ? new Date(tx.timestamp) : null;

    if (
      !timestamp ||
      timestamp.getMonth() !== month ||
      timestamp.getFullYear() !== year
    ) {
      continue;
    }

    // Only count completed transactions
    if (tx.status !== "completed") continue;

    // Add to daily and hourly aggregates
    const dateKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}`;
    const hour = timestamp.getHours();

    const currentDaily = dailyDataMap.get(dateKey) || { revenue: 0, cost: 0 };
    currentDaily.revenue += tx.total;

    for (const item of tx.items || []) {
      // Get product cost from product map, fallback to 0 if not found
      let itemCost = 0;
      if (item.productId) {
        const productInfo = productMap.get(`id:${item.productId}`);
        itemCost = (productInfo?.cost || 0) * (item.quantity || 0);
      } else if (item.sku) {
        const productInfo = productMap.get(`sku:${item.sku}`);
        itemCost = (productInfo?.cost || 0) * (item.quantity || 0);
      }
      currentDaily.cost += itemCost;
    }

    dailyDataMap.set(dateKey, currentDaily);

    // Hourly data
    if (!hourlyDataMap.has(hour)) {
      hourlyDataMap.set(hour, { revenue: 0, transactions: 0 });
    }
    const hourData = hourlyDataMap.get(hour)!;
    hourData.revenue += tx.total;
    hourData.transactions += 1;

    // Payment breakdown
    const method = tx.paymentMethod || "other";
    reportData.paymentBreakdown[method] =
      (reportData.paymentBreakdown[method] || 0) + tx.total;

    // Process items for top products
    for (const item of tx.items || []) {
      let productId = item.productId || item.sku || item.productName;
      let productName = item.productName;
      let productCost = 0;

      // Try to get product details from map
      if (item.productId) {
        const productInfo = productMap.get(`id:${item.productId}`);
        if (productInfo) {
          productId = productInfo.id;
          productName = productInfo.name;
          productCost = productInfo.cost;
        }
      } else if (item.sku) {
        const productInfo = productMap.get(`sku:${item.sku}`);
        if (productInfo) {
          productId = productInfo.id;
          productName = productInfo.name;
          productCost = productInfo.cost;
        }
      }

      const itemCost = productCost * (item.quantity || 0);
      const current = topProductsMap.get(productId) || {
        name: productName,
        qty: 0,
        revenue: 0,
        cost: 0,
      };
      current.qty += item.quantity || 0;
      current.revenue += item.totalPrice || 0;
      current.cost += itemCost;
      topProductsMap.set(productId, current);
    }
  }

  // Build daily data array
  const dailyData: DailyData[] = [];
  for (const [dateStr, data] of dailyDataMap) {
    dailyData.push({
      date: dateStr,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
    });
  }
  dailyData.sort((a, b) => a.date.localeCompare(b.date));
  reportData.dailyData = dailyData;

  // Build hourly data array
  const hourlyData: HourlyData[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const data = hourlyDataMap.get(hour);
    hourlyData.push({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      revenue: data?.revenue || 0,
      transactions: data?.transactions || 0,
    });
  }
  reportData.hourlyData = hourlyData;

  // Calculate totals
  reportData.totalRevenue = Array.from(dailyDataMap.values()).reduce(
    (sum, d) => sum + d.revenue,
    0,
  );
  reportData.totalCost = Array.from(dailyDataMap.values()).reduce(
    (sum, d) => sum + d.cost,
    0,
  );
  reportData.totalProfit = reportData.totalRevenue - reportData.totalCost;

  // Top products sorted by revenue
  const sortedProducts = Array.from(topProductsMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      quantity: p.qty,
      revenue: p.revenue,
      cost: p.cost,
    }));
  reportData.topProducts = sortedProducts;

  // Calculate GTO (2% of revenue)
  reportData.gtoCost = reportData.totalRevenue * 0.02;

  // Set utilities, marketing, and claim costs to defaults for now
  // These would come from additional API endpoints if needed
  reportData.utilitiesCost = 0;
  reportData.marketingCost = 0;
  reportData.claimCost = 0;

  // Calculate total expenses and net profit
  reportData.totalExpenses =
    reportData.totalCost +
    reportData.laborCost +
    reportData.rentalCost +
    reportData.gtoCost +
    reportData.utilitiesCost +
    reportData.marketingCost +
    reportData.claimCost;
  reportData.netProfit = reportData.totalRevenue - reportData.totalExpenses;

  return reportData;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MonthlyReportClient() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch data from APIs
  const { data: transactionsData, loading: transactionsLoading } =
    useTransactions();
  const { data: productsData, loading: productsLoading } = useProducts({
    limit: 500,
  });

  // Fetch timesheets for the selected month
  const monthStart = new Date(selectedYear, selectedMonth, 1);
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
  const fromDate = monthStart.toISOString().split("T")[0];
  const toDate = monthEnd.toISOString().split("T")[0];

  const { data: timesheetsData, loading: timesheetsLoading } = useTimesheets({
    from: fromDate,
    to: toDate,
  });

  const reportData = useMemo(() => {
    if (!transactionsData) return null;
    return getMonthData(
      selectedYear,
      selectedMonth,
      transactionsData,
      productsData || [],
      timesheetsData || [],
    );
  }, [
    selectedYear,
    selectedMonth,
    transactionsData,
    productsData,
    timesheetsData,
  ]);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;

    try {
      // Set up print styles for PDF
      const printStyle = document.createElement("style");
      printStyle.textContent = `
        @page {
          margin: 10mm;
          size: A4;
        }
        @media print {
          body { margin: 0; padding: 0; }
          .report-content {
            max-width: 100%;
            margin: 0;
            padding: 10mm;
            page-break-after: always;
          }
          .page-break {
            page-break-after: always;
          }
          * {
            margin: 0;
            padding: 0;
          }
        }
      `;
      document.head.appendChild(printStyle);

      // Capture the report with proper scaling for A4
      const canvas = await toCanvas(reportRef.current, {
        pixelRatio: 2,
      });

      // A4 dimensions
      const A4_WIDTH = 210; // mm
      const A4_HEIGHT = 297; // mm

      // Calculate image dimensions maintaining aspect ratio
      const imgWidth = A4_WIDTH;
      const imgHeight = (canvas.height / canvas.width) * A4_WIDTH;
      const pageHeight = A4_HEIGHT;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let heightLeft = imgHeight;
      let position = 0;

      // Add first image
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 10, position + 10, imgWidth - 20, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(
          imgData,
          "PNG",
          10,
          position + 10,
          imgWidth - 20,
          imgHeight,
        );
        heightLeft -= pageHeight;
      }

      pdf.save(
        `Gembira_Momento_Report_${selectedYear}_${String(selectedMonth + 1).padStart(2, "0")}.pdf`,
      );

      document.head.removeChild(printStyle);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    }
  };

  // Show loading state
  const isLoading = transactionsLoading || productsLoading || timesheetsLoading;
  if (isLoading || !reportData) {
    return (
      <div className="w-full bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading financial data...</p>
          {transactionsLoading && (
            <p className="text-sm text-gray-500">Fetching transactions...</p>
          )}
          {productsLoading && (
            <p className="text-sm text-gray-500">Fetching products...</p>
          )}
          {timesheetsLoading && (
            <p className="text-sm text-gray-500">Fetching timesheets...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header Section */}
      <div className="mx-auto max-w-7xl px-6 py-12 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              Monthly Report
            </h1>
            <p className="text-gray-600">Comprehensive financial overview</p>
          </div>

          {/* Month Navigation and Actions */}
          <div className="flex flex-col gap-4">
            {/* Month Selector */}
            <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg">
              <button
                onClick={handlePrevMonth}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-lg transition-colors"
              >
                ← Prev
              </button>
              <div className="text-center min-w-48">
                <p className="font-semibold text-slate-900 text-lg">
                  {monthNames[selectedMonth]} {selectedYear}
                </p>
              </div>
              <button
                onClick={handleNextMonth}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-lg transition-colors"
              >
                Next →
              </button>
            </div>

            {/* PDF Export Button */}
            <button
              onClick={downloadPDF}
              className="px-6 py-3 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              📥 Download PDF Report
            </button>
          </div>
        </div>
      </div>

      {/* Report Content - PDF Optimized */}
      <div
        ref={reportRef}
        className="mx-auto px-4 py-8 bg-white"
        style={{
          maxWidth: "210mm", // A4 width
          margin: "0 auto",
          padding: "10mm",
          fontSize: "14px",
          lineHeight: "1.4",
        }}
      >
        {/* Report Header */}
        <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            Gembira Momento - Monthly Financial Report
          </h2>
          <p className="text-base text-gray-600">
            {monthNames[selectedMonth]} {selectedYear}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Rubber Park @ KLCC, Kuala Lumpur
          </p>
        </div>

        {/* Key Metrics - Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {/* Revenue */}
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
            <p className="text-xs font-medium text-gray-700 mb-1">
              Total Revenue
            </p>
            <p className="text-2xl font-bold text-blue-700">
              RM {formatCurrency(reportData.totalRevenue)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {reportData.dailyData.length} days
            </p>
          </div>

          {/* COGS */}
          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
            <p className="text-xs font-medium text-gray-700 mb-1">COGS</p>
            <p className="text-2xl font-bold text-red-700">
              RM {formatCurrency(reportData.totalCost)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {reportData.totalRevenue > 0
                ? (
                    (reportData.totalCost / reportData.totalRevenue) *
                    100
                  ).toFixed(1)
                : 0}
              % of revenue
            </p>
          </div>

          {/* Gross Profit */}
          <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
            <p className="text-xs font-medium text-gray-700 mb-1">
              Gross Profit
            </p>
            <p className="text-2xl font-bold text-green-700">
              RM {formatCurrency(reportData.totalProfit)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {reportData.totalRevenue > 0
                ? (
                    (reportData.totalProfit / reportData.totalRevenue) *
                    100
                  ).toFixed(1)
                : 0}
              % margin
            </p>
          </div>

          {/* Operating Expenses */}
          <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
            <p className="text-xs font-medium text-gray-700 mb-1">
              Op. Expenses
            </p>
            <p className="text-2xl font-bold text-purple-700">
              RM{" "}
              {formatCurrency(reportData.totalExpenses - reportData.totalCost)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {reportData.totalRevenue > 0
                ? (
                    ((reportData.totalExpenses - reportData.totalCost) /
                      reportData.totalRevenue) *
                    100
                  ).toFixed(1)
                : 0}
              % of revenue
            </p>
          </div>

          {/* Net Profit */}
          <div
            className={`p-4 rounded-lg border-l-4 ${
              reportData.netProfit >= 0
                ? "bg-emerald-50 border-emerald-500"
                : "bg-orange-50 border-orange-500"
            }`}
          >
            <p className="text-xs font-medium text-gray-700 mb-1">Net Profit</p>
            <p
              className={`text-2xl font-bold ${
                reportData.netProfit >= 0
                  ? "text-emerald-700"
                  : "text-orange-700"
              }`}
            >
              RM {formatCurrency(reportData.netProfit)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {reportData.totalRevenue > 0
                ? (
                    (reportData.netProfit / reportData.totalRevenue) *
                    100
                  ).toFixed(1)
                : 0}
              % net margin
            </p>
          </div>
        </div>

        {/* Revenue and Profit Trend */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Daily Revenue & Profit Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={reportData.dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip
                formatter={(value: unknown) => `RM ${Number(value).toFixed(2)}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2}
                name="Revenue"
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#10b981"
                strokeWidth={2}
                name="Profit"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Sales Trend */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">
            Hourly Sales Trend
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={reportData.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                fill="#3b82f6"
                name="Revenue (RM)"
              />
              <Bar
                yAxisId="right"
                dataKey="transactions"
                fill="#8b5cf6"
                name="Transactions"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Expense Details Table */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              Operating Expenses
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  Cost of Goods Sold
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  RM {formatCurrency(reportData.totalCost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  Labor Cost
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  RM {formatCurrency(reportData.laborCost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  Rental
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  RM {formatCurrency(reportData.rentalCost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  GTO to Landlord (2%)
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  RM {formatCurrency(reportData.gtoCost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  Utilities (Electric)
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  RM {formatCurrency(reportData.utilitiesCost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  Marketing/Free Gift
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  RM {formatCurrency(reportData.marketingCost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  Claims (Payouts)
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  RM {formatCurrency(reportData.claimCost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 bg-amber-50 px-3 rounded-lg font-semibold">
                <span className="text-gray-900">Total Expenses</span>
                <span className="text-amber-700">
                  RM {formatCurrency(reportData.totalExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* Labor Breakdown */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              Labor Cost Breakdown
            </h3>
            <div className="space-y-3">
              {Object.entries(reportData.laborBreakdown).map(([name, data]) => (
                <div key={name} className="py-2 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      {name}
                    </span>
                    <span className="text-sm text-gray-600">
                      {data.hours > 0
                        ? `${data.hours.toFixed(2)} hrs`
                        : "Fixed salary"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">Cost</span>
                    <span className="text-sm font-semibold text-gray-900">
                      RM {formatCurrency(data.cost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Day of Week Analysis */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          <h3 className="text-lg font-bold text-slate-900 mb-3">
            Sales by Day of Week
          </h3>
          {/* Aggregate by day of week */}
          {(() => {
            const dayOfWeekMap = new Map<
              number,
              { revenue: number; count: number }
            >();
            const dayNames = [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ];

            for (const day of reportData.dailyData) {
              const date = new Date(day.date + "T00:00:00");
              const dayIndex = date.getDay();
              const current = dayOfWeekMap.get(dayIndex) || {
                revenue: 0,
                count: 0,
              };
              current.revenue += day.revenue;
              current.count += 1;
              dayOfWeekMap.set(dayIndex, current);
            }

            const dayOfWeekData = Array.from(dayOfWeekMap.entries())
              .map(([dayIndex, data]) => ({
                day: dayNames[dayIndex],
                revenue: data.revenue,
                avgRevenue: data.revenue / data.count,
              }))
              .sort(
                (a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day),
              );

            return (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: unknown) =>
                      `RM ${Number(value).toFixed(2)}`
                    }
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#2563eb" name="Total Revenue" />
                  <Bar dataKey="avgRevenue" fill="#3b82f6" name="Avg Revenue" />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              Payment Methods
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={Object.entries(reportData.paymentBreakdown).map(
                  ([type, amount]) => ({
                    name: type,
                    value: amount,
                  }),
                )}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: unknown) =>
                    `RM ${Number(value).toFixed(2)}`
                  }
                />
                <Bar dataKey="value" fill="#8b5cf6" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              Top 10 Products
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {reportData.topProducts.map((product, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-start py-2 border-b border-gray-200 text-sm"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-600">
                      {product.quantity} units sold
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      RM {formatCurrency(product.revenue)}
                    </p>
                    <p className="text-xs text-gray-600">
                      Cost: RM {formatCurrency(product.cost)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-300 pt-8 mt-12 text-center text-xs text-gray-600">
          <p>This is a confidential financial report for Gembira Momento</p>
          <p className="mt-1">
            Generated on {new Date().toLocaleDateString("en-MY")}
          </p>
        </div>
      </div>
    </div>
  );
}
