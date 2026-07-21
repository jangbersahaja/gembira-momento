"use client";

import { CumulativeSalesChart } from "@/components/SalesChart";
import type { Role } from "@/lib/auth/roles";
import { useEffect, useMemo, useState } from "react";

type TimePeriod = "today" | "yesterday" | "week" | "month" | "custom";

interface TransactionMetrics {
  totalSales: number;
  totalTransactions: number;
  averageTransaction: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    qr: number;
  };
}

interface ComparisonMetrics {
  totalSalesChange: number;
  totalTransactionsChange: number;
  averageTransactionChange: number;
}

interface ProductSale {
  name: string;
  quantity: number;
  total: number;
  sku: string;
}

interface StaffSession {
  startTime: string;
  endTime: string | null;
}

interface StaffMember {
  name: string;
  status: "on-duty" | "off-duty";
  sessions: StaffSession[];
  totalHours?: number;
}

interface Transaction {
  Time: string;
  "Receipt Number": string;
  Item: string;
  SKU: string;
  Quantity: string;
  SubTotal: string;
  Cash: string;
  "Credit Card": string;
  "Debit Card": string;
  QR: string;
  Employee: string;
  Is_Cancelled: string;
}

// API Transaction structure
interface ApiTransaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  items: Array<{
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  total: number;
  paymentMethod: "cash" | "card" | "qr" | "other";
  status: "completed" | "cancelled" | "pending";
  employeeId?: string;
}

type TransactionData = Transaction | ApiTransaction; // Union type for both CSV and API data formats

function getPaymentLabel(method: ApiTransaction["paymentMethod"]): string {
  switch (method) {
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    case "qr":
      return "QR";
    default:
      return "Other";
  }
}

function getCsvPaymentLabel(t: Transaction): string {
  if (parseFloat(t.Cash || "0") > 0) return "Cash";
  if (parseFloat(t["Credit Card"] || "0") > 0) return "Credit Card";
  if (parseFloat(t["Debit Card"] || "0") > 0) return "Debit Card";
  if (parseFloat(t.QR || "0") > 0) return "QR";
  return "-";
}

interface Shift {
  "Open Time": string;
  "Close Time": string;
  "Open By": string;
  "Close By": string;
}

interface ApiShift {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: "scheduled" | "completed" | "cancelled";
}

type ShiftData = Shift | ApiShift;

