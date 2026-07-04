"use client";

import { useMemo, useRef, useState } from "react";
import products from "../data/products";
import timesheets from "../data/timesheets";
import transactions from "../data/transactions";
import {
  DayOfWeekTrendCharts,
  PaymentTypeBarChart,
  ProductSalesBarChart,
  SalesBarChart,
  SalesByDayOfWeekChart,
  SalesLineChart,
  StaffSalesBarChart,
  type DayOfWeekPoint,
  type HourlyPoint,
  type PaymentPoint,
  type ProductPoint,
  type StaffPoint,
} from "./SalesChart";

// ─── helpers ────────────────────────────────────────────────────────────────

// Helper function to normalize supplier name and extract supply type
const normalizeSupplier = (supplierStr: string) => {
  if (!supplierStr) return { base: "No Supplier", type: "" };

  const consignmentMatch = supplierStr.match(/^(.+?)\s*\(Consignment\)$/i);
  if (consignmentMatch) {
    return { base: consignmentMatch[1].trim(), type: "(Consignment)" };
  }

  const outrightMatch = supplierStr.match(/^(.+?)\s*\(Outright\)$/i);
  if (outrightMatch) {
    return { base: outrightMatch[1].trim(), type: "(Outright)" };
  }

  return { base: supplierStr, type: "" };
};

// Create cost lookup maps from product SKU and product name
const costBySkuMap = new Map<string, number>();
const costByNameMap = new Map<string, number>();

for (const product of products) {
  const cost =
    typeof product.Cost === "number" ? product.Cost : Number(product.Cost) || 0;
  const sku = String(product.SKU);
  const name = String(product["Product Name"]);

  // Map by SKU if available
  if (sku && sku !== "undefined") {
    costBySkuMap.set(sku, cost);
  }

  // Also map by product name as fallback for empty/missing SKUs
  if (name && name !== "undefined") {
    costByNameMap.set(name, cost);
  }
}

const getCost = (sku: string, productName: string): number => {
  // First try to lookup by SKU
  if (sku && sku !== "undefined") {
    const skuCost = costBySkuMap.get(sku);
    if (skuCost !== undefined) return skuCost;
  }

  // Fallback to product name lookup
  if (productName && productName !== "undefined") {
    const nameCost = costByNameMap.get(productName);
    if (nameCost !== undefined) return nameCost;
  }

  return 0;
};

const parseTime = (timeString: string): Date | null => {
  // Try format with day name: "04/15/2026 Wednesday 16:29"
  let match = timeString.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\w+\s+(\d{1,2}):(\d{2})$/,
  );
  if (match) {
    const [, month, day, year, hour, minute] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
  }

  // Try format without day name: "04/15/2026 16:29"
  match = timeString.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/,
  );
  if (match) {
    const [, month, day, year, hour, minute] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
  }

  return null;
};

const formatRangeLabel = (hour: number) => {
  const start = hour.toString().padStart(2, "0");
  const end = (hour + 1).toString().padStart(2, "0");
  return `${start}:00 — ${end}:00`;
};

