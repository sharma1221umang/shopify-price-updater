const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SCOPES,
  SHOPIFY_STORE_DOMAIN,
} = process.env;

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !SCOPES || !SHOPIFY_STORE_DOMAIN) {
  console.error('Missing required .env values. Please set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, and SHOPIFY_STORE_DOMAIN.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

function safeCompare(a, b) {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function buildQueryString(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}

function verifyHmac(query) {
  const { hmac, signature, ...rest } = query;
  const message = buildQueryString(rest);
  const generatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');
  return safeCompare(generatedHmac, hmac || '');
}

function saveEnvValue(key, value) {
  const envContents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  let updated = '';
  if (regex.test(envContents)) {
    updated = envContents.replace(regex, `${key}=${value}`);
  } else {
    updated = envContents.trim().length > 0 ? `${envContents}\n${key}=${value}` : `${key}=${value}`;
  }
  fs.writeFileSync(envPath, updated, 'utf8');
}

app.get('/auth', (req, res) => {
  const installUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/authorize?client_id=${encodeURIComponent(
    SHOPIFY_API_KEY,
  )}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.redirect(installUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code, shop, hmac, state } = req.query;

  if (!code || !shop || !hmac) {
    return res.status(400).send('Required query params missing.');
  }

  if (!verifyHmac(req.query)) {
    return res.status(400).send('HMAC validation failed.');
  }

  try {
    const tokenUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`;
    const payload = {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    };

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', response.status, errorText);
      return res.status(500).send(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    const { access_token } = data;

    if (!access_token) {
      console.error('No access_token returned by Shopify:', data);
      return res.status(500).send('No access_token returned by Shopify.');
    }

    console.log('SHOPIFY_ADMIN_ACCESS_TOKEN:', access_token);
    saveEnvValue('SHOPIFY_ADMIN_ACCESS_TOKEN', access_token);

    return res.send('Access token received and saved to .env as SHOPIFY_ADMIN_ACCESS_TOKEN.');
  } catch (error) {
    console.error('Callback error:', error);
    return res.status(500).send('An error occurred while exchanging the authorization code.');
  }
});

app.listen(PORT, () => {
  console.log(`Shopify OAuth app listening on http://localhost:${PORT}`);
  console.log('Visit http://localhost:3000/auth to start the OAuth flow.');
});
