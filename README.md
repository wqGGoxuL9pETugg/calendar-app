# TORIMADAY

TORIMADAY は、先に西暦年を決めてから日付をまとめて入力できるカレンダーアプリです。

## 技術構成

- React + TypeScript + Vite
- Firebase Firestore 同期対応
- Firebase 未設定時は `localStorage` に保存

## 日付入力の考え方

先に西暦年を指定してから、月日だけを入力します。

例:

- `2026年` を指定して `3/21`
- `2026年` を指定して `3月21日`
- `2026年` を指定して `3/21-25`
- `2026年` を指定して `4/25・26`
- 複数行入力

```text
3/21-25
4/25・26
```

## 主な機能

- 月表示カレンダー
- 前月、今月、次月の切り替え
- 予定の作成、表示、編集、削除
- 日付クリックからのクイック登録
- 1日に複数予定を表示
- PC / スマホ対応
- Firebase によるクラウド同期

## 起動方法

```bash
npm install
npm run dev
```

スマホから同じ Wi-Fi で確認する場合:

```bash
npm run dev:host
```

## 同期設定

同期設定の詳しい手順は [SETUP_JA.md](C:/Users/PC_User/Documents/calendar-app/SETUP_JA.md) にまとめています。

## ビルド

```bash
npm run build
```
