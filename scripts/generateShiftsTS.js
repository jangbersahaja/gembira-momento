const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const csvPath = path.join(
  __dirname,
  "../public/data/Shifts_04-01-2026_07-31-2026 (5).csv",
);
const csvContent = fs.readFileSync(csvPath, "utf-8");

const parsed = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
});

const shifts = parsed.data;

const outputPath = path.join(__dirname, "../data/shifts.ts");
const tsContent = `// This file is auto-generated from CSV. Do not edit manually.
// Run: npm run generate:shifts

const shifts = ${JSON.stringify(shifts, null, 2)};

export default shifts;
`;

fs.writeFileSync(outputPath, tsContent, "utf-8");
console.log(`✅ Generated ${outputPath} (${shifts.length} records)`);
