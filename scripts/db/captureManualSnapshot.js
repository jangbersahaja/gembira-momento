/**
 * Capture a one-off "manual" stock snapshot right now, using the currently
 * running dev/prod server's live StoreHub inventory data.
 *
 * Useful when:
 *  - You want a baseline snapshot before automatic capture has any history.
 *  - StoreHub hasn't synced today's shift/timesheet yet, but you know a
 *    clock-out just happened and want the stock level on record anyway.
 *
 * Usage: npm run snapshot:manual -- --base=http://localhost:3001
 * (default base is http://localhost:3000)
 */
require("dotenv").config({ path: ".env.local" });
const { neon } = require("@neondatabase/serverless");

const args = process.argv.slice(2);
const baseArg = args.find((a) => a.startsWith("--base="));
const BASE_URL = baseArg ? baseArg.split("=")[1] : "http://localhost:3000";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const storeId = process.env.NEXT_PUBLIC_STOREHUB_STORE_ID;

  if (!connectionString) {
    console.error("DATABASE_URL is not set (check .env.local)");
    process.exit(1);
  }
  if (!storeId) {
    console.error(
      "NEXT_PUBLIC_STOREHUB_STORE_ID is not set (check .env.local)",
    );
    process.exit(1);
  }

  const sql = neon(connectionString);

  console.log(`Fetching live inventory + products from ${BASE_URL} ...`);
  const [inventoryRes, productsRes] = await Promise.all([
    fetch(`${BASE_URL}/api/storehub/inventory/${storeId}`),
    fetch(`${BASE_URL}/api/storehub/products?limit=500`),
  ]);

  if (!inventoryRes.ok)
    throw new Error(`Inventory fetch failed: ${inventoryRes.status}`);
  if (!productsRes.ok)
    throw new Error(`Products fetch failed: ${productsRes.status}`);

  const inventory = await inventoryRes.json();
  const products = await productsRes.json();

  const productIdToSku = new Map(products.map((p) => [p.id, p.sku]));

  const capturedAt = new Date().toISOString();
  const shiftKey = `manual_${capturedAt}`;

  let inserted = 0;
  for (const item of inventory) {
    const sku = productIdToSku.get(item.productId);
    if (!sku) continue;

    await sql`
      INSERT INTO stock_snapshots (sku, product_id, store_id, quantity, event_type, employee_id, shift_key, captured_at)
      VALUES (${sku}, ${item.productId}, ${storeId}, ${item.quantityOnHand}, 'manual', NULL, ${shiftKey}, ${capturedAt})
      ON CONFLICT (sku, shift_key) DO NOTHING
    `;
    inserted += 1;
  }

  console.log(
    `✅ Captured manual snapshot for ${inserted} SKUs at ${capturedAt}`,
  );
}

main().catch((err) => {
  console.error("❌ Manual snapshot failed:", err);
  process.exit(1);
});
