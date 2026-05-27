# Shopify Price Updater Dashboard

Internal Shopify pricing dashboard for Mittal Sarees.

This tool allows staff to safely create custom price update rules, run dry runs, apply live price updates, and restore old prices from backups.

---

## Important Safety Notes

- Never expose `SHOPIFY_ADMIN_ACCESS_TOKEN` in frontend code.
- All Shopify Admin API calls must happen from the backend only.
- Always run **Dry Run** before **Apply Live Update**.
- Live update creates a backup before changing prices.
- Restore Live should only be used with real backup files.
- Preview files are not restore points.

---

## Project Structure

```text
shopify-price-updater
│
├── backend
│   ├── server.js
│   ├── routes
│   ├── services
│   ├── utils
│   └── examples
│
├── frontend
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── scripts
│   ├── update-lehenga-prices.js
│   ├── restore-lehenga-prices.js
│   ├── create-current-price-snapshot.js
│   └── test-shopify-token.js
│
├── backups
│
├── .env
├── oauth-token-server.js
├── package.json
├── package-lock.json
├── shopify.app.toml
└── README.md

---

## Environment Variables

The `.env` file already exists in the project root.

Required format:

```env
SHOPIFY_STORE_DOMAIN=rystwy-z1.myshopify.com
SHOPIFY_API_VERSION=2026-04
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_ADMIN_ACCESS_TOKEN=your_admin_access_token
SCOPES=read_inventory,read_products,write_products
DRY_RUN=true
```

Do not commit `.env` to GitHub.

---

## Install Dependencies

```bash
npm install
```

---

## Start Dashboard

```bash
npm run dashboard
```

Then open:

```text
http://localhost:3000/
```

Health check:

```text
http://localhost:3000/api/health
```

Expected response:

```json
{
  "success": true,
  "status": "ok"
}
```

---

## Dashboard Features

Staff can manually create pricing rules using:

- Product title
- Product type
- Product tags
- Product handle
- Vendor
- Variant title
- SKU
- Barcode
- Inventory quantity
- Price
- Compare-at price
- Current discount percentage

Supported operators:

- equals
- not equals
- contains
- does not contain
- starts with
- ends with
- greater than
- less than
- greater than or equal
- less than or equal
- is empty
- is not empty

---

## Match Mode

### ALL

Every condition must match. This is recommended for safe price updates.

### ANY

Only one condition needs to match. This can affect many products, so the dashboard shows a warning when ANY mode is selected.

---

## Action

Currently supported action:

```text
Set discount percentage
```

Formula:

```text
new price = compare-at price × (1 - discount / 100)
```

Example:

```text
Compare-at price = 10000
Discount = 40%
New price = 6000
```

---

## Safety Features

The dashboard includes:

- Dry Run before live update
- Backup before live update
- Verification after live update
- Large update warning
- ANY mode warning
- APPLY typed confirmation before live update
- RESTORE typed confirmation before live restore
- Restore dropdown only shows real backup files
- Preview/snapshot files are hidden from restore dropdown

---

## Backup Files

Real restore files use this format:

```text
lehenga-price-backup-YYYY-MM-DD-HH-mm-ss.json
```

Preview files are not restore points:

```text
lehenga-price-preview-YYYY-MM-DD-HH-mm-ss.json
```

Snapshot files are also not restore points:

```text
current-price-snapshot-YYYY-MM-DD-HH-mm-ss.json
```

---

## Restore

Use **Restore Dry Run** first.

Use **Restore Live** only when you are sure.

Restore Live requires typing:

```text
RESTORE
```

---

## Useful API Routes

```text
GET  /api/health
POST /api/price-updater/dry-run
POST /api/price-updater/apply
GET  /api/backups
POST /api/price-updater/restore
```

---

## Old OAuth Token Server

`oauth-token-server.js` was used only to generate the Shopify Admin access token.

The main dashboard uses:

```text
backend/server.js
```

Start the dashboard with:

```bash
npm run dashboard
```

---

## CLI Scripts

Dry run / update script:

```bash
node scripts/update-lehenga-prices.js
```

Restore script:

```bash
node scripts/restore-lehenga-prices.js backups/file-name.json
```

Live restore:

```bash
node scripts/restore-lehenga-prices.js backups/file-name.json --live
```

Create current Shopify price snapshot:

```bash
node scripts/create-current-price-snapshot.js
```

Test Shopify token:

```bash
node scripts/test-shopify-token.js
```

---

## Recommended Staff Workflow

1. Open dashboard.
2. Create conditions manually.
3. Read Rule Preview Text.
4. Click Dry Run.
5. Check summary and results table.
6. If results are correct, click Apply Live Update.
7. Type APPLY in confirmation.
8. Keep generated backup file safe.

---

## Developer Notes

Do not put Shopify Admin API token in:

- `frontend/app.js`
- `frontend/index.html`
- `frontend/style.css`

The token must remain in `.env` and be used only by backend code.

Before deployment, verify:

```bash
node --check backend/server.js
node --check frontend/app.js
```