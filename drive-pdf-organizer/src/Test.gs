/**
 * 簡易テスト。GASエディタから runTests() を手動実行してログを確認する
 * （外部API・Driveへの書き込みは行わない純粋なロジックのみを対象とする）。
 */
function runTests() {
  var results = [];

  results.push(assertEqual_('品質判定: 十分な長さの日本語テキストはOK',
    assessExtractionQuality_(repeat_('これはテスト用の日本語本文です。', 20)).ok, true));

  results.push(assertEqual_('品質判定: 短すぎるテキストはNG',
    assessExtractionQuality_('短い').ok, false));

  results.push(assertEqual_('品質判定: 空文字はNG',
    assessExtractionQuality_('').ok, false));

  results.push(assertEqual_('品質判定: 文字化け（置換文字だらけ）はNG',
    assessExtractionQuality_(repeat_('�', 300)).ok, false));

  results.push(assertEqual_('分類パース: 一覧内の値はそのまま採用（callOpenAiResponses_をモック）',
    withMockedClassifyResponse_('CoC', function () {
      return classifyCategory_('傀逅.pdf', repeat_('クトゥルフ神話TRPGのシナリオです。', 10));
    }), 'CoC'));

  results.push(assertEqual_('分類パース: 前後に余計な文字が付いても部分一致で救済',
    withMockedClassifyResponse_('カテゴリ: 文学研究', function () {
      return classifyCategory_('紀要.pdf', repeat_('文学研究の論文本文です。', 10));
    }), '文学研究'));

  results.push(assertEqual_('分類パース: 一覧外の値は「その他」にフォールバック',
    withMockedClassifyResponse_('未知のジャンル', function () {
      return classifyCategory_('謎.pdf', repeat_('よくわからない内容です。', 10));
    }), 'その他'));

  var failed = results.filter(function (r) { return !r.ok; });
  Logger.log('=== テスト結果: ' + (results.length - failed.length) + '/' + results.length + ' passed ===');
  failed.forEach(function (r) { Logger.log('FAIL: ' + r.label); });
  if (failed.length === 0) Logger.log('全テスト成功。');
}

function repeat_(s, n) {
  return new Array(n + 1).join(s);
}

function assertEqual_(label, actual, expected) {
  var ok = actual === expected;
  Logger.log((ok ? 'PASS' : 'FAIL') + ': ' + label + ' (expected=' + expected + ', actual=' + actual + ')');
  return { ok: ok, label: label };
}

/**
 * callOpenAiResponses_ を一時的に差し替えて classifyCategory_ をテストするヘルパー。
 * GAS はグローバル関数の再代入がそのまま効くため、これで安全にモックできる。
 */
function withMockedClassifyResponse_(mockedAnswer, fn) {
  var original = callOpenAiResponses_;
  callOpenAiResponses_ = function () { return mockedAnswer; };
  try {
    return fn();
  } finally {
    callOpenAiResponses_ = original;
  }
}
