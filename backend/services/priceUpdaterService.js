const { createPriceUpdateFile } = require("../utils/backupUtils");
const {
  discountPercent,
  moneyToNumber,
  pricesMatch,
  roundToTwo,
} = require("../utils/priceUtils");
const { normalizeRuleRequest } = require("../utils/ruleUtils");
const { evaluateRules } = require("./ruleEngineService");
const {
  fetchProductsPage,
  getVariantPrice,
  updateVariantPrice,
} = require("./shopifyService");

function createSummary() {
  return {
    productsScanned: 0,
    variantsScanned: 0,
    matched: 0,
    updateCandidates: 0,
    updated: 0,
    skippedRuleMismatch: 0,
    skippedMissingCompareAt: 0,
    skippedInvalidPrice: 0,
    skippedAlreadyTargetPrice: 0,
    skippedPriceIncreaseBlocked: 0,
    skippedCompareAtPriceSafety: 0,
    updateFailedUserErrors: 0,
    updateFailedVerification: 0,
  };
}

function createResultBase(product, variant, ruleEvaluation) {
  const oldPrice = moneyToNumber(variant.price);
  const oldCompareAtPrice = moneyToNumber(variant.compareAtPrice);
  const oldDiscount = oldPrice !== null && oldCompareAtPrice && oldCompareAtPrice > oldPrice
    ? roundToTwo(discountPercent(oldPrice, oldCompareAtPrice))
    : null;

  return {
    productId: product.id,
    productTitle: product.title,
    productType: product.productType,
    productTags: product.tags,
    productHandle: product.handle,
    vendor: product.vendor,
    variantId: variant.id,
    variantTitle: variant.title,
    sku: variant.sku,
    barcode: variant.barcode,
    inventoryQuantity: Number(variant.inventoryQuantity || 0),
    matchedConditions: ruleEvaluation.matchedConditions,
    failedConditions: ruleEvaluation.failedConditions,
    oldPrice,
    oldCompareAtPrice,
    oldDiscount,
    newPrice: null,
    newDiscount: null,
    action: null,
    reason: null,
    verification: null,
  };
}

function createBackupRecord(result) {
  return {
    productId: result.productId,
    productTitle: result.productTitle,
    productType: result.productType,
    productTags: result.productTags,
    productHandle: result.productHandle,
    variantId: result.variantId,
    variantTitle: result.variantTitle,
    sku: result.sku,
    barcode: result.barcode,
    inventoryQuantity: result.inventoryQuantity,
    oldPrice: result.oldPrice,
    oldCompareAtPrice: result.oldCompareAtPrice,
    oldDiscount: result.oldDiscount,
    actionType: result.actionType,
    newPrice: result.newPrice,
    newDiscount: result.newDiscount,
    priceIncreaseAllowed: result.priceIncreaseAllowed,
    timestamp: new Date().toISOString(),
  };
}

function calculateActionPrice(result, rule) {
  const actionValue = Number(rule.action.value);

  if (!Number.isFinite(actionValue)) {
    return {
      newPrice: NaN,
      newDiscount: null,
    };
  }

  if (rule.action.type === "set_exact_price") {
    const newPrice = roundToTwo(actionValue);

    return {
      newPrice,
      newDiscount: Number.isFinite(result.oldCompareAtPrice) && result.oldCompareAtPrice > 0
        ? roundToTwo(discountPercent(newPrice, result.oldCompareAtPrice))
        : null,
    };
  }

  if (!Number.isFinite(result.oldCompareAtPrice)) {
    return {
      newPrice: NaN,
      newDiscount: null,
    };
  }

  const newPrice = result.oldCompareAtPrice * (1 - actionValue / 100);

  return {
    newPrice: roundToTwo(newPrice),
    newDiscount: result.oldCompareAtPrice > 0
      ? roundToTwo(discountPercent(newPrice, result.oldCompareAtPrice))
      : null,
  };
}

