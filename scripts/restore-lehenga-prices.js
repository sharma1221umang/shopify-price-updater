require("dotenv").config();

const fs = require("fs");
const path = require("path");

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";
const LIVE = process.argv.includes("--live");
const DRY_RUN = !LIVE;
const backupFileArg = process.argv.slice(2).find((arg) => arg !== "--live");

if (!SHOP || !TOKEN) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in .env");
  process.exit(1);
}

if (!backupFileArg) {
  console.error("Usage: node scripts/restore-lehenga-prices.js backups/file-name.json [--live]");
  process.exit(1);
}

const ENDPOINT = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

async function shopifyGraphQL(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors || json, null, 2));
  }

  return json.data;
}

function moneyToNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function restoreVariantPrice(variantId, oldPrice) {
  const mutation = `
    mutation UpdateVariant($input: ProductVariantInput!) {
      productVariantUpdate(input: $input) {
        productVariant {
          id
          price
          compareAtPrice
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await shopifyGraphQL(mutation, {
    input: {
      id: variantId,
      price: oldPrice.toFixed(2),
    },
  });

  const errors = data.productVariantUpdate.userErrors;
  if (errors && errors.length) {
    throw new Error(JSON.stringify(errors));
  }
}

function loadBackup(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(resolvedPath, "utf8");
  const records = JSON.parse(raw);

  if (!Array.isArray(records)) {
    throw new Error("Backup file must contain a JSON array.");
  }

  return { records, resolvedPath };
}

async function main() {
  console.log("Lehenga price restore started");
  console.log("DRY_RUN =", DRY_RUN);
  console.log("SHOP =", SHOP);
  console.log("API_VERSION =", API_VERSION);

  const { records, resolvedPath } = loadBackup(backupFileArg);
  console.log("Backup file =", resolvedPath);

  let restored = 0;
  let skipped = 0;

  for (const record of records) {
    const oldPrice = moneyToNumber(record.oldPrice);

    if (!record.variantId || oldPrice === null) {
      skipped++;
      console.log(JSON.stringify({
        productId: record.productId,
        productTitle: record.productTitle,
        variantId: record.variantId,
        variantTitle: record.variantTitle,
        sku: record.sku,
        action: "SKIP",
        reason: "Missing variantId or oldPrice",
      }));
      continue;
    }

    console.log(JSON.stringify({
      productId: record.productId,
      productTitle: record.productTitle,
      variantId: record.variantId,
      variantTitle: record.variantTitle,
      sku: record.sku,
      oldPrice,
      action: DRY_RUN ? "DRY_RUN_RESTORE" : "RESTORE",
    }));

    if (!DRY_RUN) {
      await restoreVariantPrice(record.variantId, oldPrice);
    }

    restored++;
  }

  console.log("FINAL SUMMARY:");
  console.log(JSON.stringify({ restored, skipped, dryRun: DRY_RUN }, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
