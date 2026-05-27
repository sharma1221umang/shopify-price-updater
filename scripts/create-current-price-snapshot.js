require("dotenv").config();

const fs = require("fs");
const path = require("path");

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";

if (!SHOP || !TOKEN) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in .env");
  process.exit(1);
}

const ENDPOINT = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

const summary = {
  productsScanned: 0,
  variantsScanned: 0,
};

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

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

function createSnapshotFile(records) {
  const backupDir = path.join(process.cwd(), "backups");
  const filePath = path.join(backupDir, `current-price-snapshot-${timestampForFile()}.json`);

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));

  return filePath;
}

async function main() {
  console.log("Current price snapshot started");
  console.log("SHOP =", SHOP);
  console.log("API_VERSION =", API_VERSION);

  let cursor = null;
  let hasNextPage = true;
  const snapshotRecords = [];

  while (hasNextPage) {
    const query = `
      query Products($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              productType
              tags
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    barcode
                    price
                    compareAtPrice
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await shopifyGraphQL(query, { cursor });

    for (const edge of data.products.edges) {
      const product = edge.node;
      summary.productsScanned++;

      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        summary.variantsScanned++;

        snapshotRecords.push({
          productId: product.id,
          productTitle: product.title,
          productType: product.productType,
          productTags: product.tags,
          productHandle: product.handle,
          variantId: variant.id,
          variantTitle: variant.title,
          sku: variant.sku,
          barcode: variant.barcode,
          inventoryQuantity: Number(variant.inventoryQuantity || 0),
          currentPrice: moneyToNumber(variant.price),
          currentCompareAtPrice: moneyToNumber(variant.compareAtPrice),
        });
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  const outputFilePath = createSnapshotFile(snapshotRecords);

  console.log("FINAL SUMMARY:");
  console.log(JSON.stringify(summary, null, 2));
  console.log("Snapshot file created:");
  console.log(outputFilePath);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
