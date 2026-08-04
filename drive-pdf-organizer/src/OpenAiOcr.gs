/**
 * OpenAI 連携。
 * - callOpenAiResponses_: Responses API への汎用呼び出し（Classify.gs からも使う）
 * - extractTextViaOpenAi_: Drive標準OCRの品質が不十分だった場合のフォールバック文字起こし
 *
 * GAS には PDF をページ画像に変換する手段がないため、PDF をそのまま
 * input_file として送れる Responses API の形式を使う。
 */

/**
 * @param {{message: string}} opts
 * @constructor
 */
function OpenAiRefusedError(message) {
  this.name = 'OpenAiRefusedError';
  this.message = message;
}
OpenAiRefusedError.prototype = Object.create(Error.prototype);

function OpenAiTooLargeError(message) {
  this.name = 'OpenAiTooLargeError';
  this.message = message;
}
OpenAiTooLargeError.prototype = Object.create(Error.prototype);

/**
 * Responses API を呼び、出力テキストを返す汎用ヘルパー。
 * @param {Object} payload Responses API の body（model, input 等）
 * @return {string}
 */
function callOpenAiResponses_(payload) {
  var res = UrlFetchApp.fetch(CONFIG.OPENAI_API_BASE + '/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getOpenAiApiKey_() },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('OpenAI API エラー (HTTP ' + code + '): ' + body.slice(0, 500));
  }

  var json = JSON.parse(body);

  if (json.output_text) return json.output_text;

  // output_text が無い場合は output[].content[].text を手動で探す（refusal 判定含む）
  var texts = [];
  var refused = false;
  (json.output || []).forEach(function (item) {
    (item.content || []).forEach(function (c) {
      if (c.type === 'output_text' && c.text) texts.push(c.text);
      if (c.type === 'refusal') refused = true;
    });
  });

  if (refused) {
    throw new OpenAiRefusedError('OpenAI が処理を拒否しました');
  }
  return texts.join('\n');
}

/**
 * PDF を OpenAI に直接渡して文字起こしを行う。
 * @param {GoogleAppsScript.Drive.File} pdfFile
 * @return {string} 文字起こしテキスト
 * @throws {OpenAiTooLargeError} サイズ超過時
 * @throws {OpenAiRefusedError} コンテンツポリシー等で拒否された場合
 */
function extractTextViaOpenAi_(pdfFile) {
  var blob = pdfFile.getBlob();
  var sizeBytes = blob.getBytes().length;
  if (sizeBytes > CONFIG.OPENAI_MAX_PDF_BYTES) {
    throw new OpenAiTooLargeError('PDFサイズが上限を超えています: ' + sizeBytes + ' bytes');
  }

  var base64 = Utilities.base64Encode(blob.getBytes());
  var payload = {
    model: CONFIG.OPENAI_MODEL,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'これは日本語の資料PDFです。全ページの本文をできるだけ正確に文字起こし' +
              'してください。レイアウトの説明や要約・コメントは不要で、本文テキストのみを出力してください。'
          },
          {
            type: 'input_file',
            filename: pdfFile.getName(),
            file_data: 'data:application/pdf;base64,' + base64
          }
        ]
      }
    ]
  };

  return callOpenAiResponses_(payload);
}
