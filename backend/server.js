const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const express = require("express");
const priceRoutes = require("./routes/priceRoutes");
const { assertShopifyConfig } = require("./services/shopifyService");

const app = express();
const PORT = 3000;
const frontendPath = path.resolve(__dirname, "..", "frontend");

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://admin.shopify.com https://rystwy-z1.myshopify.com https://mittalsarees.myshopify.com;"
  );
  res.removeHeader("X-Frame-Options");
  next();
});
app.use(express.static(frontendPath));
app.use("/api", priceRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: err.message,
  });
});

try {
  assertShopifyConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Dashboard backend running on http://localhost:${PORT}`);
});
