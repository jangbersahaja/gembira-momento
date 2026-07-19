/**
 * One-time seed of historical restocking activity from StoreHub CSV exports
 * (Purchase Orders, Stock Return, Stock Take) into the `restock_events` table.
 *
 * These CSVs are the only historical restock records available (from before
 * automatic stock snapshotting existed). Safe to re-run: uses ON CONFLICT
 * DO NOTHING keyed on (sku, source, reference_id).
 *
 * Usage: npm run db:seed-restock-history
 */
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { neon } = require("@neondatabase/serverless");

const DATA_DIR = path.join(__dirname, "../../public/data");

function parseCsv(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Skipping missing file: ${fileName}`);
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
  return parsed.data;
}

// StoreHub date format: "MM/DD/YYYY HH:mm"
function parseStoreHubDate(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split(" ");
  if (!datePart) return null;
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour = 0, minute = 0] = (timePart || "").split(":").map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(String(value).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

async function seedPurchaseOrders(sql) {
  const rows = parseCsv("Purchase_Orders_07-19-2026.csv");
  let inserted = 0;

  for (const row of rows) {
    const sku = row["SKU"]?.trim();
    if (!sku) continue; // skip PO header/summary rows (no line item)
    if (row["Status"] !== "Completed") continue;

    const quantity = toNumber(
      row["Received Quantity"] || row["Ordered Quantity"],
    );
    if (quantity <= 0) continue;

    const occurredAt =
      parseStoreHubDate(row["Completion Date"]) ||
      parseStoreHubDate(row["Created Date"]);
    if (!occurredAt) continue;

    const referenceId = `${row["P.O ID"]}-${row["No."] || sku}`;

    await sql`
      INSERT INTO restock_events (sku, quantity, source, reference_id, supplier, cost, occurred_at, notes)
      VALUES (${sku}, ${quantity}, 'purchase_order', ${referenceId}, ${row["Supplier"] || null}, ${toNumber(row["Cost (RM)"])}, ${occurredAt}, ${row["Product Name"] || null})
      ON CONFLICT (sku, source, reference_id) DO NOTHING
    `;
    inserted += 1;
  }

  console.log(`✅ Purchase orders: processed ${inserted} line items`);
}

async function seedStockReturns(sql) {
  const rows = parseCsv("Stock_Return_07-19-2026.csv");
  let inserted = 0;

  for (const row of rows) {
    const sku = row["SKU"]?.trim();
    if (!sku) continue;
    if (row["Status"] !== "Completed") continue;

    const quantity = toNumber(row["Returned Quantity"]);
    if (quantity <= 0) continue;

    const occurredAt =
      parseStoreHubDate(row["Completion Date"]) ||
      parseStoreHubDate(row["Created Date"]);
    if (!occurredAt) continue;

    const referenceId = `${row["S.R ID"]}-${sku}`;

    // Stock returns REMOVE stock (returned to supplier / consignment owner)
    await sql`
      INSERT INTO restock_events (sku, quantity, source, reference_id, supplier, cost, occurred_at, notes)
      VALUES (${sku}, ${-quantity}, 'stock_return', ${referenceId}, ${row["Supplier"] || null}, ${toNumber(row["Cost (RM)"])}, ${occurredAt}, ${row["Product Name"] || null})
      ON CONFLICT (sku, source, reference_id) DO NOTHING
    `;
    inserted += 1;
  }

  console.log(`✅ Stock returns: processed ${inserted} line items`);
}

async function seedStockTakes(sql) {
  const rows = parseCsv("Stock_Take_07-19-2026.csv");
  let inserted = 0;

  for (const row of rows) {
    const sku = row["SKU"]?.trim();
    if (!sku) continue;
    if (row["Status"] !== "Completed") continue;

    const difference = toNumber(row["Difference"]);
    if (difference === 0) continue; // no correction needed

    const occurredAt =
      parseStoreHubDate(row["Completed Time"]) ||
      parseStoreHubDate(row["Start Time"]);
    if (!occurredAt) continue;

    const referenceId = `${row["Start Time"]}-${sku}`;

    // Positive difference = counted MORE than expected (stock correction up)
    // Negative difference = counted LESS than expected (shrinkage / correction down)
    await sql`
      INSERT INTO restock_events (sku, quantity, source, reference_id, supplier, cost, occurred_at, notes)
      VALUES (${sku}, ${difference}, 'stock_take', ${referenceId}, ${row["Supplier"] || null}, ${toNumber(row["Cost (RM)"])}, ${occurredAt}, ${row["Product Name"] || "Stock take correction"})
      ON CONFLICT (sku, source, reference_id) DO NOTHING
    `;
    inserted += 1;
  }

  console.log(`✅ Stock takes: processed ${inserted} line items`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set (check .env.local)");
    process.exit(1);
  }
  const sql = neon(connectionString);

  await seedPurchaseOrders(sql);
  await seedStockReturns(sql);
  await seedStockTakes(sql);

  console.log("🎉 Done seeding historical restock activity.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
