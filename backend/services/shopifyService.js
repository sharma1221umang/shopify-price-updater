const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";

function assertShopifyConfig() {
  if (!SHOP || !TOKEN) {
    throw new Error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in .env");
  }
}

async function shopifyGraphQL(query, variables = {}) {
  assertShopifyConfig();

  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
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

async function fetchProductsPage(cursor = null) {
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
            vendor
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

  return shopifyGraphQL(query, { cursor });
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

  return data.productVariantUpdate;
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

  return data.node.price;
}

module.exports = {
  assertShopifyConfig,
  fetchProductsPage,
  getVariantPrice,
  restoreVariantPrice,
  updateVariantPrice,
};
