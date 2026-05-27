const {
  createRuleContext,
  describeCondition,
  evaluateCondition,
  validateRuleRequest,
} = require("../utils/ruleUtils");

function evaluateRules(product, variant, rule) {
  validateRuleRequest(rule);

  const context = createRuleContext(product, variant);
  const matchedConditions = [];
  const failedConditions = [];
  const groups = new Map();
  const ungroupedResults = [];

  for (const condition of rule.conditions) {
    const passed = evaluateCondition(condition, context);
    const conditionDescription = describeCondition(condition);

    if (passed) {
      matchedConditions.push(conditionDescription);
    } else {
      failedConditions.push(conditionDescription);
    }

    if (condition.legacyGroup) {
      if (!groups.has(condition.legacyGroup)) {
        groups.set(condition.legacyGroup, {
          mode: condition.legacyGroupMode || "all",
          results: [],
        });
      }
      groups.get(condition.legacyGroup).results.push(passed);
    } else {
      ungroupedResults.push(passed);
    }
  }

  const groupResults = Array.from(groups.values()).map((group) => {
    return group.mode === "any"
      ? group.results.some(Boolean)
      : group.results.every(Boolean);
  });

  const conditionResults = [...groupResults, ...ungroupedResults];
  const matched = rule.matchMode === "any"
    ? conditionResults.some(Boolean)
    : conditionResults.every(Boolean);

  return {
    context,
    matched,
    matchedConditions,
    failedConditions,
  };
}

module.exports = {
  evaluateRules,
};
