import { useEffect, useState } from "react";
import { parseTransactionsCSV, type Transaction } from "./csvParser";

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setIsLoading(true);
        const data = await parseTransactionsCSV(
          "/data/Transactions_04-01-2026_07-04-2026 (1).csv",
        );
        setTransactions(data);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load transactions";
        setError(errorMessage);
        console.error("Error loading transactions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactions();
  }, []);

  return { transactions, isLoading, error };
}
