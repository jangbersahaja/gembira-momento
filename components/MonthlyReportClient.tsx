"use client";

import {
  useEmployees,
  useProducts,
  useTimesheets,
  useTransactions,
} from "@/lib/useStorehubApi";
import { toCanvas } from "html-to-image";
import jsPDF from "jspdf";
import { useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import staticProducts from "../data/products";
import staticShifts from "../data/shifts";

// ─── Helper Functions ────────────────────────────────────────────────────────

const parseTime = (timeString: string): Date | null => {
  // Format: "2026-04-15T17:42:00Z" (ISO format from API)
  try {
    return new Date(timeString);
  } catch {
    return null;
  }
};

const formatCurrency = (value: number) => {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Parses shift date strings in "MM/DD/YYYY HH:mm" format
const parseShiftDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const [datePart, timePart] = dateString.split(" ");
  if (!datePart) return null;
  const [month, day, year] = datePart.split("/").map(Number);
  if (!month || !day || !year) return null;
  let hours = 0;
  let minutes = 0;
  if (timePart) {
    const [h, m] = timePart.split(":").map(Number);
    hours = h || 0;
    minutes = m || 0;
  }
  return new Date(year, month - 1, day, hours, minutes);
};

// Normalize supplier name and extract supply type ((Consignment) / (Outright))
const normalizeSupplier = (supplierStr: string) => {
  if (!supplierStr) return { base: "No Supplier", type: "" };

  const consignmentMatch = supplierStr.match(/^(.+?)\s*\(Consignment\)$/i);
  if (consignmentMatch) {
    return { base: consignmentMatch[1].trim(), type: "Consignment" };
  }

  const outrightMatch = supplierStr.match(/^(.+?)\s*\(Outright\)$/i);
  if (outrightMatch) {
    return { base: outrightMatch[1].trim(), type: "Outright" };
  }

  return { base: supplierStr, type: "Outright" };
};

// ─── Data Aggregation ────────────────────────────────────────────────────────

interface DailyData {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  transactions: number;
}

interface SupplierRow {
  supplier: string;
  supplyType: "Consignment" | "Outright";
  quantity: number;
  sales: number;
  cost: number;
  profit: number;
}

interface ReportData {
  month: string;
  year: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  dailyData: DailyData[];
  paymentBreakdown: Record<string, number>;
  laborCost: number;
  laborBreakdown: Record<string, { hours: number; cost: number }>;
  rentalCost: number;
  gtoCost: number;
  utilitiesCost: number;
  marketingCost: number;
  claimCost: number;
  totalOperatingCost: number;
  totalExpenses: number;
  netProfit: number;
  supplierRows: SupplierRow[];
  outrightTotals: { sales: number; cost: number; profit: number };
  consignmentTotals: { sales: number; cost: number; profit: number };
  topProducts: Array<{
    name: string;
    quantity: number;
    sales: number;
    cost: number;
    profit: number;
  }>;
}

function getMonthData(
  year: number,
  month: number,
  transactions: any[],
  products: any[] = [],
  timesheets: any[] = [],
  employees: any[] = [],
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
    paymentBreakdown: {},
    laborCost: 0,
    laborBreakdown: {},
    rentalCost: 1500,
    gtoCost: 0,
    utilitiesCost: 0,
    marketingCost: 0,
    claimCost: 0,
    totalOperatingCost: 0,
    totalExpenses: 0,
    netProfit: 0,
    supplierRows: [],
    outrightTotals: { sales: 0, cost: 0, profit: 0 },
    consignmentTotals: { sales: 0, cost: 0, profit: 0 },
    topProducts: [],
  };

  // Build product lookup map with SKU and ID (from live API, for cost)
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

  // Build supplier lookup from static CSV-derived product data (has Supplier field)
  const supplierBySkuMap = new Map<string, string>();
  const supplierByNameMap = new Map<string, string>();
  for (const p of staticProducts as any[]) {
    const sku = String(p["SKU"] || "");
    const name = String(p["Product Name"] || "").trim();
    const supplier = String(p["Supplier"] || "");
    if (sku) supplierBySkuMap.set(sku, supplier);
    if (name) supplierByNameMap.set(name, supplier);
  }

  const getSupplierName = (sku: string, name: string) => {
    if (sku && supplierBySkuMap.has(sku)) return supplierBySkuMap.get(sku)!;
    if (name && supplierByNameMap.has(name))
      return supplierByNameMap.get(name)!;
    return "";
  };

  // Build employee name lookup (id -> "First Last")
  const employeeNameMap = new Map<string, string>();
  for (const employee of employees) {
    if (employee.id) {
      const fullName = [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      employeeNameMap.set(String(employee.id), fullName || String(employee.id));
    }
  }

  // Calculate labor cost from timesheets
  // Assuming default hourly rate of RM15 (adjust as needed)
  const DEFAULT_HOURLY_RATE = 15;
  const laborMap = new Map<string, { hours: number; cost: number }>();

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
    const employeeName = employeeNameMap.get(employeeId) || employeeId;
    const current = laborMap.get(employeeName) || { hours: 0, cost: 0 };
    current.hours += hours;
    current.cost += laborCost;
    laborMap.set(employeeName, current);
  }

  reportData.laborBreakdown = Object.fromEntries(laborMap);
  reportData.laborCost = Array.from(laborMap.values()).reduce(
    (sum, d) => sum + d.cost,
    0,
  );

  // Calculate claim/payout cost from shift data (Pay Out field)
  let claimTotal = 0;
  for (const shift of staticShifts as any[]) {
    const openTime = parseShiftDate(String(shift["Open Time"] || ""));
    if (!openTime) continue;
    if (openTime.getMonth() !== month || openTime.getFullYear() !== year) {
      continue;
    }
    const payOut = parseFloat(String(shift["Pay Out"] || "0")) || 0;
    claimTotal += payOut;
  }
  reportData.claimCost = claimTotal;

  // Aggregate transaction data
  const dailyDataMap = new Map<
    string,
    { revenue: number; cost: number; transactions: number }
  >();
  const supplierTypeMap = new Map<string, SupplierRow>();
  const topProductsMap = new Map<
    string,
    { name: string; quantity: number; sales: number; cost: number }
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

    // Add to daily aggregates
    const dateKey = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}`;

    const currentDaily = dailyDataMap.get(dateKey) || {
      revenue: 0,
      cost: 0,
      transactions: 0,
    };
    currentDaily.revenue += tx.total;
    currentDaily.transactions += 1;

    // Payment breakdown
    const method = tx.paymentMethod || "other";
    reportData.paymentBreakdown[method] =
      (reportData.paymentBreakdown[method] || 0) + tx.total;

    for (const item of tx.items || []) {
      const sku = String(item.sku || "");
      const name = String(item.productName || "").trim();
      const quantity = item.quantity || 0;
      const itemSales = item.totalPrice || 0;

      // Get product cost (prefer live API cost data)
      let unitCost = 0;
      if (item.productId) {
        const productInfo = productMap.get(`id:${item.productId}`);
        unitCost = productInfo?.cost || 0;
      } else if (sku) {
        const productInfo = productMap.get(`sku:${sku}`);
        unitCost = productInfo?.cost || 0;
      }
      const itemCost = unitCost * quantity;
      currentDaily.cost += itemCost;

      // Supplier / supply-type aggregation
      const supplierRaw = getSupplierName(sku, name);
      const { base: supplierBase, type: supplyTypeStr } =
        normalizeSupplier(supplierRaw);
      const displaySupplier =
        supplierBase && supplierBase.trim() ? supplierBase : "(No supplier)";
      const supplyType: "Consignment" | "Outright" =
        supplyTypeStr === "Consignment" ? "Consignment" : "Outright";

      const key = `${displaySupplier}|${supplyType}`;
      const current = supplierTypeMap.get(key) || {
        supplier: displaySupplier,
        supplyType,
        quantity: 0,
        sales: 0,
        cost: 0,
        profit: 0,
      };
      current.quantity += quantity;
      current.sales += itemSales;
      current.cost += itemCost;
      current.profit = current.sales - current.cost;
      supplierTypeMap.set(key, current);

      if (supplyType === "Outright") {
        reportData.outrightTotals.sales += itemSales;
        reportData.outrightTotals.cost += itemCost;
      } else {
        reportData.consignmentTotals.sales += itemSales;
        reportData.consignmentTotals.cost += itemCost;
      }

      // Top products aggregation
      const productKey = sku || name || "Unknown";
      const productDisplayName = name || sku || "Unknown product";
      const currentProduct = topProductsMap.get(productKey) || {
        name: productDisplayName,
        quantity: 0,
        sales: 0,
        cost: 0,
      };
      currentProduct.quantity += quantity;
      currentProduct.sales += itemSales;
      currentProduct.cost += itemCost;
      topProductsMap.set(productKey, currentProduct);
    }

    dailyDataMap.set(dateKey, currentDaily);
  }

  reportData.outrightTotals.profit =
    reportData.outrightTotals.sales - reportData.outrightTotals.cost;
  reportData.consignmentTotals.profit =
    reportData.consignmentTotals.sales - reportData.consignmentTotals.cost;

  reportData.supplierRows = Array.from(supplierTypeMap.values()).sort(
    (a, b) => b.sales - a.sales,
  );

  reportData.topProducts = Array.from(topProductsMap.values())
    .map((p) => ({ ...p, profit: p.sales - p.cost }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10);

  // Build daily data array
  const dailyData: DailyData[] = [];
  for (const [dateStr, data] of dailyDataMap) {
    dailyData.push({
      date: dateStr,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      transactions: data.transactions,
    });
  }
  dailyData.sort((a, b) => a.date.localeCompare(b.date));
  reportData.dailyData = dailyData;

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

  // Calculate GTO (2% of revenue)
  reportData.gtoCost = reportData.totalRevenue * 0.02;

  // Set utilities and marketing costs to defaults for now
  // These would come from additional API endpoints if needed
  reportData.utilitiesCost = 0;
  reportData.marketingCost = 0;

  // Operating costs = everything besides COGS
  reportData.totalOperatingCost =
    reportData.laborCost +
    reportData.rentalCost +
    reportData.gtoCost +
    reportData.utilitiesCost +
    reportData.marketingCost +
    reportData.claimCost;

  // Calculate total expenses and net profit
  reportData.totalExpenses =
    reportData.totalCost + reportData.totalOperatingCost;
  reportData.netProfit = reportData.totalRevenue - reportData.totalExpenses;

  return reportData;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MonthlyReportClient() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch data from APIs
  const { data: transactionsData, loading: transactionsLoading } =
    useTransactions();
  const { data: productsData, loading: productsLoading } = useProducts({
    limit: 500,
  });
  const { data: employeesData, loading: employeesLoading } = useEmployees();

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
      employeesData || [],
    );
  }, [
    selectedYear,
    selectedMonth,
    transactionsData,
    productsData,
    timesheetsData,
    employeesData,
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
      setIsExporting(true);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const canvas = await toCanvas(reportRef.current, {
        pixelRatio: 2,
        backgroundColor: "#f9fafb",
      });

      // A4 dimensions
      const A4_WIDTH = 210; // mm
      const A4_HEIGHT = 297; // mm

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

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(
        `Gembira_Momento_Report_${selectedYear}_${String(selectedMonth + 1).padStart(2, "0")}.pdf`,
      );
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Show loading state while fetching
  if (
    transactionsLoading ||
    productsLoading ||
    timesheetsLoading ||
    employeesLoading
  ) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl bg-white p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl bg-white p-12 text-center">
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900">
                Monthly Report
              </h1>
              <p className="text-xs md:text-sm text-gray-600 mt-0.5">
                Revenue, cost, and profitability at a glance
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={handlePrevMonth}
                  className="px-2 py-1.5 text-xs md:text-sm font-medium text-gray-700 hover:bg-white rounded-md transition-colors"
                >
                  ←
                </button>
                <span className="px-2 text-xs md:text-sm font-semibold text-gray-900 min-w-28 text-center">
                  {monthNames[selectedMonth]} {selectedYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="px-2 py-1.5 text-xs md:text-sm font-medium text-gray-700 hover:bg-white rounded-md transition-colors"
                >
                  →
                </button>
              </div>

              <button
                type="button"
                onClick={downloadPDF}
                disabled={isExporting}
                className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors shrink-0"
              >
                {isExporting ? "Preparing..." : "📥 PDF"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - single page report */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6">
        <div ref={reportRef} className="space-y-5">
          {/* KPI Cards: Revenue, COGS, Operating Cost, Net Profit */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Revenue",
                value: `RM ${formatCurrency(reportData.totalRevenue)}`,
                color: "text-blue-600",
              },
              {
                label: "COGS",
                value: `RM ${formatCurrency(reportData.totalCost)}`,
                color: "text-red-600",
              },
              {
                label: "Operating Cost",
                value: `RM ${formatCurrency(reportData.totalOperatingCost)}`,
                color: "text-amber-600",
              },
              {
                label: "Net Profit",
                value: `RM ${formatCurrency(reportData.netProfit)}`,
                color:
                  reportData.netProfit >= 0 ? "text-green-600" : "text-red-600",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="bg-white border border-gray-200 rounded-lg p-3 md:p-4"
              >
                <p className="text-gray-600 text-xs font-medium mb-2">
                  {label}
                </p>
                <p className={`text-base md:text-lg font-bold ${color}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Daily Revenue & Profit Trend */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
              Daily revenue &amp; profit trend
            </h2>
            <p className="text-xs md:text-sm text-gray-600 mb-4">
              Revenue vs profit by date across the month
            </p>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={reportData.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: unknown) =>
                    `RM ${Number(value).toFixed(2)}`
                  }
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Revenue"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Profit"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Outright vs Consignment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm md:text-base font-bold text-gray-900">
                  Outright
                </h3>
                <span className="text-xs font-medium text-gray-500">
                  Owned stock
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Sales</p>
                  <p className="text-sm font-bold text-blue-600">
                    RM {formatCurrency(reportData.outrightTotals.sales)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Cost</p>
                  <p className="text-sm font-bold text-red-600">
                    RM {formatCurrency(reportData.outrightTotals.cost)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Profit</p>
                  <p className="text-sm font-bold text-green-600">
                    RM {formatCurrency(reportData.outrightTotals.profit)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm md:text-base font-bold text-gray-900">
                  Consignment
                </h3>
                <span className="text-xs font-medium text-gray-500">
                  Third-party stock
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Sales</p>
                  <p className="text-sm font-bold text-blue-600">
                    RM {formatCurrency(reportData.consignmentTotals.sales)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Cost</p>
                  <p className="text-sm font-bold text-red-600">
                    RM {formatCurrency(reportData.consignmentTotals.cost)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Profit</p>
                  <p className="text-sm font-bold text-green-600">
                    RM {formatCurrency(reportData.consignmentTotals.profit)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier Breakdown Table */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
              Sales &amp; COGS by supplier
            </h2>
            <p className="text-xs md:text-sm text-gray-600 mb-4">
              Outright vs consignment performance per supplier
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-2 font-medium">Supplier</th>
                    <th className="py-2 px-2 font-medium">Type</th>
                    <th className="py-2 px-2 font-medium text-right">Units</th>
                    <th className="py-2 px-2 font-medium text-right">Sales</th>
                    <th className="py-2 px-2 font-medium text-right">COGS</th>
                    <th className="py-2 pl-2 font-medium text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.supplierRows.map((row, idx) => (
                    <tr
                      key={`${row.supplier}-${row.supplyType}-${idx}`}
                      className="border-b border-gray-100"
                    >
                      <td className="py-2 pr-2 font-medium text-gray-900">
                        {row.supplier}
                      </td>
                      <td className="py-2 px-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium ${
                            row.supplyType === "Consignment"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {row.supplyType}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">
                        {row.quantity}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-gray-900">
                        RM {formatCurrency(row.sales)}
                      </td>
                      <td className="py-2 px-2 text-right text-red-600">
                        RM {formatCurrency(row.cost)}
                      </td>
                      <td className="py-2 pl-2 text-right font-medium text-green-600">
                        RM {formatCurrency(row.profit)}
                      </td>
                    </tr>
                  ))}
                  {reportData.supplierRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-gray-500"
                      >
                        No supplier sales data for this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Methods + Top 10 Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Payment Methods */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
                Payment methods
              </h2>
              <p className="text-xs md:text-sm text-gray-600 mb-4">
                Sales breakdown by payment type
              </p>
              <div className="space-y-2">
                {Object.entries(reportData.paymentBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, amount]) => {
                    const percentage =
                      reportData.totalRevenue > 0
                        ? (amount / reportData.totalRevenue) * 100
                        : 0;
                    return (
                      <div
                        key={method}
                        className="p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs md:text-sm font-medium text-gray-700 capitalize">
                            {method}
                          </span>
                          <span className="text-xs md:text-sm font-semibold text-gray-900">
                            RM {formatCurrency(amount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] md:text-xs text-gray-500 shrink-0">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                {Object.keys(reportData.paymentBreakdown).length === 0 && (
                  <p className="text-center text-gray-500 py-6 text-sm">
                    No payment data for this month
                  </p>
                )}
              </div>
            </div>

            {/* Top 10 Products */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
                Top 10 selling products
              </h2>
              <p className="text-xs md:text-sm text-gray-600 mb-4">
                Ranked by total sales for the month
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {reportData.topProducts.map((product, idx) => (
                  <div
                    key={`${product.name}-${idx}`}
                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-4 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-[10px] md:text-xs text-gray-600">
                          {product.quantity} units sold
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-xs md:text-sm font-semibold text-blue-600">
                        RM {formatCurrency(product.sales)}
                      </p>
                      <p className="text-[10px] md:text-xs text-green-600">
                        +RM {formatCurrency(product.profit)}
                      </p>
                    </div>
                  </div>
                ))}
                {reportData.topProducts.length === 0 && (
                  <p className="text-center text-gray-500 py-6 text-sm">
                    No product sales data for this month
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Operating Expenses + Labor Cost */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Operating Expenses */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4">
                Operating expenses
              </h2>
              <div className="space-y-2">
                {[
                  { name: "Cost of Goods Sold", value: reportData.totalCost },
                  { name: "Labor Cost", value: reportData.laborCost },
                  { name: "Rental", value: reportData.rentalCost },
                  { name: "GTO to Landlord (2%)", value: reportData.gtoCost },
                  { name: "Utilities", value: reportData.utilitiesCost },
                  {
                    name: "Marketing/Gifts",
                    value: reportData.marketingCost,
                  },
                  { name: "Claims/Payouts", value: reportData.claimCost },
                ].map(({ name, value }) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <span className="text-xs md:text-sm font-medium text-gray-700">
                      {name}
                    </span>
                    <span className="text-xs md:text-sm font-semibold text-gray-900">
                      RM {formatCurrency(value)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-xs md:text-sm font-semibold text-gray-900">
                    Total Expenses
                  </span>
                  <span className="text-xs md:text-sm font-bold text-amber-700">
                    RM {formatCurrency(reportData.totalExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* Labor Cost Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4">
                Labor cost breakdown
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {Object.entries(reportData.laborBreakdown).map(
                  ([name, data]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-900 truncate">
                          {name}
                        </p>
                        <p className="text-[10px] md:text-xs text-gray-600">
                          {data.hours > 0
                            ? `${data.hours.toFixed(2)} hours`
                            : "Fixed salary"}
                        </p>
                      </div>
                      <span className="text-xs md:text-sm font-semibold text-gray-900 ml-3 shrink-0">
                        RM {formatCurrency(data.cost)}
                      </span>
                    </div>
                  ),
                )}
                {Object.keys(reportData.laborBreakdown).length === 0 && (
                  <p className="text-center text-gray-500 py-6 text-sm">
                    No labor data for this month
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Daily Sales Table */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
              Daily sales
            </h2>
            <p className="text-xs md:text-sm text-gray-600 mb-4">
              Day-by-day revenue, cost, and profit breakdown
            </p>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Transactions
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Revenue
                    </th>
                    <th className="py-2 px-2 font-medium text-right">COGS</th>
                    <th className="py-2 pl-2 font-medium text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.dailyData.map((day) => (
                    <tr key={day.date} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium text-gray-900">
                        {new Date(day.date + "T00:00:00").toLocaleDateString(
                          "en-MY",
                          { day: "numeric", month: "short", weekday: "short" },
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">
                        {day.transactions}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-blue-600">
                        RM {formatCurrency(day.revenue)}
                      </td>
                      <td className="py-2 px-2 text-right text-red-600">
                        RM {formatCurrency(day.cost)}
                      </td>
                      <td className="py-2 pl-2 text-right font-medium text-green-600">
                        RM {formatCurrency(day.profit)}
                      </td>
                    </tr>
                  ))}
                  {reportData.dailyData.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-gray-500"
                      >
                        No sales data for this month
                      </td>
                    </tr>
                  )}
                </tbody>
                {reportData.dailyData.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-gray-50">
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td className="py-2 pr-2 text-gray-900">Total</td>
                      <td className="py-2 px-2 text-right text-gray-900">
                        {reportData.dailyData.reduce(
                          (sum, d) => sum + d.transactions,
                          0,
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-blue-700">
                        RM {formatCurrency(reportData.totalRevenue)}
                      </td>
                      <td className="py-2 px-2 text-right text-red-700">
                        RM {formatCurrency(reportData.totalCost)}
                      </td>
                      <td className="py-2 pl-2 text-right text-green-700">
                        RM {formatCurrency(reportData.totalProfit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
            <p>Confidential financial report for Gembira Momento</p>
            <p className="mt-1">
              Generated on {new Date().toLocaleDateString("en-MY")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
