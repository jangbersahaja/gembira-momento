# CSV Data Import Setup

## Overview

Your transaction data is now stored in CSV format and automatically converted to TypeScript at build time.

## Files

- **CSV Source**: `/public/data/Transactions_04-01-2026_07-04-2026 (1).csv`
- **Generated TS**: `/data/transactions.ts` (auto-generated, do not edit)
- **Build Script**: `/scripts/generateTransactionsTS.js`

## Usage

### Development

```bash
npm run dev
```

The CSV will automatically be converted to TypeScript when the build runs.

### Generate Transactions (Manual)

```bash
npm run generate:transactions
```

This updates `/data/transactions.ts` from the CSV file.

### Production Build

```bash
npm run build
```

The build script automatically generates `transactions.ts` before building Next.js.

## How It Works

1. **CSV File**: Your transaction data is stored in `/public/data/` as a standard CSV file
2. **Build Script**: `scripts/generateTransactionsTS.js` reads the CSV and converts it to a TypeScript file
3. **Type Safety**: The generated TS file can be imported and used with full TypeScript support
4. **Components**: All components continue to use the same import:

```typescript
import transactions from "@/data/transactions";
```

## Benefits

- ✅ **Editable**: Update transaction data in CSV format (Excel, Google Sheets, etc.)
- ✅ **Type Safe**: Full TypeScript support in components
- ✅ **No Runtime Overhead**: CSV parsing happens at build time
- ✅ **Version Control**: Track changes to data easily in Git

## Adding Other CSV Files

Follow the same pattern for other data files (timesheets, products, expenses):

1. Create a CSV file in `/public/data/`
2. Create a build script in `/scripts/` (copy the transactions script)
3. Update `package.json` build script to run all generators
4. Run `npm run generate:transactions` (or equivalent)

## Notes

- The transactions.ts file is generated automatically and should not be manually edited
- Always edit the CSV files directly, then regenerate
- The generated file is safe to commit to Git (it's a snapshot of the CSV data)
