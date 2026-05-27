const { readBackupFile } = require("../utils/backupUtils");
const { moneyToNumber } = require("../utils/priceUtils");
const { restoreVariantPrice } = require("./shopifyService");

async function restorePrices(body = {}) {
  if (!body.backupFile) {
    throw new Error("backupFile is required.");
  }

  const live = body.live === true;
  const { path, records } = readBackupFile(body.backupFile);
  const results = [];
  const summary = {
    scanned: records.length,
    restored: 0,
    skipped: 0,
    failed: 0,
  };

  for (const record of records) {
    const oldPrice = moneyToNumber(record.oldPrice);
    const result = {
      productId: record.productId,
      productTitle: record.productTitle,
      productType: record.productType,
      productTags: record.productTags,
      productHandle: record.productHandle,
      variantId: record.variantId,
      variantTitle: record.variantTitle,
      sku: record.sku,
      barcode: record.barcode,
      inventoryQuantity: record.inventoryQuantity,
      oldPrice,
      oldCompareAtPrice: record.oldCompareAtPrice,
      oldDiscount: record.oldDiscount,
      newPrice: record.newPrice,
      newDiscount: record.newDiscount,
      action: live ? "RESTORE" : "DRY_RUN_RESTORE",
      reason: null,
      verification: null,
    };

    if (!record.variantId || oldPrice === null) {
      summary.skipped++;
      result.action = "SKIP";
      result.reason = "Missing variantId or oldPrice";
      results.push(result);
      continue;
    }

    if (live) {
      try {
        const mutationResponse = await restoreVariantPrice(record.variantId, oldPrice);
        const userErrors = mutationResponse.userErrors || [];

        if (userErrors.length) {
          summary.failed++;
          result.action = "RESTORE_FAILED_USER_ERRORS";
          result.reason = JSON.stringify(userErrors);
        } else {
          summary.restored++;
        }
      } catch (err) {
        summary.failed++;
        result.action = "RESTORE_FAILED";
        result.reason = err.message;
      }
    }

    results.push(result);
  }

  return {
    success: true,
    mode: live ? "live" : "dry-run",
    backupPath: path,
    summary,
    results,
  };
}

module.exports = {
  restorePrices,
};
