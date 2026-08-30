/**
 * 処理台帳（スプレッドシート）の読み書き。
 * 台帳が「処理済み」の唯一の判定材料であり、これによって run() の再実行・
 * 分割実行（6分制限対策）を安全に行える（冪等性）。
 */

var LEDGER_HEADERS = [
  'fileId', 'fileName', 'status', 'method', 'category',
  'charCount', 'txtFileId', 'error', 'updatedAt'
];

// status の値: 'done' | 'refused' | 'too_large' | 'error'
// method の値: 'drive' | 'openai' | ''

/**
 * 台帳シートを取得する。ROOT_FOLDER_ID 直下に無ければ新規作成する。
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getLedgerSheet_() {
  var root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  var files = root.getFilesByName(CONFIG.LEDGER_NAME);
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(CONFIG.LEDGER_NAME);
    var file = DriveApp.getFileById(ss.getId());
    root.addFile(file);
    DriveApp.getRootFolder().removeFile(file); // マイドライブ直下からは外す
  }

  var sheet = ss.getSheetByName(CONFIG.LEDGER_SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(CONFIG.LEDGER_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(LEDGER_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * 台帳から処理済み fileId の集合を返す。
 * @return {Object} fileId -> true のマップ
 */
function loadProcessedFileIds_() {
  var sheet = getLedgerSheet_();
  var lastRow = sheet.getLastRow();
  var result = {};
  if (lastRow < 2) return result;

  var idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < idCol.length; i++) {
    var id = idCol[i][0];
    if (id) result[id] = true;
  }
  return result;
}

/**
 * 台帳に1行追記する。
 * @param {Object} record { fileId, fileName, status, method, category, charCount, txtFileId, error }
 */
function appendLedgerRow_(record) {
  if (CONFIG.DRY_RUN) {
    Logger.log('[DRY_RUN] ledger row: ' + JSON.stringify(record));
    return;
  }
  var sheet = getLedgerSheet_();
  sheet.appendRow([
    record.fileId || '',
    record.fileName || '',
    record.status || '',
    record.method || '',
    record.category || '',
    record.charCount != null ? record.charCount : '',
    record.txtFileId || '',
    record.error || '',
    new Date()
  ]);
}
