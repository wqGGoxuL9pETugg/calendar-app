/**
 * 全体設定。カテゴリの追加・しきい値の調整はここだけ触ればよい。
 */
var CONFIG = {
  // 「露骨文学 / 資料収集」フォルダ
  ROOT_FOLDER_ID: '1ZVUigYDl9hlDb3gaPWc4SlTuR30i3Us_',

  // 処理台帳（スプレッドシート）の名前。ROOT_FOLDER_ID 直下に無ければ自動作成する。
  LEDGER_NAME: '処理台帳',
  LEDGER_SHEET_NAME: 'ledger',

  // 分類できなかった／処理に失敗したファイルの退避先フォルダ名
  UNSORTED_FOLDER: '_要確認',

  // true: 元PDFもカテゴリフォルダへ移動する / false: PDFは元の場所のまま、.txtだけ書き出す
  MOVE_ORIGINAL: true,

  // true: 実際の移動・書き込み・API呼び出しをせず、ログ出力とシミュレーションのみ行う
  DRY_RUN: false,

  // GAS は1実行6分で強制終了されるため、1回の run() で処理するファイル数の上限
  MAX_FILES_PER_RUN: 3,

  // 抽出テキストがこの文字数未満ならフォールバック（OpenAI）に回す
  MIN_CHARS: 200,

  // 置換文字(U+FFFD)の比率がこれを超えたら文字化けとみなしフォールバックへ
  MAX_REPLACEMENT_CHAR_RATIO: 0.01,

  // 分類プロンプトに渡す本文の先頭文字数
  CLASSIFY_CHARS: 3000,

  // OpenAI 側のモデル。実装・運用時に最新の vision 対応モデル ID へ差し替えること。
  OPENAI_MODEL: 'gpt-4.1',
  OPENAI_API_BASE: 'https://api.openai.com/v1',

  // OpenAI にフォールバックできる PDF の上限サイズ（バイト）。超えたら too_large として退避。
  OPENAI_MAX_PDF_BYTES: 32 * 1024 * 1024,

  // 固定カテゴリ一覧。LLM はこの中からしか選ばない。「その他」は必ず残しておくこと。
  CATEGORIES: [
    { name: 'CoC', desc: 'クトゥルフ神話TRPGのシナリオ・ルールブック・サプリメント' },
    { name: 'inSANe', desc: 'インセイン（TRPG）関連のシナリオ・ルール・資料' },
    { name: '神話・民俗', desc: '神話体系、民俗学、伝承、宗教史に関する資料' },
    { name: '文学研究', desc: '文学作品の研究論文・紀要・評論' },
    { name: 'その他', desc: '上記のいずれにも当てはまらないもの' }
  ]
};

/**
 * スクリプトプロパティから OpenAI API キーを取得する。
 * 「プロジェクトの設定 > スクリプト プロパティ」に OPENAI_API_KEY を登録しておくこと。
 */
function getOpenAiApiKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!key) {
    throw new Error('スクリプトプロパティ OPENAI_API_KEY が未設定です。');
  }
  return key;
}
