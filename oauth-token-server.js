require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

const PORT = 3000;

const SHOP = process.env.SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_API_KEY;
const CLIENT_SECRET = process.env.SHOPIFY_API_SECRET;

const SCOPES = process.env.SCOPES;

app.get("/auth", (req, res) => {
  const redirectUri = "http://localhost:3000/auth/callback";

  const installUrl =
    `https://${SHOP}/admin/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post(
      `https://${SHOP}/admin/oauth/access_token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }
    );

    const accessToken = response.data.access_token;

    console.log("\nSHOPIFY ADMIN ACCESS TOKEN:\n");
    console.log(accessToken);

    res.send(`
      <h1>Token Generated Successfully</h1>
      <pre>${accessToken}</pre>
    `);
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.send("OAuth failed");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
