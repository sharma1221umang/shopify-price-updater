const fields = [
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
];

const operators = [
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
];

const operatorLabels = {
  equals: "equals",
  not_equals: "not equals",
  contains: "contains",
  does_not_contain: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: "greater than",
  less_than: "less than",
  greater_than_or_equal: "greater than or equal",
  less_than_or_equal: "less than or equal",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const actionLabels = {
  set_discount_percentage: "set discount percentage",
  set_exact_price: "set exact price",
};

const numericFields = ["inventoryQuantity", "price", "compareAtPrice", "currentDiscount"];
const productScopeFields = ["productType", "productTitle", "productTags", "vendor"];
const cjmFields = ["sku", "barcode", "productTitle", "productHandle"];
const specificIdentifierLabels = {
  sku: "SKU",
  barcode: "Barcode",
  productTitle: "Product title contains",
  productHandle: "Product handle contains",
};

const summaryKeys = [
  "productsScanned",
  "variantsScanned",
  "matched",
  "updateCandidates",
  "updated",
  "skippedRuleMismatch",
  "skippedMissingCompareAt",
  "skippedInvalidPrice",
  "updateFailedUserErrors",
  "updateFailedVerification",
];

const state = {
  conditions: [],
  conditionGroups: null,
  specificListMode: false,
  results: [],
  activeFilter: "all",
  dryRunSucceeded: false,
  lastPayload: null,
  lastDryRunSummary: {},
  lastPreviewPath: "",
  highVolumeAcknowledged: false,
};

const elements = {
  healthStatus: document.getElementById("healthStatus"),
  conditionsList: document.getElementById("conditionsList"),
  addConditionBtn: document.getElementById("addConditionBtn"),
  resetRuleBtn: document.getElementById("resetRuleBtn"),
  matchMode: document.getElementById("matchMode"),
  actionType: document.getElementById("actionType"),
  actionValueLabel: document.getElementById("actionValueLabel"),
  actionValue: document.getElementById("actionValue"),
  actionHelpText: document.getElementById("actionHelpText"),
  specificIdentifierType: document.getElementById("specificIdentifierType"),
  specificIdentifiers: document.getElementById("specificIdentifiers"),
  specificRequireInventory: document.getElementById("specificRequireInventory"),
  createSpecificRuleBtn: document.getElementById("createSpecificRuleBtn"),
  specificRuleStatus: document.getElementById("specificRuleStatus"),
  doNotChangeCompareAtPrice: document.getElementById("doNotChangeCompareAtPrice"),
  requireCompareAtPrice: document.getElementById("requireCompareAtPrice"),
  verifyAfterUpdate: document.getElementById("verifyAfterUpdate"),
  allowPriceAboveCompareAt: document.getElementById("allowPriceAboveCompareAt"),
  allowPriceIncrease: document.getElementById("allowPriceIncrease"),
  dryRunBtn: document.getElementById("dryRunBtn"),
  applyBtn: document.getElementById("applyBtn"),
  requestStatus: document.getElementById("requestStatus"),
  warningList: document.getElementById("warningList"),
  rulePreview: document.getElementById("rulePreview"),
  summaryCards: document.getElementById("summaryCards"),
  resultsBody: document.getElementById("resultsBody"),
  tableFilters: document.getElementById("tableFilters"),
  backupSelect: document.getElementById("backupSelect"),
  refreshBackupsBtn: document.getElementById("refreshBackupsBtn"),
  restoreDryRunBtn: document.getElementById("restoreDryRunBtn"),
  restoreLiveBtn: document.getElementById("restoreLiveBtn"),
  restoreSummary: document.getElementById("restoreSummary"),
  restoreStatus: document.getElementById("restoreStatus"),
  applyModal: document.getElementById("applyModal"),
  applyModalDetails: document.getElementById("applyModalDetails"),
  closeApplyModalBtn: document.getElementById("closeApplyModalBtn"),
  cancelApplyBtn: document.getElementById("cancelApplyBtn"),
  applyConfirmInput: document.getElementById("applyConfirmInput"),
  confirmApplyBtn: document.getElementById("confirmApplyBtn"),
  restoreModal: document.getElementById("restoreModal"),
  restoreModalBackupFile: document.getElementById("restoreModalBackupFile"),
  closeRestoreModalBtn: document.getElementById("closeRestoreModalBtn"),
  cancelRestoreBtn: document.getElementById("cancelRestoreBtn"),
  restoreConfirmInput: document.getElementById("restoreConfirmInput"),
  confirmRestoreBtn: document.getElementById("confirmRestoreBtn"),
};

const highVolumeSafety = document.createElement("div");
highVolumeSafety.style.display = "none";
highVolumeSafety.style.flexBasis = "100%";
highVolumeSafety.style.border = "1px solid #f04438";
highVolumeSafety.style.background = "#fff2f0";
highVolumeSafety.style.color = "#b42318";
highVolumeSafety.style.borderRadius = "6px";
highVolumeSafety.style.padding = "10px 12px";
highVolumeSafety.style.fontSize = "13px";
highVolumeSafety.style.fontWeight = "700";
elements.applyBtn.parentElement.insertBefore(highVolumeSafety, elements.dryRunBtn);

function labelForValue(value, labels = {}) {
  return labels[value] || value;
}

function optionList(values, selected, labels = {}) {
  return values.map((value) => {
    const isSelected = value === selected ? "selected" : "";
    return `<option value="${escapeHtml(value)}" ${isSelected}>${escapeHtml(labelForValue(value, labels))}</option>`;
  }).join("");
}

function selectOptionList(values, selected, placeholder, labels = {}) {
  return `<option value="">${escapeHtml(placeholder)}</option>` + optionList(values, selected, labels);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return value.toFixed(2).replace(/\.00$/, "");
  return String(value);
}

function formatCurrency(value) {
  const formatted = formatValue(value);
  return formatted === "" ? "" : `₹${formatted}`;
}

function renderConditions() {
  if (!state.conditions.length) {
    elements.conditionsList.innerHTML = `
      <div class="empty-rule-message">No conditions added yet. Click Add Condition to create a rule.</div>
    `;
    renderRulePreview();
    renderWarnings();
    return;
  }

  elements.conditionsList.innerHTML = state.conditions.map((condition, index) => `
    <div class="condition-row" data-index="${index}">
      <label>
        Field
        <select data-role="field">${selectOptionList(fields, condition.field, "Select field")}</select>
      </label>
      <label>
        Operator
        <select data-role="operator">${selectOptionList(operators, condition.operator, "Select operator", operatorLabels)}</select>
      </label>
      <label class="${isValueHidden(condition.operator)}">
        Value
        <input data-role="value" type="text" value="${escapeHtml(condition.value)}" ${isValueDisabled(condition.operator)}>
      </label>
      <button class="button remove-condition" type="button" title="Remove condition">X</button>
    </div>
  `).join("");

  renderRulePreview();
  renderWarnings();
}

function isValueDisabled(operator) {
  return operator === "is_empty" || operator === "is_not_empty" ? "disabled" : "";
}

function isValueHidden(operator) {
  return operator === "is_empty" || operator === "is_not_empty" ? "hidden" : "";
}

function parseConditionValue(condition) {
  if (condition.operator === "is_empty" || condition.operator === "is_not_empty") return "";
  if (["inventoryQuantity", "price", "compareAtPrice", "currentDiscount"].includes(condition.field)) {
    const n = Number(condition.value);
    return Number.isFinite(n) ? n : condition.value;
  }
  return condition.value;
}

function normalizeConditionForPayload(condition) {
  return {
    field: condition.field,
    operator: condition.operator,
    value: parseConditionValue(condition),
  };
}

function buildPayload() {
  const conditionPayload = state.conditionGroups
    ? {
      groupMatchMode: "all",
      conditionGroups: state.conditionGroups.map((group) => ({
        matchMode: group.matchMode,
        conditions: group.conditions.map(normalizeConditionForPayload),
      })),
    }
    : {
      matchMode: elements.matchMode.value,
      conditions: state.conditions.map(normalizeConditionForPayload),
    };

  return {
    ...conditionPayload,
    action: {
      type: elements.actionType.value,
      value: Number(elements.actionValue.value),
    },
    safety: {
      doNotChangeCompareAtPrice: true,
      requireCompareAtPrice: elements.requireCompareAtPrice.checked,
      verifyAfterUpdate: elements.verifyAfterUpdate.checked,
      allowPriceAboveCompareAt: elements.allowPriceAboveCompareAt.checked,
      allowPriceIncrease: elements.allowPriceIncrease.checked,
    },
  };
}

function conditionToText(condition) {
  const operator = labelForValue(condition.operator, operatorLabels);
  if (condition.operator === "is_empty" || condition.operator === "is_not_empty") {
    return `${condition.field} ${operator}`;
  }
  return `${condition.field} ${operator} ${formatValue(condition.value)}`;
}

function actionToText() {
  const actionLabel = labelForValue(elements.actionType.value, actionLabels);
  const value = elements.actionValue.value === "" ? "" : formatValue(Number(elements.actionValue.value));
  if (elements.actionType.value === "set_exact_price") {
    return `${actionLabel} to ${value === "" ? "" : formatCurrency(Number(elements.actionValue.value))}`;
  }
  return `${actionLabel} to ${value}%`;
}

function actionToModalText() {
  const value = Number(elements.actionValue.value);
  if (elements.actionType.value === "set_exact_price") {
    return `Set exact price to ${formatCurrency(value)}`;
  }
  return `Set discount percentage to ${formatValue(value)}%`;
}

function getReadableConditions() {
  return state.conditions.map(conditionToText);
}

function getReadableConditionGroups() {
  if (!state.conditionGroups) return [];

  return state.conditionGroups.map((group, index) => {
    const mode = group.matchMode === "any" ? "any" : "all";
    const lines = group.conditions.map((condition) => `  - ${conditionToText(condition)}`);
    return [`Group ${index + 1}: ${mode} condition matches`, ...lines].join("\n");
  });
}

function renderRulePreview() {
  if (state.conditionGroups) {
    const lines = [
      "IF all condition groups match:",
      ...getReadableConditionGroups(),
      `THEN ${actionToText()}`,
    ];
    elements.rulePreview.textContent = lines.join("\n");
    return;
  }

  if (!state.conditions.length) {
    elements.rulePreview.textContent = "No rule created yet.";
    return;
  }

  const matchText = elements.matchMode.value === "any"
    ? "IF any condition matches:"
    : "IF all conditions match:";
  const lines = [
    matchText,
    ...getReadableConditions().map((condition) => `- ${condition}`),
    `THEN ${actionToText()}`,
  ];

  elements.rulePreview.textContent = lines.join("\n");
}

function getWarnings() {
  const warnings = [];

  if (state.specificListMode) {
    warnings.push("Specific list mode uses ANY matching. Only pasted identifiers will be matched. Check Dry Run before Apply.");
  } else if (elements.matchMode.value === "any") {
    warnings.push("Warning: ANY mode can match products if only one condition is true. Use ALL mode for safer price updates.");
  }

  if (elements.allowPriceIncrease.checked) {
    warnings.push("Price increases are allowed. Review dry run carefully.");
  }

  if (elements.actionType.value === "set_exact_price" && getUpdateCandidateCount() > 10) {
    warnings.push("Exact price update affects more than 10 variants. Verify carefully.");
  }

  if (!state.conditions.length && !state.conditionGroups) {
    return warnings;
  }

  const conditionsForWarnings = state.conditionGroups
    ? state.conditionGroups.flatMap((group) => group.conditions)
    : state.conditions;
  const hasProductScope = conditionsForWarnings.some((condition) => productScopeFields.includes(condition.field));
  const hasStockSafety = conditionsForWarnings.some((condition) => {
    return condition.field === "inventoryQuantity"
      && condition.operator === "greater_than"
      && Number(condition.value) === 0;
  });
  const excludesCJM = conditionsForWarnings.some((condition) => {
    return cjmFields.includes(condition.field)
      && condition.operator === "does_not_contain"
      && String(condition.value || "").toLowerCase().includes("cjm");
  });

  if (!hasProductScope && !state.specificListMode) {
    warnings.push("Warning: This rule may affect many products. Add a product/category condition.");
  }

  if (!hasStockSafety) {
    warnings.push("Warning: This rule may include out-of-stock products.");
  }

  if (!excludesCJM) {
    warnings.push("Warning: CJM products are not excluded.");
  }

  return warnings;
}

function updateActionValueControl() {
  if (elements.actionType.value === "set_exact_price") {
    elements.actionValueLabel.firstChild.textContent = "Exact Price";
    elements.actionValue.min = "0.01";
    elements.actionValue.removeAttribute("max");
    elements.actionHelpText.textContent = "Use specific SKU/barcode/title rules before applying exact prices.";
    return;
  }

  elements.actionValueLabel.firstChild.textContent = "Discount Percentage";
  elements.actionValue.min = "1";
  elements.actionValue.max = "99";
  elements.actionHelpText.textContent = "";
}

function renderWarnings() {
  const warnings = getWarnings();
  elements.warningList.innerHTML = warnings.map((warning) => (
    `<div class="warning-item ${warning.includes("Price increases are allowed") || warning.includes("Exact price update affects more than 10") ? "danger-warning" : ""}">${escapeHtml(warning)}</div>`
  )).join("");
}

function validateRule() {
  const errors = [];
  const actionValueRaw = elements.actionValue.value;
  const actionValue = Number(actionValueRaw);

  if (!state.conditions.length && !state.conditionGroups) {
    errors.push("At least one condition is required.");
  }

  if (actionValueRaw === "") {
    errors.push("Action value is required.");
  } else if (!Number.isFinite(actionValue) || actionValue <= 0) {
    errors.push("Action value must be greater than 0.");
  } else if (elements.actionType.value === "set_discount_percentage" && actionValue >= 100) {
    errors.push("Action value must be greater than 0 and less than 100.");
  }

  if (state.conditionGroups) {
    state.conditionGroups.forEach((group, groupIndex) => {
      if (!group.conditions.length) {
        errors.push(`Condition group ${groupIndex + 1}: at least one condition is required.`);
      }

      group.conditions.forEach((condition, conditionIndex) => {
        validateCondition(condition, `Condition group ${groupIndex + 1}.${conditionIndex + 1}`, errors);
      });
    });
  } else {
    state.conditions.forEach((condition, index) => {
      validateCondition(condition, `Condition ${index + 1}`, errors);
    });
  }

  return errors;
}

function validateCondition(condition, label, errors) {
  if (!condition.field) {
    errors.push(`${label}: field is required.`);
  }

  if (!condition.operator) {
    errors.push(`${label}: operator is required.`);
    return;
  }

  if (condition.operator === "is_empty" || condition.operator === "is_not_empty") return;

  if (condition.value === "" || condition.value === null || condition.value === undefined) {
    errors.push(`${label}: value is required.`);
    return;
  }

  if (numericFields.includes(condition.field)) {
    const numericValue = Number(condition.value);
    if (!Number.isFinite(numericValue)) {
      errors.push(`${label}: ${condition.field} must have a numeric value.`);
    }
  }
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.classList.remove("error", "ok");
  if (type) element.classList.add(type);
}

function setBusy(isBusy) {
  elements.dryRunBtn.disabled = isBusy;
  elements.applyBtn.disabled = isBusy || !canApplyLive();
  updateRestoreButtonState(isBusy);
}

function invalidateDryRun() {
  state.dryRunSucceeded = false;
  state.lastPayload = null;
  state.lastDryRunSummary = {};
  state.lastPreviewPath = "";
  state.highVolumeAcknowledged = false;
  elements.applyBtn.disabled = true;
  renderHighVolumeSafety();
  renderRulePreview();
  renderWarnings();
}

function getUpdateCandidateCount() {
  return Number(state.lastDryRunSummary.updateCandidates || 0);
}

function canApplyLive() {
  const updateCandidates = getUpdateCandidateCount();
  return state.dryRunSucceeded && (updateCandidates <= 300 || state.highVolumeAcknowledged);
}

function renderHighVolumeSafety() {
  const updateCandidates = getUpdateCandidateCount();

  if (!state.dryRunSucceeded || updateCandidates <= 100) {
    highVolumeSafety.style.display = "none";
    highVolumeSafety.innerHTML = "";
    return;
  }

  highVolumeSafety.style.display = "block";
  highVolumeSafety.innerHTML = `
    <div>This rule will update many products. Please verify the results carefully before applying.</div>
    ${updateCandidates > 300 ? `
      <label style="display:flex;align-items:center;gap:8px;margin-top:8px;color:#b42318;font-size:13px;font-weight:700;">
        <input id="highVolumeAcknowledge" type="checkbox" ${state.highVolumeAcknowledged ? "checked" : ""} style="width:16px;height:16px;">
        I understand this will update many products.
      </label>
    ` : ""}
  `;

  const checkbox = document.getElementById("highVolumeAcknowledge");
  if (checkbox) {
    checkbox.addEventListener("change", () => {
      state.highVolumeAcknowledged = checkbox.checked;
      elements.applyBtn.disabled = !canApplyLive();
    });
  }
}

async function checkHealth() {
  try {
    await apiFetch("/api/health");
    elements.healthStatus.textContent = "API Online";
    elements.healthStatus.className = "status status-ok";
  } catch (error) {
    elements.healthStatus.textContent = "API Offline";
    elements.healthStatus.className = "status status-error";
  }
}

async function runDryRun() {
  const validationErrors = validateRule();
  if (validationErrors.length) {
    setStatus(elements.requestStatus, validationErrors.join(" "), "error");
    return;
  }

  const payload = buildPayload();
  state.dryRunSucceeded = false;
  state.lastPayload = null;
  setBusy(true);
  setStatus(elements.requestStatus, "Running dry run...");

  try {
    const data = await apiFetch("/api/price-updater/dry-run", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.dryRunSucceeded = true;
    state.lastPayload = payload;
    state.lastDryRunSummary = data.summary || {};
    state.lastPreviewPath = data.previewPath || "";
    state.highVolumeAcknowledged = false;
    handleUpdaterResponse(data);
    renderHighVolumeSafety();
    setStatus(
      elements.requestStatus,
      `Dry run complete: ${data.summary?.updateCandidates ?? 0} update candidates. ${data.previewPath || ""}`,
      "ok",
    );
    await loadBackups();
  } catch (error) {
    setStatus(elements.requestStatus, error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function applyLiveUpdate() {
  if (!state.dryRunSucceeded) return;
  openApplyModal();
}

function openApplyModal() {
  elements.applyConfirmInput.value = "";
  elements.confirmApplyBtn.disabled = true;
  const anyModeWarning = elements.matchMode.value === "any" && !state.specificListMode
    ? `<div class="warning-item danger-warning">ANY mode is selected. This may update more products than expected.</div>`
    : "";
  const specificListWarning = state.specificListMode
    ? `<div class="warning-item">Specific list mode uses ANY matching. Only pasted identifiers will be matched. Check Dry Run before Apply.</div>`
    : "";
  const priceIncreaseWarning = elements.allowPriceIncrease.checked
    ? `<div class="warning-item danger-warning">This update may increase product prices.</div>`
    : "";
  const exactPriceFacts = elements.actionType.value === "set_exact_price"
    ? `
      <div class="modal-fact">
        <span>Exact price</span>
        <strong>${escapeHtml(formatCurrency(Number(elements.actionValue.value)))}</strong>
      </div>
      <div class="modal-fact">
        <span>Price increase allowed</span>
        <strong>${elements.allowPriceIncrease.checked ? "Yes" : "No"}</strong>
      </div>
      <div class="modal-fact">
        <span>Above compare-at allowed</span>
        <strong>${elements.allowPriceAboveCompareAt.checked ? "Yes" : "No"}</strong>
      </div>
    `
    : "";
  const readableConditions = state.conditionGroups
    ? getReadableConditionGroups().join("\n")
    : getReadableConditions().map((condition) => `- ${condition}`).join("\n");
  elements.applyModalDetails.innerHTML = `
    ${anyModeWarning}
    ${specificListWarning}
    ${priceIncreaseWarning}
    <div class="modal-facts">
      <div class="modal-fact">
        <span>Match mode</span>
        <strong>${escapeHtml(elements.matchMode.value)}</strong>
      </div>
      <div class="modal-fact">
        <span>Update candidates</span>
        <strong>${escapeHtml(state.lastDryRunSummary.updateCandidates ?? 0)}</strong>
      </div>
      ${exactPriceFacts}
      <div class="modal-fact">
        <span>Action</span>
        <strong>${escapeHtml(actionToModalText())}</strong>
      </div>
      <div class="modal-fact">
        <span>Preview path</span>
        <strong>${escapeHtml(state.lastPreviewPath || "Not available")}</strong>
      </div>
    </div>
    <pre>${escapeHtml(readableConditions)}</pre>
  `;
  elements.applyModal.hidden = false;
  elements.applyConfirmInput.focus();
}

function closeApplyModal() {
  elements.applyModal.hidden = true;
}

async function submitLiveUpdate() {
  if (!state.dryRunSucceeded || elements.applyConfirmInput.value !== "APPLY") return;

  const payload = state.lastPayload || buildPayload();
  closeApplyModal();
  setBusy(true);
  setStatus(elements.requestStatus, "Applying live update...");

  try {
    const data = await apiFetch("/api/price-updater/apply", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    handleUpdaterResponse(data);
    setStatus(elements.requestStatus, `Live update complete: ${data.backupPath || ""}`, "ok");
    await loadBackups();
  } catch (error) {
    setStatus(elements.requestStatus, error.message, "error");
  } finally {
    setBusy(false);
  }
}

function handleUpdaterResponse(data) {
  state.results = Array.isArray(data.results) ? data.results : [];
  renderSummary(data.summary || {});
  renderWarnings();
  renderResults();
}

function renderSummary(summary = {}) {
  elements.summaryCards.innerHTML = summaryKeys.map((key) => `
    <div class="summary-card">
      <span>${escapeHtml(key)}</span>
      <strong>${escapeHtml(summary[key] ?? 0)}</strong>
    </div>
  `).join("");
}

function resultMatchesFilter(result) {
  const action = String(result.action || "");
  if (state.activeFilter === "all") return true;
  if (state.activeFilter === "candidates") {
    return action.includes("UPDATE") && !action.includes("FAILED") && action !== "SKIP";
  }
  if (state.activeFilter === "skipped") return action === "SKIP";
  if (state.activeFilter === "failed") return action.includes("FAILED") || result.verification === "FAIL";
  return true;
}

function actionClass(action) {
  const value = String(action || "");
  if (value.includes("FAILED") || value === "FAIL") return "fail";
  if (value === "SKIP") return "skip";
  if (value.includes("UPDATE") || value.includes("SUCCESS")) return "update";
  return "";
}

function renderResults() {
  const filtered = state.results.filter(resultMatchesFilter);

  if (!state.results.length) {
    elements.resultsBody.innerHTML = `<tr><td colspan="14" class="empty-cell">No results yet</td></tr>`;
    return;
  }

  if (!filtered.length) {
    elements.resultsBody.innerHTML = `<tr><td colspan="14" class="empty-cell">No matching results</td></tr>`;
    return;
  }

  elements.resultsBody.innerHTML = filtered.map((result) => `
    <tr>
      <td><span class="pill ${actionClass(result.action)}">${escapeHtml(result.action)}</span></td>
      <td>${escapeHtml(result.reason)}</td>
      <td>${escapeHtml(result.productTitle)}</td>
      <td>${escapeHtml(result.productType)}</td>
      <td>${escapeHtml(result.variantTitle)}</td>
      <td>${escapeHtml(result.sku)}</td>
      <td>${escapeHtml(result.barcode)}</td>
      <td>${escapeHtml(result.inventoryQuantity)}</td>
      <td>${escapeHtml(formatValue(result.oldPrice))}</td>
      <td>${escapeHtml(formatValue(result.oldCompareAtPrice))}</td>
      <td>${escapeHtml(formatValue(result.oldDiscount))}</td>
      <td>${escapeHtml(formatValue(result.newPrice))}</td>
      <td>${escapeHtml(formatValue(result.newDiscount))}</td>
      <td>${escapeHtml(result.verification)}</td>
    </tr>
  `).join("");
}

async function loadBackups() {
  try {
    const data = await apiFetch("/api/backups");
    const backups = (data.backups || []).map(categorizeBackupFile);
    const restoreBackups = backups.filter((backup) => backup.type === "backup");
    elements.backupSelect.innerHTML = restoreBackups.length
      ? restoreBackups.map((backup) => `<option value="${escapeHtml(backup.path)}">[backup] ${escapeHtml(backup.fileName)}</option>`).join("")
      : `<option value="">No live backup files found.</option>`;
    updateRestoreButtonState(false);
  } catch (error) {
    elements.backupSelect.innerHTML = `<option value="">Could not load backups</option>`;
    updateRestoreButtonState(false);
    setStatus(elements.restoreStatus, error.message, "error");
  }
}

function categorizeBackupFile(backup) {
  const fileName = backup.fileName || backup.name || "";
  let type = "other";

  if (fileName.startsWith("lehenga-price-backup-")) {
    type = "backup";
  } else if (fileName.startsWith("lehenga-price-preview-")) {
    type = "preview";
  } else if (fileName.startsWith("current-price-snapshot-")) {
    type = "snapshot";
  }

  return { ...backup, fileName, type };
}

function hasSelectedRestoreBackup() {
  return Boolean(elements.backupSelect.value);
}

function updateRestoreButtonState(isBusy = false) {
  const disabled = isBusy || !hasSelectedRestoreBackup();
  elements.restoreDryRunBtn.disabled = disabled;
  elements.restoreLiveBtn.disabled = disabled;
}

async function restorePrices(live) {
  const backupFile = elements.backupSelect.value;
  if (!backupFile) {
    setStatus(elements.restoreStatus, "Select a backup file first.", "error");
    return;
  }

  if (live) {
    openRestoreModal();
    return;
  }

  setBusy(true);
  setStatus(elements.restoreStatus, live ? "Restoring live prices..." : "Running restore dry run...");

  try {
    const data = await apiFetch("/api/price-updater/restore", {
      method: "POST",
      body: JSON.stringify({ backupFile, live }),
    });
    state.results = Array.isArray(data.results) ? data.results : [];
    renderSummary(data.summary || {});
    renderResults();
    renderRestoreSummary(data, live);
    setStatus(elements.restoreStatus, `${live ? "Live restore" : "Restore dry run"} complete`, "ok");
  } catch (error) {
    setStatus(elements.restoreStatus, error.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderRestoreSummary(data = {}, live = false) {
  const results = Array.isArray(data.results) ? data.results : [];
  const summary = data.summary || {};
  const totalRecords = summary.scanned ?? results.length ?? 0;
  const skipped = summary.skipped ?? results.filter((result) => result.action === "SKIP").length;
  const failed = summary.failed ?? results.filter((result) => String(result.action || "").includes("FAILED")).length;
  const wouldRestore = live
    ? summary.restored ?? results.filter((result) => result.action === "RESTORE").length
    : results.filter((result) => result.action === "DRY_RUN_RESTORE").length;

  elements.restoreSummary.innerHTML = [
    ["total records", totalRecords],
    [live ? "restored" : "wouldRestore", wouldRestore],
    ["skipped", skipped],
    ["failed", failed],
  ].map(([label, value]) => `
    <div class="restore-summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function openRestoreModal() {
  const backupFile = elements.backupSelect.value;
  if (!backupFile) {
    setStatus(elements.restoreStatus, "Select a backup file first.", "error");
    return;
  }

  elements.restoreModalBackupFile.textContent = backupFile;
  elements.restoreConfirmInput.value = "";
  elements.confirmRestoreBtn.disabled = true;
  elements.restoreModal.hidden = false;
  elements.restoreConfirmInput.focus();
}

function closeRestoreModal() {
  elements.restoreModal.hidden = true;
}

async function submitRestoreLive() {
  if (elements.restoreConfirmInput.value !== "RESTORE") return;
  closeRestoreModal();

  const backupFile = elements.backupSelect.value;
  setBusy(true);
  setStatus(elements.restoreStatus, "Restoring live prices...");

  try {
    const data = await apiFetch("/api/price-updater/restore", {
      method: "POST",
      body: JSON.stringify({ backupFile, live: true }),
    });
    state.results = Array.isArray(data.results) ? data.results : [];
    renderSummary(data.summary || {});
    renderResults();
    renderRestoreSummary(data, true);
    setStatus(elements.restoreStatus, "Live restore complete", "ok");
  } catch (error) {
    setStatus(elements.restoreStatus, error.message, "error");
  } finally {
    setBusy(false);
  }
}

function parseSpecificIdentifiers() {
  return elements.specificIdentifiers.value
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function createSpecificRuleFromList() {
  const identifiers = parseSpecificIdentifiers();

  if (!identifiers.length) {
    setStatus(elements.specificRuleStatus, "Paste at least one identifier.", "error");
    return;
  }

  const identifierType = elements.specificIdentifierType.value;
  const field = identifierType;
  const operator = identifierType === "sku" || identifierType === "barcode" ? "equals" : "contains";
  const identifierConditions = identifiers.map((value) => ({ field, operator, value }));
  const conditionGroups = [
    {
      matchMode: "any",
      conditions: identifierConditions,
    },
  ];

  if (elements.specificRequireInventory.checked) {
    conditionGroups.push({
      matchMode: "all",
      conditions: [
        { field: "inventoryQuantity", operator: "greater_than", value: 0 },
      ],
    });
  }

  state.conditions = identifierConditions;
  state.conditionGroups = conditionGroups;
  state.specificListMode = true;
  elements.matchMode.value = "any";
  elements.actionType.value = "set_exact_price";
  updateActionValueControl();
  invalidateDryRun();
  renderConditions();
  setStatus(
    elements.specificRuleStatus,
    `Created ${identifiers.length} ${specificIdentifierLabels[identifierType]} condition${identifiers.length === 1 ? "" : "s"}.`,
    "ok",
  );
}

function clearGroupedRuleForManualEdit() {
  if (!state.conditionGroups) return;
  state.conditionGroups = null;
  state.specificListMode = false;
  setStatus(elements.specificRuleStatus, "");
}

elements.conditionsList.addEventListener("change", (event) => {
  const row = event.target.closest(".condition-row");
  if (!row) return;
  clearGroupedRuleForManualEdit();
  const index = Number(row.dataset.index);
  const role = event.target.dataset.role;
  state.conditions[index][role] = event.target.value;

  if (role === "operator" && (event.target.value === "is_empty" || event.target.value === "is_not_empty")) {
    state.conditions[index].value = "";
  }

  invalidateDryRun();

  if (role === "operator") {
    renderConditions();
  }
});

elements.conditionsList.addEventListener("input", (event) => {
  const row = event.target.closest(".condition-row");
  if (!row || event.target.dataset.role !== "value") return;
  clearGroupedRuleForManualEdit();
  state.conditions[Number(row.dataset.index)].value = event.target.value;
  invalidateDryRun();
});

elements.conditionsList.addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-condition")) return;
  const row = event.target.closest(".condition-row");
  clearGroupedRuleForManualEdit();
  state.conditions.splice(Number(row.dataset.index), 1);
  invalidateDryRun();
  renderConditions();
});

elements.addConditionBtn.addEventListener("click", () => {
  clearGroupedRuleForManualEdit();
  state.conditions.push({ field: "", operator: "", value: "" });
  invalidateDryRun();
  renderConditions();
});

elements.resetRuleBtn.addEventListener("click", () => {
  state.conditions = [];
  state.conditionGroups = null;
  state.specificListMode = false;
  state.results = [];
  elements.matchMode.value = "all";
  elements.actionType.value = "set_discount_percentage";
  updateActionValueControl();
  elements.actionValue.value = "";
  elements.requireCompareAtPrice.checked = true;
  elements.verifyAfterUpdate.checked = true;
  elements.allowPriceAboveCompareAt.checked = false;
  elements.allowPriceIncrease.checked = false;
  elements.specificIdentifiers.value = "";
  elements.specificRequireInventory.checked = true;
  setStatus(elements.requestStatus, "");
  setStatus(elements.restoreStatus, "");
  setStatus(elements.specificRuleStatus, "");
  elements.restoreSummary.innerHTML = "";
  renderSummary();
  renderResults();
  invalidateDryRun();
  renderConditions();
});

elements.tableFilters.addEventListener("click", (event) => {
  if (!event.target.matches("button")) return;
  state.activeFilter = event.target.dataset.filter;
  elements.tableFilters.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button === event.target);
  });
  renderResults();
});

elements.dryRunBtn.addEventListener("click", runDryRun);
elements.applyBtn.addEventListener("click", applyLiveUpdate);
elements.createSpecificRuleBtn.addEventListener("click", createSpecificRuleFromList);
elements.specificIdentifiers.addEventListener("input", () => setStatus(elements.specificRuleStatus, ""));
elements.specificIdentifierType.addEventListener("change", () => setStatus(elements.specificRuleStatus, ""));
elements.specificRequireInventory.addEventListener("change", () => setStatus(elements.specificRuleStatus, ""));
elements.matchMode.addEventListener("change", () => {
  clearGroupedRuleForManualEdit();
  invalidateDryRun();
});
elements.actionType.addEventListener("change", () => {
  updateActionValueControl();
  invalidateDryRun();
});
elements.actionValue.addEventListener("input", invalidateDryRun);
elements.requireCompareAtPrice.addEventListener("change", invalidateDryRun);
elements.verifyAfterUpdate.addEventListener("change", invalidateDryRun);
elements.allowPriceAboveCompareAt.addEventListener("change", invalidateDryRun);
elements.allowPriceIncrease.addEventListener("change", invalidateDryRun);
elements.closeApplyModalBtn.addEventListener("click", closeApplyModal);
elements.cancelApplyBtn.addEventListener("click", closeApplyModal);
elements.applyConfirmInput.addEventListener("input", () => {
  elements.confirmApplyBtn.disabled = elements.applyConfirmInput.value !== "APPLY";
});
elements.confirmApplyBtn.addEventListener("click", submitLiveUpdate);
elements.applyModal.addEventListener("click", (event) => {
  if (event.target === elements.applyModal) closeApplyModal();
});
elements.backupSelect.addEventListener("change", () => updateRestoreButtonState(false));
elements.closeRestoreModalBtn.addEventListener("click", closeRestoreModal);
elements.cancelRestoreBtn.addEventListener("click", closeRestoreModal);
elements.restoreConfirmInput.addEventListener("input", () => {
  elements.confirmRestoreBtn.disabled = elements.restoreConfirmInput.value !== "RESTORE";
});
elements.confirmRestoreBtn.addEventListener("click", submitRestoreLive);
elements.restoreModal.addEventListener("click", (event) => {
  if (event.target === elements.restoreModal) closeRestoreModal();
});
elements.refreshBackupsBtn.addEventListener("click", loadBackups);
elements.restoreDryRunBtn.addEventListener("click", () => restorePrices(false));
elements.restoreLiveBtn.addEventListener("click", () => restorePrices(true));

renderConditions();
updateActionValueControl();
renderSummary();
checkHealth();
loadBackups();
