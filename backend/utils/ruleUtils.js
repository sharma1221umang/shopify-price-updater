const { discountPercent, moneyToNumber, roundToTwo } = require("./priceUtils");

const SUPPORTED_FIELDS = new Set([
  "productTitle",
  "productType",
  "productTags",
  "productHandle",
  "vendor",
  "variantTitle",
  "sku",
  "barcode",
  "inventoryQuantity",
  "price",
  "compareAtPrice",
  "currentDiscount",
]);

const SUPPORTED_OPERATORS = new Set([
  "equals",
  "not_equals",
  "contains",
  "does_not_contain",
  "starts_with",
  "ends_with",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
  "is_empty",
  "is_not_empty",
]);

function createRuleContext(product, variant) {
  const price = moneyToNumber(variant.price);
  const compareAtPrice = moneyToNumber(variant.compareAtPrice);
  const currentDiscount = price !== null && compareAtPrice && compareAtPrice > price
    ? roundToTwo(discountPercent(price, compareAtPrice))
    : null;

  return {
    productTitle: product.title,
    productType: product.productType,
    productTags: product.tags || [],
    productHandle: product.handle,
    vendor: product.vendor,
    variantTitle: variant.title,
    sku: variant.sku,
    barcode: variant.barcode,
    inventoryQuantity: Number(variant.inventoryQuantity || 0),
    price,
    compareAtPrice,
    currentDiscount,
  };
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === "";
}

function toComparableString(value) {
  if (Array.isArray(value)) return value.join(" ");
  return String(value ?? "");
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function describeCondition(condition) {
  return {
    field: condition.field,
    operator: condition.operator,
    value: condition.value,
  };
}

function evaluateCondition(condition, context) {
  if (!SUPPORTED_FIELDS.has(condition.field)) {
    throw new Error(`Unsupported rule field: ${condition.field}`);
  }

  if (!SUPPORTED_OPERATORS.has(condition.operator)) {
    throw new Error(`Unsupported rule operator: ${condition.operator}`);
  }

  const actual = context[condition.field];
  const expected = condition.value;
  const actualString = toComparableString(actual).toLowerCase();
  const expectedString = toComparableString(expected).toLowerCase();
  const actualNumber = toNumber(actual);
  const expectedNumber = toNumber(expected);

  switch (condition.operator) {
    case "equals":
      if (Array.isArray(actual)) {
        return actual.some((item) => String(item).toLowerCase() === expectedString);
      }
      return actualString === expectedString;
    case "not_equals":
      if (Array.isArray(actual)) {
        return !actual.some((item) => String(item).toLowerCase() === expectedString);
      }
      return actualString !== expectedString;
    case "contains":
      return actualString.includes(expectedString);
    case "does_not_contain":
      return !actualString.includes(expectedString);
    case "starts_with":
      return actualString.startsWith(expectedString);
    case "ends_with":
      return actualString.endsWith(expectedString);
    case "greater_than":
      return actualNumber !== null && expectedNumber !== null && actualNumber > expectedNumber;
    case "less_than":
      return actualNumber !== null && expectedNumber !== null && actualNumber < expectedNumber;
    case "greater_than_or_equal":
      return actualNumber !== null && expectedNumber !== null && actualNumber >= expectedNumber;
    case "less_than_or_equal":
      return actualNumber !== null && expectedNumber !== null && actualNumber <= expectedNumber;
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);
    default:
      return false;
  }
}

function normalizeRuleRequest(body = {}) {
  if (body.action && Array.isArray(body.conditions)) {
    return {
      matchMode: body.matchMode === "any" ? "any" : "all",
      conditions: body.conditions,
      action: body.action,
      safety: {
        doNotChangeCompareAtPrice: body.safety?.doNotChangeCompareAtPrice !== false,
        requireCompareAtPrice: body.safety?.requireCompareAtPrice !== false,
        verifyAfterUpdate: body.safety?.verifyAfterUpdate !== false,
      },
    };
  }

  const targetDiscount = Number(body.targetDiscount ?? 40);

  if (!Number.isFinite(targetDiscount) || targetDiscount <= 0 || targetDiscount >= 100) {
    throw new Error("targetDiscount must be a number greater than 0 and less than 100.");
  }

  const conditions = [
    {
      field: "productType",
      operator: "equals",
      value: body.productType || "Lehenga",
      legacyGroup: "productEligibility",
      legacyGroupMode: "any",
    },
    {
      field: "productTitle",
      operator: "contains",
      value: body.includeTitleContains || "lehenga",
      legacyGroup: "productEligibility",
      legacyGroupMode: "any",
    },
    {
      field: "currentDiscount",
      operator: "less_than",
      value: targetDiscount,
    },
  ];

  if (body.skipCJM !== false) {
    conditions.push(
      { field: "sku", operator: "does_not_contain", value: "CJM" },
      { field: "barcode", operator: "does_not_contain", value: "CJM" },
      { field: "productTitle", operator: "does_not_contain", value: "CJM" },
      { field: "productHandle", operator: "does_not_contain", value: "CJM" },
    );
  }

  if (body.skipOutOfStock !== false) {
    conditions.push({
      field: "inventoryQuantity",
      operator: "greater_than",
      value: 0,
    });
  }

  return {
    matchMode: "all",
    conditions,
    action: {
      type: "set_discount_percentage",
      value: targetDiscount,
    },
    safety: {
      doNotChangeCompareAtPrice: true,
      requireCompareAtPrice: true,
      verifyAfterUpdate: true,
    },
  };
}

function validateRuleRequest(rule) {
  if (!["all", "any"].includes(rule.matchMode)) {
    throw new Error("matchMode must be all or any.");
  }

  if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    throw new Error("conditions must be a non-empty array.");
  }

  if (!rule.action || rule.action.type !== "set_discount_percentage") {
    throw new Error("Only action.type set_discount_percentage is supported.");
  }

  const actionValue = Number(rule.action.value);

  if (!Number.isFinite(actionValue) || actionValue <= 0 || actionValue >= 100) {
    throw new Error("action.value must be a number greater than 0 and less than 100.");
  }
}

module.exports = {
  createRuleContext,
  describeCondition,
  evaluateCondition,
  normalizeRuleRequest,
  validateRuleRequest,
};
