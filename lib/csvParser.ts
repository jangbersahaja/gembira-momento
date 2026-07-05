import Papa from "papaparse";

export interface Transaction {
  Time: string;
  "Receipt Number": string;
  "Original Sale Receipt Number": string;
  Store: string;
  "Register Id": string | number;
  Employee: string;
  "Transaction Type": string;
  Customer: string;
  Is_Cancelled: string;
  Item: string;
  SKU: string;
  Barcode: string;
  Category: string;
  "S/N": string;
  Variants: string;
  Quantity: string | number;
  SubTotal: string | number;
  Discount: string | number;
  "Service Charge": string | number;
  Tax: string | number;
  Rounding: string | number;
  Total: string | number;
  Notes: string;
  Cash: string | number;
  "Credit Card": string | number;
  "Debit Card": string | number;
  QR: string | number;
  "Payment Id": string;
}

interface ParseResult {
  data: Transaction[];
  errors: Array<{ message: string }>;
  meta: {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
  };
}

export async function parseTransactionsCSV(
  filePath: string,
): Promise<Transaction[]> {
  try {
    const response = await fetch(filePath);
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse<Transaction>(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results: ParseResult) => {
          resolve(results.data);
        },
        error: (error: { message: string }) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error("Error parsing CSV:", error);
    return [];
  }
}

// Convert string values to appropriate types
export function normalizeTransaction(transaction: Transaction): Transaction {
  return {
    ...transaction,
    "Register Id": transaction["Register Id"]
      ? Number(transaction["Register Id"])
      : "",
    Quantity: transaction.Quantity ? Number(transaction.Quantity) : "",
    SubTotal: transaction.SubTotal ? Number(transaction.SubTotal) : "",
    Discount: transaction.Discount ? Number(transaction.Discount) : "",
    "Service Charge": transaction["Service Charge"]
      ? Number(transaction["Service Charge"])
      : "",
    Tax: transaction.Tax ? Number(transaction.Tax) : "",
    Rounding: transaction.Rounding ? Number(transaction.Rounding) : "",
    Total: transaction.Total ? Number(transaction.Total) : "",
    Cash: transaction.Cash ? Number(transaction.Cash) : "",
    "Credit Card": transaction["Credit Card"]
      ? Number(transaction["Credit Card"])
      : "",
    "Debit Card": transaction["Debit Card"]
      ? Number(transaction["Debit Card"])
      : "",
    QR: transaction.QR ? Number(transaction.QR) : "",
  };
}
