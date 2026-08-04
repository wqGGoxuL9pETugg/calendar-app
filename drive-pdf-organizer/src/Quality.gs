/**
 * Drive 標準OCR（PDF→Docs変換）で得たテキストの品質判定。
 * ここで「不十分」と判定されたものだけ OpenAI フォールバックに回すことで、
 * 課金を最小限に抑える。
 */

/**
 * @param {string} text 抽出されたテキスト
 * @return {{ok: boolean, reason: string}} ok=false なら reason にフォールバック理由
 */
function assessExtractionQuality_(text) {
  if (!text) {
    return { ok: false, reason: 'empty' };
  }

  var trimmed = text.trim();
  if (trimmed.length < CONFIG.MIN_CHARS) {
    return { ok: false, reason: 'too_short(' + trimmed.length + 'chars)' };
  }

  var replacementCount = (trimmed.match(/�/g) || []).length;
  var replacementRatio = replacementCount / trimmed.length;
  if (replacementRatio > CONFIG.MAX_REPLACEMENT_CHAR_RATIO) {
    return { ok: false, reason: 'garbled(replacement_ratio=' + replacementRatio.toFixed(3) + ')' };
  }

  // 日本語（かな・漢字）比率と ASCII 比率のどちらも極端に低い場合、
  // OCR が意味のない記号列を吐いている可能性が高い。
  var jaCount = (trimmed.match(/[぀-ヿ一-鿿]/g) || []).length;
  var asciiCount = (trimmed.match(/[\x20-\x7E]/g) || []).length;
  var meaningfulRatio = (jaCount + asciiCount) / trimmed.length;
  if (meaningfulRatio < 0.3) {
    return { ok: false, reason: 'low_readable_ratio(' + meaningfulRatio.toFixed(3) + ')' };
  }

  return { ok: true, reason: '' };
}
