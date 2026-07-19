/**
 * StoreHub API Integration
 * Documentation: StoreHub APIs Public Version
 *
 * This module handles all API calls to StoreHub for fetching:
 * - Products/Inventory
 * - Transactions/Sales
 * - Timesheets (Employee)
 * - Shifts
 */

const STOREHUB_API_BASE =
  process.env.NEXT_PUBLIC_STOREHUB_API_BASE || "https://api.storehubhq.com";
const STOREHUB_USERNAME = process.env.STOREHUB_USERNAME || "gembiramomento";
const STOREHUB_PASSWORD = process.env.STOREHUB_PASSWORD;

/**
 * Generate Basic Auth header from username and password
 */
function getBasicAuthHeader(): string {
  const credentials = `${STOREHUB_USERNAME}:${STOREHUB_PASSWORD}`;
  const encodedCredentials = Buffer.from(credentials).toString("base64");
  return `Basic ${encodedCredentials}`;
}

interface ApiRequestConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

/**
 * Helper function to make API requests to StoreHub
 */
async function makeApiRequest<T>(
  endpoint: string,
  config: ApiRequestConfig = {},
): Promise<T> {
  const { method = "GET", headers = {}, body } = config;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: getBasicAuthHeader(),
    ...headers,
  };

  try {
    const url = `${STOREHUB_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: defaultHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText} (${response.status})`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`StoreHub API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * PRODUCTS ENDPOINTS
 */

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  cost: number;
  quantity?: number;
  description?: string;
}

/**
 * Get all products or filter by criteria
 */
export async function getProducts(filters?: {
  category?: string;
  sku?: string;
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const queryParams = new URLSearchParams();

  if (filters?.category) queryParams.append("category", filters.category);
  if (filters?.sku) queryParams.append("sku", filters.sku);
  if (filters?.limit) queryParams.append("limit", filters.limit.toString());
  if (filters?.offset) queryParams.append("offset", filters.offset.toString());

  const endpoint = `/products${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
  const rawProducts = await makeApiRequest<Record<string, unknown>[]>(endpoint);

  // Transform API response to match expected Product interface
  return rawProducts.map((product: Record<string, unknown>) => ({
    id: (product.id as string) || "",
    sku: (product.sku as string) || "",
    name: (product.name as string) || "",
    category: (product.category as string) || "",
    unitPrice: (product.unitPrice as number) || 0,
    cost: (product.cost as number) || 0,
    quantity: (product.quantity as number) || 0,
    description: product.description as string,
  }));
}

/**
 * Get a specific product by SKU
 *
 * NOTE: StoreHub's `/products?sku=...` query param is silently ignored by
 * their API — it returns the full, unfiltered product list regardless. We
 * must filter client-side, otherwise `products[0]` would be an arbitrary
 * unrelated product.
 */
export async function getProductBySku(sku: string): Promise<Product> {
  const products = await getProducts();
  return (
    products.find((p) => p.sku === sku) || {
      id: "",
      sku,
      name: "",
      category: "",
      unitPrice: 0,
      cost: 0,
    }
  );
}

/**
 * TRANSACTIONS/SALES ENDPOINTS
 */

export interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  storeId: string;
  registerId: string;
  employeeId: string;
  customerId?: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: "cash" | "card" | "qr" | "other";
  status: "completed" | "cancelled" | "pending";
}

export interface TransactionItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * Get transactions/sales within date range
 */
