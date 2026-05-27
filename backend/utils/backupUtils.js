const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", "..");
const backupsDir = path.join(projectRoot, "backups");

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

function toProjectRelative(filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function createPriceUpdateFile(records, mode) {
  const prefix = mode === "live" ? "lehenga-price-backup" : "lehenga-price-preview";
  const filePath = path.join(backupsDir, `${prefix}-${timestampForFile()}.json`);

  fs.mkdirSync(backupsDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));

  return toProjectRelative(filePath);
}

function listBackupFiles() {
  if (!fs.existsSync(backupsDir)) return [];

  return fs.readdirSync(backupsDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(backupsDir, fileName);
      const stats = fs.statSync(filePath);

      return {
        fileName,
        path: toProjectRelative(filePath),
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

function readBackupFile(backupFile) {
  const resolvedPath = path.resolve(projectRoot, backupFile);
  const backupsRoot = backupsDir + path.sep;

  if (!resolvedPath.startsWith(backupsRoot)) {
    throw new Error("backupFile must point to a file inside the backups folder.");
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  const records = JSON.parse(raw);

  if (!Array.isArray(records)) {
    throw new Error("Backup file must contain a JSON array.");
  }

  return {
    path: toProjectRelative(resolvedPath),
    records,
  };
}

module.exports = {
  createPriceUpdateFile,
  listBackupFiles,
  readBackupFile,
};
