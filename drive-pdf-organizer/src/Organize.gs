/**
 * カテゴリフォルダの作成、PDFの移動、.txt の書き出し。
 */

/**
 * ROOT_FOLDER_ID 直下でカテゴリ名のフォルダを取得（無ければ作成）する。
 * @param {string} categoryName
 * @return {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateCategoryFolder_(categoryName) {
  var root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  var it = root.getFoldersByName(categoryName);
  if (it.hasNext()) return it.next();
  if (CONFIG.DRY_RUN) {
    Logger.log('[DRY_RUN] would create folder: ' + categoryName);
    return root; // ドライラン時はダミーとしてルートを返す（実書き込みはしない前提）
  }
  return root.createFolder(categoryName);
}

/**
 * 分類結果に基づき、PDFを移動し .txt を書き出す。
 * @param {GoogleAppsScript.Drive.File} pdfFile
 * @param {string} text
 * @param {string} category
 * @return {{txtFileId: string}}
 */
function organizeFile_(pdfFile, text, category) {
  var targetFolder = getOrCreateCategoryFolder_(category);
  var baseName = pdfFile.getName().replace(/\.pdf$/i, '');
  var txtName = baseName + '.txt';

  if (CONFIG.DRY_RUN) {
    Logger.log('[DRY_RUN] would write ' + txtName + ' (' + text.length + ' chars) into "' + category + '"');
    if (CONFIG.MOVE_ORIGINAL) {
      Logger.log('[DRY_RUN] would move ' + pdfFile.getName() + ' into "' + category + '"');
    }
    return { txtFileId: '' };
  }

  var txtFile = targetFolder.createFile(txtName, text, MimeType.PLAIN_TEXT);

  if (CONFIG.MOVE_ORIGINAL) {
    var parents = pdfFile.getParents();
    targetFolder.addFile(pdfFile);
    while (parents.hasNext()) {
      var parent = parents.next();
      if (parent.getId() !== targetFolder.getId()) {
        parent.removeFile(pdfFile);
      }
    }
  }

  return { txtFileId: txtFile.getId() };
}

/**
 * 処理に失敗した／分類不能なファイルを _要確認 フォルダへ退避する。
 * @param {GoogleAppsScript.Drive.File} pdfFile
 */
function moveToUnsorted_(pdfFile) {
  if (CONFIG.DRY_RUN) {
    Logger.log('[DRY_RUN] would move ' + pdfFile.getName() + ' into "' + CONFIG.UNSORTED_FOLDER + '"');
    return;
  }
  var target = getOrCreateCategoryFolder_(CONFIG.UNSORTED_FOLDER);
  var parents = pdfFile.getParents();
  target.addFile(pdfFile);
  while (parents.hasNext()) {
    var parent = parents.next();
    if (parent.getId() !== target.getId()) {
      parent.removeFile(pdfFile);
    }
  }
}
