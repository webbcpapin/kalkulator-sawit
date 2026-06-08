/**
 * Backend Google Apps Script untuk Aplikasi Tax and Levy Ekspor Kelapa Sawit.
 *
 * Fitur:
 * - Health check.
 * - Simpan transaksi ke Google Sheets.
 * - Ambil daftar transaksi.
 * - Hapus transaksi berdasarkan id.
 * - Hapus semua transaksi, khusus admin.
 * - Simpan dan ambil snapshot master data JSON, khusus admin untuk update.
 *
 * Setup Script Properties:
 * - ADMIN_PASSWORD: password admin backend.
 * - SPREADSHEET_ID: opsional. Jika kosong, script memakai spreadsheet aktif.
 */

const CONFIG = {
  SHEETS: {
    TRANSACTIONS: "Transactions",
    MASTER_DATA: "MasterData",
    AUDIT_LOG: "AuditLog"
  },
  ADMIN_PASSWORD_FALLBACK: "beacukaipapin",
  MAX_LIST_LIMIT: 1000
};

const TRANSACTION_COLUMNS = [
  "id",
  "createdAt",
  "tanggal",
  "bulan",
  "eksportir",
  "produk",
  "hs",
  "volume",
  "satuan",
  "fob",
  "kurs",
  "hpe",
  "rangeBk",
  "tarifBk",
  "kolomBk",
  "kelompokPungutan",
  "tarifPungutan",
  "satuanPungutan",
  "kolomPungutan",
  "nilaiBk",
  "nilaiPungutan",
  "total",
  "nilaiBkIdr",
  "nilaiPungutanIdr",
  "totalIdr",
  "status",
  "dasarHukumHpe",
  "dasarHukumTarif",
  "catatan"
];

function doGet(e) {
  const action = getParam(e, "action", "health");
  try {
    if (action === "health") return jsonOk({ status: "ok", service: "kalkulator-sawit-backend" });
    if (action === "transactions") return jsonOk({ rows: listTransactions_(toInt(getParam(e, "limit", "100"))) });
    if (action === "master") return jsonOk({ data: getMasterData_() });
    return jsonError("Aksi GET tidak dikenal.", 404);
  } catch (err) {
    return jsonError(err.message || String(err), 500);
  }
}

function doPost(e) {
  const body = parseJsonBody_(e);
  const action = clean_(body.action);
  try {
    if (action === "appendTransaction") return jsonOk({ row: appendTransaction_(body.transaction || {}) });
    if (action === "deleteTransaction") return jsonOk({ deleted: deleteTransaction_(body.id) });
    if (action === "clearTransactions") {
      requireAdmin_(body.adminPassword);
      return jsonOk({ cleared: clearTransactions_() });
    }
    if (action === "saveMasterData") {
      requireAdmin_(body.adminPassword);
      return jsonOk({ saved: saveMasterData_(body.data) });
    }
    return jsonError("Aksi POST tidak dikenal.", 404);
  } catch (err) {
    return jsonError(err.message || String(err), 400);
  }
}

function setupBackend() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, CONFIG.SHEETS.TRANSACTIONS, TRANSACTION_COLUMNS);
  ensureSheet_(ss, CONFIG.SHEETS.MASTER_DATA, ["key", "updatedAt", "json"]);
  ensureSheet_(ss, CONFIG.SHEETS.AUDIT_LOG, ["createdAt", "actor", "action", "detail"]);
  return "Backend siap.";
}

function appendTransaction_(transaction) {
  validateTransaction_(transaction);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getTransactionSheet_();
    const row = normalizeTransaction_(transaction);
    sheet.appendRow(TRANSACTION_COLUMNS.map((column) => row[column]));
    writeAudit_("user", "appendTransaction", row.id);
    return row;
  } finally {
    lock.releaseLock();
  }
}

function listTransactions_(limit) {
  const safeLimit = Math.max(1, Math.min(limit || 100, CONFIG.MAX_LIST_LIMIT));
  const sheet = getTransactionSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const header = values[0].map(String);
  return values.slice(1).slice(-safeLimit).map((row) => rowToObject_(header, row));
}