const formatNumber = (value: number) => {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const formatCurrency = (value: number) => {
  return value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const isTotalRow = (row: Record<string, unknown>) =>
  getString(row["Transaction Type"]) === "Sale" &&
  getString(row.Item) === "" &&
  getString(row.Is_Cancelled) === "False" &&
  row.SubTotal !== "" &&
  row.SubTotal !== null &&
  row.SubTotal !== undefined;

const isItemRow = (row: Record<string, unknown>) =>
  getString(row["Transaction Type"]) === "Sale" &&
  getString(row.Is_Cancelled) === "False" &&
  getString(row.Item) !== "";

const getAmount = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const getQuantity = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

/** Returns yyyy-MM-dd string for an input[type=date] value */
const toInputDate = (d: Date) => d.toISOString().slice(0, 10);

/** Parses an input[type=date] string to a Date at midnight local time */
const fromInputDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// ─── preset helpers ──────────────────────────────────────────────────────────

type Preset = "all" | "this-month" | "last-month" | "custom";
type ViewTab =
  | "daily"
  | "time"
  | "products"
  | "payments"
  | "staff"
  | "supplier";

const getPresetRange = (preset: Preset): { from: Date; to: Date } | null => {
  const now = new Date();
  if (preset === "all") return null;
  if (preset === "this-month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  }
  if (preset === "last-month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }
  return null; // custom — caller manages dates
};

// ─── data processing ─────────────────────────────────────────────────────────

const groupByHour = (from: Date | null, to: Date | null) => {
  const hourlyMap = new Map<number, { total: number; transactions: number }>();
  const receiptMap = new Map<string, { hour: number; total: number }>();

  // First pass: collect receipt totals from payment methods
  for (const row of transactions) {
    if (!isTotalRow(row)) continue;
    const date = parseTime(row.Time);
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const hour = date.getHours();
    const receipt = getString(row["Receipt Number"]);
    const cash = getAmount(row.Cash);
    const qr = getAmount(row.QR);
    const creditCard = getAmount(row["Credit Card"]);
    const debitCard = getAmount(row["Debit Card"]);
    const total = cash + qr + creditCard + debitCard;

    if (total > 0 && !receiptMap.has(receipt)) {
      receiptMap.set(receipt, { hour, total });
    }
  }

  // Second pass: aggregate by hour
  for (const { hour, total } of receiptMap.values()) {
    if (!hourlyMap.has(hour))
      hourlyMap.set(hour, { total: 0, transactions: 0 });
    const current = hourlyMap.get(hour)!;
    current.total += total;
    current.transactions += 1;
  }

  const hourly: HourlyPoint[] = Array.from(hourlyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, value]) => ({
      hour,
      label: formatRangeLabel(hour),
      ...value,
    }));

  return {
    hourly,
    dateCount: receiptMap.size,
    transactionCount: hourly.reduce((s, r) => s + r.transactions, 0),
    totalSales: hourly.reduce((s, r) => s + r.total, 0),
  };
};
const groupByDay = (from: Date | null, to: Date | null) => {
  const dailyMap = new Map<
    string,
    {
      total: number;
      transactions: number;
      cost: number;
      firstTxnHour?: string;
      lastTxnHour?: string;
      openingTime?: string;
      closingTime?: string;
    }
  >();
  const receiptMap = new Map<
    string,
    { date: string; total: number; time: string }
  >();

  // First pass: collect receipt totals from payment methods and track times
  for (const row of transactions) {
    if (!isTotalRow(row)) continue;
    const date = parseTime(row.Time);
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const receipt = getString(row["Receipt Number"]);
    const cash = getAmount(row.Cash);
    const qr = getAmount(row.QR);
    const creditCard = getAmount(row["Credit Card"]);
    const debitCard = getAmount(row["Debit Card"]);
    const total = cash + qr + creditCard + debitCard;
    const timeStr = getString(row.Time);
    const hour = date.getHours().toString().padStart(2, "0");
    const minute = date.getMinutes().toString().padStart(2, "0");
    const hourMinute = `${hour}:${minute}`;

    if (total > 0 && !receiptMap.has(receipt)) {
      receiptMap.set(receipt, { date: dateKey, total, time: timeStr });
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          total: 0,
          transactions: 0,
          cost: 0,
          firstTxnHour: hourMinute,
          lastTxnHour: hourMinute,
        });
      }
      const current = dailyMap.get(dateKey)!;
      current.total += total;
      current.transactions += 1;
      // Update last time (since we're iterating in order, this will be the latest)
      current.lastTxnHour = hourMinute;
    }
  }

  // Second pass: add opening and closing times from timesheets for all dates
  for (const sheet of timesheets) {
    const timeInStr = getString(sheet["Time In"]);
    const timeOutStr = getString(sheet["Time Out"]);

    if (timeInStr) {
      const timeInDate = parseTime(timeInStr);
      if (timeInDate) {
        const dateKey = `${timeInDate.getFullYear()}-${String(timeInDate.getMonth() + 1).padStart(2, "0")}-${String(timeInDate.getDate()).padStart(2, "0")}`;
        const hour = timeInDate.getHours().toString().padStart(2, "0");
        const minute = timeInDate.getMinutes().toString().padStart(2, "0");
        const timeDisplay = `${hour}:${minute}`;

        // Create entry if it doesn't exist
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, {
            total: 0,
            transactions: 0,
            cost: 0,
            openingTime: timeDisplay,
            closingTime: timeDisplay,
          });
        } else {
          const current = dailyMap.get(dateKey)!;
          // Set opening time if not set or if this is earlier
          if (!current.openingTime) {
            current.openingTime = timeDisplay;
          } else {
            const existingHour = parseInt(current.openingTime.split(":")[0]);
            const existingMin = parseInt(current.openingTime.split(":")[1]);
            const newHour = parseInt(hour);
            const newMin = parseInt(minute);
            if (
              newHour < existingHour ||
              (newHour === existingHour && newMin < existingMin)
            ) {
              current.openingTime = timeDisplay;
            }
          }
        }
      }
    }

    if (timeOutStr) {
      const timeOutDate = parseTime(timeOutStr);
      if (timeOutDate) {
        const dateKey = `${timeOutDate.getFullYear()}-${String(timeOutDate.getMonth() + 1).padStart(2, "0")}-${String(timeOutDate.getDate()).padStart(2, "0")}`;
        const hour = timeOutDate.getHours().toString().padStart(2, "0");
        const minute = timeOutDate.getMinutes().toString().padStart(2, "0");
        const timeDisplay = `${hour}:${minute}`;

        // Create entry if it doesn't exist
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, {
            total: 0,
            transactions: 0,
            cost: 0,
            openingTime: timeDisplay,
            closingTime: timeDisplay,
          });
        } else {
          const current = dailyMap.get(dateKey)!;
          // Set closing time if not set or if this is later
          if (!current.closingTime) {
            current.closingTime = timeDisplay;
          } else {
            const existingHour = parseInt(current.closingTime.split(":")[0]);
            const existingMin = parseInt(current.closingTime.split(":")[1]);
            const newHour = parseInt(hour);
            const newMin = parseInt(minute);
            if (
              newHour > existingHour ||
              (newHour === existingHour && newMin > existingMin)
            ) {
              current.closingTime = timeDisplay;
            }
          }
        }
      }
    }
  }

  // Second pass: calculate cost for each day by processing item rows
  for (const row of transactions) {
    if (!isItemRow(row)) continue;
    const date = parseTime(getString(row.Time));
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const quantity = getQuantity(row.Quantity);
    const sku = getString(row.SKU);
    const name = getString(row.Item);
    const unitCost = getCost(sku, name);
    const totalCost = unitCost * quantity;

    if (dailyMap.has(dateKey)) {
      dailyMap.get(dateKey)!.cost += totalCost;
    }
  }

  const daily: Array<{
    date: string;
    label: string;
    total: number;
    transactions: number;
    cost: number;
    profit: number;
    margin: number;
    firstTxnHour?: string;
    lastTxnHour?: string;
    openingTime?: string;
    closingTime?: string;
  }> = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([
        dateKey,
        {
          total,
          transactions,
          cost,
          firstTxnHour,
          lastTxnHour,
          openingTime,
          closingTime,
        },
      ]) => {
        const profit = total - cost;
        const margin = total > 0 ? (profit / total) * 100 : 0;
        return {
          date: dateKey,
          label: dateKey,
          total,
          transactions,
          cost,
          profit,
          margin,
          firstTxnHour,
          lastTxnHour,
          openingTime,
          closingTime,
        };
      },
    );

  return {
    daily,
    dayCount: daily.length,
    transactionCount: daily.reduce((s, r) => s + r.transactions, 0),
    totalSales: daily.reduce((s, r) => s + r.total, 0),
    totalCost: daily.reduce((s, r) => s + r.cost, 0),
    totalProfit: daily.reduce((s, r) => s + r.profit, 0),
  };
};

const groupByDayOfWeek = (from: Date | null, to: Date | null) => {
  const dayNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  const dayMap = new Map<
    number,
    {
      hourly: Map<number, { total: number; transactions: number }>;
      total: number;
      transactions: number;
    }
  >();

  // Initialize day map (0 = Monday, 6 = Sunday)
  for (let i = 0; i < 7; i++) {
    dayMap.set(i, { hourly: new Map(), total: 0, transactions: 0 });
  }

  // First pass: aggregate receipt totals by day of week
  const receiptMap = new Map<
    string,
    { day: number; hour: number; total: number }
  >();
  for (const row of transactions) {
    if (!isTotalRow(row)) continue;
    const date = parseTime(row.Time);
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    // Convert JavaScript getDay() (0=Sunday) to our format (0=Monday)
    let dayOfWeek = date.getDay();
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const hour = date.getHours();
    const receipt = getString(row["Receipt Number"]);
    const cash = getAmount(row.Cash);
    const qr = getAmount(row.QR);
    const creditCard = getAmount(row["Credit Card"]);
    const debitCard = getAmount(row["Debit Card"]);
    const total = cash + qr + creditCard + debitCard;

    if (total > 0 && !receiptMap.has(receipt)) {
      receiptMap.set(receipt, { day: dayOfWeek, hour, total });
      const dayData = dayMap.get(dayOfWeek)!;
      dayData.total += total;
      dayData.transactions += 1;

      if (!dayData.hourly.has(hour)) {
        dayData.hourly.set(hour, { total: 0, transactions: 0 });
      }
      const hourData = dayData.hourly.get(hour)!;
      hourData.total += total;
      hourData.transactions += 1;
    }
  }

  const daysOfWeek: DayOfWeekPoint[] = Array.from(dayMap.entries())
    .map(([dayIndex, { hourly, total, transactions }]) => {
      const hourlyBreakdown: HourlyPoint[] = Array.from(hourly.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([hour, value]) => ({
          hour,
          label: formatRangeLabel(hour),
          ...value,
        }));

      return {
        dayName: dayNames[dayIndex],
        dayIndex,
        total,
        transactions,
        hourlyBreakdown,
      };
    })
    .sort((a, b) => a.dayIndex - b.dayIndex);

  return {
    daysOfWeek,
    transactionCount: daysOfWeek.reduce((s, r) => s + r.transactions, 0),
    totalSales: daysOfWeek.reduce((s, r) => s + r.total, 0),
  };
};

