---
description: TORIMA の端末通知（Service Worker の showNotification と index.html 側のスケジューラ）を調べて直す。「通知が来ない」「通知が二重に出る」「時刻がずれる」「iOS で通知されない」「リマインダーが動かない」ときに使う。
---

# 通知のデバッグ

## 仕組み

責務がはっきり分かれている。

- **`index.html` 側のスケジューラ** — いつ何を出すかの判断をすべて担う
- **`sw.js`** — `registration.showNotification()` の呼び出し先と、通知タップ時のフォーカス処理だけ

`notifyTick()` が 30 秒ごとに走り、可視状態に戻ったときにも走る。
各予定の `notify.offsets`（0 = 当日、1 = 前日、…）と `notify.time` から発火時刻を組み立て、
「前回チェック時刻より後・今より前」に入ったものを通知する。

関係する定数と localStorage キー:

| 名前 | 意味 |
| :-- | :-- |
| `torimaNotifyLastTick` | 前回チェックした時刻。ここから今までの区間を見る |
| `torimaNotifyFired` | 発火済みの記録。`{eventId}|{dateKey}|{offset}` をキーに二重発火を防ぐ |
| `NOTIFY_CATCHUP_MS` | 見逃し分を遡る上限（24 時間）。長時間閉じていても遡りすぎない |
| `NOTIFY_FIRED_TTL_MS` | 発火済み記録の保持期間（30 日）。過ぎたものは剪定される |

## 通知が出ないときの切り分け

上から順に潰す。**最初の 2 つが原因であることが圧倒的に多い。**

1. **ロックされていないか。** `notifyTick()` は `isAppUnlocked` が false なら即座に戻る。
   予定が復号されていないので当然通知もできない。**アプリを閉じている間は通知されない**のが仕様

2. **許可が下りているか。** `Notification.permission` が `granted` である必要がある。
   コンソールで確認する:

   ```js
   Notification.permission
   ```

3. **iOS か。** iOS では**ホーム画面に追加した PWA として開いた場合のみ**通知できる。
   Safari のタブで開いている限り出ない。iOS 16.4 以上も必要

4. **Service Worker が登録されているか。**

   ```js
   navigator.serviceWorker.getRegistration().then(console.log)
   ```

   `null` なら `sw.js` の配信に失敗している。Android Chrome は `new Notification()` を拒むため、
   ここが無いと通知経路が絶たれる

5. **予定側の設定。** `ev.notify.enabled` が true で、`offsets` が空でないこと

6. **初回起動の扱い。** `torimaNotifyLastTick` が無いときは「今」を基準に置くだけで何も通知しない
   （過去の予定を一気に出さないため）。動作確認するなら未来 1〜2 分後の予定で試す

## 時刻がずれるとき

`occurrenceTime()` は端末のローカル時刻で組み立てている。
一方 `parseDateKey()` / `toUtcDate()` は UTC 基準で、これは月表示の日付計算用。
**通知時刻の計算に UTC 系のヘルパーを混ぜてはいけない**（時差ぶんずれる）。
この理由はコード中のコメントにも書かれているので、消さずに残すこと。

## 二重に出るとき

`torimaNotifyFired` の記録が効いていない。キーの組み立て（`{eventId}|{dateKey}|{offset}`）か、
予定 ID が保存のたびに変わっていないかを疑う。

## 手元での確認

```bash
python3 -m http.server 8000
```

通知 API と Service Worker は `localhost` か HTTPS でしか動かない。`file://` での確認は無意味。
アプリ内のテスト通知ボタンを使えば、スケジューラを介さず表示経路だけを確かめられる。
