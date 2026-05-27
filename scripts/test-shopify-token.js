require("dotenv").config();

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";

async function main() {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({
      query: `
        query {
          shop {
            name
            myshopifyDomain
          }
        }
      `,
    }),
  });

  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

main().catch(console.error);