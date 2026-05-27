function moneyToNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundToTwo(value) {
  return Number(value.toFixed(2));
}

function discountPercent(price, compareAtPrice) {
  return ((compareAtPrice - price) / compareAtPrice) * 100;
}

function pricesMatch(actual, expected) {
  if (actual === null || expected === null) return false;
  return roundToTwo(actual) === roundToTwo(expected);
}

module.exports = {
  discountPercent,
  moneyToNumber,
  pricesMatch,
  roundToTwo,
};
