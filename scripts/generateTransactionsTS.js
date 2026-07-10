const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

// Read the CSV file
const csvPath = path.join(
  __dirname,
  "../public/data/Transactions_04-01-2026_07-07-2026.csv",
);
const csvContent = fs.readFileSync(csvPath, "utf-8");

// Parse CSV
const parsed = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
});

const transactions = parsed.data;

// Generate TypeScript file
const outputPath = path.join(__dirname, "../data/transactions.ts");
const tsContent = `// This file is auto-generated from CSV. Do not edit manually.
// Run: npm run generate:transactions

const transactions = ${JSON.stringify(transactions, null, 2)};

export default transactions;
`;

fs.writeFileSync(outputPath, tsContent, "utf-8");
console.log(`✅ Generated ${outputPath} (${transactions.length} records)`);
