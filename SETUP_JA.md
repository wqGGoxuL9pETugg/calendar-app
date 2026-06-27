# TORIMADAY セットアップガイド

このガイドでは、まずアプリを動かし、そのあと Firebase 同期を有効にするところまでを説明します。

## 1. アプリを開発モードで起動する

PowerShell で次を実行します。

```powershell
cd C:\Users\PC_User\Documents\calendar-app
npm run dev
```

スマホでも確認したい場合は、こちらを使います。

```powershell
npm run dev:host
```

起動すると URL が表示されます。

- PC で見るとき: `http://localhost:5173/`
- スマホで見るとき: `http://192.168.x.x:5173/`

## 2. TORIMADAY の日付入力ルール

TORIMADAY は、先に西暦年を決めてから日付を入力します。

使い方:

1. `西暦年` に `2026` のように 4 桁で入力する
2. `日付入力` に月日だけを入力する

入力例:

- `3/21`
- `3月21日`
- `3/21-25`
- `4/25・26`
- 複数行入力

```text
3/21-25
4/25・26
```

## 3. 同期設定の全体像

PC とスマホで同じ予定を共有したい場合は、Firebase を使います。

必要な作業は次の 4 つです。

1. Firebase プロジェクトを作る
2. Web アプリを追加する
3. `.env` に設定値を入れる
4. Firestore Database を有効化する

## 4. Firebase プロジェクトを作る

ブラウザで [Firebase Console](https://console.firebase.google.com/) を開きます。

そのあと:

1. `プロジェクトを追加`
2. 好きなプロジェクト名を入力
3. 画面の案内に沿って作成

## 5. Web アプリを追加する

プロジェクト作成後に `</>` の Web アイコンを押します。

アプリ名の例:

- `torimaday-web`

登録すると、Firebase の設定値が表示されます。

表示例:

```ts
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
}
```

この 6 個の値を使います。

## 6. `.env` を作る

PowerShell で次を実行します。

```powershell
Copy-Item .env.example .env
```

## 7. `.env` に Firebase の値を入れる

`.env` を開いて、Firebase Console の値を貼り付けます。

```env
VITE_FIREBASE_API_KEY=ここに apiKey
VITE_FIREBASE_AUTH_DOMAIN=ここに authDomain
VITE_FIREBASE_PROJECT_ID=ここに projectId
VITE_FIREBASE_STORAGE_BUCKET=ここに storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=ここに messagingSenderId
VITE_FIREBASE_APP_ID=ここに appId
```

## 8. Firestore Database を有効化する

Firebase Console で次を開きます。

1. `Build`
2. `Firestore Database`
3. `データベースを作成`

最初の確認用なら、Firebase Console の `テストモード` で始めるのがいちばん簡単です。

## 9. Firestore ルールについて

今の TORIMADAY にはログイン機能がありません。

そのため、簡単に同期確認するには `テストモード` が最も手早いです。ただし、これは本番公開には向きません。

もし手動でルールを書くなら、確認用の最小ルールは次です。

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /schedules/{document=**} {
      allow read, write: if true;
    }
  }
}
```

注意:

- このルールは同期確認用です
- 公開 URL を知っている人なら読み書きできる可能性があります
- 本番利用前には Firebase Authentication の追加をおすすめします

## 10. 開発サーバーを再起動する

`.env` を保存したら、開発サーバーを止めてもう一度起動します。

```powershell
npm run dev
```

またはスマホ確認もするなら:

```powershell
npm run dev:host
```

## 11. 同期できているか確認する

アプリ右上の表示が `同期設定済み` になれば、Firebase 接続ができています。

確認手順:

1. PC で予定を 1 件登録する
2. 同じ Firebase 設定を入れた別端末で開く
3. 同じ予定が見えれば同期成功

## 12. うまくいかないとき

### Firebase 同期にならない

- `.env` の値が正しいか確認する
- 開発サーバーを再起動したか確認する
- Firestore Database を作成したか確認する

### 予定が保存できない

- Firestore ルールを確認する
- Firebase Console のプロジェクトが正しいか確認する

### スマホから見られない

- PC とスマホが同じ Wi-Fi か確認する
- `npm run dev:host` を使っているか確認する
- PC のファイアウォール設定を確認する

## 13. 次におすすめの改善

同期を本格的に使うなら、次はこの順番がおすすめです。

1. Firebase Authentication を追加する
2. Firestore ルールを安全なものに変える
3. 公開用にデプロイする
