---
description: TORIMA の Firebase 連携（設定の受け渡し、認証、Realtime Database のパスとセキュリティルール、端末側暗号化）を監査・デバッグする。「同期されない」「Firebase に繋がらない」「permission denied」「ログインできない」「予定が消えた」「復号できない」ときに使う。
---

# Firebase 連携の監査とデバッグ

## 全体像

TORIMA の Firebase 連携には、他のアプリと違う点が 2 つある。

1. **設定値がリポジトリに入っていない。** 利用者がアプリの設定画面で Firebase の構成を貼り付け、
   localStorage の `fbConfig` に保存される。`loadFirebaseConfig()` がそれを読む。
   したがって `apiKey` 等をコードに直書きする変更は入れてはいけない
2. **サーバは暗号文しか持たない。** 予定は端末側で PBKDF2（150,000 回）+ AES-GCM により暗号化され、
   `{ salt, iv, ciphertext }` の形で書き込まれる。鍵の材料である `sessionPassword` はメモリ上のみに置く

## データの置き場所

| 状態 | 保存先 |
| :-- | :-- |
| ログイン済み | Realtime Database の `users/{uid}/events` |
| Firebase 未設定 | localStorage の `calEvents` |
| 旧形式（移行元） | Realtime Database のルート直下 `events` |

`loadEventsFromStore()` は 「現在の保存先 → 旧形式 → localStorage」の順に読み、
見つかった旧データを新しい場所へ書き直して移行する。読み込み経路に手を入れるときは、
この移行が生き残っているかを必ず確認すること。壊すと既存ユーザーの予定が消えたように見える。

## セキュリティルール

各ユーザーが自分のノードだけを読み書きできる形にする。

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

- `permission denied` が出るなら、まずログイン状態（`currentUser`）と、
  書き込み先のパスがルールの `$uid` と一致しているかを見る
- ルート直下の `events`（旧形式）を読む移行処理は、ルールで許可されていなければ失敗する。
  移行を終えた利用者しかいないなら、旧パスを閉じてよい

## 切り分け手順

1. **設定が入っているか**

   ブラウザの DevTools コンソールで:

   ```js
   JSON.parse(localStorage.getItem('fbConfig'))
   ```

   `apiKey` `authDomain` `databaseURL` が揃っている必要がある（`saveFirebaseConfig` が検証している）。
   `databaseURL` は `https://<name>.firebaseio.com` か `https://<name>.firebasedatabase.app` の形。

2. **SDK が読めているか**

   `firebase-app-compat.js` など 3 本の `<script>` は CDN 配信。
   `sw.js` は同一オリジンの GET しかキャッシュしないので、**オフラインでは必ず読み込みに失敗する**。
   オフライン時に同期できないのは仕様どおり。

3. **認証が通っているか**

   `auth.onAuthStateChanged` が `null` を返す間はロック画面のまま、予定は空配列になる。
   Firebase コンソールで Email/Password サインインが有効かを確認する。

4. **購読先が正しいか**

   `eventsRef = db.ref('users').child(user.uid).child('events')` を確認する。

5. **復号できるか**

   「パスワードが違うか、暗号化データを復号できませんでした。」は AES-GCM の復号失敗。
   原因はパスワード違い、または `salt` / `iv` / `ciphertext` の破損。
   **暗号文が壊れていた場合、パスワードを変えても復元はできない**ため、
   復旧ではなくバックアップからの復元を案内する。

## 変更時に守ること

- `apiKey` `databaseURL` などの設定値をリポジトリにコミットしない
- `sessionPassword`、復号後の予定内容、`ciphertext` をログに出さない
- 保存形式（`{ salt, iv, ciphertext }`）と暗号パラメータ（PBKDF2 150,000 回、AES-GCM）を変えない。
  変えるなら旧形式を読み続ける移行パスを必ず用意する
- `persistEvents()` は「暗号化してから書き込む」。平文を書き込む経路を新設しない
