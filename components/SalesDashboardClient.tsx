"use client";

import { useEffect, useMemo, useState } from "react";

type TimePeriod = "today" | "yesterday" | "week" | "month";

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
  endTime: string;
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

export default function SalesDashboardClient() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("today");
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
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

        if (timePeriod === "yesterday") {
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
  }, [timePeriod]);

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
  }, [transactions, timePeriod]);

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

  // Get staff on duty
  const staffOnDuty = useMemo<StaffMember[]>(() => {
    if (!Array.isArray(shifts) || shifts.length === 0) {
      return [];
    }

    // API shifts structure
    if (shifts.length > 0 && isApiShift(shifts[0])) {
      const staffMap = new Map<string, StaffMember>();

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
              status: "on-duty",
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
          const end = new Date(session.endTime).getTime();
          const hours = (end - start) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);

        return {
          ...staff,
          totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
        };
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
        const end = new Date(session.endTime).getTime();
        const hours = (end - start) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);

      return {
        ...staff,
        totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimals
      };
    });
    console.log("[staffOnDuty] CSV result:", result);
    return result;
  }, [shifts, timePeriod, employees]);

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header */}
      <div className="bg-linear-to-r from-orange-500 to-amber-500 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-bold text-white mb-2">
            Sales Dashboard
          </h1>
          <p className="text-orange-50">
            Monitor transactions, products sold, and staff on duty
          </p>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="mx-auto max-w-7xl px-6 py-8 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-gray-700">Time Period:</span>
          <div className="flex gap-2">
            {(["today", "yesterday", "week", "month"] as const).map(
              (period) => (
                <button
                  key={period}
                  onClick={() => setTimePeriod(period)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    timePeriod === period
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {period === "yesterday"
                    ? "Yesterday"
                    : period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-2">Total Sales</p>
            <p className="text-3xl font-bold text-blue-600">
              {formatCurrency(metrics.totalSales)}
            </p>
            <p
              className={`text-xs mt-2 font-semibold ${
                comparisonMetrics.totalSalesChange >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {comparisonMetrics.totalSalesChange >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(comparisonMetrics.totalSalesChange).toFixed(1)}% vs last
              period
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-2">Average Transaction</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(metrics.averageTransaction)}
            </p>
            <p
              className={`text-xs mt-2 font-semibold ${
                comparisonMetrics.averageTransactionChange >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {comparisonMetrics.averageTransactionChange >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(comparisonMetrics.averageTransactionChange).toFixed(1)}%
              vs last period
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-2">Transactions</p>
            <p className="text-3xl font-bold text-purple-600">
              {metrics.totalTransactions}
            </p>
            <p
              className={`text-xs mt-2 font-semibold ${
                comparisonMetrics.totalTransactionsChange >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {comparisonMetrics.totalTransactionsChange >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(comparisonMetrics.totalTransactionsChange).toFixed(1)}%
              vs last period
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
            <p className="text-gray-600 text-sm mb-2">Staff On Duty</p>
            <p className="text-3xl font-bold text-amber-600">
              {staffOnDuty.length}
            </p>
            <p className="text-xs text-gray-500 mt-2">Active staff members</p>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Payment Method Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-gray-600 text-sm mb-1">Cash</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.paymentBreakdown.cash)}
                </p>
              </div>
              <div className="text-3xl">💵</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-gray-600 text-sm mb-1">Card</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.paymentBreakdown.card)}
                </p>
              </div>
              <div className="text-3xl">💳</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-gray-600 text-sm mb-1">QR Code</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.paymentBreakdown.qr)}
                </p>
              </div>
              <div className="text-3xl">📱</div>
            </div>
          </div>
        </div>

        {/* Top Products and Staff */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Top Products */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Top Selling Products
            </h2>
            {topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map((product, idx) => (
                  <div
                    key={product.sku}
                    className="flex items-center justify-between border-b border-gray-200 pb-3 last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block w-6 h-6 bg-orange-500 text-white rounded-full text-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <p className="font-medium text-gray-900 text-sm">
                          {product.name}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        SKU: {product.sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {product.quantity.toFixed(0)} units
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatCurrency(product.total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No sales data available for this period
              </p>
            )}
          </div>

          {/* Staff On Duty */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Staff On Duty
            </h2>
            {staffOnDuty.length > 0 ? (
              <div className="space-y-3">
                {staffOnDuty.map((staff) => (
                  <div
                    key={staff.name}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">
                        ✓
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {staff.name}
                          </p>
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            {staff.totalHours || 0}h
                          </span>
                        </div>
                        {staff.sessions && staff.sessions.length > 0 && (
                          <div className="text-xs text-gray-500 space-y-1 mt-2">
                            {staff.sessions.map((session, idx) => (
                              <div key={idx}>
                                {formatTimestamp(session.startTime)} -{" "}
                                {formatTimestamp(session.endTime)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No staff recorded for this period
              </p>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Recent Transactions
          </h2>
          {filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">
                      Receipt #
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">
                      Time
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">
                      Product
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">
                      Qty
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900">
                      Employee
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions
                    .slice()
                    .reverse()
                    .map((t, idx) => {
                      if (isApiTransaction(t)) {
                        // Show each item as a separate row for multi-item transactions
                        return t.items.map((item, itemIdx) => (
                          <tr
                            key={`${idx}-${itemIdx}`}
                            className="border-b border-gray-200 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 font-mono text-gray-900">
                              {itemIdx === 0 ? t.receiptNumber : ""}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {itemIdx === 0
                                ? formatTimestamp(t.timestamp)
                                : ""}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {item.productName}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              {formatCurrency(item.totalPrice)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {itemIdx === 0
                                ? t.employeeId
                                  ? employees[t.employeeId] || t.employeeId
                                  : "-"
                                : ""}
                            </td>
                          </tr>
                        ));
                      } else if (isCsvTransaction(t)) {
                        return (
                          <tr
                            key={idx}
                            className="border-b border-gray-200 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 font-mono text-gray-900">
                              {t["Receipt Number"]}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {formatTimestamp(t.Time)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {t.Item || "-"}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {t.Quantity}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              {formatCurrency(parseFloat(t.SubTotal || "0"))}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {t.Employee}
                            </td>
                          </tr>
                        );
                      }
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No transactions available for this period
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
