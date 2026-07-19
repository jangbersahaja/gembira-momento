const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

// Read the CSV file
const csvPath = path.join(__dirname, "../public/data/Products (11).csv");
const csvContent = fs.readFileSync(csvPath, "utf-8");

// Parse CSV
const parsed = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
});

// Filter out the header description row (first row after headers)
const products = parsed.data.filter((product) => {
  // Skip if SKU contains "Required" or "Must be unique" (it's the description row)
  if (typeof product.SKU === "string" && product.SKU.includes("Required")) {
    return false;
  }
  return true;
});

// Generate TypeScript file
const outputPath = path.join(__dirname, "../data/products.ts");
const tsContent = `// This file is auto-generated from CSV. Do not edit manually.
// Run: npm run generate:products

const products = ${JSON.stringify(products, null, 2)};

export default products;
`;

fs.writeFileSync(outputPath, tsContent, "utf-8");
console.log(`✅ Generated ${outputPath} (${products.length} records)`);
