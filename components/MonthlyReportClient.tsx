"use client";

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
import expenses from "../data/expenses";
import products from "../data/products";
import timesheets from "../data/timesheets";
import transactions from "../data/transactions";

// ─── Helper Functions ────────────────────────────────────────────────────────

const costBySkuMap = new Map<string, number>();
const costByNameMap = new Map<string, number>();

for (const product of products) {
  const cost =
    typeof product.Cost === "number" ? product.Cost : Number(product.Cost) || 0;
  const sku = String(product.SKU);
  const name = String(product["Product Name"]);

  if (sku && sku !== "undefined") {
    costBySkuMap.set(sku, cost);
  }

  if (name && name !== "undefined") {
    costByNameMap.set(name, cost);
  }
}

const getCost = (sku: string, productName: string): number => {
  if (sku && sku !== "undefined") {
    const skuCost = costBySkuMap.get(sku);
    if (skuCost !== undefined) return skuCost;
  }

  if (productName && productName !== "undefined") {
    const nameCost = costByNameMap.get(productName);
    if (nameCost !== undefined) return nameCost;
  }

  return 0;
};

const parseTime = (timeString: string): Date | null => {
  // Format: "04/15/2026 Wednesday 17:42" or "04/15/2026 17:42"
  const match = timeString.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(?:\w+\s+)?(\d{1,2}):(\d{2})$/,
  );
  if (!match) return null;
  const [, month, day, year, hour, minute] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const isTotalRow = (row: Record<string, unknown>) =>
  getString(row["Transaction Type"]) === "Sale" &&
  getString(row.Item) === "" &&
  getString(row.Is_Cancelled) === "False" &&
  row.SubTotal !== "";

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
  otherExpenses: number;
  totalExpenses: number;
  netProfit: number;
}

