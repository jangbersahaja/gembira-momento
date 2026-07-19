/**
 * React Hooks for StoreHub API integration
 * Use these hooks in your client components for real-time data fetching
 */

"use client";

import {
  DependencyList,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Generic hook for fetching data from an API endpoint
 */
export function useApiData<T>(
  fetchFn: () => Promise<T>,
  dependencies: DependencyList = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await fetchFn();
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { data, loading, error };
}

/**
 * Hook for fetching products
 */
export function useProducts(filters?: {
  category?: string;
  sku?: string;
  limit?: number;
  offset?: number;
}) {
  // Memoize the filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(
    () => filters,
    [filters?.category, filters?.sku, filters?.limit, filters?.offset],
  );

  const fetchProducts = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/products?${new URLSearchParams(
        Object.entries(memoizedFilters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch products");
    return res.json();
  }, [memoizedFilters]);

  return useApiData(fetchProducts, [memoizedFilters]);
}

/**
 * Hook for fetching transactions
 */
export function useTransactions(filters?: {
  from?: string;
  to?: string;
  employeeId?: string;
  status?: string;
}) {
  // Memoize the filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(
    () => filters,
    [filters?.from, filters?.to, filters?.employeeId, filters?.status],
  );

  const fetchTransactions = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/transactions?${new URLSearchParams(
        Object.entries(memoizedFilters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return res.json();
  }, [memoizedFilters]);

  return useApiData(fetchTransactions, [memoizedFilters]);
}

/**
 * Hook for fetching inventory levels for a specific store
 */
export function useInventory(storeId: string) {
  const fetchInventory = useCallback(async () => {
    if (!storeId) {
      throw new Error("storeId is required to fetch inventory");
    }
    const res = await fetch(`/api/storehub/inventory/${storeId}`);
    if (!res.ok) throw new Error("Failed to fetch inventory");
    return res.json();
  }, [storeId]);

  return useApiData(fetchInventory, [storeId]);
}

/**
 * Hook for fetching employees
 */
export function useEmployees(filters?: { modifiedSince?: string }) {
  // Memoize the filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(() => filters, [filters?.modifiedSince]);

  const fetchEmployees = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/employees?${new URLSearchParams(
        Object.entries(memoizedFilters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch employees");
    return res.json();
  }, [memoizedFilters]);

  return useApiData(fetchEmployees, [memoizedFilters]);
}

/**
 * Hook for fetching stores
 */
export function useStores() {
  const fetchStores = useCallback(async () => {
    const res = await fetch("/api/storehub/stores");
    if (!res.ok) throw new Error("Failed to fetch stores");
    return res.json();
  }, []);

  return useApiData(fetchStores, []);
}

/**
 * Hook for fetching timesheets
 */
export function useTimesheets(filters?: {
  storeId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
}) {
  // Memoize the filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(
    () => filters,
    [filters?.storeId, filters?.employeeId, filters?.from, filters?.to],
  );

  const fetchTimesheets = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/timesheets?${new URLSearchParams(
        Object.entries(memoizedFilters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch timesheets");
    return res.json();
  }, [memoizedFilters]);

  return useApiData(fetchTimesheets, [memoizedFilters]);
}

/**
 * Hook for fetching shifts
 */
export function useShifts(filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  // Memoize the filters to prevent unnecessary re-renders
  const memoizedFilters = useMemo(
    () => filters,
    [
      filters?.employeeId,
      filters?.startDate,
      filters?.endDate,
      filters?.status,
    ],
  );

  const fetchShifts = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/shifts?${new URLSearchParams(
        Object.entries(memoizedFilters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch shifts");
    return res.json();
  }, [memoizedFilters]);

  return useApiData(fetchShifts, [memoizedFilters]);
}

/**
 * Hook for fetching DB-backed restocking advice for a SKU (see
 * lib/restockingLogic.ts and app/api/restock-advice/[sku]/route.ts).
 */
export function useRestockAdvice(sku: string, storeId?: string) {
  const fetchAdvice = useCallback(async () => {
    if (!sku) throw new Error("sku is required to fetch restock advice");
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
    const res = await fetch(
      `/api/restock-advice/${encodeURIComponent(sku)}${query}`,
    );
    if (!res.ok) throw new Error("Failed to fetch restock advice");
    return res.json();
  }, [sku, storeId]);

  return useApiData(fetchAdvice, [sku, storeId]);
}

/**
 * Hook for fetching raw stock snapshot + restock event history for a SKU
 * (see app/api/stock-history/[sku]/route.ts). Used to render the Stock
 * Level vs Sales chart on the product detail page.
 */
export function useStockHistory(sku: string) {
  const fetchHistory = useCallback(async () => {
    if (!sku) throw new Error("sku is required to fetch stock history");
    const res = await fetch(`/api/stock-history/${encodeURIComponent(sku)}`);
    if (!res.ok) throw new Error("Failed to fetch stock history");
    return res.json();
  }, [sku]);

  return useApiData(fetchHistory, [sku]);
}

/**
 * Hook for fetching a sales report
 */
export function useSalesReport(startDate: string, endDate: string) {
  const fetchReport = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/reports/sales?start_date=${startDate}&end_date=${endDate}`,
    );
    if (!res.ok) throw new Error("Failed to fetch sales report");
    return res.json();
  }, [startDate, endDate]);

  return useApiData(fetchReport, [startDate, endDate]);
}
