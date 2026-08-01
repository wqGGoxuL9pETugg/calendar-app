---
description: TORIMA をリリースする手順。sw.js の CACHE_NAME を上げ、CORE_ASSETS とアイコン参照を確認し、リリース前チェックを回す。「リリース」「デプロイ」「公開」「キャッシュを更新」「バージョンを上げる」と言われたとき、または index.html を変更し終えたときに使う。
---

# TORIMA リリース手順

TORIMA は静的サイトなので「リリース」＝ `main` に push すること。ビルドは無い。
そのぶん、**Service Worker のキャッシュ更新を人間が忘れないこと**が唯一かつ最大の関門になる。

## なぜ CACHE_NAME を上げるのか

`sw.js` の `activate` イベントは `CACHE_NAME` と一致しないキャッシュだけを削除する。
`CACHE_NAME` を据え置いたまま配信すると古いキャッシュが生き残り、
特にホーム画面に追加した iOS の利用者に古い `index.html` が残り続ける。

`fetch` ハンドラは network-first なので通信できていれば新しい方を取れるが、
オフライン復帰直後や取りこぼしのときに古い版が出る。上げるのが正しい。

## 手順

1. **変更内容を確認する**

   ```bash
   git status --short
   git diff --stat
   ```

2. **`sw.js` の `CACHE_NAME` を上げる**

   `torima-v1` → `torima-v2` のように連番を進める。日付でもよいが、既存の連番形式に合わせる。

   ```bash
   grep -n "CACHE_NAME" sw.js
   ```

3. **`CORE_ASSETS` を実ファイルと突き合わせる**

   ファイルを増やした・消した・名前を変えたなら `CORE_ASSETS` も直す。
   存在しないパスが 1 つでもあると `cache.addAll()` は全体が失敗し、
   オフライン用キャッシュが丸ごと作られなくなる（`.catch(() => {})` で握り潰されるので気づけない）。

4. **リリース前チェックを回す**

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/check-syntax.mjs"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/check-pwa.mjs"
   ```

   前者は `index.html` の JS をコンパイルして構文エラーを見る。
   後者は manifest・アイコン・`CORE_ASSETS`・`index.html` の参照・`CACHE_NAME` の更新有無を検証する
   （詳細は `/torima-dev:pwa-check`）。

5. **ブラウザで開いて確認する**

   ```bash
   python3 -m http.server 8000
   ```

   最低限、月表示の描画・予定の追加と保存・パスワードでのロック解除まで触る。
   単一ファイル構成なので、JS のどこか 1 箇所で例外が出ると画面全体が死ぬ。
   DevTools のコンソールにエラーが無いことを必ず見る。

6. **コミットして push する**

   ```bash
   git add -A
   git commit -m "<変更内容の要約>"
   git push -u origin <branch>
   ```

## リリース前チェックリスト

- [ ] `sw.js` の `CACHE_NAME` を上げた
- [ ] `index.html` の JS に構文エラーが無い
- [ ] `CORE_ASSETS` のパスがすべて実在する
- [ ] `manifest.webmanifest` のアイコンが実在し、宣言どおりの寸法である
- [ ] コンソールにエラーが出ない
- [ ] Firebase の設定値（apiKey 等）をコードに直接書き込んでいない
  （設定は利用者がアプリ内で入力し localStorage の `fbConfig` に入る）
- [ ] `sessionPassword` や復号後の予定内容を `console.log` に残していない
