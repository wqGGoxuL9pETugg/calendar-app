---
description: TORIMA の index.html を編集するときの前提知識と作法。単一ファイル（HTML/CSS/JS が 1 ファイル）構成、ビルド無し、Firebase compat SDK、暗号化された保存形式といったこのリポジトリ固有の制約を扱う。index.html / sw.js / manifest.webmanifest を読む・直す・機能を足すときに使う。
---

# TORIMA のコード構造

TORIMA は**ビルド工程を持たない静的サイト**。`index.html` を開けばそれがアプリそのもので、
バンドラも npm もテストランナーも無い。壊したらそのまま本番が壊れる、という前提で編集する。

## ファイルの役割

| ファイル | 役割 |
| :-- | :-- |
| `index.html` | アプリ本体。CSS・HTML・JS がすべてこの中にある（約 3,200 行） |
| `sw.js` | Service Worker。PWA 化、端末通知の表示元、オフライン用キャッシュ |
| `manifest.webmanifest` | PWA のインストール情報（名前・色・アイコン） |
| `icon-192.png` / `icon-512.png` | ホーム画面用アイコン。manifest と sw.js の両方から参照される |

## index.html の中の区画

編集前に、自分がどの区画を触っているかを必ず確認する。行番号は変動するので
`grep -n "</style>\|<body>\|<script>" index.html` で都度取り直すこと。

1. `<head>`（先頭〜） — メタタグ、PWA 用の `apple-mobile-web-app-*`、manifest とアイコンの参照、
   Firebase compat SDK の `<script src>` 3 本（app / database / auth）
2. `<style>` 〜 `</style>` — 全 CSS。色は `:root` の CSS 変数（`--bg` `--accent` など）に集約されている。
   新しい色をハードコードせず、既存の変数を使うか変数を足す
3. `<body>` — 画面のマークアップ。要素は `document.getElementById()` で直接引かれているので、
   **id を変えると対応する JS が黙って壊れる**。id を変えるなら JS 側も一緒に直す
4. `<script>` 〜 `</script>` — 全ロジック。モジュールではなく素のグローバルスクリプト。
   先頭に状態変数（`events` `currentYear` `sessionPassword` など）がまとまっている

## 守るべき制約

- **モジュール化しない。** `import` / `export` は使えない（`<script>` は module ではない）。
  外部ファイルへの分割も、PWA のキャッシュ資産一覧（`sw.js` の `CORE_ASSETS`）と
  デプロイ手順に影響するので、依頼されていない限りやらない
- **ビルドが要る構文を持ち込まない。** TypeScript、JSX、SCSS などは不可。素の HTML/CSS/JS のみ
- **依存を足さない。** 追加が避けられない場合も CDN の `<script src>` 1 行で済ませ、
  オフライン時に落ちないか（`sw.js` は同一オリジンの GET しかキャッシュしない）を必ず考える
- **コメントは日本語。** 既存コードは「なぜそうしたか」を日本語で書く流儀なので合わせる。
  たとえば `occurrenceTime()` には UTC を使わない理由が書いてある
- **全体整形をしない。** インデントや引用符をまとめて変えると、単一ファイルゆえに
  差分が数千行になりレビュー不能になる。触った箇所だけ直す

## データまわりの不変条件

予定データは**端末側で暗号化してから保存される**。ここを崩すと既存ユーザーのデータが読めなくなる。

- 保存形式は `{ salt, iv, ciphertext }` 形の暗号化オブジェクト（PBKDF2 150,000 回 + AES-GCM）
- 保存先は Firebase 接続時が `users/{uid}/events`、未接続時が localStorage の `calEvents`
- 復号鍵の材料になる `sessionPassword` はメモリ上のみ。**保存・送信・ログ出力をしてはいけない**
- 旧形式（ルート直下の `events`、平文）からの移行パスが `loadEventsFromStore()` にある。
  読み込み経路を変えるときはこの移行が生き残っているか確認する

localStorage のキー: `fbConfig`, `calEvents`, `torimaSidebarMode`,
`torimaNotifyFired`, `torimaNotifyLastTick`

## 動作確認

JS を触ったら、まず構文だけでも通しておく。1 箇所の構文エラーで画面全体が死ぬため、
これだけでも「開いたら真っ白」の大半は防げる。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-syntax.mjs"
```

その先の確認は実際にブラウザで開く。ビルドもテストも無いので他に手段は無い。

```bash
python3 -m http.server 8000
```

`http://localhost:8000` を開く。Service Worker と通知 API は `localhost` か HTTPS でしか
動かないため、`file://` で開いた確認は当てにならない。

`index.html` を変更したら `/torima-dev:release` の手順に従って `sw.js` の
`CACHE_NAME` を上げる。上げ忘れると利用者に古い画面が残り続ける。