const groupByProduct = (from: Date | null, to: Date | null) => {
  const productsMap = new Map<
    string,
    { total: number; quantity: number; cost: number; sku: string }
  >();

  // Aggregate products - Calculate net sales (SubTotal - Discount)
  for (const row of transactions) {
    if (!isItemRow(row)) continue;

    const date = parseTime(getString(row.Time));
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const name = getString(row.Item);
    const subtotal = getAmount(row.SubTotal);
    const discount = Math.abs(getAmount(row.Discount)); // discount is stored as negative, convert to positive
    const netSales = subtotal - discount; // Net sales after discount
    const quantity = getQuantity(row.Quantity);
    const sku = getString(row.SKU);

    const unitCost = getCost(sku, name);
    const totalCost = unitCost * quantity;

    if (!productsMap.has(name)) {
      productsMap.set(name, { total: 0, quantity: 0, cost: 0, sku });
    }

    const current = productsMap.get(name)!;
    current.total += netSales;
    current.quantity += quantity;
    current.cost += totalCost;
  }

  const products: ProductPoint[] = Array.from(productsMap.entries())
    .map(([name, { total, quantity, cost }]) => ({
      name,
      total,
      quantity,
      cost,
      profit: total - cost,
      margin: total > 0 ? ((total - cost) / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    products,
    topProducts: products.slice(0, 10),
    productCount: products.length,
    totalUnits: products.reduce((sum, item) => sum + item.quantity, 0),
    totalProductSales: products.reduce((sum, item) => sum + item.total, 0),
    totalProductCost: products.reduce((sum, item) => sum + (item.cost || 0), 0),
    totalProductProfit: products.reduce(
      (sum, item) => sum + (item.profit || 0),
      0,
    ),
  };
};

const groupByPaymentType = (from: Date | null, to: Date | null) => {
  const seed = {
    Cash: { total: 0, transactions: 0 },
    QR: { total: 0, transactions: 0 },
    "Credit / Debit Card": { total: 0, transactions: 0 },
  };

  for (const row of transactions) {
    if (!isTotalRow(row)) continue;

    const date = parseTime(getString(row.Time));
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const cashAmount = getAmount(row.Cash);
    const qrAmount = getAmount(row.QR);
    const cardAmount =
      getAmount(row["Credit Card"]) + getAmount(row["Debit Card"]);

    if (cashAmount > 0) {
      seed.Cash.total += cashAmount;
      seed.Cash.transactions += 1;
    }

    if (qrAmount > 0) {
      seed.QR.total += qrAmount;
      seed.QR.transactions += 1;
    }

    if (cardAmount > 0) {
      seed["Credit / Debit Card"].total += cardAmount;
      seed["Credit / Debit Card"].transactions += 1;
    }
  }

  const paymentPoints: PaymentPoint[] = [
    { method: "Cash", ...seed.Cash },
    { method: "QR", ...seed.QR },
    { method: "Credit / Debit Card", ...seed["Credit / Debit Card"] },
  ];

  const totalPaymentSales = paymentPoints.reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const totalPaymentTransactions = paymentPoints.reduce(
    (sum, item) => sum + item.transactions,
    0,
  );

  return {
    paymentPoints,
    totalPaymentSales,
    totalPaymentTransactions,
  };
};

const groupByStaff = (from: Date | null, to: Date | null) => {
  const staffMap = new Map<
    string,
    {
      sales: number;
      transactions: number;
      discountGiven: number;
      cost: number;
    }
  >();
  const receiptMap = new Map<
    string,
    { employee: string; hasProcessed: boolean }
  >();

  // First pass: collect receipt-level staff info
  for (const row of transactions) {
    if (!isTotalRow(row)) continue;
    const date = parseTime(row.Time);
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const receiptNum = getString(row["Receipt Number"]);
    const employee = getString(row.Employee);
    if (receiptNum && !receiptMap.has(receiptNum)) {
      receiptMap.set(receiptNum, {
        employee: employee || "",
        hasProcessed: false,
      });
    }
  }

  // Second pass: aggregate staff data with net sales and cost tracking
  for (const row of transactions) {
    if (!isItemRow(row)) continue;

    const date = parseTime(getString(row.Time));
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const receiptNum = getString(row["Receipt Number"]);
    const receiptData = receiptMap.get(receiptNum);
    if (!receiptData) continue;

    const employee = receiptData.employee;
    if (!employee) continue;

    const sku = getString(row.SKU);
    const quantity = getQuantity(row.Quantity);
    const subtotal = getAmount(row.SubTotal);
    const discount = Math.abs(getAmount(row.Discount));
    const netSales = subtotal - discount;

    const unitCost = getCost(sku, getString(row.Item));
    const totalCost = unitCost * quantity;

    if (!staffMap.has(employee)) {
      staffMap.set(employee, {
        sales: 0,
        transactions: 0,
        discountGiven: 0,
        cost: 0,
      });
    }

    const current = staffMap.get(employee)!;
    current.sales += netSales;
    current.cost += totalCost;
    current.discountGiven += discount;
  }

  // Third pass: count transactions per staff
  for (const row of transactions) {
    if (!isTotalRow(row)) continue;

    const date = parseTime(getString(row.Time));
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const employee = getString(row.Employee);
    if (!employee) continue;

    if (!staffMap.has(employee)) {
      staffMap.set(employee, {
        sales: 0,
        transactions: 0,
        discountGiven: 0,
        cost: 0,
      });
    }

    const current = staffMap.get(employee)!;
    current.transactions += 1;
  }

  const staffPoints: StaffPoint[] = Array.from(staffMap.entries())
    .map(([name, { sales, transactions, discountGiven, cost }]) => ({
      name,
      sales,
      transactions,
      discountGiven,
      cost,
      profit: sales - cost,
      margin: sales > 0 ? ((sales - cost) / sales) * 100 : 0,
    }))
    .sort((a, b) => b.sales - a.sales);

  return {
    staffPoints,
    totalStaffSales: staffPoints.reduce((sum, item) => sum + item.sales, 0),
    totalStaffTransactions: staffPoints.reduce(
      (sum, item) => sum + item.transactions,
      0,
    ),
    totalStaffDiscounts: staffPoints.reduce(
      (sum, item) => sum + item.discountGiven,
      0,
    ),
    totalStaffCost: staffPoints.reduce(
      (sum, item) => sum + (item.cost || 0),
      0,
    ),
    totalStaffProfit: staffPoints.reduce(
      (sum, item) => sum + (item.profit || 0),
      0,
    ),
  };
};

const groupBySupplier = (from: Date | null, to: Date | null) => {
  // Map to track data per supplier AND supply type combination
  const supplierTypeMap = new Map<
    string, // key: "supplier|supplyType"
    {
      supplier: string;
      supplyType: "Consignment" | "Outright";
      subtotal: number;
      total: number;
      quantity: number;
      cost: number;
    }
  >();

  // Aggregate suppliers with both subtotal and net sales
  for (const row of transactions) {
    if (!isItemRow(row)) continue;

    const date = parseTime(getString(row.Time));
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const subtotal = getAmount(row.SubTotal);
    const discount = Math.abs(getAmount(row.Discount));
    const netSales = subtotal - discount; // Net sales after discount
    const quantity = getQuantity(row.Quantity);
    const sku = getString(row.SKU);
    const name = getString(row.Item).trim(); // Trim whitespace

    // Find supplier from products data
    // Try matching by: 1) SKU, 2) exact product name, 3) trimmed product name, 4) case-insensitive name
    let product = sku && products.find((p) => p.SKU === sku);

    if (!product && name) {
      // Try exact name match
      product = products.find((p) => p["Product Name"] === name);
    }

    if (!product && name) {
      // Try trimmed name match
      product = products.find((p) => String(p["Product Name"]).trim() === name);
    }

    if (!product && name) {
      // Try case-insensitive name match as fallback
      product = products.find(
        (p) =>
          String(p["Product Name"]).toLowerCase().trim() === name.toLowerCase(),
      );
    }

    const supplierName = product ? getString(product.Supplier || "") : "";

    // Normalize supplier name to extract base name and supply type
    const { base: supplierBase, type: supplyTypeTag } =
      normalizeSupplier(supplierName);
    const displaySupplier =
      supplierBase && supplierBase.trim() ? supplierBase : "(No supplier)";

    // Determine supply type: if has Consignment tag, it's Consignment, otherwise Outright
    const supplyType: "Consignment" | "Outright" = supplyTypeTag.includes(
      "Consignment",
    )
      ? "Consignment"
      : "Outright";

    const unitCost = getCost(sku, name);
    const totalCost = unitCost * quantity;

    // Create unique key for supplier + supply type combination
    const key = `${displaySupplier}|${supplyType}`;

    if (!supplierTypeMap.has(key)) {
      supplierTypeMap.set(key, {
        supplier: displaySupplier,
        supplyType,
        subtotal: 0,
        total: 0,
        quantity: 0,
        cost: 0,
      });
    }

    const current = supplierTypeMap.get(key)!;
    current.subtotal += subtotal;
    current.total += netSales;
    current.quantity += quantity;
    current.cost += totalCost;
  }

  const suppliers: Array<{
    supplier: string;
    supplyType: "Consignment" | "Outright";
    subtotal: number;
    total: number;
    quantity: number;
    cost: number;
    profit: number;
    margin: number;
  }> = Array.from(supplierTypeMap.values())
    .map(({ supplier, supplyType, subtotal, total, quantity, cost }) => ({
      supplier,
      supplyType,
      subtotal,
      total,
      quantity,
      cost,
      profit: total - cost,
      margin: total > 0 ? ((total - cost) / total) * 100 : 0,
    }))
    .sort((a, b) => {
      // Sort by total sales (highest first)
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      // Then by supply type (Consignment first)
      return a.supplyType === "Consignment" ? -1 : 1;
    });

  return {
    suppliers,
    topSuppliers: suppliers.slice(0, 10),
    supplierCount: suppliers.length,
    totalSupplierUnits: suppliers.reduce((sum, item) => sum + item.quantity, 0),
    totalSupplierSales: suppliers.reduce((sum, item) => sum + item.total, 0),
    totalSupplierCost: suppliers.reduce(
      (sum, item) => sum + (item.cost || 0),
      0,
    ),
    totalSupplierProfit: suppliers.reduce(
      (sum, item) => sum + (item.profit || 0),
      0,
    ),
  };
};

// ─── component ───────────────────────────────────────────────────────────────

export default function SalesAssessmentClient() {
  const [activeTab, setActiveTab] = useState<ViewTab>("daily");
  const [preset, setPreset] = useState<Preset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [timeView, setTimeView] = useState<"hourly" | "daily">("hourly");
  const reportRef = useRef<HTMLDivElement>(null);

  const { from, to } = useMemo<{ from: Date | null; to: Date | null }>(() => {
    if (preset !== "custom") {
      const range = getPresetRange(preset);
      return { from: range?.from ?? null, to: range?.to ?? null };
    }
    return {
      from: customFrom ? fromInputDate(customFrom) : null,
      to: customTo
        ? new Date(fromInputDate(customTo).setHours(23, 59, 59, 999))
        : null,
    };
  }, [preset, customFrom, customTo]);

  const {
    daily,
    dayCount,
    transactionCount: dailyTransactionCount,
    totalSales: dailyTotalSales,
    totalCost: dailyTotalCost,
    totalProfit: dailyTotalProfit,
  } = useMemo(() => groupByDay(from, to), [from, to]);

  const { hourly, dateCount, transactionCount, totalSales } = useMemo(
    () => groupByHour(from, to),
    [from, to],
  );

  // Filter hourly data to show only operation hours (10 AM - 12 AM / 11 PM)
  const operationHourly = useMemo(() => {
    const START_HOUR = 10; // 10 AM
    const END_HOUR = 23; // 11 PM (includes 11 PM - 12 AM)
    return hourly.filter((h) => h.hour >= START_HOUR && h.hour <= END_HOUR);
  }, [hourly]);

  const { daysOfWeek } = useMemo(() => groupByDayOfWeek(from, to), [from, to]);

  const {
    products,
    topProducts,
    productCount,
    totalUnits,
    totalProductSales,
    totalProductCost,
    totalProductProfit,
  } = useMemo(() => groupByProduct(from, to), [from, to]);

  const { paymentPoints, totalPaymentSales, totalPaymentTransactions } =
    useMemo(() => groupByPaymentType(from, to), [from, to]);

  const {
    staffPoints,
    totalStaffSales,
    totalStaffTransactions,
    totalStaffCost,
    totalStaffProfit,
  } = useMemo(() => groupByStaff(from, to), [from, to]);

  const {
    suppliers,
    topSuppliers,
    supplierCount,
    totalSupplierUnits,
    totalSupplierSales,
    totalSupplierCost,
    totalSupplierProfit,
  } = useMemo(() => groupBySupplier(from, to), [from, to]);

  const presets: { id: Preset; label: string }[] = [
    { id: "all", label: "All time" },
    { id: "this-month", label: "This month" },
    { id: "last-month", label: "Last month" },
    { id: "custom", label: "Custom range" },
  ];

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;

    try {
      setIsExporting(true);
      await new Promise((resolve) => setTimeout(resolve, 80));

      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const element = reportRef.current;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const imageData = await toPng(element, {
        cacheBust: true,
        pixelRatio,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      const image = new Image();
      image.src = imageData;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(new Error("Failed to render report image"));
      });

      const imageHeight = (image.height * contentWidth) / image.width;
      let remainingHeight = imageHeight;
      let imagePosition = margin;

      pdf.addImage(
        imageData,
        "PNG",
        margin,
        imagePosition,
        contentWidth,
        imageHeight,
      );
      remainingHeight -= contentHeight;

      while (remainingHeight > 0) {
        pdf.addPage();
        imagePosition = margin - (imageHeight - remainingHeight);
        pdf.addImage(
          imageData,
          "PNG",
          margin,
          imagePosition,
          contentWidth,
          imageHeight,
        );
        remainingHeight -= contentHeight;
      }

      const fromText = from ? from.toISOString().slice(0, 10) : "all-start";
      const toText = to ? to.toISOString().slice(0, 10) : "all-end";
      pdf.save(`sales-${activeTab}-${fromText}-to-${toText}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isExporting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {isExporting ? "Preparing PDF..." : "Download PDF (A4)"}
        </button>
      </div>

      <div ref={reportRef} className="rounded-xl bg-white p-6 sm:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-foreground">
            Sales Assessment
          </h1>
          <p className="mt-2 text-sm text-gray-600 max-w-3xl">
            Hourly overview for main sales transaction rows. Filter by date
            range to narrow the report.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm mb-8">
          <p className="text-sm font-medium text-gray-700 mb-3">Date range</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {presets.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPreset(id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                  preset === id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">
                  From
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  max={customTo || toInputDate(new Date())}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  min={customFrom}
                  max={toInputDate(new Date())}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              {(customFrom || customTo) && (
                <button
                  onClick={() => {
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                  className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {(from || to) && (
            <p className="mt-3 text-xs text-gray-400">
              Showing:{" "}
              <span className="text-gray-600 font-medium">
                {from?.toLocaleDateString("en-MY", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }) ?? "—"}
              </span>
              {" → "}
              <span className="text-gray-600 font-medium">
                {to?.toLocaleDateString("en-MY", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }) ?? "—"}
              </span>
            </p>
          )}
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              activeTab === "daily"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            Daily sales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("time")}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              activeTab === "time"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            Sales by time
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              activeTab === "products"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            Sales by products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              activeTab === "payments"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            Payment type
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              activeTab === "staff"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            Staff performance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("supplier")}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              activeTab === "supplier"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            Sales by supplier
          </button>
        </div>

        {activeTab === "daily" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-5 mb-8">
              {[
                { label: "Total days", value: formatNumber(dayCount) },
                {
                  label: "Transactions",
                  value: formatNumber(dailyTransactionCount),
                },
                {
                  label: "Total sales",
                  value: `RM ${formatCurrency(dailyTotalSales)}`,
                },
                {
                  label: "Total cost",
                  value: `RM ${formatCurrency(dailyTotalCost)}`,
                },
                {
                  label: "Total profit",
                  value: `RM ${formatCurrency(dailyTotalProfit)}`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border bg-white p-5 shadow-sm"
                >
                  <div className="text-sm font-medium text-gray-500">
                    {label}
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-1">
                Daily sales chart
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Total sales RM by date across the selected period.
              </p>
              <SalesBarChart
                data={daily.map((d) => ({
                  ...d,
                  hour: 0,
                  label: d.label,
                }))}
              />
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-foreground mb-1">
                Daily breakdown
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Detailed sales, cost, and profit per day.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Opening</th>
                      <th className="px-4 py-3 font-medium">Closing</th>
                      <th className="px-4 py-3 font-medium">First Txn</th>
                      <th className="px-4 py-3 font-medium">Last Txn</th>
                      <th className="px-4 py-3 font-medium">Transactions</th>
                      <th className="px-4 py-3 font-medium">Sales RM</th>
                      <th className="px-4 py-3 font-medium">Cost RM</th>
                      <th className="px-4 py-3 font-medium">Profit RM</th>
                      <th className="px-4 py-3 font-medium">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {daily.map(
                      ({
                        date,
                        openingTime,
                        closingTime,
                        firstTxnHour,
                        lastTxnHour,
                        transactions,
                        total,
                        cost,
                        profit,
                        margin,
                      }) => (
                        <tr key={date} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {date}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {openingTime || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {closingTime || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {firstTxnHour || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {lastTxnHour || "-"}
                          </td>
                          <td className="px-4 py-3">{transactions}</td>
                          <td className="px-4 py-3">
                            RM {formatCurrency(total)}
                          </td>
                          <td className="px-4 py-3">
                            RM {formatCurrency(cost)}
                          </td>
                          <td className="px-4 py-3 font-medium text-green-600">
                            RM {formatCurrency(profit)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {margin.toFixed(1)}%
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : activeTab === "time" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3 mb-8">
              {[
                { label: "Trading days", value: formatNumber(dateCount) },
                {
                  label: "Transactions",
                  value: formatNumber(transactionCount),
                },
                {
                  label: "Total sales",
                  value: `RM ${formatCurrency(totalSales)}`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border bg-white p-5 shadow-sm"
                >
                  <div className="text-sm font-medium text-gray-500">
                    {label}
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            {hourly.length === 0 ? (
              <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
                <p className="text-sm text-gray-500">
                  No transactions found for the selected date range.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex gap-3">
                  <button
                    onClick={() => setTimeView("hourly")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      timeView === "hourly"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    By Hour
                  </button>
                  <button
                    onClick={() => setTimeView("daily")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      timeView === "daily"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    By Day of Week
                  </button>
                </div>

                {timeView === "hourly" ? (
                  <>
                    <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
                      <h2 className="text-xl font-semibold text-foreground mb-1">
                        Sales by hour — bar chart
                      </h2>
                      <p className="text-sm text-gray-500 mb-6">
                        Total RM and number of transactions per hour (10 AM - 12
                        AM).
                      </p>
                      <SalesBarChart data={operationHourly} />
                    </div>

                    <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
                      <h2 className="text-xl font-semibold text-foreground mb-1">
                        Sales trend — line chart
                      </h2>
                      <p className="text-sm text-gray-500 mb-6">
                        Sales RM across hours of operation (10 AM - 12 AM).
                      </p>
                      <SalesLineChart data={operationHourly} />
                    </div>

                    <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
                      <h2 className="text-xl font-semibold text-foreground mb-1">
                        Hourly trend by day
                      </h2>
                      <p className="text-sm text-gray-500 mb-6">
                        Sales trend for each day of the week showing peak hours
                        and patterns. All charts use the same hour range labels
                        (e.g., 11am-12pm, 12pm-1pm) for easy comparison.
                      </p>
                      <DayOfWeekTrendCharts data={daysOfWeek} />
                    </div>

                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-foreground mb-1">
                        Hourly breakdown
                      </h2>
                      <p className="text-sm text-gray-500 mb-4">
                        Detailed totals per hour slot.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                          <thead className="bg-gray-50 text-gray-700">
                            <tr>
                              <th className="px-4 py-3 font-medium">
                                Hour range
                              </th>
                              <th className="px-4 py-3 font-medium">
                                Transactions
                              </th>
                              <th className="px-4 py-3 font-medium">Trans %</th>
                              <th className="px-4 py-3 font-medium">
                                Sales RM
                              </th>
                              <th className="px-4 py-3 font-medium">
                                Avg / transaction
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {operationHourly.map(
                              ({ hour, label, total, transactions }) => (
                                <tr key={hour} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                    {label}
                                  </td>
                                  <td className="px-4 py-3">{transactions}</td>
                                  <td className="px-4 py-3 text-amber-600 font-medium">
                                    {transactionCount > 0
                                      ? (
                                          (transactions / transactionCount) *
                                          100
                                        ).toFixed(1)
                                      : "0.0"}
                                    %
                                  </td>
                                  <td className="px-4 py-3">
                                    RM {formatCurrency(total)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-500">
                                    RM {formatCurrency(total / transactions)}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
                      <h2 className="text-xl font-semibold text-foreground mb-1">
                        Sales by day of week
                      </h2>
                      <p className="text-sm text-gray-500 mb-6">
                        Total RM and transactions by day of the week showing
                        trends.
                      </p>
                      <SalesByDayOfWeekChart data={daysOfWeek} />
                    </div>

                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-foreground mb-1">
                        Day of week breakdown
                      </h2>
                      <p className="text-sm text-gray-500 mb-4">
                        Sales totals and hourly patterns per day.
                      </p>
                      <div className="space-y-6">
                        {daysOfWeek.map(
                          ({
                            dayName,
                            total,
                            transactions,
                            hourlyBreakdown,
                          }) => (
                            <div
                              key={dayName}
                              className="border-t pt-6 first:border-t-0 first:pt-0"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900">
                                  {dayName}
                                </h3>
                                <div className="flex gap-6 text-sm">
                                  <div>
                                    <span className="text-gray-500">
                                      Sales:
                                    </span>{" "}
                                    <span className="font-medium">
                                      RM {formatCurrency(total)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">
                                      Transactions:
                                    </span>{" "}
                                    <span className="font-medium">
                                      {formatNumber(transactions)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                                  <thead className="bg-gray-50 text-gray-700">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">
                                        Hour
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Transactions
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Sales RM
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {hourlyBreakdown.map(
                                      ({
                                        hour,
                                        label,
                                        total: hourTotal,
                                        transactions: hourTx,
                                      }) => (
                                        <tr
                                          key={hour}
                                          className="hover:bg-gray-50"
                                        >
                                          <td className="px-3 py-2 text-gray-900">
                                            {label}
                                          </td>
                                          <td className="px-3 py-2">
                                            {hourTx}
                                          </td>
                                          <td className="px-3 py-2">
                                            RM {formatCurrency(hourTotal)}
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        ) : activeTab === "products" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-4 mb-8">
              {[
                { label: "Products sold", value: formatNumber(productCount) },
                { label: "Units sold", value: formatNumber(totalUnits) },
                {
                  label: "Product sales",
                  value: `RM ${formatCurrency(totalProductSales)}`,
                },
                {
                  label: "Total cost",
                  value: `RM ${formatCurrency(totalProductCost || 0)}`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border bg-white p-5 shadow-sm"
                >
                  <div className="text-sm font-medium text-gray-500">
                    {label}
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            {totalProductCost !== undefined &&
              totalProductProfit !== undefined && (
                <div className="grid gap-4 sm:grid-cols-2 mb-8">
                  {[
                    {
                      label: "Total profit",
                      value: `RM ${formatCurrency(totalProductProfit)}`,
                      color:
                        totalProductProfit >= 0
                          ? "text-green-600"
                          : "text-red-600",
                    },
                    {
                      label: "Profit margin",
                      value:
                        totalProductSales > 0
                          ? `${((totalProductProfit / totalProductSales) * 100).toFixed(1)}%`
                          : "0%",
                      color: "text-blue-600",
                    },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="rounded-lg border bg-white p-5 shadow-sm"
                    >
                      <div className="text-sm font-medium text-gray-500">
                        {label}
                      </div>
                      <div className={`mt-3 text-2xl font-semibold ${color}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {products.length === 0 ? (
              <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
                <p className="text-sm text-gray-500">
                  No product sales found for the selected date range.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    Top products by sales
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">
                    Highest grossing products in the selected range.
                  </p>
                  <ProductSalesBarChart data={topProducts} />
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    Product breakdown
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Quantity and sales by product.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-4 py-3 font-medium">Product</th>
                          <th className="px-4 py-3 font-medium">Units</th>
                          <th className="px-4 py-3 font-medium">Sales RM</th>
                          <th className="px-4 py-3 font-medium">Cost RM</th>
                          <th className="px-4 py-3 font-medium">Profit RM</th>
                          <th className="px-4 py-3 font-medium">Margin %</th>
                          <th className="px-4 py-3 font-medium">
                            Avg unit price
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {products.map(
                          ({
                            name,
                            quantity,
                            total,
                            cost = 0,
                            profit = 0,
                            margin = 0,
                          }) => (
                            <tr key={name} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {name}
                              </td>
                              <td className="px-4 py-3">{quantity}</td>
                              <td className="px-4 py-3">
                                RM {formatCurrency(total)}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                RM {formatCurrency(cost)}
                              </td>
                              <td
                                className={`px-4 py-3 font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                RM {formatCurrency(profit)}
                              </td>
                              <td className="px-4 py-3 text-blue-600">
                                {margin.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                RM{" "}
                                {formatCurrency(
                                  quantity > 0 ? total / quantity : 0,
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        ) : activeTab === "payments" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-4 mb-8">
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-500">Cash</div>
                <div className="mt-3 text-2xl font-semibold">
                  RM {formatCurrency(paymentPoints[0].total)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {formatNumber(paymentPoints[0].transactions)} transactions
                </div>
              </div>
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-500">QR</div>
                <div className="mt-3 text-2xl font-semibold">
                  RM {formatCurrency(paymentPoints[1].total)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {formatNumber(paymentPoints[1].transactions)} transactions
                </div>
              </div>
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-500">
                  Credit / Debit Card
                </div>
                <div className="mt-3 text-2xl font-semibold">
                  RM {formatCurrency(paymentPoints[2].total)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {formatNumber(paymentPoints[2].transactions)} transactions
                </div>
              </div>
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-500">
                  Total paid
                </div>
                <div className="mt-3 text-2xl font-semibold">
                  RM {formatCurrency(totalPaymentSales)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {formatNumber(totalPaymentTransactions)} payment entries
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-1">
                Sales by payment method
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Cash, QR, and credit/debit card totals in selected date range.
              </p>
              <PaymentTypeBarChart data={paymentPoints} />
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-foreground mb-1">
                Payment breakdown
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Detailed totals and transaction counts per payment method.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">Payment type</th>
                      <th className="px-4 py-3 font-medium">Transactions</th>
                      <th className="px-4 py-3 font-medium">Sales RM</th>
                      <th className="px-4 py-3 font-medium">Avg per txn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paymentPoints.map(({ method, transactions, total }) => (
                      <tr key={method} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {method}
                        </td>
                        <td className="px-4 py-3">
                          {formatNumber(transactions)}
                        </td>
                        <td className="px-4 py-3">
                          RM {formatCurrency(total)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          RM{" "}
                          {formatCurrency(
                            transactions > 0 ? total / transactions : 0,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : activeTab === "staff" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-4 mb-8">
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-500">
                  Staff count
                </div>
                <div className="mt-3 text-2xl font-semibold">
                  {formatNumber(staffPoints.length)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Total staff members
                </div>
              </div>
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-500">
                  Total sales
                </div>
                <div className="mt-3 text-2xl font-semibold">
                  RM {formatCurrency(totalStaffSales)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {formatNumber(totalStaffTransactions)} transactions
                </div>
              </div>
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-500">
                  Total cost
                </div>
                <div className="mt-3 text-2xl font-semibold">
                  RM {formatCurrency(totalStaffCost || 0)}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  COGS for period
                </div>
              </div>
              <div className="rounded-lg border bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-gray-500">
                  Total profit
                </div>
                <div
                  className={`mt-3 text-2xl font-semibold ${(totalStaffProfit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  RM {formatCurrency(totalStaffProfit || 0)}
                </div>
                <div className="mt-1 text-xs text-gray-500">After COGS</div>
              </div>
            </div>

            {staffPoints.length === 0 ? (
              <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
                <p className="text-sm text-gray-500">
                  No staff sales found for the selected date range.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    Staff sales performance
                  </h2>
                  <p className="text-sm text-gray-500 mb-6">
                    Total sales per staff member.
                  </p>
                  <StaffSalesBarChart data={staffPoints} />
                </div>

                <div className="rounded-xl border bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    Staff breakdown
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Sales, transactions, and discounts per staff member.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="px-4 py-3 font-medium">
                            Staff member
                          </th>
                          <th className="px-4 py-3 font-medium">
                            Transactions
                          </th>
                          <th className="px-4 py-3 font-medium">Sales RM</th>
                          <th className="px-4 py-3 font-medium">Cost RM</th>
                          <th className="px-4 py-3 font-medium">Profit RM</th>
                          <th className="px-4 py-3 font-medium">Margin %</th>
                          <th className="px-4 py-3 font-medium">Discount %</th>
                          <th className="px-4 py-3 font-medium">Avg per txn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {staffPoints.map(
                          ({
                            name,
                            transactions,
                            sales,
                            discountGiven,
                            cost = 0,
                            profit = 0,
                            margin = 0,
                          }) => {
                            const grossSales = sales + discountGiven;
                            const discountPercentage =
                              grossSales > 0
                                ? (discountGiven / grossSales) * 100
                                : 0;
                            return (
                              <tr key={name} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {name}
                                </td>
                                <td className="px-4 py-3">
                                  {formatNumber(transactions)}
                                </td>
                                <td className="px-4 py-3">
                                  RM {formatCurrency(sales)}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  RM {formatCurrency(cost)}
                                </td>
                                <td
                                  className={`px-4 py-3 font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  RM {formatCurrency(profit)}
                                </td>
                                <td className="px-4 py-3 text-blue-600">
                                  {margin.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-gray-500">
                                  {discountPercentage.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-gray-500">
                                  RM{" "}
                                  {formatCurrency(
                                    transactions > 0 ? sales / transactions : 0,
                                  )}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-5 mb-8">
              {[
                { label: "Suppliers", value: formatNumber(supplierCount) },
                {
                  label: "Total units",
                  value: formatNumber(totalSupplierUnits),
                },
                {
                  label: "Total sales",
                  value: `RM ${formatCurrency(totalSupplierSales)}`,
                },
                {
                  label: "Total cost",
                  value: `RM ${formatCurrency(totalSupplierCost || 0)}`,
                },
                {
                  label: "Total profit",
                  value: `RM ${formatCurrency(totalSupplierProfit || 0)}`,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border bg-white p-5 shadow-sm"
                >
                  <div className="text-sm font-medium text-gray-500">
                    {label}
                  </div>
                  <div className="mt-3 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-1">
                Sales by supplier — top 10
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Highest performing suppliers by sales volume.
              </p>
              <ProductSalesBarChart
                data={topSuppliers.map((s) => ({ name: s.supplier, ...s }))}
              />
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-foreground mb-1">
                All suppliers
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Complete supplier performance breakdown with sales, cost, and
                profit.
              </p>

              {/* Consignment suppliers */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Consignment Suppliers
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 font-medium">Supplier</th>
                        <th className="px-4 py-3 font-medium">Units</th>
                        <th className="px-4 py-3 font-medium">SubTotal RM</th>
                        <th className="px-4 py-3 font-medium">Total RM</th>
                        <th className="px-4 py-3 font-medium">Cost RM</th>
                        <th className="px-4 py-3 font-medium">Profit RM</th>
                        <th className="px-4 py-3 font-medium">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {suppliers
                        .filter((s) => s.supplyType === "Consignment")
                        .map(
                          ({
                            supplier,
                            quantity,
                            subtotal,
                            total,
                            cost,
                            profit,
                            margin,
                          }) => (
                            <tr key={supplier} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {supplier}
                              </td>
                              <td className="px-4 py-3">
                                {formatNumber(quantity)}
                              </td>
                              <td className="px-4 py-3">
                                RM {formatCurrency(subtotal)}
                              </td>
                              <td className="px-4 py-3">
                                RM {formatCurrency(total)}
                              </td>
                              <td className="px-4 py-3">
                                RM {formatCurrency(cost)}
                              </td>
                              <td className="px-4 py-3 font-medium text-green-600">
                                RM {formatCurrency(profit)}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {margin.toFixed(1)}%
                              </td>
                            </tr>
                          ),
                        )}
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-4 py-3">Consignment Subtotal</td>
                        <td className="px-4 py-3">
                          {formatNumber(
                            suppliers
                              .filter((s) => s.supplyType === "Consignment")
                              .reduce((sum, s) => sum + s.quantity, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          RM{" "}
                          {formatCurrency(
                            suppliers
                              .filter((s) => s.supplyType === "Consignment")
                              .reduce((sum, s) => sum + s.subtotal, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          RM{" "}
                          {formatCurrency(
                            suppliers
                              .filter((s) => s.supplyType === "Consignment")
                              .reduce((sum, s) => sum + s.total, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          RM{" "}
                          {formatCurrency(
                            suppliers
                              .filter((s) => s.supplyType === "Consignment")
                              .reduce((sum, s) => sum + s.cost, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          RM{" "}
                          {formatCurrency(
                            suppliers
                              .filter((s) => s.supplyType === "Consignment")
                              .reduce((sum, s) => sum + s.profit, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {(
                            (suppliers
                              .filter((s) => s.supplyType === "Consignment")
                              .reduce((sum, s) => sum + s.profit, 0) /
                              suppliers
                                .filter((s) => s.supplyType === "Consignment")
                                .reduce((sum, s) => sum + s.total, 0)) *
                            100
                          ).toFixed(1)}
                          %
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Outright suppliers */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Outright Suppliers
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 font-medium">Supplier</th>
                        <th className="px-4 py-3 font-medium">Units</th>
                        <th className="px-4 py-3 font-medium">SubTotal RM</th>
                        <th className="px-4 py-3 font-medium">Total RM</th>
                        <th className="px-4 py-3 font-medium">Cost RM</th>
                        <th className="px-4 py-3 font-medium">Profit RM</th>
                        <th className="px-4 py-3 font-medium">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {suppliers
                        .filter((s) => s.supplyType === "Outright")
                        .map(
                          ({
                            supplier,
                            quantity,
                            subtotal,
                            total,
                            cost,
                            profit,
                            margin,
                          }) => (
                            <tr key={supplier} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {supplier}
                              </td>
                              <td className="px-4 py-3">
                                {formatNumber(quantity)}
                              </td>
                              <td className="px-4 py-3">
                                RM {formatCurrency(subtotal)}
                              </td>
                              <td className="px-4 py-3">
                                RM {formatCurrency(total)}
                              </td>
                              <td className="px-4 py-3">
                                RM {formatCurrency(cost)}
                              </td>
                              <td className="px-4 py-3 font-medium text-green-600">
                                RM {formatCurrency(profit)}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {margin.toFixed(1)}%
                              </td>
                            </tr>
                          ),
                        )}
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-4 py-3">Outright Subtotal</td>
                        <td className="px-4 py-3">
                          {formatNumber(
                            suppliers
                              .filter((s) => s.supplyType === "Outright")
                              .reduce((sum, s) => sum + s.quantity, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          RM{" "}
                          {formatCurrency(
                            suppliers
                              .filter((s) => s.supplyType === "Outright")
                              .reduce((sum, s) => sum + s.subtotal, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          RM{" "}
                          {formatCurrency(
                            suppliers
                              .filter((s) => s.supplyType === "Outright")
                              .reduce((sum, s) => sum + s.total, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          RM{" "}
                          {formatCurrency(
                            suppliers
                              .filter((s) => s.supplyType === "Outright")
                              .reduce((sum, s) => sum + s.cost, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          RM{" "}
                          {formatCurrency(
                            suppliers
                              .filter((s) => s.supplyType === "Outright")
                              .reduce((sum, s) => sum + s.profit, 0),
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {suppliers
                            .filter((s) => s.supplyType === "Outright")
                            .reduce((sum, s) => sum + s.total, 0) > 0
                            ? (
                                (suppliers
                                  .filter((s) => s.supplyType === "Outright")
                                  .reduce((sum, s) => sum + s.profit, 0) /
                                  suppliers
                                    .filter((s) => s.supplyType === "Outright")
                                    .reduce((sum, s) => sum + s.total, 0)) *
                                100
                              ).toFixed(1)
                            : "0.0"}
                          %
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Grand Total */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Grand Total (All Suppliers)
                </h3>
                <div className="grid gap-4 sm:grid-cols-7">
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Units
                    </div>
                    <div className="text-xl font-semibold">
                      {formatNumber(
                        suppliers.reduce((sum, s) => sum + s.quantity, 0),
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      SubTotal RM
                    </div>
                    <div className="text-xl font-semibold">
                      {formatCurrency(
                        suppliers.reduce((sum, s) => sum + s.subtotal, 0),
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Total RM
                    </div>
                    <div className="text-xl font-semibold">
                      {formatCurrency(
                        suppliers.reduce((sum, s) => sum + s.total, 0),
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Cost RM
                    </div>
                    <div className="text-xl font-semibold">
                      {formatCurrency(
                        suppliers.reduce((sum, s) => sum + s.cost, 0),
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Profit RM
                    </div>
                    <div className="text-xl font-semibold text-green-600">
                      {formatCurrency(
                        suppliers.reduce((sum, s) => sum + s.profit, 0),
                      )}
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Margin %
                    </div>
                    <div className="text-xl font-semibold">
                      {suppliers.reduce((sum, s) => sum + s.total, 0) > 0
                        ? (
                            (suppliers.reduce((sum, s) => sum + s.profit, 0) /
                              suppliers.reduce((sum, s) => sum + s.total, 0)) *
                            100
                          ).toFixed(1)
                        : "0.0"}
                      %
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Discount RM
                    </div>
                    <div className="text-xl font-semibold text-orange-600">
                      {formatCurrency(
                        suppliers.reduce(
                          (sum, s) => sum + (s.subtotal - s.total),
                          0,
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
