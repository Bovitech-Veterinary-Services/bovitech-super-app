// Offline cache for the app shell. Bump VERSION on every release.
const VERSION = 'bvp-v83';
const SHELL = ['./', 'index.html', 'email.js', 'app.js', 'config.js', 'qr.js', 'supa.js', 'bookings.js', 'bk-ui.js', 'bk-form.js', 'bk-oncall.js', 'bk-plus.js', 'bk-year.js', 'setup.js', 'patients.js', 'ezy.js', 'voice.js', 'vcontrol.js', 'prep.js', 'handsfree.js', 'stock.js', 'statement.js', 'sharefarm.js', 'vehicles.js', 'bkinfo.js', 'herd.js', 'bulkhist.js', 'golive.js', 'nav.js', 'blocks2.js', 'prelive.js', 'ezytpl.js', 'invmail.js', 'tabs2.js', 'aiprog.js', 'rules.js', 'needfill.js', 'hist2.js', 'status2.js', 'perms2.js', 'comms2.js', 'menus2.js', 'richtext.js', 'setx.js', 'recreq.js', 'shorthand.js', 'contacts2.js', 'hist3.js', 'billing2.js', 'stock2.js', 'settings2.js', 'dlx.js', 'vmaint.js', 'locs2.js', 'ui3.js', 'safety2.js', 'sms.js', 'img/logo.png', 'cr.js', 'cr-ui.js', 'cr-tpls.js', 'cr-docs.js', 'vendor/jszip/jszip.min.js', 'templates/qsml-bbse.xlsx', 'defaults.json', 'privacy.html', 'terms.html', 'manifest.webmanifest', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', ...['a','aplus','b','c','bfriends','bvs','payup','dna','inactive','industry','newfac','newassess','newmaybe','occ','phone','prac','sheepreg','sheepocc','icon-192','icon-512'].map(n => `img/${n}.png`)];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bvp-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    // network first (so updates arrive straight away), saved copy when offline
    // always ask GitHub for the newest copy (no-cache = check before using the browser's saved copy)
    // weak reception: if GitHub hasn't answered within a few seconds, use the saved copy so the app still opens
    const net = fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); } return r; });
    const saved = () => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'));
    e.respondWith(new Promise(res => {
      let done = false; const finish = r => { if (!done && r) { done = true; res(r); } };
      const t = setTimeout(() => saved().then(hit => { if (hit) finish(hit); }), u.pathname.endsWith('version.json') ? 8000 : 3500);
      net.then(r => { clearTimeout(t); finish(r); }).catch(() => { clearTimeout(t); saved().then(hit => finish(hit || Response.error())); });
    }));
  } else if (u.host.includes('fonts.g')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; })));
  }
});
