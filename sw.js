// TORIMA Service Worker
// 役割：
//  1) PWA としてインストール可能にする（iOS のホーム画面追加に必要）
//  2) 端末通知の表示元になる（Android Chrome 等は new Notification() を拒否するため
//     registration.showNotification() が必須）
//  3) オフライン時に最低限の閲覧ができるよう同一オリジンのGETをキャッシュする
//
// 通知の「いつ・何を出すか」の判断はすべて index.html 側のスケジューラが行う。
// この SW は showNotification() の呼び出し先と、通知クリック時のフォーカス処理のみを担当する。

const CACHE_NAME = 'torima-v1';
const CORE_ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// network-first: 最新の index.html を優先し、オフライン時のみキャッシュへフォールバック。
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});

// 通知タップでアプリを前面に出す（既に開いていればそれをフォーカス、無ければ新規で開く）。
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
