# StoreHub API Integration Guide for Gembira Momento

## Overview

This guide walks you through integrating the StoreHub API to replace your offline CSV data sources.

## Step 1: Environment Setup

Create a `.env.local` file in your project root (it's already in `.gitignore`):

```bash
# .env.local
NEXT_PUBLIC_STOREHUB_API_BASE=https://api.storehubhq.com
STOREHUB_USERNAME=gembiramomento
STOREHUB_PASSWORD=91015673b6064a329018bdd2d0893c1b
```

**Authentication Method:**

StoreHub API uses **Basic Authentication**. The credentials are:

- Username: `gembiramomento`
- Password: `91015673b6064a329018bdd2d0893c1b`

These are automatically encoded in Base64 and sent with every API request in the `Authorization` header.

**Security Note:**

- `NEXT_PUBLIC_*` variables are exposed to the browser
- `STOREHUB_PASSWORD` is private and only used on the server (in Route Handlers)
- Never commit `.env.local` to git
- Keep your password secure and do not share it publicly

## Step 2: API Endpoints Overview

### Base URL

```
https://api.storehubhq.com
```

### Authentication

All requests use Basic Authentication with the credentials:

- Username: `gembiramomento`
- Password: `91015673b6064a329018bdd2d0893c1b`

The client automatically encodes these as Base64 in the Authorization header:

```
Authorization: Basic Z2VtYmlmYW1vbWVudG86OTEwMTU2NzNiNjA2NGEzMjkwMThiZGQyZDA4OTNjMWI=
```

### Available Endpoints

#### Products

- `GET /products` - Get all products with optional filters
- `GET /products?sku=SKU_CODE` - Get specific product
- `GET /products?category=CATEGORY` - Filter by category

#### Transactions

- `GET /transactions` - Get all transactions
- `GET /transactions?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` - Date range filter
- `GET /transactions?employee_id=ID` - Filter by employee
- `GET /transactions/{receiptNumber}` - Get specific transaction

#### Employees

- `GET /employees` - Get all employees
- `GET /employees?status=active` - Filter active/inactive

#### Timesheets

- `GET /timesheets?employee_id=ID&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

#### Shifts

- `GET /shifts?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

#### Customers

- `GET /customers?email=EMAIL` - Get customer by email

#### Inventory

- `GET /inventory` - Get current stock levels
- `GET /inventory?low_stock_only=true` - Get low stock items

#### Reports

- `GET /reports/sales?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` - Sales report

## Step 3: Response Format

All endpoints return JSON data. Example:

### Products Response

```json
[
  {
    "id": "69dc60e37bb1b80007962f8b",
    "sku": "SH0080",
    "name": "BAG AKAR",
    "category": "Bag",
    "price": 59.0,
    "cost": 16.0,
    "quantity": 10,
    "description": "Handmade bag"
  }
]
```

### Transactions Response

```json
[
  {
    "id": "0002604151413322",
    "receiptNumber": "0002604151413322",
    "timestamp": "2026-04-15T14:13:00Z",
    "storeId": "store_001",
    "registerId": "1",
    "employeeId": "emp_123",
    "items": [
      {
        "sku": "SH0053",
        "productName": "PS Keychain (5)",
        "quantity": 1,
        "unitPrice": 5.0,
        "totalPrice": 5.0
      }
    ],
    "subtotal": 5.0,
    "discount": 0.0,
    "tax": 0.0,
    "total": 5.0,
    "paymentMethod": "card",
    "status": "completed"
  }
]
```

## Step 4: Replace CSV Data in Your Components

### Before (Using CSV)

```typescript
// Old way - csvParser.ts
import { parseTransactionsCSV } from "@/lib/csvParser";

const transactions = await parseTransactionsCSV("/data/Transactions.csv");
```

### After (Using API)

```typescript
// New way - storehubApi.ts
import { getTransactions } from "@/lib/storehubApi";

const transactions = await getTransactions({
  startDate: "2026-04-01",
  endDate: "2026-07-31",
});
```

## Step 5: Update Your Pages/Components

### Example 1: Products Page

**File:** `app/products/page.tsx`

```typescript
import { getProducts } from '@/lib/storehubApi';
import ProductsClient from '@/components/ProductsClient';

export default async function ProductsPage() {
  try {
    const products = await getProducts({
      limit: 100,
      offset: 0
    });

    return (
      <ProductsClient initialProducts={products} />
    );
  } catch (error) {
    console.error('Failed to load products:', error);
    return <div>Error loading products</div>;
  }
}
```

### Example 2: Sales Report

**File:** `app/reports/page.tsx`

```typescript
import { getSalesReport, getTransactions } from '@/lib/storehubApi';
import MonthlyReportClient from '@/components/MonthlyReportClient';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default async function ReportsPage() {
  const today = new Date();
  const startDate = format(startOfMonth(today), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(today), 'yyyy-MM-dd');

  try {
    const [report, transactions] = await Promise.all([
      getSalesReport(startDate, endDate),
      getTransactions({ startDate, endDate })
    ]);

    return (
      <MonthlyReportClient
        report={report}
        transactions={transactions}
      />
    );
  } catch (error) {
    console.error('Failed to load report:', error);
    return <div>Error loading report</div>;
  }
}
```

### Example 3: Dashboard with Real-time Data

**File:** `app/dashboard/page.tsx`

```typescript
import { getTransactions, getInventory, getShifts } from '@/lib/storehubApi';

export default async function DashboardPage() {
  const today = new Date().toISOString().split('T')[0];

  try {
    const [transactions, inventory, shifts] = await Promise.all([
      getTransactions({
        startDate: today,
        endDate: today
      }),
      getInventory({ lowStockOnly: true }),
      getShifts({
        startDate: today,
        endDate: today,
        status: 'scheduled'
      })
    ]);

    return (
      <div>
        <h1>Dashboard</h1>
        <p>Today's Sales: {transactions.length}</p>
        <p>Low Stock Items: {inventory.length}</p>
        <p>Scheduled Shifts: {shifts.length}</p>
      </div>
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    return <div>Error loading dashboard</div>;
  }
}
```

## Step 6: Handling Errors & Retries

```typescript
import { getProducts } from "@/lib/storehubApi";

async function getProductsWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await getProducts();
    } catch (error) {
      if (i === retries - 1) throw error;
      // Wait before retry (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000),
      );
    }
  }
}
```

## Step 7: Caching API Responses

Use Next.js built-in caching for better performance:

```typescript
import { getProducts } from '@/lib/storehubApi';

// Cache for 1 hour
export const revalidate = 3600;

export default async function ProductsPage() {
  const products = await getProducts();
  return <ProductsClient initialProducts={products} />;
}
```

Or use React's `cache()`:

```typescript
import { cache } from 'react';
import { getProducts } from '@/lib/storehubApi';

const getCachedProducts = cache(async () => {
  return await getProducts();
});

export default async function ProductsPage() {
  const products = await getCachedProducts();
  return <ProductsClient initialProducts={products} />;
}
```

## Step 8: Testing API Connection

```typescript
// app/api/test-api/route.ts
import { testApiConnection } from "@/lib/storehubApi";

export async function GET() {
  const isConnected = await testApiConnection();

  return Response.json({
    connected: isConnected,
    timestamp: new Date().toISOString(),
  });
}
```

Then test with:

```bash
curl http://localhost:3000/api/test-api
```

## Step 9: Rate Limiting & Quotas

StoreHub API typically has rate limits. Consider implementing:

```typescript
import pRetry from "p-retry";

export async function getProductsWithRateLimit() {
  return pRetry(() => getProducts(), {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
  });
}
```

Install: `npm install p-retry`

## Step 10: Migration Checklist

- [ ] Create `.env.local` with API credentials
- [ ] Test API connection
- [ ] Update all data-fetching pages
- [ ] Update components to use API data
- [ ] Remove CSV parsing code (after verification)
- [ ] Update build scripts (remove CSV generation)
- [ ] Test all reports and dashboards
- [ ] Monitor API performance
- [ ] Set up monitoring/alerts

## Common Issues & Solutions

### Issue: "401 Unauthorized"

**Solution:** Check API key in `.env.local` is correct

### Issue: "API rate limit exceeded"

**Solution:** Implement caching and reduce unnecessary requests

### Issue: "Slow API responses"

**Solution:** Add server-side caching with `revalidate` or Redis

### Issue: "CORS errors"

**Solution:** API requests must be made from server-side only (Next.js Route Handlers or Server Components)

## Next Steps

1. Get your StoreHub API key
2. Set up `.env.local`
3. Test connection
4. Migrate one page at a time
5. Monitor performance
6. Remove CSV files once fully migrated
