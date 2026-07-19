"use client";

import { getAliasMultiplier, resolveCanonicalSku } from "@/lib/productAliases";
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
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
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
  if (!timeString) return null;
  try {
    const date = new Date(timeString);
    // `new Date("")` (or any unparseable string) doesn't throw - it silently
    // returns an "Invalid Date" object, which is truthy and would otherwise
    // slip past `!date` checks and poison downstream math with NaN (e.g. a
    // staff member still clocked in with no clock-out time recorded yet).
    if (Number.isNaN(date.getTime())) return null;
    return date;
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

// Shift "Open By"/"Close By" fields come with odd leading punctuation from
// the POS export (e.g. ". Putri", "_ Faris") - strip that off for display.
const cleanStaffName = (name: string): string => {
  if (!name) return "-";
  return name.replace(/^[^a-zA-Z]+/, "").trim() || name;
};

// Format a break duration in minutes/hours as a short readable string,
// e.g. "45 min" or "1.25 hrs".
const formatDuration = (hours: number): string => {
  if (hours <= 0) return "0 min";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(2)} hrs`;
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
  cumulativeRevenue: number;
  cumulativeProfit: number;
  dailyFixedCost: number;
  dailyNetProfit: number;
  cumulativeNetProfit: number;
  cumulativeCost: number;
  netProfitArea: number;
  areaBase: number;
  areaDiff: number;
}

interface SupplierRow {
  supplier: string;
  supplyType: "Consignment" | "Outright";
  quantity: number;
  sales: number;
  cost: number;
  profit: number;
}

interface CommissionRow {
  date: string;
  totalSales: number;
  eligibleSales: number;
  commission: number;
  staff: string[];
  perStaffAmount: number;
}

interface ShiftRow {
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string;
  rawHours: number;
  breakDeducted: number;
  paidHours: number;
  clockOutAdjusted: boolean;
}

interface BreakPeriod {
  start: string;
  end: string;
  hours: number;
}

interface GroupedShiftDay {
  date: string;
  segments: ShiftRow[];
  firstClockIn: string;
  lastClockOut: string;
  lastClockOutAdjusted: boolean;
  totalRawHours: number;
  totalBreakDeducted: number;
  totalPaidHours: number;
  breakHours: number;
  breaks: BreakPeriod[];
}

// Merge multiple same-day shift entries (e.g. clock-out/in for a break, or
// staff who clocked out/in again for a split shift) into a single row per
// day, using the time gap between segments as the break duration shown.
const groupShiftsByDate = (shifts: ShiftRow[]): GroupedShiftDay[] => {
  const byDate = new Map<string, ShiftRow[]>();
  for (const shift of shifts) {
    const list = byDate.get(shift.date) || [];
    list.push(shift);
    byDate.set(shift.date, list);
  }

  const grouped: GroupedShiftDay[] = [];
  for (const [date, segments] of byDate) {
    const sorted = segments
      .slice()
      .sort(
        (a, b) =>
          (parseTime(a.clockIn)?.getTime() || 0) -
          (parseTime(b.clockIn)?.getTime() || 0),
      );

    let breakHours = 0;
    const breaks: BreakPeriod[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const thisOut = parseTime(sorted[i].clockOut);
      const nextIn = parseTime(sorted[i + 1].clockIn);
      if (thisOut && nextIn) {
        const gapHours = Math.max(
          0,
          (nextIn.getTime() - thisOut.getTime()) / (1000 * 60 * 60),
        );
        breakHours += gapHours;
        breaks.push({
          start: sorted[i].clockOut,
          end: sorted[i + 1].clockIn,
          hours: gapHours,
        });
      }
    }

    grouped.push({
      date,
      segments: sorted,
      firstClockIn: sorted[0].clockIn,
      lastClockOut: sorted[sorted.length - 1].clockOut,
      lastClockOutAdjusted: sorted[sorted.length - 1].clockOutAdjusted,
      totalRawHours: sorted.reduce((sum, s) => sum + s.rawHours, 0),
      totalBreakDeducted: sorted.reduce((sum, s) => sum + s.breakDeducted, 0),
      totalPaidHours: sorted.reduce((sum, s) => sum + s.paidHours, 0),
      breakHours,
      breaks,
    });
  }

  grouped.sort((a, b) => a.date.localeCompare(b.date));
  return grouped;
};

interface SalaryBreakdown {
  basic: number;
  attendanceAllowance: number;
  performanceBonus: number;
  overtimePay: number;
}

interface CashMovementRow {
  date: string;
  openedBy: string;
  closedBy: string;
  openingAmount: number;
  cashSales: number;
  payIn: number;
  payOut: number;
  expectedDrawer: number;
  actualDrawer: number;
  overShort: number;
  closingBalance: number;
  bankTransfer: number;
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
  laborBreakdown: Record<
    string,
    {
      hours: number;
      cost: number;
      commission: number;
      total: number;
      salaryBreakdown?: SalaryBreakdown;
    }
  >;
  commissionRows: CommissionRow[];
  totalCommission: number;
  shiftsByEmployee: Record<string, ShiftRow[]>;
  rentalCost: number;
  gtoCost: number;
  utilitiesCost: number;
  marketingCost: number;
  claimCost: number;
  totalOperatingCost: number;
  totalExpenses: number;
  netProfit: number;
  breakEvenDate: string | null;
  daysToBreakEven: number | null;
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
  cashMovementRows: CashMovementRow[];
  cashMovementTotals: {
    openingAmount: number;
    cashSales: number;
    payIn: number;
    payOut: number;
    expectedDrawer: number;
    actualDrawer: number;
    overShort: number;
    bankTransfer: number;
  };
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
    commissionRows: [],
    totalCommission: 0,
    shiftsByEmployee: {},
    rentalCost: 1500,
    gtoCost: 0,
    utilitiesCost: 0,
    marketingCost: 0,
    claimCost: 0,
    totalOperatingCost: 0,
    totalExpenses: 0,
    netProfit: 0,
    breakEvenDate: null,
    daysToBreakEven: null,
    supplierRows: [],
    outrightTotals: { sales: 0, cost: 0, profit: 0 },
    consignmentTotals: { sales: 0, cost: 0, profit: 0 },
    topProducts: [],
    cashMovementRows: [],
    cashMovementTotals: {
      openingAmount: 0,
      cashSales: 0,
      payIn: 0,
      payOut: 0,
      expectedDrawer: 0,
      actualDrawer: 0,
      overShort: 0,
      bankTransfer: 0,
    },
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
  const productNameBySkuMap = new Map<string, string>();
  for (const p of staticProducts as any[]) {
    const sku = String(p["SKU"] || "");
    const name = String(p["Product Name"] || "").trim();
    const supplier = String(p["Supplier"] || "");
    if (sku) supplierBySkuMap.set(sku, supplier);
    if (name) supplierByNameMap.set(name, supplier);
    if (sku && name) productNameBySkuMap.set(sku, name);
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

  // Calculate labor cost from timesheets.
  // Default rate for part-time staff: RM8/hour. Full-timers (Faris, Putri)
  // have their own fixed/structured pay rules applied further below.
  const DEFAULT_HOURLY_RATE = 8;
  const laborMap = new Map<string, { hours: number; cost: number }>();

  // Some staff forget to clock out when closing, so their timesheet either
  // has no clock-out time, or shows a clock-out in the early hours of the
  // next day (non-operating hours, e.g. 1am-9am) - a sign they actually
  // clocked out much later than intended (or the system auto-recorded it
  // when they next clocked in). In those cases we fall back to that day's
  // shift Close Time (from shifts.ts) as the real end of the shift.
  const shiftCloseByDateMap = new Map<string, Date>();
  for (const shift of staticShifts as any[]) {
    const openTime = parseShiftDate(String(shift["Open Time"] || ""));
    const closeTime = parseShiftDate(String(shift["Close Time"] || ""));
    if (!openTime || !closeTime) continue;
    const dateKey = `${openTime.getFullYear()}-${String(openTime.getMonth() + 1).padStart(2, "0")}-${String(openTime.getDate()).padStart(2, "0")}`;
    shiftCloseByDateMap.set(dateKey, closeTime);
  }

  // Track which staff were on duty each day (from timesheets clock-ins),
  // used for splitting the daily sales commission.
  const staffByDateMap = new Map<string, Set<string>>();

  // Track every shift (clock-in/out, raw vs paid hours, break deduction
  // applied) per employee, used to render a daily shift table per staff.
  const shiftsByEmployee = new Map<string, ShiftRow[]>();

  // Track which Mon-Sat calendar days an employee actually worked,
  // bucketed by calendar week (Monday-start). Used for Putri's attendance
  // allowance (paid per fully-attended working week, independent of OT).
  const workDaysByEmployeeWeek = new Map<string, Map<string, Set<string>>>();
  // Track paid hours per employee per calendar day (month-scoped only),
  // used to compute Putri's daily overtime per the Employment Act 1955.
  const hoursByEmployeeDay = new Map<string, Map<string, number>>();
  const getWeekKey = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOfWeek = d.getDay(); // 0 (Sun) - 6 (Sat)
    const diffToMonday = (dayOfWeek + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  for (const timesheet of timesheets) {
    const clockIn = parseTime(timesheet.clockInTime);
    const rawClockOut = parseTime(timesheet.clockOutTime);

    if (!clockIn) continue;

    // Timesheets are fetched for a padded range (full Monday-Sunday weeks
    // overlapping the month) so weekly attendance is judged on complete
    // weeks even at the month boundary. Entries outside the actual
    // selected month still contribute to that week's attendance tracking
    // (for the allowance) but are excluded from month-scoped totals:
    // labor cost, the daily shift tables, staff-on-duty tracking, and
    // Putri's daily overtime (computed per calendar day within the
    // selected month only).
    const isInSelectedMonth =
      clockIn.getMonth() === month && clockIn.getFullYear() === year;

    // Detect a forgotten clock-out: either missing entirely, or recorded
    // in the early-morning non-operating window (1am-9am) on a later
    // calendar day than the clock-in - a telltale sign staff forgot to
    // clock out at actual closing time.
    const clockOutLooksForgotten =
      !rawClockOut ||
      (rawClockOut.getDate() !== clockIn.getDate() &&
        rawClockOut.getHours() >= 1 &&
        rawClockOut.getHours() < 9);

    let clockOut = rawClockOut;
    let clockOutAdjusted = false;
    if (clockOutLooksForgotten) {
      const shiftDateKey = `${clockIn.getFullYear()}-${String(clockIn.getMonth() + 1).padStart(2, "0")}-${String(clockIn.getDate()).padStart(2, "0")}`;
      const fallbackClose = shiftCloseByDateMap.get(shiftDateKey);
      if (fallbackClose) {
        clockOut = fallbackClose;
        clockOutAdjusted = true;
      }
    }

    if (!clockOut) continue;

    const rawHours =
      (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

    // Mandatory break policy: staff must clock out/in for their break.
    // When a shift is recorded as one straight block of 10+ hours (no
    // break clock-out/in found), we assume the break was skipped or
    // forgotten and deduct the required break time from paid hours:
    // 10+ hours straight -> deduct 1 hour, 12+ hours straight -> deduct 2
    // hours.
    const employeeId = timesheet.employeeId || "Unknown";
    const employeeName = employeeNameMap.get(employeeId) || employeeId;
    let breakDeduction = 0;
    if (rawHours >= 12) {
      breakDeduction = 2;
    } else if (rawHours >= 10) {
      breakDeduction = 1;
    }
    const hours = Math.max(0, rawHours - breakDeduction);

    // Always tally worked days into the employee's weekly attendance
    // bucket (even for padding days outside the selected month), so a
    // week's attendance is judged on the complete Monday-Sunday span. Her
    // rest day can fall on any day of the week (not fixed to Sunday), so
    // every worked day is tracked here - the "fully-attended" check later
    // simply looks for 6 worked days out of the week's 7 (i.e. every day
    // except her one rest day).
    const weekKey = getWeekKey(clockIn);
    const dutyDateKeyForWeek = `${clockIn.getFullYear()}-${String(clockIn.getMonth() + 1).padStart(2, "0")}-${String(clockIn.getDate()).padStart(2, "0")}`;
    if (hours > 0) {
      const weekWorkMap =
        workDaysByEmployeeWeek.get(employeeName) ||
        new Map<string, Set<string>>();
      const daySet = weekWorkMap.get(weekKey) || new Set<string>();
      daySet.add(dutyDateKeyForWeek);
      weekWorkMap.set(weekKey, daySet);
      workDaysByEmployeeWeek.set(employeeName, weekWorkMap);
    }

    // Everything below this point is month-scoped: labor cost, the daily
    // shift tables, staff-on-duty-per-day tracking, and Putri's daily
    // overtime should only reflect shifts that actually fall within the
    // selected month.
    if (!isInSelectedMonth) continue;

    const dutyDateKeyForShift = `${clockIn.getFullYear()}-${String(clockIn.getMonth() + 1).padStart(2, "0")}-${String(clockIn.getDate()).padStart(2, "0")}`;
    const employeeShifts = shiftsByEmployee.get(employeeName) || [];
    employeeShifts.push({
      employeeName,
      date: dutyDateKeyForShift,
      clockIn: timesheet.clockInTime,
      clockOut: clockOutAdjusted
        ? clockOut.toISOString()
        : timesheet.clockOutTime,
      rawHours,
      breakDeducted: breakDeduction,
      paidHours: hours,
      clockOutAdjusted,
    });
    shiftsByEmployee.set(employeeName, employeeShifts);

    const laborCost = hours * DEFAULT_HOURLY_RATE;

    const current = laborMap.get(employeeName) || { hours: 0, cost: 0 };
    current.hours += hours;
    current.cost += laborCost;
    laborMap.set(employeeName, current);

    // Track paid hours per calendar day (month-scoped), used for Putri's
    // daily overtime calculation (Employment Act 1955: OT is based on
    // hours beyond the normal daily hours, not a weekly bucket).
    const dayMap =
      hoursByEmployeeDay.get(employeeName) || new Map<string, number>();
    dayMap.set(
      dutyDateKeyForShift,
      (dayMap.get(dutyDateKeyForShift) || 0) + hours,
    );
    hoursByEmployeeDay.set(employeeName, dayMap);

    const dutyDateKey = `${clockIn.getFullYear()}-${String(clockIn.getMonth() + 1).padStart(2, "0")}-${String(clockIn.getDate()).padStart(2, "0")}`;
    const staffSet = staffByDateMap.get(dutyDateKey) || new Set<string>();
    staffSet.add(employeeName);
    staffByDateMap.set(dutyDateKey, staffSet);
  }

  const shiftsByEmployeeObj: Record<string, ShiftRow[]> = {};
  for (const [name, shifts] of shiftsByEmployee) {
    shiftsByEmployeeObj[name] = shifts
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  reportData.shiftsByEmployee = shiftsByEmployeeObj;

  // ─── Special payroll rules ──────────────────────────────────────────────
  // Faris is always a full-timer on a fixed salary (no OT, no commission).
  // Putri became a full-timer with the structured salary below starting
  // July 2026; before that (including June 2026 and earlier) she's paid as
  // a regular part-timer (RM8/hr, already the default applied above).
  const PUTRI_FULLTIME_EFFECTIVE_DATE = new Date(2026, 6, 1); // July 1, 2026
  const isPutriFulltimeMonth =
    new Date(year, month, 1) >= PUTRI_FULLTIME_EFFECTIVE_DATE;

  // Detailed salary breakdown (basic / allowance / bonus / OT) for
  // full-timers with structured pay, surfaced in the labor cost UI.
  const salaryBreakdownMap = new Map<string, SalaryBreakdown>();

  for (const [employeeName, data] of Array.from(laborMap.entries())) {
    if (/faris/i.test(employeeName)) {
      // Faris: fixed salary RM3200, no overtime, no commission - always.
      laborMap.set(employeeName, { hours: 0, cost: 3200 });
      salaryBreakdownMap.set(employeeName, {
        basic: 3200,
        attendanceAllowance: 0,
        performanceBonus: 0,
        overtimePay: 0,
      });
      for (const staffSet of staffByDateMap.values()) {
        staffSet.delete(employeeName);
      }
    } else if (/putri/i.test(employeeName) && isPutriFulltimeMonth) {
      // Putri: Basic RM1750/month, structured for shift-based retail work
      // under the Employment Act 1955 (monthly-rated employee):
      //  - Daily rate = Basic / 26
      //  - Hourly rate = Daily rate / normal daily hours (8, used only as
      //    the OT pay-rate divisor, not as a daily OT trigger - retail
      //    shifts vary in length by design, so OT is judged weekly).
      //  - Normal OT: hours beyond 45/week paid at 1.5x hourly rate. This
      //    matches EA 1955's weekly hour limit and fits shift rostering
      //    much better than a fixed daily-hours trigger (which would
      //    falsely flag every longer shift as OT even on an otherwise
      //    normal week).
      //  - Rest-day OT: on her designated rest day, the normal-hours
      //    portion is paid as half/full a day's wage (half a day's wage
      //    if she worked half a day or less, else a full day's wage),
      //    plus hours beyond the normal 8-hour day paid at 2x hourly
      //    rate. Rest-day hours are excluded from the weekly 45hr OT
      //    tally since they're compensated separately under this rule.
      //  - Statutory cap: max 104 OT hours counted per month.
      //
      // Putri's weekly rest day is not fixed to Sunday - she may choose
      // any day off. Per week, the rest day is determined as the last
      // unworked calendar day of that Monday-Sunday week (if she has more
      // than one day off, the EA treats the last one in the week as the
      // designated rest day; if she worked every day that week, Sunday is
      // used as the statutory default since a rest day must exist).
      // Plus a performance bonus (1% of revenue, floored, clamped
      // RM100-RM300) and a business-policy attendance allowance (RM50 per
      // fully-attended working week - independent of OT, since attendance
      // and overtime are different things).
      const BASIC_SALARY = 1750;
      const NORMAL_DAILY_HOURS = 8;
      const NORMAL_WEEKLY_HOURS = 45;
      const WAGE_DIVISOR_DAYS = 26;
      const MAX_MONTHLY_OT_HOURS = 104;
      const dailyRate = BASIC_SALARY / WAGE_DIVISOR_DAYS;
      const hourlyRate = dailyRate / NORMAL_DAILY_HOURS;

      const dayMap =
        hoursByEmployeeDay.get(employeeName) || new Map<string, number>();

      // Determine each week's rest day: for every week this employee has
      // at least one recorded day in, find which day-of-week (Mon=0 .. Sun=6)
      // was NOT worked, and use the latest such day in the week as the
      // rest day. Falls back to Sunday (6) if every day of the week was
      // worked.
      const weekWorkedDows = new Map<string, Set<number>>();
      for (const dateKey of dayMap.keys()) {
        const dateObj = new Date(dateKey + "T00:00:00");
        const wk = getWeekKey(dateObj);
        const dow = (dateObj.getDay() + 6) % 7; // remap Sun=0..Sat=6 -> Mon=0..Sun=6
        const set = weekWorkedDows.get(wk) || new Set<number>();
        set.add(dow);
        weekWorkedDows.set(wk, set);
      }
      const restDayByWeek = new Map<string, number>();
      for (const [wk, workedDows] of weekWorkedDows.entries()) {
        let restDow = 6; // default Sunday if every day worked
        for (let d = 6; d >= 0; d--) {
          if (!workedDows.has(d)) {
            restDow = d;
            break;
          }
        }
        restDayByWeek.set(wk, restDow);
      }

      // Bucket normal (non-rest-day) paid hours per week, and separately
      // accumulate rest-day pay per day (rest-day pay uses its own rule,
      // not the weekly 45hr threshold).
      const normalHoursByWeek = new Map<string, number>();
      let restDayPay = 0;
      for (const [dateKey, paidHoursForDay] of dayMap.entries()) {
        if (paidHoursForDay <= 0) continue;
        const dateObj = new Date(dateKey + "T00:00:00");
        const wk = getWeekKey(dateObj);
        const dow = (dateObj.getDay() + 6) % 7;
        const isRestDay = dow === (restDayByWeek.get(wk) ?? 6);
        if (isRestDay) {
          const normalPortion = Math.min(paidHoursForDay, NORMAL_DAILY_HOURS);
          const excessPortion = Math.max(
            0,
            paidHoursForDay - NORMAL_DAILY_HOURS,
          );
          const dayWagePay =
            normalPortion <= NORMAL_DAILY_HOURS / 2 ? dailyRate / 2 : dailyRate;
          restDayPay += dayWagePay + excessPortion * hourlyRate * 2;
        } else {
          normalHoursByWeek.set(
            wk,
            (normalHoursByWeek.get(wk) || 0) + paidHoursForDay,
          );
        }
      }

      // Weekly OT: hours beyond 45/week (excluding rest-day hours, which
      // are compensated separately above) paid at 1.5x hourly rate.
      let normalOtHours = 0;
      for (const weeklyHours of normalHoursByWeek.values()) {
        normalOtHours += Math.max(0, weeklyHours - NORMAL_WEEKLY_HOURS);
      }
      // Cap normal OT hours at the statutory monthly maximum (rest-day pay
      // is a separate entitlement and is not subject to this cap).
      const cappedOtHours = Math.min(normalOtHours, MAX_MONTHLY_OT_HOURS);
      const otPay = cappedOtHours * hourlyRate * 1.5 + restDayPay;

      // Attendance allowance: RM50 for each complete working week (6 days
      // worked out of 7, i.e. every day except her one rest day) whose
      // Monday falls in this month - avoids double-counting a week that
      // straddles two calendar months.
      const weekWorkMap =
        workDaysByEmployeeWeek.get(employeeName) ||
        new Map<string, Set<string>>();
      let attendanceAllowance = 0;
      for (const [weekKey, daySet] of weekWorkMap.entries()) {
        const [wYear, wMonth] = weekKey.split("-").map(Number);
        const weekBelongsToThisMonth = wYear === year && wMonth - 1 === month;
        if (!weekBelongsToThisMonth) continue;
        if (daySet.size >= 6) attendanceAllowance += 50;
      }

      if (data.hours > 0 || dayMap.size > 0) {
        const rawBonus = Math.floor(reportData.totalRevenue * 0.01);
        const performanceBonus = Math.min(300, Math.max(100, rawBonus));
        const totalCost =
          BASIC_SALARY + attendanceAllowance + performanceBonus + otPay;
        laborMap.set(employeeName, { hours: data.hours, cost: totalCost });
        salaryBreakdownMap.set(employeeName, {
          basic: BASIC_SALARY,
          attendanceAllowance,
          performanceBonus,
          overtimePay: otPay,
        });
      }
    }
  }

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

  // Cash drawer movement per shift (day): opening balance carried from the
  // previous day's takeout, cash sales taken in, staff pay-in/pay-out
  // entries (e.g. adding change or withdrawing cash to bank at end of
  // shift), and the resulting expected vs actual drawer counts.
  //
  // Build a lookup of every shift's closing balance across the ENTIRE
  // dataset (not just the selected month), so the first day of a month can
  // still find the actual previous day's closing balance (e.g. the last
  // day of the prior month) instead of treating it as day one with no
  // prior balance.
  const closingBalanceByDateMap = new Map<string, number>();
  const openingAmountByDateMap = new Map<string, number>();
  for (const shift of staticShifts as any[]) {
    const openTime = parseShiftDate(String(shift["Open Time"] || ""));
    if (!openTime) continue;
    const dateKey = `${openTime.getFullYear()}-${String(openTime.getMonth() + 1).padStart(2, "0")}-${String(openTime.getDate()).padStart(2, "0")}`;
    const actualDrawerAllTime =
      parseFloat(String(shift["Actual Drawer"] || "0")) || 0;
    closingBalanceByDateMap.set(dateKey, actualDrawerAllTime);
    const openingAmountAllTime =
      parseFloat(String(shift["Opening Amount"] || "0")) || 0;
    openingAmountByDateMap.set(dateKey, openingAmountAllTime);
  }

  const cashMovementRows: CashMovementRow[] = [];
  for (const shift of staticShifts as any[]) {
    const openTime = parseShiftDate(String(shift["Open Time"] || ""));
    if (!openTime) continue;
    if (openTime.getMonth() !== month || openTime.getFullYear() !== year) {
      continue;
    }
    const dateStr = `${openTime.getFullYear()}-${String(openTime.getMonth() + 1).padStart(2, "0")}-${String(openTime.getDate()).padStart(2, "0")}`;
    const openedBy = cleanStaffName(String(shift["Open By"] || ""));
    const closedBy = cleanStaffName(String(shift["Close By"] || ""));
    const openingAmount =
      parseFloat(String(shift["Opening Amount"] || "0")) || 0;
    const cashSales = parseFloat(String(shift["Cash Sales"] || "0")) || 0;
    const payIn = parseFloat(String(shift["Pay In"] || "0")) || 0;
    const payOut = parseFloat(String(shift["Pay Out"] || "0")) || 0;
    const expectedDrawer =
      parseFloat(String(shift["Expected Drawer"] || "0")) || 0;
    const actualDrawer = parseFloat(String(shift["Actual Drawer"] || "0")) || 0;
    const overShort =
      parseFloat(String(shift["Cash Drawer Over/Short"] || "0")) || 0;
    // Actual Drawer is the physical cash counted at end of shift, which
    // already has the Pay Out (cash withdrawn to bank) removed and any
    // Pay In (added change) included - so it IS the closing balance left
    // in the drawer, ready to become tomorrow's opening/change float.
    const closingBalance = actualDrawer;

    cashMovementRows.push({
      date: dateStr,
      openedBy,
      closedBy,
      openingAmount,
      cashSales,
      payIn,
      payOut,
      expectedDrawer,
      actualDrawer,
      overShort,
      closingBalance,
      bankTransfer: 0, // filled below once we know the previous day's closing balance
    });
  }
  cashMovementRows.sort((a, b) => a.date.localeCompare(b.date));

  // Bank transfer = today's closing balance minus tomorrow's opening
  // amount. Staff take cash out at end of shift to bank; whatever wasn't
  // carried forward as tomorrow's change float is the amount actually
  // transferred to the company bank account. Looks up the next calendar
  // day's opening amount from the all-time map so this works correctly
  // even for the last day of the month (next day being in the following
  // month).
  for (const row of cashMovementRows) {
    const currentDate = new Date(row.date + "T00:00:00");
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;
    const nextOpeningAmount = openingAmountByDateMap.get(nextDateKey);
    row.bankTransfer =
      nextOpeningAmount !== undefined
        ? row.closingBalance - nextOpeningAmount
        : 0;
  }

  reportData.cashMovementRows = cashMovementRows;
  reportData.cashMovementTotals = cashMovementRows.reduce(
    (acc, row) => ({
      openingAmount: acc.openingAmount + row.openingAmount,
      cashSales: acc.cashSales + row.cashSales,
      payIn: acc.payIn + row.payIn,
      payOut: acc.payOut + row.payOut,
      expectedDrawer: acc.expectedDrawer + row.expectedDrawer,
      bankTransfer: acc.bankTransfer + row.bankTransfer,
      actualDrawer: acc.actualDrawer + row.actualDrawer,
      overShort: acc.overShort + row.overShort,
    }),
    {
      openingAmount: 0,
      cashSales: 0,
      payIn: 0,
      payOut: 0,
      expectedDrawer: 0,
      actualDrawer: 0,
      overShort: 0,
      bankTransfer: 0,
    },
  );

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
      const rawSku = String(item.sku || "");
      // Fold legacy/superseded SKUs (e.g. discontinued SH0100 bundle) into
      // their canonical replacement (e.g. SH0053 sold per piece) so they
      // report as ONE product/supplier line instead of splitting history.
      const sku = resolveCanonicalSku(rawSku);
      const aliasMultiplier = getAliasMultiplier(rawSku);
      const rawQuantity = item.quantity || 0;
      const quantity = rawQuantity * aliasMultiplier;
      const name = String(item.productName || "").trim();
      const itemSales = item.totalPrice || 0;

      // Get product cost (prefer live API cost data). Unit cost is looked
      // up against the raw SKU/productId (its own recorded cost per its own
      // unit), so multiplying by the raw (un-scaled) quantity yields the
      // correct total cost regardless of the alias unit conversion.
      let unitCost = 0;
      if (item.productId) {
        const productInfo = productMap.get(`id:${item.productId}`);
        unitCost = productInfo?.cost || 0;
      } else if (rawSku) {
        const productInfo = productMap.get(`sku:${rawSku}`);
        unitCost = productInfo?.cost || 0;
      }
      const itemCost = unitCost * rawQuantity;
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

      // Top products aggregation — group by canonical SKU so legacy-SKU
      // sales merge into the current product's line.
      const productKey = sku || name || "Unknown";
      const productDisplayName =
        productNameBySkuMap.get(sku) || name || sku || "Unknown product";
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

  // Build daily data array. Every calendar day in the month is included
  // (even ones with zero sales) so that fixed costs are correctly charged
  // against days with no revenue - otherwise the break-even calculation
  // below would skip those days and understate accumulated costs. Days
  // after "today" are excluded when viewing the current month, since they
  // haven't happened yet.
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const daysToInclude = new Date(year, month + 1, 0).getDate();
  const lastDayOfMonth = isCurrentMonth
    ? Math.min(daysToInclude, now.getDate())
    : daysToInclude;

  const dailyData: DailyData[] = [];
  for (let d = 1; d <= lastDayOfMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const data = dailyDataMap.get(dateStr) || {
      revenue: 0,
      cost: 0,
      transactions: 0,
    };
    dailyData.push({
      date: dateStr,
      revenue: data.revenue,
      cost: data.cost,
      profit: data.revenue - data.cost,
      transactions: data.transactions,
      cumulativeRevenue: 0,
      cumulativeProfit: 0,
      dailyFixedCost: 0,
      dailyNetProfit: 0,
      cumulativeNetProfit: 0,
      cumulativeCost: 0,
      netProfitArea: 0,
      areaBase: 0,
      areaDiff: 0,
    });
  }
  dailyData.sort((a, b) => a.date.localeCompare(b.date));

  // Running totals for the cumulative trend chart
  let runningRevenue = 0;
  let runningProfit = 0;
  for (const day of dailyData) {
    runningRevenue += day.revenue;
    runningProfit += day.profit;
    day.cumulativeRevenue = runningRevenue;
    day.cumulativeProfit = runningProfit;
  }

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

  // ─── Commission Calculation (effective starting July 2026) ─────────────
  // Rule: on any day where total sales exceed RM1000, every RM100 of sales
  // above that RM1000 threshold earns RM10 of commission, split evenly
  // among staff on duty that day. Sales are floored to the nearest RM100
  // before computing eligibility (e.g. RM1275 -> RM1200 -> RM200 eligible
  // -> RM20 commission).
  const COMMISSION_EFFECTIVE_DATE = new Date(2026, 6, 1); // July 1, 2026
  const commissionRows: CommissionRow[] = [];
  const staffCommissionMap = new Map<string, number>();

  for (const [dateStr, data] of dailyDataMap) {
    const dateObj = new Date(dateStr + "T00:00:00");
    if (dateObj < COMMISSION_EFFECTIVE_DATE) continue;
    if (data.revenue <= 1000) continue;

    const flooredSales = Math.floor(data.revenue / 100) * 100;
    const eligibleSales = flooredSales - 1000;
    if (eligibleSales <= 0) continue;

    const commission = (eligibleSales / 100) * 10;
    const staffSet = staffByDateMap.get(dateStr) || new Set<string>();
    const staff = Array.from(staffSet).sort();
    const perStaffAmount = staff.length > 0 ? commission / staff.length : 0;

    for (const name of staff) {
      staffCommissionMap.set(
        name,
        (staffCommissionMap.get(name) || 0) + perStaffAmount,
      );
    }

    commissionRows.push({
      date: dateStr,
      totalSales: data.revenue,
      eligibleSales,
      commission,
      staff,
      perStaffAmount,
    });
  }

  commissionRows.sort((a, b) => a.date.localeCompare(b.date));
  reportData.commissionRows = commissionRows;
  reportData.totalCommission = commissionRows.reduce(
    (sum, r) => sum + r.commission,
    0,
  );

  // Merge commission into labor breakdown (salary + commission = total)
  const laborBreakdown: Record<
    string,
    {
      hours: number;
      cost: number;
      commission: number;
      total: number;
      salaryBreakdown?: SalaryBreakdown;
    }
  > = {};
  const allNames = new Set<string>([
    ...laborMap.keys(),
    ...staffCommissionMap.keys(),
  ]);
  for (const name of allNames) {
    const base = laborMap.get(name) || { hours: 0, cost: 0 };
    const commission = staffCommissionMap.get(name) || 0;
    laborBreakdown[name] = {
      hours: base.hours,
      cost: base.cost,
      commission,
      total: base.cost + commission,
      salaryBreakdown: salaryBreakdownMap.get(name),
    };
  }
  reportData.laborBreakdown = laborBreakdown;
  reportData.laborCost = Object.values(laborBreakdown).reduce(
    (sum, d) => sum + d.cost,
    0,
  );

  // Calculate GTO (2% of revenue)
  reportData.gtoCost = reportData.totalRevenue * 0.02;

  // Set utilities and marketing costs to defaults for now
  // These would come from additional API endpoints if needed
  reportData.utilitiesCost = 0;
  reportData.marketingCost = 0;

  // Operating costs = everything besides COGS
  reportData.totalOperatingCost =
    reportData.laborCost +
    reportData.totalCommission +
    reportData.rentalCost +
    reportData.gtoCost +
    reportData.utilitiesCost +
    reportData.marketingCost +
    reportData.claimCost;

  // Calculate total expenses and net profit
  reportData.totalExpenses =
    reportData.totalCost + reportData.totalOperatingCost;
  reportData.netProfit = reportData.totalRevenue - reportData.totalExpenses;

  // ─── Break-even Analysis ────────────────────────────────────
  // The month's fixed overhead (rental, labor, commission, utilities,
  // marketing, claims) has to be paid regardless of how sales are spread
  // across the month, so it is treated as a constant baseline added on top
  // of the running COGS + GTO to build a "cumulative cost" line. Plotting
  // that against the cumulative revenue (sales) line lets the break-even
  // point show up naturally as the day the two lines cross, with the gap
  // between them representing net profit (or loss).
  const totalFixedCost =
    reportData.laborCost +
    reportData.totalCommission +
    reportData.rentalCost +
    reportData.utilitiesCost +
    reportData.marketingCost +
    reportData.claimCost;

  let runningCost = totalFixedCost;
  let breakEvenDate: string | null = null;
  for (const day of reportData.dailyData) {
    const dailyGto = day.revenue * 0.02;
    runningCost += day.cost + dailyGto;

    day.dailyFixedCost = dailyGto;
    day.dailyNetProfit = day.profit - dailyGto;
    day.cumulativeCost = runningCost;
    day.netProfitArea = day.cumulativeRevenue - runningCost;
    day.cumulativeNetProfit = day.netProfitArea;
    day.areaBase = Math.min(day.cumulativeRevenue, runningCost);
    day.areaDiff = Math.abs(day.cumulativeRevenue - runningCost);

    if (breakEvenDate === null && day.netProfitArea >= 0) {
      breakEvenDate = day.date;
    }
  }

  reportData.breakEvenDate = breakEvenDate;
  reportData.daysToBreakEven = breakEvenDate
    ? new Date(breakEvenDate + "T00:00:00").getDate()
    : null;

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

  // Fetch timesheets for the selected month, padded out to the full
  // Monday-Sunday weeks that overlap the month boundary. This is needed so
  // weekly overtime (Putri: >45 hrs/week) is computed on complete weeks
  // even when the month starts/ends mid-week - otherwise the first/last
  // week of the month would look artificially short and under-report OT.
  const monthStart = new Date(selectedYear, selectedMonth, 1);
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
  const paddedStart = new Date(monthStart);
  paddedStart.setDate(paddedStart.getDate() - ((paddedStart.getDay() + 6) % 7)); // back to Monday
  const paddedEnd = new Date(monthEnd);
  paddedEnd.setDate(
    paddedEnd.getDate() + (7 - ((paddedEnd.getDay() + 6) % 7) - 1),
  ); // forward to Sunday
  const fromDate = paddedStart.toISOString().split("T")[0];
  const toDate = paddedEnd.toISOString().split("T")[0];

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
      <div
        className="sticky z-20 bg-white border-b border-gray-200 shadow-sm"
        style={{ top: "var(--app-header-height, 64px)" }}
      >
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

          {/* Break-even Analysis */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
              <h2 className="text-base md:text-lg font-bold text-gray-900">
                Break-even point
              </h2>
              {reportData.breakEvenDate ? (
                <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  Achieved on{" "}
                  {new Date(
                    reportData.breakEvenDate + "T00:00:00",
                  ).toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  (Day {reportData.daysToBreakEven})
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                  Not yet achieved this month
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-gray-600 mb-4">
              Cumulative sales versus cumulative cost (fixed overhead + COGS +
              GTO) across the month. The point where the two lines meet is the
              break-even point - the shaded gap between them is net profit when
              sales are on top, or net loss when cost is on top.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={reportData.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  formatter={(value: unknown, name: unknown) =>
                    name === "Gap (base)"
                      ? [null, null]
                      : [`RM ${Number(value).toFixed(2)}`, String(name)]
                  }
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Legend
                  {...({
                    payload: [
                      {
                        value: "Cumulative Sales",
                        type: "line",
                        color: "#2563eb",
                      },
                      {
                        value: "Cumulative Cost",
                        type: "line",
                        color: "#ef4444",
                      },
                      {
                        value: "Net profit/loss gap",
                        type: "rect",
                        color: "#10b981",
                      },
                    ],
                  } as React.ComponentProps<typeof Legend>)}
                />
                {reportData.breakEvenDate && (
                  <ReferenceLine
                    x={reportData.breakEvenDate}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: "Break-even",
                      position: "insideTopLeft",
                      fontSize: 11,
                      fill: "#10b981",
                    }}
                  />
                )}
                <Area
                  dataKey="areaBase"
                  name="Gap (base)"
                  stackId="gap"
                  stroke="none"
                  fill="transparent"
                  legendType="none"
                  isAnimationActive={false}
                />
                <Area
                  dataKey="areaDiff"
                  name="Net profit/loss gap"
                  stackId="gap"
                  stroke="none"
                  fill="#10b981"
                  fillOpacity={0.2}
                  legendType="none"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeRevenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Cumulative Sales"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeCost"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Cumulative Cost"
                  dot={false}
                />
              </ComposedChart>
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
                Top selling products
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
                  { name: "Labor Cost (Salary)", value: reportData.laborCost },
                  { name: "Commission", value: reportData.totalCommission },
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
              <div className="space-y-2 max-h-80">
                {Object.entries(reportData.laborBreakdown).map(
                  ([name, data]) => (
                    <div
                      key={name}
                      className="p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs md:text-sm font-medium text-gray-900 truncate">
                          {name}
                        </p>
                        <span className="text-xs md:text-sm font-bold text-gray-900 ml-3 shrink-0">
                          RM {formatCurrency(data.total)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] md:text-xs text-gray-600">
                        <span>
                          {data.hours > 0
                            ? `${data.hours.toFixed(2)} hours`
                            : "Fixed salary"}
                        </span>
                        <span className="flex gap-3">
                          <span>Salary: RM {formatCurrency(data.cost)}</span>
                          <span
                            className={
                              data.commission > 0
                                ? "text-green-600 font-medium"
                                : ""
                            }
                          >
                            Commission: RM {formatCurrency(data.commission)}
                          </span>
                        </span>
                      </div>
                      {data.salaryBreakdown && (
                        <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] md:text-xs text-gray-600">
                          <span className="flex justify-between gap-2">
                            <span>Basic</span>
                            <span className="font-medium text-gray-800">
                              RM {formatCurrency(data.salaryBreakdown.basic)}
                            </span>
                          </span>
                          <span className="flex justify-between gap-2">
                            <span>Attendance allowance</span>
                            <span className="font-medium text-gray-800">
                              RM{" "}
                              {formatCurrency(
                                data.salaryBreakdown.attendanceAllowance,
                              )}
                            </span>
                          </span>
                          <span className="flex justify-between gap-2">
                            <span>Performance bonus</span>
                            <span className="font-medium text-gray-800">
                              RM{" "}
                              {formatCurrency(
                                data.salaryBreakdown.performanceBonus,
                              )}
                            </span>
                          </span>
                          <span className="flex justify-between gap-2">
                            <span>Overtime</span>
                            <span className="font-medium text-gray-800">
                              RM{" "}
                              {formatCurrency(data.salaryBreakdown.overtimePay)}
                            </span>
                          </span>
                        </div>
                      )}
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

          {/* Staff Daily Shift Tables */}
          {Object.entries(reportData.shiftsByEmployee).map(
            ([employeeName, shifts]) => {
              const groupedDays = groupShiftsByDate(shifts);
              const totalRaw = groupedDays.reduce(
                (sum, d) => sum + d.totalRawHours,
                0,
              );
              const totalDeducted = groupedDays.reduce(
                (sum, d) => sum + d.totalBreakDeducted,
                0,
              );
              const totalPaid = groupedDays.reduce(
                (sum, d) => sum + d.totalPaidHours,
                0,
              );
              return (
                <div
                  key={employeeName}
                  className="bg-white border border-gray-200 rounded-lg p-4 md:p-6"
                >
                  <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
                    {employeeName} &mdash; daily shifts
                  </h2>
                  <p className="text-xs md:text-sm text-gray-600 mb-4">
                    Clock-in/out per day (multiple clock-out/in entries on the
                    same day are merged, with the gap shown as a break).
                    Straight shifts of 10+ hours with no recorded break deduct 1
                    hour of paid time; 12+ hours deduct 2 hours. Clock-outs
                    marked{" "}
                    <span className="text-amber-600 font-medium">(adj.)</span>{" "}
                    were forgotten (missing or logged in the 1am-9am
                    non-operating window) and have been replaced with that
                    day&apos;s shift closing time.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-2 pr-2 font-medium">Date</th>
                          <th className="py-2 px-2 font-medium">Clock in</th>
                          <th className="py-2 px-2 font-medium">Clock out</th>
                          <th className="py-2 px-2 font-medium text-right">
                            Break time
                          </th>
                          <th className="py-2 px-2 font-medium text-right">
                            Clocked hours
                          </th>
                          <th className="py-2 px-2 font-medium text-right">
                            Break deducted
                          </th>
                          <th className="py-2 pl-2 font-medium text-right">
                            Paid hours
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedDays.map((row) => (
                          <tr
                            key={row.date}
                            className="border-b border-gray-100"
                          >
                            <td className="py-2 pr-2 font-medium text-gray-900">
                              {new Date(
                                row.date + "T00:00:00",
                              ).toLocaleDateString("en-MY", {
                                day: "numeric",
                                month: "short",
                                weekday: "short",
                              })}
                            </td>
                            <td className="py-2 px-2 text-gray-700">
                              {parseTime(row.firstClockIn)?.toLocaleTimeString(
                                "en-MY",
                                { hour: "2-digit", minute: "2-digit" },
                              ) || "-"}
                            </td>
                            <td className="py-2 px-2 text-gray-700">
                              {parseTime(row.lastClockOut)?.toLocaleTimeString(
                                "en-MY",
                                { hour: "2-digit", minute: "2-digit" },
                              ) || "-"}
                              {row.lastClockOutAdjusted && (
                                <span
                                  className="ml-1 text-amber-600 font-medium"
                                  title="Clock-out was missing or forgotten; replaced with that day's shift closing time"
                                >
                                  (adj.)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right text-gray-700">
                              {row.breaks.length > 0 ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  {row.breaks.map((brk, idx) => (
                                    <span
                                      key={idx}
                                      className="text-blue-600 font-medium whitespace-nowrap"
                                    >
                                      {parseTime(brk.start)?.toLocaleTimeString(
                                        "en-MY",
                                        { hour: "2-digit", minute: "2-digit" },
                                      ) || "-"}
                                      {" \u2013 "}
                                      {parseTime(brk.end)?.toLocaleTimeString(
                                        "en-MY",
                                        { hour: "2-digit", minute: "2-digit" },
                                      ) || "-"}
                                      {" ("}
                                      {formatDuration(brk.hours)}
                                      {")"}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">&mdash;</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right text-gray-700">
                              {row.totalRawHours.toFixed(2)} hrs
                            </td>
                            <td className="py-2 px-2 text-right font-medium">
                              {row.totalBreakDeducted > 0 ? (
                                <span className="text-red-600">
                                  &minus;{row.totalBreakDeducted.toFixed(0)} hr
                                </span>
                              ) : (
                                <span className="text-gray-400">&mdash;</span>
                              )}
                            </td>
                            <td className="py-2 pl-2 text-right font-semibold text-gray-900">
                              {row.totalPaidHours.toFixed(2)} hrs
                            </td>
                          </tr>
                        ))}
                        {groupedDays.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-6 text-center text-gray-500"
                            >
                              No shifts recorded this month
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {groupedDays.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr className="border-t-2 border-gray-300 font-semibold">
                            <td className="py-2 pr-2 text-gray-900" colSpan={4}>
                              Total
                            </td>
                            <td className="py-2 px-2 text-right text-gray-900">
                              {totalRaw.toFixed(2)} hrs
                            </td>
                            <td className="py-2 px-2 text-right text-red-700">
                              {totalDeducted > 0
                                ? `-${totalDeducted.toFixed(0)} hr`
                                : "-"}
                            </td>
                            <td className="py-2 pl-2 text-right text-gray-900">
                              {totalPaid.toFixed(2)} hrs
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              );
            },
          )}

          {/* Commission Table */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
              Sales commission
            </h2>
            <p className="text-xs md:text-sm text-gray-600 mb-4">
              Days with sales above RM1,000 earn RM10 commission for every RM100
              sold above that threshold, split evenly among staff on duty.
              Effective from July 2026.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Total sales
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Eligible sales
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Commission
                    </th>
                    <th className="py-2 pl-2 font-medium">
                      Staff (per person)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.commissionRows.map((row) => (
                    <tr key={row.date} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium text-gray-900">
                        {new Date(row.date + "T00:00:00").toLocaleDateString(
                          "en-MY",
                          { day: "numeric", month: "short", weekday: "short" },
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-blue-600">
                        RM {formatCurrency(row.totalSales)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">
                        RM {formatCurrency(row.eligibleSales)}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-green-600">
                        RM {formatCurrency(row.commission)}
                      </td>
                      <td className="py-2 pl-2 text-gray-700">
                        {row.staff.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.staff.map((name) => (
                              <span
                                key={name}
                                className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] md:text-xs font-medium"
                              >
                                {name}: RM {formatCurrency(row.perStaffAmount)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">
                            No staff on duty recorded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {reportData.commissionRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-gray-500"
                      >
                        No commission-eligible days this month
                      </td>
                    </tr>
                  )}
                </tbody>
                {reportData.commissionRows.length > 0 && (
                  <tfoot className="bg-gray-50">
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td className="py-2 pr-2 text-gray-900" colSpan={3}>
                        Total commission
                      </td>
                      <td className="py-2 px-2 text-right text-green-700">
                        RM {formatCurrency(reportData.totalCommission)}
                      </td>
                      <td className="py-2 pl-2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
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

          {/* Cash Drawer Movement Table */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
              Cash movement
            </h2>
            <p className="text-xs md:text-sm text-gray-600 mb-4">
              Daily cash drawer flow: opening float, cash sales taken in, staff
              pay-in/pay-out entries, and the counted vs expected drawer amount.
              At end of shift, staff withdraw cash to be banked (Pay Out) - the
              remainder (Actual drawer) stays in the drawer as tomorrow&apos;s
              change float.
            </p>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-2 font-medium">Date</th>
                    <th className="py-2 px-2 font-medium">Opened by</th>
                    <th className="py-2 px-2 font-medium">Closed by</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Opening balance
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Cash sales
                    </th>
                    <th className="py-2 px-2 font-medium text-right">Pay in</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Pay out
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Expected drawer
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Actual drawer
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Over/Short
                    </th>
                    <th className="py-2 pl-2 font-medium text-right">
                      To transfer (bank)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.cashMovementRows.map((row) => (
                    <tr key={row.date} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium text-gray-900">
                        {new Date(row.date + "T00:00:00").toLocaleDateString(
                          "en-MY",
                          { day: "numeric", month: "short", weekday: "short" },
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-700">
                        {row.openedBy}
                      </td>
                      <td className="py-2 px-2 text-gray-700">
                        {row.closedBy}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">
                        RM {formatCurrency(row.openingAmount)}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-blue-600">
                        RM {formatCurrency(row.cashSales)}
                      </td>
                      <td className="py-2 px-2 text-right text-green-600">
                        {row.payIn > 0
                          ? `+RM ${formatCurrency(row.payIn)}`
                          : "-"}
                      </td>
                      <td className="py-2 px-2 text-right text-red-600">
                        {row.payOut > 0
                          ? `-RM ${formatCurrency(row.payOut)}`
                          : "-"}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-700">
                        RM {formatCurrency(row.expectedDrawer)}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-900">
                        RM {formatCurrency(row.actualDrawer)}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">
                        {row.overShort === 0 ? (
                          <span className="text-gray-400">RM 0.00</span>
                        ) : row.overShort > 0 ? (
                          <span className="text-green-600">
                            +RM {formatCurrency(row.overShort)}
                          </span>
                        ) : (
                          <span className="text-red-600">
                            -RM {formatCurrency(Math.abs(row.overShort))}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pl-2 text-right font-semibold text-purple-700">
                        RM {formatCurrency(row.bankTransfer)}
                      </td>
                    </tr>
                  ))}
                  {reportData.cashMovementRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-6 text-center text-gray-500"
                      >
                        No cash drawer data for this month
                      </td>
                    </tr>
                  )}
                </tbody>
                {reportData.cashMovementRows.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-gray-50">
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td className="py-2 pr-2 text-gray-900" colSpan={3}>
                        Total
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900">
                        RM{" "}
                        {formatCurrency(
                          reportData.cashMovementTotals.openingAmount,
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-blue-700">
                        RM{" "}
                        {formatCurrency(
                          reportData.cashMovementTotals.cashSales,
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-green-700">
                        RM {formatCurrency(reportData.cashMovementTotals.payIn)}
                      </td>
                      <td className="py-2 px-2 text-right text-red-700">
                        RM{" "}
                        {formatCurrency(reportData.cashMovementTotals.payOut)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900">
                        RM{" "}
                        {formatCurrency(
                          reportData.cashMovementTotals.expectedDrawer,
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900">
                        RM{" "}
                        {formatCurrency(
                          reportData.cashMovementTotals.actualDrawer,
                        )}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900">
                        RM{" "}
                        {formatCurrency(
                          reportData.cashMovementTotals.overShort,
                        )}
                      </td>
                      <td className="py-2 pl-2 text-right text-purple-700">
                        RM{" "}
                        {formatCurrency(
                          reportData.cashMovementTotals.bankTransfer,
                        )}
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
