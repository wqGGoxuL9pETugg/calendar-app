/**
 * PDF からのテキスト抽出（第一手段）。
 *
 * Drive の「PDF → Google ドキュメント」変換を使う。この変換は
 * - 文字埋め込み済みPDF: 埋め込みテキストがそのまま本文になる
 * - 画像（スキャン）PDF: Drive の OCR が走ってテキスト化される
 * という2つの経路を1つのAPIで両方カバーできる。
 *
 * 既知の制約: ページ数・サイズが大きいスキャンPDFは OCR が先頭部分しか
 * 拾わないことがある。これは Quality.gs の判定（文字数が短すぎる等）で
 * 検知し、OpenAI フォールバックに回す前提で設計している。
 */

/**
 * @param {GoogleAppsScript.Drive.File} pdfFile
 * @return {string} 抽出されたテキスト（失敗時は空文字）
 */
function extractTextViaDrive_(pdfFile) {
  var blob = pdfFile.getBlob();
  var resource = {
    title: pdfFile.getName() + ' (OCR一時ファイル)',
    mimeType: MimeType.GOOGLE_DOCS
  };

  var tempDocFile = null;
  try {
    // Drive Advanced Service (v2) の files.insert に convert: true を渡すことで
    // PDF -> Google ドキュメントへの変換（必要ならOCR込み）が行われる。
    tempDocFile = Drive.Files.insert(resource, blob, { convert: true, ocr: true, ocrLanguage: 'ja' });

    var doc = DocumentApp.openById(tempDocFile.id);
    var text = doc.getBody().getText();
    return text;
  } finally {
    if (tempDocFile) {
      try {
        Drive.Files.remove(tempDocFile.id); // 一時ファイルはゴミ箱を経由せず完全削除
      } catch (e) {
        Logger.log('一時ファイル削除に失敗: ' + tempDocFile.id + ' / ' + e);
      }
    }
  }
}
