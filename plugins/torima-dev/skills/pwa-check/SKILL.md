---
description: TORIMA の PWA 構成（manifest.webmanifest、アイコン、sw.js の CORE_ASSETS と CACHE_NAME、index.html からの参照）に食い違いが無いか検証する。「PWA が壊れた」「ホーム画面に追加できない」「アイコンが出ない」「オフラインで動かない」「キャッシュが更新されない」ときに使う。
---

# PWA 構成チェック

## 実行

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-pwa.mjs"
```

リポジトリのルート（`index.html` がある場所）で実行する。引数でルートを渡すこともできる。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-pwa.mjs" /path/to/calendar-app
```

## 検証項目

- `manifest.webmanifest` が妥当な JSON で、`name` `start_url` `display` `icons` が揃っている
- manifest が挙げるアイコンが実在し、**宣言した `sizes` と PNG の実寸が一致する**
  （ここがずれると iOS がインストールを黙って拒む）
- `purpose` に `any` と `maskable` の両方が揃っている
- `index.html` が参照する `manifest.webmanifest` と `apple-touch-icon` が実在する
- iOS 用メタタグ（`apple-mobile-web-app-capable` など）が消えていない
- `sw.js` の `CORE_ASSETS` に挙がったパスがすべて実在する
- `sw.js` に `CACHE_NAME` があり、`index.html` を変更しているのに据え置きになっていないか
  （`git` の HEAD と比較する）

終了コードは、エラーがあれば `1`、警告のみ・問題なしなら `0`。

## 結果の読み方

**エラー**は放置するとインストールやオフライン動作が壊れるもの。必ず直す。

**警告**は状況次第で正しいこともあるもの。たとえば `CACHE_NAME` の据え置き警告は、
CSS の軽微な修正だけならリリース前に上げれば足りるので、その場では警告どまりにしてある。

## よくある原因

| 症状 | 見るところ |
| :-- | :-- |
| ホーム画面に追加が出ない | manifest のアイコン寸法の不一致、`display` が `standalone` でない、HTTPS でない |
| 古い画面が消えない | `sw.js` の `CACHE_NAME` の上げ忘れ |
| オフラインで真っ白 | `CORE_ASSETS` に存在しないパスがあり `cache.addAll()` が全滅している |
| アイコンが白い四角 | `icon-192.png` / `icon-512.png` の欠落、または `purpose: maskable` の未指定 |
| 通知が出ない | PWA ではなく通知側の問題。`/torima-dev:notify-debug` を見る |
