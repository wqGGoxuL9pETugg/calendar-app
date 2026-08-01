# torima-dev

TORIMA（単一ファイル構成のカレンダー PWA）を開発するための Claude Code プラグイン。

このリポジトリにはビルド工程もテストもリンタも無く、`index.html` がそのままアプリになる。
そのため「Service Worker のキャッシュ版数を上げ忘れた」「JS の構文エラーで画面が真っ白」
「暗号化された保存形式を崩して既存の予定が読めなくなった」といった壊れ方を、
仕組みで防げない。このプラグインはそこを埋めるためのもの。

## 入っているもの

### スキル

| スキル | 用途 |
| :-- | :-- |
| `/torima-dev:app-structure` | `index.html` の区画、守るべき制約、データまわりの不変条件 |
| `/torima-dev:release` | リリース手順と、リリース前チェックリスト |
| `/torima-dev:pwa-check` | manifest・アイコン・`CORE_ASSETS`・`CACHE_NAME` の検証 |
| `/torima-dev:firebase-check` | 同期・認証・セキュリティルール・暗号化の監査と切り分け |
| `/torima-dev:notify-debug` | 端末通知が来ない・二重に出る・時刻がずれるときの切り分け |

スキルは `/名前` で明示的に呼べるほか、関連する作業をしていれば Claude が自動で参照する。

### エージェント

`@torima-dev:torima-reviewer` — コミット前のレビュー担当。差分を読み、
データ保全・機密の取り扱い・PWA のキャッシュ・通知・単一ファイル構成ゆえの壊れ方を確認する。

### フック

`index.html`・`manifest.webmanifest`・アイコンを編集したのに `sw.js` の `CACHE_NAME` が
据え置きのままなら、その場で一度だけ知らせる（`PostToolUse`）。
セッションごとに 1 回までなので、編集のたびに繰り返し言うことはない。

### スクリプト

どちらも単体で実行できる。依存は Node.js のみ。

```bash
node plugins/torima-dev/scripts/check-syntax.mjs   # index.html の JS の構文チェック
node plugins/torima-dev/scripts/check-pwa.mjs      # PWA 構成の検証
```

## 使い方

### このリポジトリで試す

```bash
claude --plugin-dir ./plugins/torima-dev
```

編集したら `/reload-plugins` で読み直す。

### インストールする

```
/plugin marketplace add wqGGoxuL9pETugg/calendar-app
/plugin install torima-dev@torima
/reload-plugins
```

マーケットプレイスの定義はリポジトリのルートの `.claude-plugin/marketplace.json` にある。

## 手を入れるとき

- スキルの `description` は、いつ使うかを具体的に書く。ここが曖昧だと Claude が呼ばない
- 中身に書くのは**このリポジトリ固有の事情**だけにする。一般的な PWA の解説は要らない
- 変更したら `claude plugin validate ./plugins/torima-dev` で検証する
- 中身を変えたら `.claude-plugin/plugin.json` の `version` を上げる。
  上げないとインストール済みの利用者に更新が届かない