export default function SalesDashboardClient({
  role,
}: {
  role?: Role | null;
} = {}) {
  const canViewPaymentBreakdown = role !== "STAFF" && role !== "SUPERVISOR";
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [customSingleDay, setCustomSingleDay] = useState<boolean>(true);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [historicalTransactions, setHistoricalTransactions] = useState<
    TransactionData[]
  >([]);
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [employees, setEmployees] = useState<Record<string, string>>({}); // Map of employeeId to name

  // Parse transaction data and get date
  const parseDate = (dateStr: string) => {
    const [date] = dateStr.split(" ");
    const [month, day, year] = date.split("/");
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };

  // Fetch data from APIs
  useEffect(() => {
    // For custom period, wait until both dates are picked before fetching
    if (timePeriod === "custom" && (!customStartDate || !customEndDate)) {
      return;
    }

    const fetchData = async () => {
      try {
        // Get today's date in Malaysia timezone (GMT+8)
        const utcNow = new Date();
        const malaysiaOffset = 8 * 60; // GMT+8 in minutes
        const utcOffset = utcNow.getTimezoneOffset(); // UTC offset in minutes
        const offsetDifference = malaysiaOffset + utcOffset; // Difference from system time
        const today = new Date(utcNow.getTime() + offsetDifference * 60 * 1000);

        // Reset to midnight in Malaysia timezone
        today.setHours(0, 0, 0, 0);

        // Calculate date range
        let startDate = new Date(today);
        let endDate = new Date(today);

        if (timePeriod === "custom") {
          // Custom: user-selected start/end dates (YYYY-MM-DD strings, parsed as local dates)
          const [sy, sm, sd] = customStartDate.split("-").map(Number);
          const [ey, em, ed] = customEndDate.split("-").map(Number);
          startDate = new Date(sy, sm - 1, sd);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(ey, em - 1, ed);
          endDate.setDate(endDate.getDate() + 1); // Include end date to buffer the query
          endDate.setHours(23, 59, 59, 999);
        } else if (timePeriod === "yesterday") {
          // Yesterday: full day, but query with buffer to +1 day for API compatibility
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1); // Include today to buffer the query
          endDate.setHours(23, 59, 59, 999);
        } else if (timePeriod === "week") {
          // Week: Monday to Sunday in Malaysia timezone
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday (0), go back 6 days, else go back (day-1) days
          startDate = new Date(today);
          startDate.setDate(today.getDate() - daysToMonday);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
        } else if (timePeriod === "month") {
          // Month: 1st to last day of month
          startDate = new Date(today);
          startDate.setDate(1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Today: full day, but query with buffer to +1 day for API compatibility
          startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(today);
          endDate.setDate(today.getDate() + 1); // Include tomorrow to buffer the query
          endDate.setHours(23, 59, 59, 999);
        }

        // Format dates for API (YYYY-MM-DD format)
        const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        const startStr = formatDate(startDate);
        const endStr = formatDate(endDate);

        // Fetch transactions
        const txRes = await fetch(
          `/api/storehub/transactions?startDate=${startStr}&endDate=${endStr}`,
        );
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData) ? txData : []);

        // Fetch timesheets instead of shifts (shifts endpoint doesn't exist in StoreHub API)
        try {
          const timesheetRes = await fetch(
            `/api/storehub/timesheets?from=${startStr}&to=${endStr}`,
          );
          const timesheetData = await timesheetRes.json();
          // Convert timesheets to shift-like format for compatibility
          if (Array.isArray(timesheetData)) {
            const shiftsFromTimesheets = timesheetData.map(
              (ts: Record<string, unknown>) => ({
                id: (ts.employeeId as string) + (ts.clockInTime as string),
                employeeId: ts.employeeId as string,
                date: startStr,
                startTime: ts.clockInTime as string,
                endTime: ts.clockOutTime as string,
                duration: 0,
                status: "completed" as const,
              }),
            );
            setShifts(shiftsFromTimesheets);
          } else {
            setShifts([]);
          }
        } catch (timesheetError) {
          console.warn("Timesheets fetch failed:", timesheetError);
          setShifts([]);
        }

        // Fetch employees
        try {
          const empRes = await fetch("/api/storehub/employees");
          const empData = await empRes.json();
          if (Array.isArray(empData)) {
            const empMap: Record<string, string> = {};
            empData.forEach((emp: Record<string, unknown>) => {
              if (emp.id && emp.firstName) {
                empMap[emp.id as string] =
                  `${emp.firstName as string} ${(emp.lastName as string) || ""}`.trim();
              }
            });
            setEmployees(empMap);
          }
        } catch (empError) {
          console.warn("Employees endpoint not available:", empError);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [timePeriod, customStartDate, customEndDate]);

  // Fetch a historical baseline (last ~90 completed days) once, used to compute
  // the "average cumulative sales" comparison line. Excludes today since it's
  // incomplete and would skew the average.
  useEffect(() => {
    const fetchHistoricalBaseline = async () => {
      try {
        const utcNow = new Date();
        const malaysiaOffset = 8 * 60;
        const utcOffset = utcNow.getTimezoneOffset();
        const offsetDifference = malaysiaOffset + utcOffset;
        const today = new Date(utcNow.getTime() + offsetDifference * 60 * 1000);
        today.setHours(0, 0, 0, 0);

        const end = new Date(today);
        end.setDate(end.getDate() - 1); // exclude today (incomplete day)
        const start = new Date(end);
        start.setDate(start.getDate() - 89); // ~90 day baseline window

        const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        const res = await fetch(
          `/api/storehub/transactions?startDate=${formatDate(start)}&endDate=${formatDate(end)}`,
        );
        const data = await res.json();
        setHistoricalTransactions(Array.isArray(data) ? data : []);
      } catch (error) {
        console.warn("Failed to fetch historical baseline:", error);
        setHistoricalTransactions([]);
      }
    };

    fetchHistoricalBaseline();
  }, []);

  // Compute the display label for the currently selected time period
  const dateRangeLabel = useMemo(() => {
    // Get today's date in Malaysia timezone (GMT+8)
    const utcNow = new Date();
    const malaysiaOffset = 8 * 60;
    const utcOffset = utcNow.getTimezoneOffset();
    const offsetDifference = malaysiaOffset + utcOffset;
    const today = new Date(utcNow.getTime() + offsetDifference * 60 * 1000);
    today.setHours(0, 0, 0, 0);

    const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
      d.toLocaleDateString("en-MY", opts);

    if (timePeriod === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return fmt(yesterday, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    if (timePeriod === "week") {
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `${fmt(monday, { month: "short", day: "numeric" })} - ${fmt(sunday, { month: "short", day: "numeric", year: "numeric" })}`;
    }

    if (timePeriod === "month") {
      return fmt(today, { month: "long", year: "numeric" });
    }

    if (timePeriod === "custom") {
      if (!customStartDate || !customEndDate) {
        return "Select a date range";
      }
      const [sy, sm, sd] = customStartDate.split("-").map(Number);
      const [ey, em, ed] = customEndDate.split("-").map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      if (customStartDate === customEndDate) {
        return fmt(start, {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
      return `${fmt(start, { month: "short", day: "numeric" })} - ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}`;
    }

    // today
    return fmt(today, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [timePeriod, customStartDate, customEndDate]);

  // Helper to check if transaction is API format
  const isApiTransaction = (t: TransactionData): t is ApiTransaction =>
    "receiptNumber" in t && "paymentMethod" in t;

  // Helper to check if transaction is CSV format
  const isCsvTransaction = (t: TransactionData): t is Transaction =>
    "Time" in t && "Receipt Number" in t;

  // Helper to format ISO timestamp to readable format
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString("en-MY", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  };

  // Helper to format currency with thousand separators
  const formatCurrency = (amount: number): string => {
    return `RM${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Helper to check if shift is API format
  const isApiShift = (s: ShiftData): s is ApiShift =>
    "employeeId" in s && "duration" in s;

  // Helper to check if shift is CSV format
  const isCsvShift = (s: ShiftData): s is Shift =>
    "Open Time" in s && "Open By" in s;

  // Filter transactions based on time period
  const filteredTransactions = useMemo<TransactionData[]>(() => {
    if (!Array.isArray(transactions)) return [];

    // Get today's date in Malaysia timezone (GMT+8)
    const utcNow = new Date();
    const malaysiaOffset = 8 * 60; // GMT+8 in minutes
    const utcOffset = utcNow.getTimezoneOffset(); // UTC offset in minutes
    const offsetDifference = malaysiaOffset + utcOffset; // Difference from system time
    const today = new Date(utcNow.getTime() + offsetDifference * 60 * 1000);
    today.setHours(0, 0, 0, 0);

    // If API data structure
    if (transactions.length > 0 && isApiTransaction(transactions[0])) {
      const validTransactions = transactions.filter(
        (t) => isApiTransaction(t) && t.status !== "cancelled" && t.total > 0,
      );

      // Parse the API timestamp and filter by time period
      return validTransactions.filter((t) => {
        if (!isApiTransaction(t)) return false;
        try {
          const txDate = new Date(t.timestamp);
          // Convert to Malaysia timezone for comparison
          const txMalaysiaTime = new Date(
            txDate.getTime() + offsetDifference * 60 * 1000,
          );
          const txDateOnly = new Date(
            txMalaysiaTime.getFullYear(),
            txMalaysiaTime.getMonth(),
            txMalaysiaTime.getDate(),
          );
          const todayOnly = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          );

          if (timePeriod === "today") {
            return txDateOnly.getTime() === todayOnly.getTime();
          } else if (timePeriod === "yesterday") {
            const yesterday = new Date(todayOnly);
            yesterday.setDate(today.getDate() - 1);
            return txDateOnly.getTime() === yesterday.getTime();
          } else if (timePeriod === "week") {
            // Calculate week start (Monday) and end (Sunday)
            const dayOfWeek = today.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - daysToMonday);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            // Compare dates
            const weekStartOnly = new Date(
              weekStart.getFullYear(),
              weekStart.getMonth(),
              weekStart.getDate(),
            );
            const weekEndOnly = new Date(
              weekEnd.getFullYear(),
              weekEnd.getMonth(),
              weekEnd.getDate(),
            );
            return txDateOnly >= weekStartOnly && txDateOnly <= weekEndOnly;
          } else if (timePeriod === "month") {
            return (
              txMalaysiaTime.getFullYear() === today.getFullYear() &&
              txMalaysiaTime.getMonth() === today.getMonth()
            );
          } else if (timePeriod === "custom") {
            if (!customStartDate || !customEndDate) return false;
            const [sy, sm, sd] = customStartDate.split("-").map(Number);
            const [ey, em, ed] = customEndDate.split("-").map(Number);
            const customStart = new Date(sy, sm - 1, sd);
            const customEnd = new Date(ey, em - 1, ed);
            return txDateOnly >= customStart && txDateOnly <= customEnd;
          }
          return true;
        } catch {
          return false;
        }
      });
    }

    // Legacy CSV data structure
    let latestDate = new Date(2026, 4, 31);

    transactions.forEach((t) => {
      if (isCsvTransaction(t) && t.Time) {
        const txDate = parseDate(t.Time);
        if (txDate > latestDate) {
          latestDate = txDate;
        }
      }
    });

    const csvToday = latestDate;
    const start = new Date(csvToday);
    const end = new Date(csvToday);

    let startDate = start;
    let endDate = end;

    if (timePeriod === "today") {
      startDate = start;
      endDate = end;
    } else if (timePeriod === "week") {
      startDate = new Date(start);
      startDate.setDate(csvToday.getDate() - csvToday.getDay());
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      startDate = new Date(csvToday);
      startDate.setDate(1);
      endDate = new Date(csvToday);
      endDate.setDate(32);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
    }

    return transactions.filter((t) => {
      if (!isCsvTransaction(t) || !t.Time) return false;
      const txDate = parseDate(t.Time);
      return (
        txDate >= startDate &&
        txDate <= endDate &&
        t.Is_Cancelled === "False" &&
        t.Item !== ""
      );
    });
  }, [transactions, timePeriod, customStartDate, customEndDate]);

  // Calculate metrics
  const metrics = useMemo<TransactionMetrics>(() => {
    let cashSales = 0;
    let cardSales = 0;
    let qrSales = 0;

    filteredTransactions.forEach((t) => {
      if (isApiTransaction(t)) {
        if (t.paymentMethod === "cash") {
          cashSales += t.total;
        } else if (t.paymentMethod === "card") {
          cardSales += t.total;
        } else if (t.paymentMethod === "qr") {
          qrSales += t.total;
        }
      } else if (isCsvTransaction(t)) {
        if (t.Cash) cashSales += parseFloat(t.Cash || "0");
        if (t["Credit Card"]) cardSales += parseFloat(t["Credit Card"] || "0");
        if (t["Debit Card"]) cardSales += parseFloat(t["Debit Card"] || "0");
        if (t.QR) qrSales += parseFloat(t.QR || "0");
      }
    });

    const totalSales = cashSales + cardSales + qrSales;

    return {
      totalSales,
      totalTransactions: filteredTransactions.length,
      averageTransaction:
        filteredTransactions.length > 0
          ? totalSales / filteredTransactions.length
          : 0,
      paymentBreakdown: {
        cash: cashSales,
        card: cardSales,
        qr: qrSales,
      },
    };
  }, [filteredTransactions]);

  // Calculate previous period metrics for comparison
  const comparisonMetrics = useMemo<ComparisonMetrics>(() => {
    if (!Array.isArray(transactions)) {
      return {
        totalSalesChange: 0,
        totalTransactionsChange: 0,
        averageTransactionChange: 0,
      };
    }

    // Helper function to calculate metrics for a date range
    const calculateMetricsForPeriod = (
      txs: TransactionData[],
    ): TransactionMetrics => {
      let cashSales = 0;
      let cardSales = 0;
      let qrSales = 0;

      txs.forEach((t) => {
        if (isApiTransaction(t)) {
          if (t.paymentMethod === "cash") {
            cashSales += t.total;
          } else if (t.paymentMethod === "card") {
            cardSales += t.total;
          } else if (t.paymentMethod === "qr") {
            qrSales += t.total;
          }
        } else if (isCsvTransaction(t)) {
          if (t.Cash) cashSales += parseFloat(t.Cash || "0");
          if (t["Credit Card"])
            cardSales += parseFloat(t["Credit Card"] || "0");
          if (t["Debit Card"]) cardSales += parseFloat(t["Debit Card"] || "0");
          if (t.QR) qrSales += parseFloat(t.QR || "0");
        }
      });

      const totalSales = cashSales + cardSales + qrSales;
      return {
        totalSales,
        totalTransactions: txs.length,
        averageTransaction: txs.length > 0 ? totalSales / txs.length : 0,
        paymentBreakdown: { cash: cashSales, card: cardSales, qr: qrSales },
      };
    };

    // Get today's date in Malaysia timezone (GMT+8)
    const utcNow = new Date();
    const malaysiaOffset = 8 * 60;
    const utcOffset = utcNow.getTimezoneOffset();
    const offsetDifference = malaysiaOffset + utcOffset;
    const today = new Date(utcNow.getTime() + offsetDifference * 60 * 1000);
    today.setHours(0, 0, 0, 0);

    // Helper to filter transactions by date range
    const filterByDateRange = (
      startDate: Date,
      endDate: Date,
    ): TransactionData[] => {
      return transactions.filter((t) => {
        try {
          const txDate = new Date(isApiTransaction(t) ? t.timestamp : t.Time);
          const txMalaysiaTime = new Date(
            txDate.getTime() + offsetDifference * 60 * 1000,
          );
          const txDateOnly = new Date(
            txMalaysiaTime.getFullYear(),
            txMalaysiaTime.getMonth(),
            txMalaysiaTime.getDate(),
          );
          const startOnly = new Date(
            startDate.getFullYear(),
            startDate.getMonth(),
            startDate.getDate(),
          );
          const endOnly = new Date(
            endDate.getFullYear(),
            endDate.getMonth(),
            endDate.getDate(),
          );

          if (
            isApiTransaction(t) &&
            (t.status === "cancelled" || t.total <= 0)
          ) {
            return false;
          }
          if (isCsvTransaction(t) && t.Is_Cancelled === "True") {
            return false;
          }

          return txDateOnly >= startOnly && txDateOnly <= endOnly;
        } catch {
          return false;
        }
      });
    };

    let previousTxs: TransactionData[] = [];

    if (timePeriod === "today") {
      // Previous period: yesterday
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      previousTxs = filterByDateRange(yesterday, yesterday);
    } else if (timePeriod === "yesterday") {
      // Previous period: 2 days ago
      const dayBefore = new Date(today);
      dayBefore.setDate(today.getDate() - 2);
      previousTxs = filterByDateRange(dayBefore, dayBefore);
    } else if (timePeriod === "week") {
      // Previous period: last week (Monday-Sunday)
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - daysToMonday);

      const lastWeekEnd = new Date(currentWeekStart);
      lastWeekEnd.setDate(currentWeekStart.getDate() - 1);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);

      previousTxs = filterByDateRange(lastWeekStart, lastWeekEnd);
    } else if (timePeriod === "month") {
      // Previous period: last month
      const lastMonthStart = new Date(today);
      lastMonthStart.setDate(1);
      lastMonthStart.setMonth(today.getMonth() - 1);
      const lastMonthEnd = new Date(today);
      lastMonthEnd.setDate(0); // Last day of previous month

      previousTxs = filterByDateRange(lastMonthStart, lastMonthEnd);
    }

    const previousMetrics = calculateMetricsForPeriod(previousTxs);
    const currentMetrics = metrics;

    // Calculate percentage changes
    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current === 0 ? 0 : 100;
      return ((current - previous) / previous) * 100;
    };

    return {
      totalSalesChange: calcChange(
        currentMetrics.totalSales,
        previousMetrics.totalSales,
      ),
      totalTransactionsChange: calcChange(
        currentMetrics.totalTransactions,
        previousMetrics.totalTransactions,
      ),
      averageTransactionChange: calcChange(
        currentMetrics.averageTransaction,
        previousMetrics.averageTransaction,
      ),
    };
  }, [transactions, timePeriod, metrics]);

  // Get top products
  const topProducts = useMemo<ProductSale[]>(() => {
    const productMap = new Map<
      string,
      { quantity: number; total: number; name: string }
    >();

    filteredTransactions.forEach((t) => {
      if (isApiTransaction(t)) {
        t.items.forEach((item) => {
          const existing = productMap.get(item.sku) || {
            quantity: 0,
            total: 0,
            name: item.productName,
          };
          productMap.set(item.sku, {
            quantity: existing.quantity + item.quantity,
            total: existing.total + item.totalPrice,
            name: existing.name,
          });
        });
      } else if (isCsvTransaction(t) && t.Item && t.SKU) {
        const quantity = parseFloat(t.Quantity || "0");
        const total = parseFloat(t.SubTotal || "0");

        const existing = productMap.get(t.SKU) || {
          quantity: 0,
          total: 0,
          name: t.Item,
        };
        productMap.set(t.SKU, {
          quantity: existing.quantity + quantity,
          total: existing.total + total,
          name: existing.name,
        });
      }
    });

    return Array.from(productMap.entries())
      .map(([sku, data]) => ({
        sku,
        name: data.name,
        quantity: data.quantity,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredTransactions]);

  // Whether the currently selected period is effectively a single day.
  // Hourly cumulative comparisons only make sense for a single day; for
  // multi-day ranges (week/month/custom range) we fall back to a
  // day-by-day cumulative view instead.
  const isSingleDayView = useMemo(() => {
    if (timePeriod === "today" || timePeriod === "yesterday") return true;
    if (timePeriod === "custom") {
      return customSingleDay || customStartDate === customEndDate;
    }
    return false;
  }, [timePeriod, customSingleDay, customStartDate, customEndDate]);

  // Cumulative sales trend: actual running total vs an average baseline.
  // - Single day view: cumulative sales by hour vs the average cumulative
  //   sales at each hour, computed from the last ~90 days.
  // - Multi-day range view: cumulative sales by day vs the "expected" pace
  //   line built from the average daily sales over the last ~90 days.
  const cumulativeChartData = useMemo(() => {
    const malaysiaOffset = 8 * 60;
    const utcOffset = new Date().getTimezoneOffset();
    const offsetDifference = malaysiaOffset + utcOffset;

    const getAmount = (t: TransactionData): number => {
      if (isApiTransaction(t)) return t.total;
      if (isCsvTransaction(t)) return parseFloat(t.SubTotal || "0");
      return 0;
    };

    const getDateKeyAndHour = (
      t: TransactionData,
    ): { key: string; hour: number } | null => {
      try {
        if (isApiTransaction(t)) {
          const d = new Date(t.timestamp);
          const my = new Date(d.getTime() + offsetDifference * 60 * 1000);
          const key = `${my.getFullYear()}-${String(my.getMonth() + 1).padStart(2, "0")}-${String(my.getDate()).padStart(2, "0")}`;
          return { key, hour: my.getHours() };
        }
        if (isCsvTransaction(t)) {
          const d = parseDate(t.Time);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const timePart = t.Time.split(" ")[1];
          const hour = timePart ? parseInt(timePart.split(":")[0], 10) : 0;
          return { key, hour };
        }
      } catch {
        return null;
      }
      return null;
    };

    if (isSingleDayView) {
      const START_HOUR = 9;
      const END_HOUR = 23;

      // Actual hourly totals for the selected day
      const hourTotals = new Map<number, number>();
      filteredTransactions.forEach((t) => {
        const info = getDateKeyAndHour(t);
        if (!info) return;
        hourTotals.set(
          info.hour,
          (hourTotals.get(info.hour) || 0) + getAmount(t),
        );
      });

      // Historical per-day hourly cumulative totals, then averaged per hour
      const dayHourTotals = new Map<string, Map<number, number>>();
      historicalTransactions.forEach((t) => {
        const info = getDateKeyAndHour(t);
        if (!info) return;
        if (!dayHourTotals.has(info.key)) {
          dayHourTotals.set(info.key, new Map());
        }
        const m = dayHourTotals.get(info.key)!;
        m.set(info.hour, (m.get(info.hour) || 0) + getAmount(t));
      });

      const numDays = dayHourTotals.size || 1;
      const avgHourCumulativeSum = new Map<number, number>();
      dayHourTotals.forEach((hourMap) => {
        let cumulative = 0;
        for (let h = START_HOUR; h <= END_HOUR; h++) {
          cumulative += hourMap.get(h) || 0;
          avgHourCumulativeSum.set(
            h,
            (avgHourCumulativeSum.get(h) || 0) + cumulative,
          );
        }
      });

      let runningActual = 0;
      const data = [];
      for (let h = START_HOUR; h <= END_HOUR; h++) {
        runningActual += hourTotals.get(h) || 0;
        data.push({
          label: `${h.toString().padStart(2, "0")}:00`,
          actual: Math.round(runningActual * 100) / 100,
          average:
            Math.round(((avgHourCumulativeSum.get(h) || 0) / numDays) * 100) /
            100,
        });
      }

      return { mode: "hourly" as const, data };
    }

    // Multi-day range view: cumulative sales by day
    const dayTotals = new Map<string, number>();
    filteredTransactions.forEach((t) => {
      const info = getDateKeyAndHour(t);
      if (!info) return;
      dayTotals.set(info.key, (dayTotals.get(info.key) || 0) + getAmount(t));
    });
    const sortedDays = Array.from(dayTotals.keys()).sort();

    // Average daily sales from the historical baseline, used to build an
    // "expected pace" straight line for comparison
    const histDayTotals = new Map<string, number>();
    historicalTransactions.forEach((t) => {
      const info = getDateKeyAndHour(t);
      if (!info) return;
      histDayTotals.set(
        info.key,
        (histDayTotals.get(info.key) || 0) + getAmount(t),
      );
    });
    const histValues = Array.from(histDayTotals.values());
    const avgDailySales =
      histValues.length > 0
        ? histValues.reduce((a, b) => a + b, 0) / histValues.length
        : 0;

    let runningActual = 0;
    let runningAvg = 0;
    const data = sortedDays.map((key) => {
      runningActual += dayTotals.get(key) || 0;
      runningAvg += avgDailySales;
      const [y, m, d] = key.split("-").map(Number);
      const label = new Date(y, m - 1, d).toLocaleDateString("en-MY", {
        month: "short",
        day: "numeric",
      });
      return {
        label,
        actual: Math.round(runningActual * 100) / 100,
        average: Math.round(runningAvg * 100) / 100,
      };
    });

    return { mode: "daily" as const, data };
  }, [isSingleDayView, filteredTransactions, historicalTransactions]);

  // Get staff on duty
  const staffOnDuty = useMemo<StaffMember[]>(() => {
    if (!Array.isArray(shifts) || shifts.length === 0) {
      return [];
    }

    // API shifts structure
    if (shifts.length > 0 && isApiShift(shifts[0])) {
      const staffMap = new Map<
        string,
        { name: string; sessions: StaffSession[] }
      >();

      // Determine the target date(s) to filter by
      let targetDate: Date;
      let filterStartTime: string | null = null;
      let filterEndTime: string | null = null;

      if (timePeriod === "today" || timePeriod === "yesterday") {
        // Get today's or yesterday's date
        const utcNow = new Date();
        const malaysiaOffset = 8 * 60;
        const utcOffset = utcNow.getTimezoneOffset();
        const offsetDifference = malaysiaOffset + utcOffset;
        const today = new Date(utcNow.getTime() + offsetDifference * 60 * 1000);
        today.setHours(0, 0, 0, 0);

        if (timePeriod === "yesterday") {
          targetDate = new Date(today);
          targetDate.setDate(today.getDate() - 1);
        } else {
          targetDate = today;
        }

        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
        filterStartTime = `${dateStr}T00:00:00`;
        filterEndTime = `${dateStr}T23:59:59`;
      }

      shifts.forEach((shift) => {
        if (isApiShift(shift) && shift.employeeId) {
          // Filter by date if viewing today/yesterday
          if (filterStartTime && filterEndTime) {
            if (
              shift.startTime < filterStartTime ||
              shift.startTime > filterEndTime
            ) {
              return; // Skip shifts outside the target date
            }
          }

          const empName = employees[shift.employeeId] || shift.employeeId;
          const existing = staffMap.get(shift.employeeId);

          if (existing) {
            // Add session to existing staff member
            existing.sessions.push({
              startTime: shift.startTime,
              endTime: shift.endTime,
            });
          } else {
            // Create new staff member with first session
            staffMap.set(shift.employeeId, {
              name: empName,
              sessions: [
                {
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                },
              ],
            });
          }
        }
      });

      const result = Array.from(staffMap.values()).map((staff) => {
        // Calculate total hours for all sessions
        const totalHours = staff.sessions.reduce((sum, session) => {
          const start = new Date(session.startTime).getTime();
          const end = session.endTime
            ? new Date(session.endTime).getTime()
            : start;
          const hours = (end - start) / (1000 * 60 * 60);
          return sum + (hours > 0 ? hours : 0);
        }, 0);

        // Check if staff is currently active (has a session without endTime)
        const isCurrentlyActive = staff.sessions.some(
          (session) => !session.endTime,
        );

        return {
          ...staff,
          status: isCurrentlyActive ? "on-duty" : "off-duty",
          totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
        } as StaffMember;
      });

      return result;
    }

    // Legacy CSV data structure
    let latestDate = new Date(2026, 4, 31); // Default to May 31, 2026 if no data found

    shifts.forEach((s) => {
      if (isCsvShift(s) && s["Open Time"]) {
        const shiftDate = parseDate(s["Open Time"]);
        if (shiftDate > latestDate) {
          latestDate = shiftDate;
        }
      }
    });

    const today = latestDate;
    const start = new Date(today);
    const end = new Date(today);

    let startDate = start;
    let endDate = end;

    if (timePeriod === "today") {
      startDate = start;
      endDate = end;
    } else if (timePeriod === "week") {
      startDate = new Date(start);
      startDate.setDate(today.getDate() - today.getDay());
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      startDate = new Date(today);
      startDate.setDate(1);
      endDate = new Date(today);
      endDate.setDate(32);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
    }

    const staffMap = new Map<string, StaffMember>();

    if (Array.isArray(shifts)) {
      shifts.forEach((shift) => {
        if (isCsvShift(shift) && shift["Open Time"]) {
          const shiftDate = parseDate(shift["Open Time"]);
          if (shiftDate >= startDate && shiftDate <= endDate) {
            // Add opening staff
            if (shift["Open By"]) {
              const existing = staffMap.get(shift["Open By"]);
              if (existing) {
                existing.sessions.push({
                  startTime: shift["Open Time"],
                  endTime: shift["Close Time"],
                });
              } else {
                staffMap.set(shift["Open By"], {
                  name: shift["Open By"],
                  status: "on-duty",
                  sessions: [
                    {
                      startTime: shift["Open Time"],
                      endTime: shift["Close Time"],
                    },
                  ],
                });
              }
            }
            // Add closing staff
            if (shift["Close By"] && shift["Close By"] !== shift["Open By"]) {
              const existing = staffMap.get(shift["Close By"]);
              if (existing) {
                existing.sessions.push({
                  startTime: shift["Open Time"],
                  endTime: shift["Close Time"],
                });
              } else {
                staffMap.set(shift["Close By"], {
                  name: shift["Close By"],
                  status: "on-duty",
                  sessions: [
                    {
                      startTime: shift["Open Time"],
                      endTime: shift["Close Time"],
                    },
                  ],
                });
              }
            }
          }
        }
      });
    }

    const result = Array.from(staffMap.values()).map((staff) => {
      // Calculate total hours for all sessions
      const totalHours = staff.sessions.reduce((sum, session) => {
        const start = new Date(session.startTime).getTime();
        const end = session.endTime
          ? new Date(session.endTime).getTime()
          : start;
        const hours = (end - start) / (1000 * 60 * 60);
        return sum + (hours > 0 ? hours : 0);
      }, 0);

      // Check if staff is currently active (has a session without endTime)
      const isCurrentlyActive = staff.sessions.some(
        (session) => !session.endTime,
      );

      return {
        ...staff,
        status: isCurrentlyActive ? "on-duty" : "off-duty",
        totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
      } as StaffMember;
    });
    console.log("[staffOnDuty] CSV result:", result);
    return result;
  }, [shifts, timePeriod, employees]);

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      {/* Compact Header */}
      <div
        className="sticky z-40 bg-white border-b border-gray-200 shadow-sm"
        style={{ top: "var(--app-header-height, 64px)" }}
      >
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Sales Dashboard
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                {dateRangeLabel}
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              {/* Time Period Selector - Compact */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
                {(
                  ["today", "yesterday", "week", "month", "custom"] as const
                ).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    className={`px-2.5 md:px-3 py-1.5 rounded-md font-medium transition-all text-xs md:text-sm ${
                      timePeriod === period
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-white hover:text-gray-900"
                    }`}
                  >
                    {period === "yesterday"
                      ? "Yest."
                      : period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>

              {/* Custom Date Range Pickers */}
              {timePeriod === "custom" && (
                <div className="flex flex-col items-start md:items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomSingleDay(true);
                        if (customStartDate) setCustomEndDate(customStartDate);
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                        customSingleDay
                          ? "bg-orange-100 text-orange-700"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      Single date
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomSingleDay(false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                        !customSingleDay
                          ? "bg-orange-100 text-orange-700"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      Date range
                    </button>
                  </div>

                  {customSingleDay ? (
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setCustomEndDate(e.target.value);
                      }}
                      className="text-xs md:text-sm border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={customStartDate}
                        max={customEndDate || undefined}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="text-xs md:text-sm border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                      <span className="text-gray-400 text-xs">to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        min={customStartDate || undefined}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="text-xs md:text-sm border border-gray-300 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-6">
        {/* Key Metrics - Compact Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow">
            <p className="text-gray-500 text-xs font-medium mb-1">
              Total Sales
            </p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(metrics.totalSales)}
            </p>
            <p
              className={`text-xs font-semibold ${
                comparisonMetrics.totalSalesChange >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {comparisonMetrics.totalSalesChange >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(comparisonMetrics.totalSalesChange).toFixed(1)}%
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow">
            <p className="text-gray-500 text-xs font-medium mb-1">
              Avg. Transaction
            </p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
              {formatCurrency(metrics.averageTransaction)}
            </p>
            <p
              className={`text-xs font-semibold ${
                comparisonMetrics.averageTransactionChange >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {comparisonMetrics.averageTransactionChange >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(comparisonMetrics.averageTransactionChange).toFixed(1)}%
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow">
            <p className="text-gray-500 text-xs font-medium mb-1">
              Transactions
            </p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
              {metrics.totalTransactions}
            </p>
            <p
              className={`text-xs font-semibold ${
                comparisonMetrics.totalTransactionsChange >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {comparisonMetrics.totalTransactionsChange >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(comparisonMetrics.totalTransactionsChange).toFixed(1)}%
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow">
            <p className="text-gray-500 text-xs font-medium mb-1">
              Staff On Duty
            </p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 mb-1">
              {staffOnDuty.length}
            </p>
            <p className="text-xs text-gray-500">
              {staffOnDuty.filter((s) => s.status === "on-duty").length} active
            </p>
          </div>
        </div>

        {/* Payment Breakdown - Compact (hidden for Staff/Supervisor) */}
        {canViewPaymentBreakdown && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Payment Breakdown
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                <p className="text-gray-600 text-xs font-medium mb-1">Cash</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatCurrency(metrics.paymentBreakdown.cash)}
                </p>
              </div>

              <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                <p className="text-gray-600 text-xs font-medium mb-1">Card</p>
                <p className="text-lg font-bold text-green-900">
                  {formatCurrency(metrics.paymentBreakdown.card)}
                </p>
              </div>

              <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                <p className="text-gray-600 text-xs font-medium mb-1">
                  QR Code
                </p>
                <p className="text-lg font-bold text-purple-900">
                  {formatCurrency(metrics.paymentBreakdown.qr)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cumulative Sales Trend */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Cumulative Sales{" "}
            {cumulativeChartData.mode === "hourly" ? "by Hour" : "by Day"}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            {cumulativeChartData.mode === "hourly"
              ? "Running total for the selected day vs the average cumulative sales at each hour (based on the last ~90 days)"
              : "Running total across the selected period vs the expected pace based on average daily sales (last ~90 days). Note: for longer ranges this compares day-by-day totals, not hour-by-hour."}
          </p>
          {cumulativeChartData.data.length > 0 ? (
            <CumulativeSalesChart data={cumulativeChartData.data} />
          ) : (
            <p className="text-gray-400 text-center py-8 text-xs">
              Not enough data to build this chart
            </p>
          )}
        </div>

        {/* Products Sold */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Products Sold
          </h3>
          {topProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 max-h-96 overflow-y-auto pr-2">
              {(() => {
                const half = Math.ceil(topProducts.length / 2);
                const columns = [
                  topProducts.slice(0, half),
                  topProducts.slice(half),
                ];
                return columns.map((column, colIdx) => (
                  <div key={colIdx} className="space-y-2">
                    {column.map((product, i) => {
                      const idx = colIdx * half + i;
                      return (
                        <div
                          key={product.sku}
                          className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 hover:bg-gray-50 p-1.5 rounded transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 w-5 h-5 bg-orange-500 text-white rounded-full text-center text-xs font-bold">
                                {idx + 1}
                              </span>
                              <p className="font-medium text-gray-900 text-xs truncate">
                                {product.name}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {product.quantity.toFixed(0)} units
                            </p>
                          </div>
                          <div className="text-right ml-2 shrink-0">
                            <p className="font-semibold text-gray-900 text-xs">
                              {formatCurrency(product.total)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4 text-xs">
              No sales data
            </p>
          )}
        </div>

        {/* Staff On Duty */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Staff On Duty
          </h3>
          {staffOnDuty.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 max-h-80 overflow-y-auto pr-2">
              {staffOnDuty.map((staff) => {
                const isActive = staff.status === "on-duty";
                return (
                  <div
                    key={staff.name}
                    className={`flex items-center justify-between p-2 rounded-lg transition ${
                      isActive
                        ? "bg-green-50 border border-green-200"
                        : "bg-gray-50 border border-gray-200"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`shrink-0 w-4 h-4 rounded-full ${
                            isActive ? "bg-green-500" : "bg-gray-300"
                          }`}
                        />
                        <p className="font-medium text-gray-900 text-xs truncate">
                          {staff.name}
                        </p>
                        <span className="text-xs text-gray-500">
                          {staff.totalHours || 0}h
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 ml-1 ${
                        isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {isActive ? "Active" : "Off"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4 text-xs">No staff</p>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Recent Transactions
          </h3>
          {filteredTransactions.length > 0 ? (
            <>
              {/* Table view for desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">
                        Receipt #
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">
                        Time
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">
                        Product
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-700">
                        Qty
                      </th>
                      <th className="text-right px-3 py-2 font-semibold text-gray-700">
                        Amount
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">
                        Employee
                      </th>
                      {canViewPaymentBreakdown && (
                        <th className="text-left px-3 py-2 font-semibold text-gray-700">
                          Payment
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTransactions
                      .slice()
                      .reverse()
                      .slice(0, 15)
                      .map((t, idx) => {
                        if (isApiTransaction(t)) {
                          return t.items.map((item, itemIdx) => (
                            <tr
                              key={`${idx}-${itemIdx}`}
                              className="hover:bg-gray-50 transition"
                            >
                              <td className="px-3 py-2 font-mono text-gray-900">
                                {itemIdx === 0 ? t.receiptNumber : ""}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {itemIdx === 0
                                  ? formatTimestamp(t.timestamp)
                                  : ""}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {item.productName}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-600">
                                {item.quantity}
                              </td>
                              <td className="px-3 py-2 font-semibold text-gray-900 text-right">
                                {formatCurrency(item.totalPrice)}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {itemIdx === 0
                                  ? t.employeeId
                                    ? employees[t.employeeId] || t.employeeId
                                    : "-"
                                  : ""}
                              </td>
                              {canViewPaymentBreakdown && (
                                <td className="px-3 py-2 text-gray-600 capitalize">
                                  {itemIdx === 0
                                    ? getPaymentLabel(t.paymentMethod)
                                    : ""}
                                </td>
                              )}
                            </tr>
                          ));
                        } else if (isCsvTransaction(t)) {
                          return (
                            <tr
                              key={idx}
                              className="hover:bg-gray-50 transition"
                            >
                              <td className="px-3 py-2 font-mono text-gray-900">
                                {t["Receipt Number"]}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {formatTimestamp(t.Time)}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {t.Item || "-"}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-600">
                                {t.Quantity}
                              </td>
                              <td className="px-3 py-2 font-semibold text-gray-900 text-right">
                                {formatCurrency(parseFloat(t.SubTotal || "0"))}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {t.Employee}
                              </td>
                              {canViewPaymentBreakdown && (
                                <td className="px-3 py-2 text-gray-600 capitalize">
                                  {getCsvPaymentLabel(t)}
                                </td>
                              )}
                            </tr>
                          );
                        }
                      })}
                  </tbody>
                </table>
              </div>

              {/* Card view for mobile */}
              <div className="md:hidden space-y-2 max-h-96 overflow-y-auto">
                {filteredTransactions
                  .slice()
                  .reverse()
                  .slice(0, 15)
                  .map((t, idx) => {
                    if (isApiTransaction(t)) {
                      return (
                        <div
                          key={`api-${idx}`}
                          className="bg-gray-50 border border-gray-200 rounded p-2.5"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-xs font-mono text-gray-500">
                                #{t.receiptNumber}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {formatTimestamp(t.timestamp)}
                              </p>
                            </div>
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-semibold">
                              {formatCurrency(t.total)}
                            </span>
                          </div>

                          <div className="space-y-1 mb-2 border-t border-gray-200 pt-2">
                            {t.items.map((item, itemIdx) => (
                              <div key={itemIdx} className="text-xs">
                                <p className="text-gray-900 font-medium">
                                  {item.productName}
                                </p>
                                <p className="text-gray-500">
                                  {item.quantity}x{" "}
                                  {formatCurrency(item.unitPrice)}
                                </p>
                              </div>
                            ))}
                          </div>

                          <p className="text-xs text-gray-600 text-right border-t border-gray-200 pt-1">
                            {t.employeeId
                              ? employees[t.employeeId] || t.employeeId
                              : "-"}
                          </p>
                        </div>
                      );
                    } else if (isCsvTransaction(t)) {
                      return (
                        <div
                          key={`csv-${idx}`}
                          className="bg-gray-50 border border-gray-200 rounded p-2.5"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-xs font-mono text-gray-500">
                                #{t["Receipt Number"]}
                              </p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {formatTimestamp(t.Time)}
                              </p>
                            </div>
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-semibold">
                              {formatCurrency(parseFloat(t.SubTotal || "0"))}
                            </span>
                          </div>

                          <div className="border-t border-gray-200 pt-2 mb-2">
                            <p className="text-gray-900 font-medium text-xs">
                              {t.Item || "-"}
                            </p>
                            <p className="text-gray-600 text-xs">
                              Qty: {t.Quantity}
                            </p>
                          </div>

                          <p className="text-xs text-gray-600 text-right">
                            {t.Employee}
                          </p>
                        </div>
                      );
                    }
                  })}
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-center py-6 text-xs">
              No transactions
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