export async function getTransactions(filters?: {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  customerId?: string;
  status?: "completed" | "cancelled" | "pending";
  limit?: number;
  offset?: number;
}): Promise<Transaction[]> {
  const queryParams = new URLSearchParams();

  if (filters?.startDate) queryParams.append("start_date", filters.startDate);
  if (filters?.endDate) queryParams.append("end_date", filters.endDate);
  if (filters?.employeeId)
    queryParams.append("employee_id", filters.employeeId);
  if (filters?.customerId)
    queryParams.append("customer_id", filters.customerId);
  if (filters?.status) queryParams.append("status", filters.status);
  if (filters?.limit) queryParams.append("limit", filters.limit.toString());
  if (filters?.offset) queryParams.append("offset", filters.offset.toString());

  const endpoint = `/transactions${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
  const rawTransactions =
    await makeApiRequest<Record<string, unknown>[]>(endpoint);

  // Fetch products to create lookup map for SKU and product names
  const productLookup = new Map<string, { sku: string; name: string }>();
  try {
    const products = await getProducts({ limit: 500 });
    for (const product of products) {
      productLookup.set(product.id, {
        sku: product.sku,
        name: product.name,
      });
    }
  } catch {
    // If product fetch fails, continue without lookup (will use fallback)
  }

  // Transform API response to match expected Transaction interface
  return rawTransactions.map((txn: Record<string, unknown>) => {
    const payments = txn.payments as Record<string, unknown>[] | undefined;
    const paymentMethod: "cash" | "card" | "qr" | "other" =
      transformPaymentMethod(payments);

    return {
      id: (txn.refId as string) || (txn.id as string),
      receiptNumber: (txn.invoiceNumber as string) || "",
      timestamp: (txn.transactionTime as string) || "",
      storeId: (txn.storeId as string) || "",
      registerId: (txn.registerId as string) || "",
      employeeId: (txn.employeeId as string) || "",
      customerId: undefined,
      items: ((txn.items as Record<string, unknown>[]) || []).map(
        (item: Record<string, unknown>) => {
          const productId = item.productId as string;
          const productInfo = productLookup.get(productId);

          return {
            sku: productInfo?.sku || (item.sku as string) || productId,
            productName:
              productInfo?.name ||
              (item.productName as string) ||
              `Item ${productId}`,
            quantity: (item.quantity as number) || 0,
            unitPrice: (item.unitPrice as number) || 0,
            totalPrice: (item.total as number) || 0,
          };
        },
      ),
      subtotal: (txn.subTotal as number) || 0,
      discount: (txn.discount as number) || 0,
      tax: (txn.tax as number) || 0,
      total: (txn.total as number) || 0,
      paymentMethod,
      status: (txn.isCancelled as boolean)
        ? "cancelled"
        : (txn.transactionType as string) === "Sale"
          ? "completed"
          : "pending",
    };
  });
}

/**
 * Helper function to transform payment method from API format
 */
function transformPaymentMethod(
  payments: Record<string, unknown>[] | undefined,
): "cash" | "card" | "qr" | "other" {
  if (!payments || payments.length === 0) return "other";

  const method = ((payments[0].paymentMethod as string) || "").toLowerCase();

  if (method.includes("cash")) return "cash";
  if (
    method.includes("debit") ||
    method.includes("credit") ||
    method.includes("card")
  )
    return "card";
  if (method.includes("qr")) return "qr";

  return "other";
}

/**
 * Get transaction by receipt number
 */
export async function getTransactionByReceipt(
  receiptNumber: string,
): Promise<Transaction> {
  return makeApiRequest<Transaction>(`/transactions/${receiptNumber}`);
}

/**
 * EMPLOYEES/TIMESHEETS ENDPOINTS
 */

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdTime: string; // ISO 8601 timestamp
  modifiedTime: string; // ISO 8601 timestamp
}

export interface Store {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  website?: string;
}

export interface Timesheet {
  employeeId: string;
  storeId: string;
  clockInTime: string; // ISO 8601 timestamp
  clockOutTime: string; // ISO 8601 timestamp
}

/**
 * Get timesheets for specified date range and optional filters
 * Endpoint: GET /timesheets
 * Query Parameters: storeId, employeeId, from (YYYY-MM-DD), to (YYYY-MM-DD)
 */
export async function getTimesheets(filters?: {
  storeId?: string;
  employeeId?: string;
  from?: string; // YYYY-MM-DD format
  to?: string; // YYYY-MM-DD format
}): Promise<Timesheet[]> {
  const queryParams = new URLSearchParams();

  if (filters?.storeId) queryParams.append("storeId", filters.storeId);
  if (filters?.employeeId) queryParams.append("employeeId", filters.employeeId);
  if (filters?.from) queryParams.append("from", filters.from);
  if (filters?.to) queryParams.append("to", filters.to);

  const endpoint = `/timesheets${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
  return makeApiRequest<Timesheet[]>(endpoint);
}

/**
 * Get all employees
 * Endpoint: GET /employees
 * Query Parameters: modifiedSince (optional, YYYY-MM-DD format)
 */
export async function getEmployees(filters?: {
  modifiedSince?: string; // YYYY-MM-DD format
}): Promise<Employee[]> {
  const queryParams = new URLSearchParams();

  if (filters?.modifiedSince)
    queryParams.append("modifiedSince", filters.modifiedSince);

  const endpoint = `/employees${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
  return makeApiRequest<Employee[]>(endpoint);
}

/**
 * Get all stores
 * Endpoint: GET /stores
 */
export async function getStores(): Promise<Store[]> {
  return makeApiRequest<Store[]>("/stores");
}

/**
 * SHIFTS ENDPOINTS
 */

export interface Shift {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: "scheduled" | "completed" | "cancelled";
}

/**
 * Get shifts for employees
 */
export async function getShifts(filters?: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: "scheduled" | "completed" | "cancelled";
  limit?: number;
  offset?: number;
}): Promise<Shift[]> {
  const queryParams = new URLSearchParams();

  if (filters?.employeeId)
    queryParams.append("employee_id", filters.employeeId);
  if (filters?.startDate) queryParams.append("start_date", filters.startDate);
  if (filters?.endDate) queryParams.append("end_date", filters.endDate);
  if (filters?.status) queryParams.append("status", filters.status);
  if (filters?.limit) queryParams.append("limit", filters.limit.toString());
  if (filters?.offset) queryParams.append("offset", filters.offset.toString());

  const endpoint = `/shifts${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
  return makeApiRequest<Shift[]>(endpoint);
}

/**
 * CUSTOMERS ENDPOINTS
 */

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  registeredAt: string;
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(
  email: string,
): Promise<Customer | null> {
  try {
    return await makeApiRequest<Customer>(`/customers?email=${email}`);
  } catch {
    console.warn(`Customer not found: ${email}`);
    return null;
  }
}

/**
 * INVENTORY ENDPOINTS
 */

export interface InventoryLevel {
  productId: string; // Unique ID of the product
  quantityOnHand: number; // Quantity of product available in stock
  warningStock?: number; // Quantity warning stock level (optional)
  idealStock?: number; // Quantity ideal stock level (optional)
}

/**
 * Get current inventory levels for a store
 * Endpoint: GET /inventory/<storeId>
 * Returns array of stocks. Only products configured to track stock level are included.
 */
export async function getInventory(storeId: string): Promise<InventoryLevel[]> {
  if (!storeId) {
    throw new Error("storeId is required to fetch inventory");
  }
  const endpoint = `/inventory/${storeId}`;
  return makeApiRequest<InventoryLevel[]>(endpoint);
}

/**
 * REPORTS ENDPOINTS
 */

export interface SalesReport {
  totalSales: number;
  totalTransactions: number;
  averageTransactionValue: number;
  topProducts: Array<{
    sku: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  paymentMethods: Record<string, number>;
  period: { startDate: string; endDate: string };
}

/**
 * Get sales report for date range
 */
export async function getSalesReport(
  startDate: string,
  endDate: string,
): Promise<SalesReport> {
  return makeApiRequest<SalesReport>(
    `/reports/sales?start_date=${startDate}&end_date=${endDate}`,
  );
}

/**
 * Test API connection
 */
export async function testApiConnection(): Promise<boolean> {
  try {
    // Try to fetch a simple endpoint
    await makeApiRequest<Product[]>("/products?limit=1");
    console.log("✅ StoreHub API connection successful");
    return true;
  } catch {
    console.error("❌ StoreHub API connection failed");
    return false;
  }
}
