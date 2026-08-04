/**
 * 抽出テキストとファイル名から、CONFIG.CATEGORIES の中から1つだけ選ばせる。
 * LLM に新カテゴリを作らせない（フォルダの無秩序な増殖を防ぐ）。
 */

/**
 * @param {string} fileName
 * @param {string} text
 * @return {string} CONFIG.CATEGORIES に含まれるカテゴリ名。失敗時は「その他」。
 */
function classifyCategory_(fileName, text) {
  var excerpt = (text || '').trim().slice(0, CONFIG.CLASSIFY_CHARS);
  var categoryLines = CONFIG.CATEGORIES.map(function (c) {
    return '- ' + c.name + ': ' + c.desc;
  }).join('\n');
  var validNames = CONFIG.CATEGORIES.map(function (c) { return c.name; });
  var fallback = 'その他';

  var systemPrompt =
    'あなたは資料整理アシスタントです。与えられたファイル名と本文抜粋から、' +
    '以下のカテゴリ一覧の中から最も適切なものを1つだけ選んでください。' +
    '一覧にないカテゴリを新しく作ってはいけません。判断に迷う場合は「' + fallback + '」を選んでください。' +
    '出力はカテゴリ名のみを1行で返し、説明や記号は付けないでください。\n\n' +
    'カテゴリ一覧:\n' + categoryLines;

  var userPrompt = 'ファイル名: ' + fileName + '\n\n本文抜粋:\n' + excerpt;

  var payload = {
    model: CONFIG.OPENAI_MODEL,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0
  };

  var raw;
  try {
    raw = callOpenAiResponses_(payload);
  } catch (e) {
    Logger.log('分類APIエラー: ' + e + ' -> フォールバック「' + fallback + '」を使用');
    return fallback;
  }

  var answer = (raw || '').trim();
  // 前後の記号・引用符・空白を除去して素直な文字列比較に寄せる
  answer = answer.replace(/^["'「『\s]+|["'」』\s]+$/g, '');

  for (var i = 0; i < validNames.length; i++) {
    if (answer === validNames[i]) return validNames[i];
  }
  // 部分一致で救済（例: "カテゴリ: CoC" のような余計な前置きが付いた場合）
  for (var j = 0; j < validNames.length; j++) {
    if (answer.indexOf(validNames[j]) !== -1) return validNames[j];
  }

  Logger.log('分類結果が一覧外のため「' + fallback + '」にフォールバック: "' + answer + '"');
  return fallback;
}
