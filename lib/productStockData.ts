/**
 * Product Stock Data
 * Fetches product stock quantities from the CSV data files
 * This is a temporary solution until the API provides stock information
 */

export interface ProductStock {
  sku: string;
  quantity: number;
}

let stockCache: Map<string, number> | null = null;

/**
 * Parse the Products CSV to extract SKU and quantity
 * The "Gembira Momento_Quantity" column contains the stock quantity
 */
async function parseProductsCSV(): Promise<Map<string, number>> {
  if (stockCache) {
    return stockCache;
  }

  try {
    const response = await fetch("/data/Products (5).csv");
    if (!response.ok) throw new Error("Failed to fetch products CSV");

    const csv = await response.text();
    const lines = csv.split("\n");

    // Find the header row (skip description rows)
    let headerIndex = -1;
    let headers: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("SKU") && line.includes("Gembira Momento_Quantity")) {
        headerIndex = i;
        headers = parseCSVLine(line);
        break;
      }
    }

    if (headerIndex === -1) {
      console.warn("Could not find CSV header row");
      return new Map();
    }

    // Find column indices
    const skuIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("sku") && !h.toLowerCase().includes("parent"),
    );
    const quantityIndex = headers.findIndex((h) =>
      h.toLowerCase().includes("quantity"),
    );

    if (skuIndex === -1 || quantityIndex === -1) {
      console.warn(
        `Could not find required columns. SKU: ${skuIndex}, Quantity: ${quantityIndex}`,
      );
      return new Map();
    }

    // Parse data rows
    const stockMap = new Map<string, number>();

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const sku = values[skuIndex]?.trim() || "";
      const quantity = parseFloat(values[quantityIndex] || "0");

      if (sku) {
        stockMap.set(sku, isNaN(quantity) ? 0 : quantity);
      }
    }

    stockCache = stockMap;
    return stockMap;
  } catch (error) {
    console.error("Error parsing products CSV:", error);
    return new Map();
  }
}

/**
 * Parse a CSV line handling quotes and escaping
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Get stock quantity for a specific SKU
 */
export async function getProductStock(sku: string): Promise<number> {
  const stockMap = await parseProductsCSV();
  return stockMap.get(sku) || 0;
}

/**
 * Get stock quantities for all products
 */
export async function getAllProductStocks(): Promise<Map<string, number>> {
  return parseProductsCSV();
}
