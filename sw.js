// Offline cache for the app shell. Bump VERSION and APPV on every release (APPV must match APP_VERSION in app.js).
// 2.49: cache-first — the app opens straight from this phone's saved copy (fast, even with poor reception). A new version is
// downloaded in the background into its own cache; it's only used once someone taps ⟳ (or every app window is closed), so the
// page is never reloaded out from under you. Versions are never mixed.
const VERSION = 'bvp-v102';
const APPV = '2.49.1';
const SHELL = ['./', 'index.html', 'offmode.js', 'email.js', 'app.js', 'config.js', 'qr.js', 'supa.js', 'bookings.js', 'bk-ui.js', 'bk-form.js', 'bk-oncall.js', 'bk-plus.js', 'bk-year.js', 'setup.js', 'patients.js', 'ezy.js', 'voice.js', 'vcontrol.js', 'prep.js', 'handsfree.js', 'stock.js', 'statement.js', 'sharefarm.js', 'vehicles.js', 'bkinfo.js', 'herd.js', 'bulkhist.js', 'golive.js', 'nav.js', 'blocks2.js', 'prelive.js', 'ezytpl.js', 'invmail.js', 'tabs2.js', 'aiprog.js', 'rules.js', 'needfill.js', 'hist2.js', 'status2.js', 'perms2.js', 'comms2.js', 'menus2.js', 'richtext.js', 'setx.js', 'recreq.js', 'shorthand.js', 'contacts2.js', 'hist3.js', 'billing2.js', 'stock2.js', 'settings2.js', 'dlx.js', 'vmaint.js', 'locs2.js', 'ui3.js', 'safety2.js', 'lists2.js', 'breeds.js', 'ui4.js', 'gcontacts2.js', 'disc.js', 'ui5.js', 'ui6.js', 'ui7.js', 'ui8.js', 'ui9.js', 'ui10.js', 'ui11.js', 'ui12.js', 'emojis.js', 'sms.js', 'img/logo.png', 'cr.js', 'cr-ui.js', 'cr-tpls.js', 'cr-docs.js', 'vendor/jszip/jszip.min.js', 'templates/qsml-bbse.xlsx', 'defaults.json', 'privacy.html', 'terms.html', 'manifest.webmanifest', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', ...['a','aplus','b','c','bfriends','bvs','payup','dna','inactive','industry','newfac','newassess','newmaybe','occ','phone','prac','sheepreg','sheepocc','icon-192','icon-512'].map(n => `img/${n}.png`)];
self.addEventListener('install', e => { e.waitUntil((async () => {
  const c = await caches.open(VERSION);
  // GitHub's servers can hand out the previous release for a few minutes after a new one: make sure app.js really is this version,
  // otherwise give up (nothing is changed) and the browser tries again later.
  const app = await fetch(new Request('app.js', { cache: 'reload' }));
  if (!app.ok || !(await app.clone().text()).includes("APP_VERSION = '" + APPV)) throw new Error('app.js is not ' + APPV + ' yet');
  await c.put('app.js', app);
  await Promise.all(SHELL.filter(u => u !== 'app.js').map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); })));
  if (!self.registration.active) await self.skipWaiting(); // very first install: start straight away
})()); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bvp-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    if (u.pathname.endsWith('version.json') || u.pathname.endsWith('sw.js')) return; // always the internet
    // the saved copy of this version first; anything not saved (pictures, view.html…) from the internet, saved copy if offline
    const root = /\/(index\.html)?$/.test(u.pathname);
    e.respondWith(caches.open(VERSION).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => hit || (root ? c.match('index.html') : null))).then(hit => hit || fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }).then(h2 => h2 || Response.error()))));
  } else if (u.host.includes('fonts.g')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; })));
  }
});