async function collectPriceUpdateCandidates(rule, mode) {
  const summary = createSummary();
  const results = [];
  const updateCandidates = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await fetchProductsPage(cursor);

    for (const edge of data.products.edges) {
      const product = edge.node;
      summary.productsScanned++;

      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        const ruleEvaluation = evaluateRules(product, variant, rule);
        const result = createResultBase(product, variant, ruleEvaluation);
        summary.variantsScanned++;

        if (
          rule.safety.requireCompareAtPrice
          && (!Number.isFinite(result.oldCompareAtPrice) || result.oldCompareAtPrice <= 0)
        ) {
          summary.skippedMissingCompareAt++;
          result.action = "SKIP";
          result.reason = "Missing compareAtPrice";
          results.push(result);
          continue;
        }

        if (!ruleEvaluation.matched) {
          summary.skippedRuleMismatch++;
          result.action = "SKIP";
          result.reason = "Rule conditions not matched";
          results.push(result);
          continue;
        }

        summary.matched++;

        const calculated = calculateActionPrice(result, rule);
        result.actionType = rule.action.type;
        result.newPrice = calculated.newPrice;
        result.newDiscount = calculated.newDiscount;
        result.priceIncreaseAllowed = rule.safety.allowPriceIncrease === true;

        if (!Number.isFinite(calculated.newPrice) || calculated.newPrice <= 0) {
          summary.skippedInvalidPrice++;
          result.action = "SKIP";
          result.reason = "Invalid new price";
          results.push(result);
          continue;
        }

        if (
          pricesMatch(calculated.newPrice, result.oldPrice)
        ) {
          summary.skippedAlreadyTargetPrice++;
          result.action = "SKIP";
          result.reason = "Price already equals target price";
          results.push(result);
          continue;
        }

        if (
          Number.isFinite(result.oldPrice)
          && calculated.newPrice > result.oldPrice
          && !rule.safety.allowPriceIncrease
        ) {
          summary.skippedPriceIncreaseBlocked++;
          result.action = "SKIP";
          result.reason = "Price increase blocked by safety setting";
          results.push(result);
          continue;
        }

        if (
          rule.action.type === "set_exact_price"
          && !rule.safety.allowPriceAboveCompareAt
          && Number.isFinite(result.oldCompareAtPrice)
          && result.oldCompareAtPrice > 0
          && calculated.newPrice >= result.oldCompareAtPrice
        ) {
          summary.skippedCompareAtPriceSafety++;
          result.action = "SKIP";
          result.reason = "Exact price is not below compareAtPrice";
          results.push(result);
          continue;
        }

        if (
          rule.action.type === "set_discount_percentage"
          && Number.isFinite(result.oldCompareAtPrice)
          && result.oldCompareAtPrice > 0
          && calculated.newPrice >= result.oldCompareAtPrice
        ) {
          summary.skippedInvalidPrice++;
          result.action = "SKIP";
          result.reason = "New price must be less than compareAtPrice";
          results.push(result);
          continue;
        }

        result.action = mode === "dry-run" ? "DRY_RUN_UPDATE" : "PENDING_UPDATE";
        results.push(result);
        updateCandidates.push(result);
        summary.updateCandidates++;
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  return { results, summary, updateCandidates };
}

async function runPriceUpdater(body = {}, mode = "dry-run") {
  const rule = normalizeRuleRequest(body);
  const { results, summary, updateCandidates } = await collectPriceUpdateCandidates(rule, mode);
  const backupRecords = updateCandidates.map(createBackupRecord);
  const outputPath = createPriceUpdateFile(backupRecords, mode);

  if (mode === "dry-run") {
    return {
      success: true,
      mode,
      previewPath: outputPath,
      summary,
      results,
    };
  }

  for (const candidate of updateCandidates) {
    const expectedNewPrice = Number(candidate.newPrice);

    console.log(JSON.stringify({
      productId: candidate.productId,
      variantId: candidate.variantId,
      expectedNewPrice,
      action: "UPDATE_ATTEMPT",
    }));

    const mutationResponse = await updateVariantPrice(candidate.productId, candidate.variantId, expectedNewPrice);

    console.log(JSON.stringify({
      productId: candidate.productId,
      variantId: candidate.variantId,
      productVariants: mutationResponse.productVariants,
      userErrors: mutationResponse.userErrors,
      action: "UPDATE_MUTATION_RESPONSE",
    }));

    if (mutationResponse.userErrors && mutationResponse.userErrors.length) {
      summary.updateFailedUserErrors++;
      candidate.action = "UPDATE_FAILED_USER_ERRORS";
      candidate.reason = JSON.stringify(mutationResponse.userErrors);
      continue;
    }

    const actualPriceAfterUpdate = moneyToNumber(await getVariantPrice(candidate.variantId));
    candidate.verification = pricesMatch(actualPriceAfterUpdate, expectedNewPrice) ? "PASS" : "FAIL";

    console.log(JSON.stringify({
      productId: candidate.productId,
      variantId: candidate.variantId,
      expectedNewPrice: roundToTwo(expectedNewPrice),
      actualPriceAfterUpdate,
      verification: candidate.verification,
      action: "VERIFY_PRICE_AFTER_UPDATE",
    }));

    if (candidate.verification === "PASS") {
      summary.updated++;
      candidate.action = "UPDATE_SUCCESS";
      candidate.reason = null;
    } else {
      summary.updateFailedVerification++;
      candidate.action = "UPDATE_FAILED_VERIFICATION";
      candidate.reason = "Actual price after update did not match expected price";
    }
  }

  return {
    success: true,
    mode,
    backupPath: outputPath,
    summary,
    results,
  };
}

module.exports = {
  runPriceUpdater,
};
