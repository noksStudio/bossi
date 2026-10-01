// Service worker של האפליקציה המותקנת. תפקיד אחד: מסך "אין חיבור" במקום
// דף השגיאה של הדפדפן. **לא שומר שום תגובה של המערכת במטמון** — נתוני
// דיירים לא נשארים על המכשיר, גם לא בטלפון משותף. רק הדף הסטטי, שהלוגו
// מוטבע בתוכו — אין לו בקשות משנה שייכשלו בלי רשת.
const CACHE = 'bossi-offline-v2';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
