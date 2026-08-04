/**
 * エントリポイント。
 *
 * run()            … 手動実行 / トリガーの本体。未処理PDFを最大 MAX_FILES_PER_RUN 件処理する。
 * installTriggers() … 1時間ごとの時間主導トリガーを登録する（初回セットアップ時に1回実行）。
 */

/**
 * ROOT_FOLDER_ID 直下（サブフォルダは対象外）の application/pdf を処理する。
 * 台帳で処理済みのものはスキップするため、再実行しても安全（冪等）。
 */
function run() {
  var root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  var processedIds = loadProcessedFileIds_();

  var pdfIt = root.getFilesByType(MimeType.PDF);
  var targets = [];
  while (pdfIt.hasNext()) {
    var f = pdfIt.next();
    if (!processedIds[f.getId()]) targets.push(f);
  }

  Logger.log('未処理PDF: ' + targets.length + '件（うち今回処理する上限: ' + CONFIG.MAX_FILES_PER_RUN + '件）');

  var processedCount = 0;
  for (var i = 0; i < targets.length && processedCount < CONFIG.MAX_FILES_PER_RUN; i++) {
    processOneFile_(targets[i]);
    processedCount++;
  }

  if (processedCount < targets.length) {
    Logger.log('未処理が残っているため、1分後に続きを実行するワンショットトリガーを登録します。');
    if (!CONFIG.DRY_RUN) {
      ScriptApp.newTrigger('run').timeBased().after(60 * 1000).create();
    }
  } else {
    Logger.log('全件処理完了。');
  }
}

/**
 * PDF 1件分の処理: 抽出 -> 品質判定 -> (必要なら)フォールバック -> 分類 -> 配置 -> 台帳記録。
 * @param {GoogleAppsScript.Drive.File} pdfFile
 */
function processOneFile_(pdfFile) {
  var fileName = pdfFile.getName();
  var fileId = pdfFile.getId();
  Logger.log('処理開始: ' + fileName + ' (' + fileId + ')');

  var text = '';
  var method = 'drive';

  try {
    text = extractTextViaDrive_(pdfFile);
  } catch (e) {
    Logger.log('Drive抽出でエラー: ' + e);
    text = '';
  }

  var quality = assessExtractionQuality_(text);
  if (!quality.ok) {
    Logger.log('Drive抽出の品質不足（' + quality.reason + '）のため OpenAI にフォールバックします。');
    try {
      text = extractTextViaOpenAi_(pdfFile);
      method = 'openai';
    } catch (e) {
      if (e && e.name === 'OpenAiTooLargeError') {
        Logger.log('サイズ超過: ' + fileName);
        moveToUnsorted_(pdfFile);
        appendLedgerRow_({ fileId: fileId, fileName: fileName, status: 'too_large', method: 'drive', error: String(e.message) });
        return;
      }
      if (e && e.name === 'OpenAiRefusedError') {
        Logger.log('OpenAIが処理を拒否: ' + fileName);
        moveToUnsorted_(pdfFile);
        appendLedgerRow_({ fileId: fileId, fileName: fileName, status: 'refused', method: 'openai', error: String(e.message) });
        return;
      }
      Logger.log('OpenAIフォールバックでエラー: ' + e);
      moveToUnsorted_(pdfFile);
      appendLedgerRow_({ fileId: fileId, fileName: fileName, status: 'error', method: method, error: String(e) });
      return;
    }
  }

  var finalQuality = assessExtractionQuality_(text);
  if (!finalQuality.ok) {
    Logger.log('フォールバック後も品質不十分: ' + fileName + ' (' + finalQuality.reason + ')');
    moveToUnsorted_(pdfFile);
    appendLedgerRow_({ fileId: fileId, fileName: fileName, status: 'error', method: method, error: finalQuality.reason });
    return;
  }

  var category;
  try {
    category = classifyCategory_(fileName, text);
  } catch (e) {
    Logger.log('分類でエラー、「その他」を使用: ' + e);
    category = 'その他';
  }

  var result;
  try {
    result = organizeFile_(pdfFile, text, category);
  } catch (e) {
    Logger.log('配置処理でエラー: ' + e);
    moveToUnsorted_(pdfFile);
    appendLedgerRow_({ fileId: fileId, fileName: fileName, status: 'error', method: method, category: category, error: String(e) });
    return;
  }

  appendLedgerRow_({
    fileId: fileId,
    fileName: fileName,
    status: 'done',
    method: method,
    category: category,
    charCount: text.trim().length,
    txtFileId: result.txtFileId
  });
  Logger.log('完了: ' + fileName + ' -> ' + category + '（抽出手段: ' + method + '）');
}

/**
 * 1時間ごとの時間主導トリガーを登録する。二重登録を避けるため、既存の run トリガーは一度削除する。
 * 初回セットアップ時にエディタから1回だけ手動実行する。
 */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'run') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('run').timeBased().everyHours(1).create();
  Logger.log('1時間ごとのトリガーを登録しました。');
}
