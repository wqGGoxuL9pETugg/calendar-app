# calendar-app

このリポジトリには、用途と保存方式が異なる2つのカレンダーがあります。

## TORIMA

リポジトリ直下の `index.html` です。Firebaseログインと個人領域への暗号化保存を使います。

## Shared Calendar

`shared-calendar/` にある、ログイン不要の共有用カレンダーです。

- 予定は利用端末の `localStorage` に保存されます。
- 共有リンクでは予定をURLの `#` 以降へ圧縮して埋め込みます。
- URLフラグメントはWebサーバーへ送信されないため、予定データはGitHubやGitHub Pagesのアクセスログには保存されません。
- 共有リンクを知っている人は予定を閲覧できます。個人情報や公開したくない内容は登録しないでください。
- Discord Webhook URLは利用端末だけに保存され、共有リンクには含まれません。

### GitHub Pagesで開く

1. リポジトリの **Settings → Pages** を開きます。
2. 公開元を `main` ブランチのルートに設定します。
3. `https://wqggoxul9petugg.github.io/calendar-app/shared-calendar/` を開きます。

### Discordへ共有する

初めて設定する場合は、画面写真がなくても順番どおり進められる [Discord Webhook はじめてガイド](shared-calendar/webhook-guide.html) を参照してください。

1. Discordの対象チャンネルで **チャンネル設定 → 連携サービス → ウェブフック** を開き、Webhookを作成します。
2. Webhook URLをコピーします。このURLは投稿権限そのものなので、他人へ送らないでください。
3. Shared Calendarの **Webhookを設定** にURLを貼り、表示名と共有範囲を保存します。
4. **今すぐ反映** を押します。Discordにカレンダーメッセージが作成されます。
5. そのメッセージをピン留めします。以後、予定の保存・削除・取り込みから約3秒後に同じメッセージが更新されます。

実チャンネルへの初回接続確認は、Webhook URLを持つ利用者の環境で行ってください。

### 予定を取り込む

Shared Calendarの **まとめて取り込み** に月ブロック形式の予定表を貼り付けます。取り込み前の一覧で、不要な行のチェックを外せます。既存の予定は残り、同じ種類・同じタイトルの予定には日付が追加されます。

### バックアップ・機種変更

**共有・書き出し** から閲覧専用リンクを作ります。新しい端末でそのリンクを開き、**自分のカレンダーに取り込む** を選ぶと、端末内へ追加できます。

## 開発時の注意

- TORIMAの `index.html`、`sw.js`、`manifest.webmanifest`、既存アイコンはShared Calendarから変更しません。
- Shared Calendarの保存キーはすべて `sharedCal` で始まり、TORIMAの保存キーとは分離されています。
- 予定データやWebhook URLはコミットしません。
- `shared-calendar/` は `file://` ではなくHTTPサーバー経由で確認してください。
