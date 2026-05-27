require("dotenv").config();

const fs = require("fs");
const path = require("path");

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!SHOP || !TOKEN) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in .env");
  process.exit(1);
}

const ENDPOINT = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

const summary = {
  productsScanned: 0,
  variantsScanned: 0,
  updated: 0,
  skippedAlready40OrMore: 0,
  skippedCJM: 0,
  skippedOutOfStock: 0,
  skippedNonLehenga: 0,
  skippedMissingCompareAt: 0,
  skippedInvalidPrice: 0,
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

function hasCJM(...values) {
  return values.some((v) => String(v || "").toLowerCase().includes("cjm"));
}

function isLehenga(product) {
  const productType = String(product.productType || "").toLowerCase();
  const title = String(product.title || "").toLowerCase();

  return productType === "lehenga" || title.includes("lehenga");
}

function discountPercent(price, compareAtPrice) {
  return ((compareAtPrice - price) / compareAtPrice) * 100;
}

function roundToTwo(value) {
  return Number(value.toFixed(2));
}

function pricesMatch(actual, expected) {
  if (actual === null || expected === null) return false;
  return roundToTwo(actual) === roundToTwo(expected);
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

function createBackupFile(records) {
  const backupDir = path.join(process.cwd(), "backups");
  const prefix = DRY_RUN ? "lehenga-price-preview" : "lehenga-price-backup";
  const filePath = path.join(backupDir, `${prefix}-${timestampForFile()}.json`);

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));

  return filePath;
}

async function updateVariantPrice(productId, variantId, newPrice) {
  const mutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        product {
          id
        }
        productVariants {
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
    productId,
    variants: [
      {
        id: variantId,
        price: newPrice.toFixed(2),
      },
    ],
  });

  return data.productVariantsBulkUpdate;
}

async function getVariantPrice(variantId) {
  const query = `
    query Variant($id: ID!) {
      node(id: $id) {
        ... on ProductVariant {
          id
          price
          compareAtPrice
        }
      }
    }
  `;

  const data = await shopifyGraphQL(query, { id: variantId });

  if (!data.node) {
    throw new Error(`Variant not found: ${variantId}`);
  }

  return moneyToNumber(data.node.price);
}

async function main() {
  console.log("Lehenga 40% price updater started");
  console.log("DRY_RUN =", DRY_RUN);
  console.log("SHOP =", SHOP);
  console.log("API_VERSION =", API_VERSION);

  let cursor = null;
  let hasNextPage = true;
  const updateCandidates = [];

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

      const lehenga = isLehenga(product);

      if (!lehenga) {
        summary.skippedNonLehenga++;
        continue;
      }

      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        summary.variantsScanned++;

        const price = moneyToNumber(variant.price);
        const compareAt = moneyToNumber(variant.compareAtPrice);
        const inventory = Number(variant.inventoryQuantity || 0);

        const logBase = {
          productId: product.id,
          productTitle: product.title,
          productType: product.productType,
          productTags: product.tags,
          variantId: variant.id,
          variantTitle: variant.title,
          sku: variant.sku,
          barcode: variant.barcode,
          inventoryQuantity: inventory,
          oldPrice: price,
          oldCompareAtPrice: compareAt,
        };

        if (hasCJM(variant.sku, variant.barcode, product.title, product.handle)) {
          summary.skippedCJM++;
          console.log(JSON.stringify({ ...logBase, action: "SKIP", reason: "CJM found" }));
          continue;
        }

        if (inventory < 1) {
          summary.skippedOutOfStock++;
          console.log(JSON.stringify({ ...logBase, action: "SKIP", reason: "Out of stock" }));
          continue;
        }

        if (!compareAt || !price || compareAt <= price) {
          summary.skippedMissingCompareAt++;
          console.log(JSON.stringify({ ...logBase, action: "SKIP", reason: "Missing/invalid compare_at_price" }));
          continue;
        }

        const oldDiscount = discountPercent(price, compareAt);

        if (oldDiscount >= 40) {
          summary.skippedAlready40OrMore++;
          console.log(JSON.stringify({ ...logBase, oldDiscount: oldDiscount.toFixed(2), action: "SKIP", reason: "Already >= 40%" }));
          continue;
        }

        const newPrice = compareAt * 0.6;
        const minAllowedPrice = compareAt * 0.6;
        const newDiscount = discountPercent(newPrice, compareAt);

        if (newPrice <= 0 || newPrice >= compareAt || newPrice < minAllowedPrice) {
          summary.skippedInvalidPrice++;
          console.log(JSON.stringify({ ...logBase, oldDiscount: oldDiscount.toFixed(2), newPrice, action: "SKIP", reason: "Invalid new price" }));
          continue;
        }

        if (DRY_RUN) {
          console.log(JSON.stringify({
            ...logBase,
            oldDiscount: oldDiscount.toFixed(2),
            newPrice: newPrice.toFixed(2),
            newDiscount: newDiscount.toFixed(2),
            action: "DRY_RUN_UPDATE",
          }));
        }

        updateCandidates.push({
          ...logBase,
          oldDiscount: roundToTwo(oldDiscount),
          newPrice: roundToTwo(newPrice),
          newDiscount: roundToTwo(newDiscount),
          timestamp: new Date().toISOString(),
        });
        summary.updated++;
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  let backupFilePath;
  try {
    backupFilePath = createBackupFile(updateCandidates);
  } catch (err) {
    console.error("FAILED TO CREATE BACKUP FILE:", err.message);
    console.error("No prices were updated.");
    process.exit(1);
  }

  console.log(DRY_RUN ? "Preview file created:" : "Backup file created:");
  console.log(backupFilePath);

  if (!DRY_RUN) {
    for (const record of updateCandidates) {
      const expectedNewPrice = Number(record.newPrice);

      console.log(JSON.stringify({
        ...record,
        expectedNewPrice,
        action: "UPDATE_ATTEMPT",
      }));

      const mutationResponse = await updateVariantPrice(record.productId, record.variantId, expectedNewPrice);

      console.log(JSON.stringify({
        productId: record.productId,
        variantId: record.variantId,
        productVariants: mutationResponse.productVariants,
        userErrors: mutationResponse.userErrors,
        action: "UPDATE_MUTATION_RESPONSE",
      }));

      if (mutationResponse.userErrors && mutationResponse.userErrors.length) {
        console.log(JSON.stringify({
          ...record,
          expectedNewPrice,
          userErrors: mutationResponse.userErrors,
          action: "UPDATE_FAILED_USER_ERRORS",
        }));
        continue;
      }

      const actualPriceAfterUpdate = await getVariantPrice(record.variantId);
      const verification = pricesMatch(actualPriceAfterUpdate, expectedNewPrice) ? "PASS" : "FAIL";

      console.log(JSON.stringify({
        ...record,
        expectedNewPrice: roundToTwo(expectedNewPrice),
        actualPriceAfterUpdate,
        verification,
        action: "VERIFY_PRICE_AFTER_UPDATE",
      }));

      if (verification === "FAIL") {
        console.log(JSON.stringify({
          ...record,
          expectedNewPrice: roundToTwo(expectedNewPrice),
          actualPriceAfterUpdate,
          action: "UPDATE_FAILED_VERIFICATION",
        }));
      }
    }
  }

  console.log("FINAL SUMMARY:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
