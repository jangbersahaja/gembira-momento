/**
 * React Hooks for StoreHub API integration
 * Use these hooks in your client components for real-time data fetching
 */

"use client";

import { DependencyList, useCallback, useEffect, useState } from "react";

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
  const fetchProducts = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/products?${new URLSearchParams(
        Object.entries(filters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch products");
    return res.json();
  }, [filters]);

  return useApiData(fetchProducts, [filters]);
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
  const fetchTransactions = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/transactions?${new URLSearchParams(
        Object.entries(filters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return res.json();
  }, [filters]);

  return useApiData(fetchTransactions, [filters]);
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
  const fetchEmployees = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/employees?${new URLSearchParams(
        Object.entries(filters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch employees");
    return res.json();
  }, [filters]);

  return useApiData(fetchEmployees, [filters]);
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
  const fetchTimesheets = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/timesheets?${new URLSearchParams(
        Object.entries(filters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch timesheets");
    return res.json();
  }, [filters]);

  return useApiData(fetchTimesheets, [filters]);
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
  const fetchShifts = useCallback(async () => {
    const res = await fetch(
      `/api/storehub/shifts?${new URLSearchParams(
        Object.entries(filters || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`,
    );
    if (!res.ok) throw new Error("Failed to fetch shifts");
    return res.json();
  }, [filters]);

  return useApiData(fetchShifts, [filters]);
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