function deleteTransaction_(id) {
  const targetId = clean_(id);
  if (!targetId) throw new Error("id transaksi wajib diisi.");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getTransactionSheet_();
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i += 1) {
      if (clean_(values[i][0]) === targetId) {
        sheet.deleteRow(i + 1);
        writeAudit_("user", "deleteTransaction", targetId);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function clearTransactions_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getTransactionSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
    writeAudit_("admin", "clearTransactions", "all");
    return true;
  } finally {
    lock.releaseLock();
  }
}

function getMasterData_() {
  const sheet = getMasterDataSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const latest = values.slice(1).filter((row) => clean_(row[0]) === "DATA").pop();
  if (!latest) return null;
  return JSON.parse(clean_(latest[2]) || "null");
}

function saveMasterData_(data) {
  if (!data || typeof data !== "object") throw new Error("data master wajib berupa object JSON.");
  const json = JSON.stringify(data);
  const sheet = getMasterDataSheet_();
  sheet.appendRow(["DATA", new Date().toISOString(), json]);
  writeAudit_("admin", "saveMasterData", "DATA");
  return true;
}

function validateTransaction_(transaction) {
  const required = ["tanggal", "bulan", "produk", "hs", "volume", "kurs", "hpe", "tarifBk", "tarifPungutan", "status"];
  required.forEach((field) => {
    if (transaction[field] === null || transaction[field] === undefined || clean_(transaction[field]) === "") {
      throw new Error(`Field ${field} wajib diisi.`);
    }
  });
  if (clean_(transaction.status) !== "Valid") throw new Error("Hanya transaksi valid yang boleh disimpan.");
  if (!isPositiveNumber_(transaction.volume)) throw new Error("Volume harus lebih dari 0.");
  if (!isPositiveNumber_(transaction.kurs)) throw new Error("Kurs harus lebih dari 0.");
  if (Number(transaction.kurs) < 10000) throw new Error("Periksa kurs KMK. Nilai kurs USD terlihat terlalu rendah.");
}

function normalizeTransaction_(transaction) {
  const id = clean_(transaction.id) || Utilities.getUuid();
  const normalized = { id, createdAt: new Date().toISOString() };
  TRANSACTION_COLUMNS.forEach((column) => {
    if (column === "id" || column === "createdAt") return;
    normalized[column] = sanitizeCell_(transaction[column]);
  });
  return normalized;
}

function requireAdmin_(password) {
  const expected = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD") || CONFIG.ADMIN_PASSWORD_FALLBACK;
  if (clean_(password) !== expected) throw new Error("Password admin tidak valid.");
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("SPREADSHEET_ID belum diset dan tidak ada spreadsheet aktif.");
  return active;
}

function getTransactionSheet_() {
  return ensureSheet_(getSpreadsheet_(), CONFIG.SHEETS.TRANSACTIONS, TRANSACTION_COLUMNS);
}

function getMasterDataSheet_() {
  return ensureSheet_(getSpreadsheet_(), CONFIG.SHEETS.MASTER_DATA, ["key", "updatedAt", "json"]);
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    const needsHeader = headers.some((header, index) => clean_(currentHeaders[index]) !== header);
    if (needsHeader) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function writeAudit_(actor, action, detail) {
  try {
    const sheet = ensureSheet_(getSpreadsheet_(), CONFIG.SHEETS.AUDIT_LOG, ["createdAt", "actor", "action", "detail"]);
    sheet.appendRow([new Date().toISOString(), actor, action, detail]);
  } catch (err) {
    console.warn(err);
  }
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error("Body harus JSON valid.");
  }
}

function rowToObject_(header, row) {
  return header.reduce((obj, key, index) => {
    if (key) obj[key] = row[index];
    return obj;
  }, {});
}

function getParam(e, key, fallback) {
  return e && e.parameter && e.parameter[key] !== undefined ? e.parameter[key] : fallback;
}

function toInt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : 0;
}

function clean_(value) {
  return (value === null || value === undefined ? "" : String(value)).trim();
}

function isPositiveNumber_(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function sanitizeCell_(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value;
  return String(value).replace(/(\r\n|\n|\r)/gm, " ").trim();
}

function jsonOk(payload) {
  return jsonResponse_(Object.assign({ ok: true }, payload || {}));
}

function jsonError(message, status) {
  return jsonResponse_({ ok: false, status: status || 400, error: message });
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
