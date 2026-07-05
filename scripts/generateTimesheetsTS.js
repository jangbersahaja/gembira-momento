const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

// Read the CSV file
const csvPath = path.join(
  __dirname,
  "../public/data/Timesheets_04-01-2026_07-31-2026.csv",
);
const csvContent = fs.readFileSync(csvPath, "utf-8");

// Parse CSV
const parsed = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
});

const timesheets = parsed.data;

// Generate TypeScript file
const outputPath = path.join(__dirname, "../data/timesheets.ts");
const tsContent = `// This file is auto-generated from CSV. Do not edit manually.
// Run: npm run generate:timesheets

const timesheets = ${JSON.stringify(timesheets, null, 2)};

export default timesheets;
`;

fs.writeFileSync(outputPath, tsContent, "utf-8");
console.log(`✅ Generated ${outputPath} (${timesheets.length} records)`);