function getMonthData(year: number, month: number): ReportData {
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
    otherExpenses: 0,
    totalExpenses: 0,
    netProfit: 0,
  };

  // Aggregate transaction data by day
  const dailyDataMap = new Map<string, { revenue: number; cost: number }>();
  const hourlyDataMap = new Map<
    number,
    { revenue: number; transactions: number }
  >();
  const productMap = new Map<
    string,
    { qty: number; revenue: number; cost: number }
  >();

  // First pass: Calculate daily and hourly revenue from receipt totals (payment methods)
  const receiptRevenueMap = new Map<string, number>();
  for (const tx of transactions) {
    const timeStr = getString(tx.Time);
    const date = parseTime(timeStr);

    if (!date || date.getMonth() !== month || date.getFullYear() !== year)
      continue;

    if (!isTotalRow(tx)) continue;

    const receipt = getString(tx["Receipt Number"]);
    const cash = typeof tx.Cash === "number" ? tx.Cash : Number(tx.Cash) || 0;
    const creditCard =
      typeof tx["Credit Card"] === "number"
        ? tx["Credit Card"]
        : Number(tx["Credit Card"]) || 0;
    const debitCard =
      typeof tx["Debit Card"] === "number"
        ? tx["Debit Card"]
        : Number(tx["Debit Card"]) || 0;
    const qr = typeof tx.QR === "number" ? tx.QR : Number(tx.QR) || 0;

    const receiptRevenue = cash + creditCard + debitCard + qr;
    if (receiptRevenue > 0) {
      receiptRevenueMap.set(receipt, receiptRevenue);

      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const hour = date.getHours();

      // Daily revenue
      const currentDaily = dailyDataMap.get(dateKey) || { revenue: 0, cost: 0 };
      currentDaily.revenue += receiptRevenue;
      dailyDataMap.set(dateKey, currentDaily);

      // Hourly revenue
      if (!hourlyDataMap.has(hour)) {
        hourlyDataMap.set(hour, { revenue: 0, transactions: 0 });
      }
      const hourData = hourlyDataMap.get(hour)!;
      hourData.revenue += receiptRevenue;
      hourData.transactions += 1;
    }
  }

  // Second pass: Process item rows for cost and product data
  for (const tx of transactions) {
    const timeStr = getString(tx.Time);
    const date = parseTime(timeStr);

    if (!date || date.getMonth() !== month || date.getFullYear() !== year)
      continue;

    // Process individual items (not totals)
    const txType = getString(tx["Transaction Type"]);
    const isCancelled = getString(tx.Is_Cancelled);

    if (txType !== "Sale" || isCancelled === "True") continue;

    // Skip empty item rows (transaction total rows)
    const itemName = getString(tx.Item);
    if (!itemName) continue;

    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const quantity =
      typeof tx.Quantity === "number" ? tx.Quantity : Number(tx.Quantity) || 0;

    // Cost calculation
    const sku = getString(tx.SKU);
    const itemCost = getCost(sku, itemName);
    const totalCost = itemCost * quantity;

    // Daily data - accumulate costs
    const currentDaily = dailyDataMap.get(dateKey) || { revenue: 0, cost: 0 };
    currentDaily.cost += totalCost;
    dailyDataMap.set(dateKey, currentDaily);

    // Product tracking - use item SubTotal for product-level reporting
    const subtotal =
      typeof tx.SubTotal === "number" ? tx.SubTotal : Number(tx.SubTotal) || 0;
    const discountValue =
      typeof tx.Discount === "number" ? tx.Discount : Number(tx.Discount) || 0;
    const discount = Math.abs(discountValue);
    const netSales = subtotal - discount;

    if (itemName) {
      const current = productMap.get(itemName) || {
        qty: 0,
        revenue: 0,
        cost: 0,
      };
      current.qty += quantity;
      current.revenue += netSales;
      current.cost += totalCost;
      productMap.set(itemName, current);
    }
  }

  // Recalculate payment breakdown correctly and calculate revenue from payments
  const paymentBreakdownCorrect = new Map<string, number>();
  for (const tx of transactions) {
    const timeStr = getString(tx.Time);
    const date = parseTime(timeStr);

    if (!date || date.getMonth() !== month || date.getFullYear() !== year)
      continue;

    if (!isTotalRow(tx)) continue;

    const cash = typeof tx.Cash === "number" ? tx.Cash : Number(tx.Cash) || 0;
    const creditCard =
      typeof tx["Credit Card"] === "number"
        ? tx["Credit Card"]
        : Number(tx["Credit Card"]) || 0;
    const debitCard =
      typeof tx["Debit Card"] === "number"
        ? tx["Debit Card"]
        : Number(tx["Debit Card"]) || 0;
    const qr = typeof tx.QR === "number" ? tx.QR : Number(tx.QR) || 0;

    if (cash > 0) {
      paymentBreakdownCorrect.set(
        "Cash",
        (paymentBreakdownCorrect.get("Cash") || 0) + cash,
      );
    }
    if (creditCard > 0) {
      paymentBreakdownCorrect.set(
        "Credit Card",
        (paymentBreakdownCorrect.get("Credit Card") || 0) + creditCard,
      );
    }
    if (debitCard > 0) {
      paymentBreakdownCorrect.set(
        "Debit Card",
        (paymentBreakdownCorrect.get("Debit Card") || 0) + debitCard,
      );
    }
    if (qr > 0) {
      paymentBreakdownCorrect.set(
        "QR Pay",
        (paymentBreakdownCorrect.get("QR Pay") || 0) + qr,
      );
    }
  }

  // Convert daily data map to sorted array
  const dailyArray: DailyData[] = [];
  for (const [dateKey, data] of dailyDataMap) {
    const profit = data.revenue - data.cost;
    dailyArray.push({
      date: dateKey,
      revenue: data.revenue,
      cost: data.cost,
      profit,
    });
    reportData.totalRevenue += data.revenue;
    reportData.totalCost += data.cost;
  }
  dailyArray.sort((a, b) => a.date.localeCompare(b.date));
  reportData.dailyData = dailyArray;
  reportData.totalProfit = reportData.totalRevenue - reportData.totalCost;

  // Convert hourly data map to sorted array
  const formatRangeLabel = (hour: number): string => {
    const start = hour.toString().padStart(2, "0");
    const end = ((hour + 1) % 24).toString().padStart(2, "0");
    return `${start}:00 - ${end}:00`;
  };

  const hourlyArray: HourlyData[] = Array.from(hourlyDataMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, data]) => ({
      hour,
      label: formatRangeLabel(hour),
      revenue: data.revenue,
      transactions: data.transactions,
    }));
  reportData.hourlyData = hourlyArray;

  // Payment breakdown - use the correct calculated map
  for (const [paymentType, amount] of paymentBreakdownCorrect) {
    reportData.paymentBreakdown[paymentType] = amount;
  }

  // Top products
  const productArray = Array.from(productMap.entries())
    .map(([name, data]) => ({
      name,
      quantity: data.qty,
      revenue: data.revenue,
      cost: data.cost,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  reportData.topProducts = productArray;

  // Labor cost calculation - group timesheet entries by staff section
  const laborMap = new Map<
    string,
    { name: string; hours: number; shifts: number }
  >();

  let currentStaff = "Unknown";

  for (const timesheet of timesheets) {
    const firstName = getString(timesheet["First Name"]);
    const timeInStr = getString(timesheet["Time In"]);
    const totalHours =
      typeof timesheet["Total Hours"] === "number"
        ? timesheet["Total Hours"]
        : Number(timesheet["Total Hours"]) || 0;

    // If Time In is empty but First Name exists, it's a header row - update current staff
    if (!timeInStr && firstName) {
      currentStaff = firstName;
      continue; // Skip the header row itself
    }

    // Skip if no Time In (entry rows we don't want to process)
    if (!timeInStr) continue;

    // Parse the time to get month/year
    const timeIn = parseTime(timeInStr);
    if (!timeIn || timeIn.getMonth() !== month || timeIn.getFullYear() !== year)
      continue;

    // Aggregate by current staff
    const key = currentStaff;
    const current = laborMap.get(key) || {
      name: currentStaff,
      hours: 0,
      shifts: 0,
    };
    current.hours += totalHours;
    current.shifts += 1;
    laborMap.set(key, current);
  }

  // Calculate labor costs
  // Faris is branch manager with fixed RM3200/month
  // Others: RM8/hour
  for (const [staffName, labor] of laborMap) {
    let cost = 0;

    if (staffName.toLowerCase() === "faris") {
      // Fixed salary for manager
      cost = 3200;
    } else {
      // Hourly rate for others
      cost = labor.hours * 8;
    }

    reportData.laborCost += cost;
    reportData.laborBreakdown[labor.name] = {
      hours: labor.hours,
      cost,
    };
  }

  // Calculate GTO (2% of revenue)
  reportData.gtoCost = reportData.totalRevenue * 0.02;

  // Get utilities and other expenses from expenses.ts
  for (const exp of expenses) {
    if (exp.Year === String(year) && exp.Month === monthNames[month]) {
      reportData.utilitiesCost =
        typeof exp.Electric === "number"
          ? exp.Electric
          : Number(exp.Electric) || 0;
      reportData.otherExpenses =
        (typeof exp["Other (Claim)"] === "number"
          ? exp["Other (Claim)"]
          : Number(exp["Other (Claim)"]) || 0) +
        (typeof exp["Marketing/Free Gift"] === "number"
          ? exp["Marketing/Free Gift"]
          : Number(exp["Marketing/Free Gift"]) || 0);
    }
  }

  // Calculate total expenses and net profit
  reportData.totalExpenses =
    reportData.totalCost +
    reportData.laborCost +
    reportData.rentalCost +
    reportData.gtoCost +
    reportData.utilitiesCost +
    reportData.otherExpenses;

  reportData.netProfit = reportData.totalRevenue - reportData.totalExpenses;

  return reportData;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MonthlyReportClient() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const reportRef = useRef<HTMLDivElement>(null);

  const reportData = useMemo(
    () => getMonthData(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

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
                  Utilities & Expenses
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  RM{" "}
                  {formatCurrency(
                    reportData.utilitiesCost + reportData.otherExpenses,
                  )}
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
