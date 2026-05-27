const express = require("express");

const { listBackupFiles } = require("../utils/backupUtils");
const { runPriceUpdater } = require("../services/priceUpdaterService");
const { restorePrices } = require("../services/restoreService");

const router = express.Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
  });
});

router.post("/price-updater/dry-run", asyncHandler(async (req, res) => {
  const result = await runPriceUpdater(req.body, "dry-run");
  res.json(result);
}));

router.post("/price-updater/apply", asyncHandler(async (req, res) => {
  const result = await runPriceUpdater(req.body, "live");
  res.json(result);
}));

router.get("/backups", (req, res) => {
  res.json({
    success: true,
    backups: listBackupFiles(),
  });
});

router.post("/price-updater/restore", asyncHandler(async (req, res) => {
  const result = await restorePrices(req.body);
  res.json(result);
}));

module.exports = router;
