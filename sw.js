// EvolveArena — çevrimdışı önbellek (v3.46)
// * Python çalışma motoru (pygame-web.github.io/cdn/0.9.3) DEĞİŞMEZ: bir kez
//   indirilir, sonra telefondan anında açılır (cache-first).
// * Oyunun kendi dosyaları (index.html, game.tar.gz...) önce internetten
//   istenir (güncelleme hemen gelsin); internet yoksa / çok yavaşsa
//   telefondaki kopya kullanılır.
// * Video ve sunucu (hesap, sıralama) istekleri önbelleğe girmez.
const GAME_CACHE = 'evo-game-v3.46';
const RUNTIME_CACHE = 'evo-runtime-0.9.3';

self.addEventListener('install', function (e) { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k !== GAME_CACHE && k !== RUNTIME_CACHE; })
      .map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

async function cacheFirst(req) {
  const c = await caches.open(RUNTIME_CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) c.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const c = await caches.open(GAME_CACHE);
  const hit = await c.match(req, {ignoreSearch: true});
  const net = fetch(req, {cache: 'no-cache'}).then(function (res) {
    if (res && res.ok && res.type === 'basic') c.put(req, res.clone());
    return res;
  });
  if (!hit) return net;
  // Ağ 6 saniyede cevap vermezse telefondaki kopya.
  const slow = new Promise(function (resolve) { setTimeout(function () { resolve(hit); }, 6000); });
  return Promise.race([net.catch(function () { return hit; }), slow]);
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('.mp4')) return;
  if (url.hostname === 'pygame-web.github.io' && url.pathname.indexOf('/cdn/') === 0) {
    e.respondWith(cacheFirst(req));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req));
  }
});
