# drive-pdf-organizer

Google Drive の「露骨文学 / 資料収集」フォルダに集めた PDF を自動で

1. テキスト化し（Drive標準OCR → 品質不足時のみ OpenAI にフォールバック）
2. 固定カテゴリの中から題材を判定し
3. カテゴリごとのサブフォルダへ PDF を移動、同じ場所に `.txt` を書き出す

Google Apps Script (GAS) の時間主導トリガーで無人実行する。ソースは
[clasp](https://github.com/google/clasp) で管理し、このリポジトリの
`drive-pdf-organizer/src/` を GAS プロジェクトとして push/pull する。

## 対象フォルダ

- 資料収集: `https://drive.google.com/drive/folders/1ZVUigYDl9hlDb3gaPWc4SlTuR30i3Us_`

フォルダIDは `src/Config.gs` の `CONFIG.ROOT_FOLDER_ID` で管理している。

## セットアップ

### 1. GAS プロジェクトの作成

```bash
npm install -g @google/clasp
clasp login
cd drive-pdf-organizer
clasp create --type standalone --title "drive-pdf-organizer" --rootDir ./src
```

`clasp create` が生成した `.clasp.json` の `scriptId` を確認し、
`.clasp.json.example` を参考に `.clasp.json` を用意する（`.clasp.json` は
`.gitignore` 対象なのでコミットされない）。

既存の GAS プロジェクトに紐づける場合は、`.clasp.json.example` をコピーして
`scriptId` を書き換えるだけでよい。

```bash
cp .clasp.json.example .clasp.json
# .clasp.json の scriptId を編集
clasp push
```

### 2. Drive Advanced Service の有効化

`appsscript.json` に `enabledAdvancedServices` として `Drive v2` を宣言済みだが、
GASエディタ側でも「サービス」から `Drive API` を追加し、Google Cloud 側で
Drive API が有効になっていることを確認する。

### 3. スクリプトプロパティの設定

GASエディタ「プロジェクトの設定」→「スクリプト プロパティ」で以下を追加する。

| プロパティ名 | 内容 |
|---|---|
| `OPENAI_API_KEY` | OpenAI API キー（Driveの標準OCRで拾いきれないPDFのフォールバックに使用） |

### 4. 権限の許可

GASエディタから `run` を初回手動実行し、Drive・スプレッドシート・外部リクエストの
権限を許可する。

### 5. 自動実行の登録

`installTriggers` を1回だけ手動実行すると、1時間ごとに `run` が呼ばれる
時間主導トリガーが登録される。

## 設定（`src/Config.gs`）

- `CATEGORIES`: 固定カテゴリの一覧。ここに無いカテゴリは LLM に作らせない。
  増やす／名前を変えるときはこの配列を編集して `clasp push` するだけでよい。
- `DRY_RUN`: `true` にすると Drive への書き込み（移動・.txt作成・フォルダ作成）を
  行わず、ログ出力だけで動作確認できる。新しい環境にセットアップした直後は
  まずこれを `true` にして `run()` を試すこと。
- `MOVE_ORIGINAL`: `false` にすると元PDFは移動せず `.txt` だけを書き出す。
- `MAX_FILES_PER_RUN`: GAS の実行時間制限（6分）対策。1回の `run()` で処理する
  ファイル数の上限。未処理が残っていれば1分後に自動で続きを実行する。

## 処理の流れ

1. `資料収集` 直下（サブフォルダは対象外）の PDF を列挙し、処理台帳
   （`資料収集` 内のスプレッドシート「処理台帳」）に未記載のものだけを対象にする。
2. Drive の「PDF → Googleドキュメント変換」でテキストを抽出する
   （埋め込みテキストPDFはそのまま、画像PDFはDriveのOCRが走る）。
3. 文字数・文字化け率などから品質を判定し、不十分なら OpenAI にPDFを直接渡して
   文字起こしする。
4. 抽出テキストの先頭部分とファイル名から、固定カテゴリの中から1つを選ぶ。
5. カテゴリフォルダ（無ければ作成）へ PDF を移動し、同名の `.txt` を書き出す。
6. 台帳に結果を記録する（ステータス: `done` / `refused` / `too_large` / `error`）。

失敗・分類不能・OpenAIに処理を拒否されたファイルは `_要確認` フォルダに退避される。

## 動作確認

- **ドライラン**: `Config.gs` で `DRY_RUN = true` にし、テキスト埋め込みPDFと
  画像スキャンPDFを1件ずつ `資料収集` に置いて `run()` を実行。ログで
  抽出文字数・品質判定・分類結果を確認する（ファイルは動かない）。
- **単体テスト**: `Test.gs` の `runTests()` を実行。品質判定と分類レスポンスの
  パースを検証する。
- **本番実行**: `DRY_RUN = false` にして `run()`。カテゴリフォルダが作られ、
  PDFが移動し `.txt` が生成され、台帳に行が追加されることを確認する。
- **冪等性**: もう一度 `run()` を実行し、処理済みファイルが再処理されない
  （台帳の行が増えない）ことを確認する。

## 既知の制約

- Drive標準OCRはページ数・サイズが大きいスキャンPDFで先頭部分しか
  読み取れないことがある。これは品質判定で検知しOpenAIフォールバックに回す。
- OpenAI側にも1リクエストあたりの容量上限があり、超過分は `too_large` として
  `_要確認` に退避する（自動分割はしない）。
- 「露骨文学」という題材の性質上、性的表現を含む資料はOpenAI側で処理を拒否
  されることがある。その場合は `refused` として `_要確認` に退避する。
- OpenAIフォールバックが走った分だけ課金が発生する。台帳の `method` 列で
  どのファイルが課金対象だったか確認できる。
