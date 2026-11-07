/* Bovitech Super App — v2.30: appointment statuses.
   Unconfirmed → ✔ Booked (the time was agreed with the client when booking) → ✔✔ Confirmed (they replied YES to the reminder text).
   The app works out ✔✔ from the texts: a YES (y, yes, yep, ok, 👍…) from that client after the reminder went out. "✓ Confirmed by reply" on a
   reply job does the same. */
if (typeof BK_STATUS !== 'undefined') BK_STATUS.confirmed = 'Booked (time agreed)';
const ST_YES_DEF = ['y', 'ye', 'yes', 'yep', 'yeah', 'yup', 'ok', 'okay', 'sure', 'confirm', 'confirmed', 'yes please', 'yes thanks', 'thanks yes', 'yes thank you', '👍', '👌', '✅'];
const stYesList = () => { const L = (typeof D !== 'undefined' && D && D.settings && Array.isArray(D.settings.yesWords) && D.settings.yesWords.length) ? D.settings.yesWords : ST_YES_DEF; return L; };
const stNorm = (t) => String(t || '').toLowerCase().replace(/[.,!?;:'"()\-]+/g, ' ').replace(/\s+/g, ' ').trim();
function stYes(t) { const n = stNorm(t); if (!n) return false; const L = stYesList().map(stNorm); if (L.includes(n)) return true; const words = n.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim(); const sym = n.replace(/[\p{L}\p{N}\s]/gu, ''); if (words && L.includes(words) && (!sym || [...sym].every((c) => /\p{Extended_Pictographic}|\u200d|\ufe0f/u.test(c)))) return true; return !words && !!sym && L.some((w) => w && sym.includes(w) && !/[\p{L}\p{N}]/u.test(w)); } /* a reply that only says one of the YES words (Settings → Texts) */
const stRemAt = (b) => { const L = (typeof smsLog === 'function' ? smsLog() : []).filter((x) => x.booking_id === b.id && x.kind === 'reminder' && x.status !== 'failed'); return L.length ? Math.min(...L.map((x) => new Date(x.at).getTime() || 0)) : null; };
function stRemConf(b) { if (!b || b.status === 'unconfirmed' || !b.status) return !!(b && b.remConf); if (b.remConf) return true; const t0 = stRemAt(b); if (!t0) return false; const end = new Date(b.date + 'T23:59:59').getTime();
  return (typeof smsLog === 'function' ? smsLog() : []).some((x) => x.kind === 'reply' && (x.business_id === b.bid || (b.cid && x.contact_id === b.cid)) && stYes(x.body) && (new Date(x.at).getTime() || 0) >= t0 && (new Date(x.at).getTime() || 0) <= end); }
if (typeof Bk !== 'undefined') { Bk.remConf = stRemConf; Bk.statusText = (function (orig) { return function (b) { if (b && !b.proposal && b.status === 'confirmed' && stRemConf(b)) return '✔✔ Confirmed (replied YES to the reminder)'; const t = orig.apply(this, arguments); return b && b.status === 'confirmed' && !b.proposal ? '✔ ' + t : t; }; })(Bk.statusText); }
/* the calendar: ✔✔ on appointments confirmed by the reminder */
bkRender = (function (orig) { return function () { const html = orig.apply(this, arguments); if (BK.page && BK.page !== 'cal') return html; const ids = new Set(Bk.list('bookings').filter((b) => b.status === 'confirmed' && b.date >= bkAdd(bkToday(), -7) && stRemConf(b)).map((b) => b.id)); if (!ids.size) return html;
  return html.replace(/data-act="bk-open"([^>]*?) data-id="([^"]+)"/g, (m, mid, id) => (ids.has(id) ? m + ' data-rc="1"' : m)); }; })(bkRender);
/* a "confirmed by reply" from the reply job counts as ✔✔ */
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=bkj-replyconf]'); if (!el) return; const b = Bk.list('bookings').find((x) => x.id === el.dataset.id); if (b) { b.remConf = true; touch(b); } }, true);
(function () { const st = document.createElement('style'); st.textContent = '[data-rc="1"]::after{content:"✔✔";position:absolute;top:1px;right:3px;font-size:10px;font-weight:700;color:#1d5b2c;background:rgba(255,255,255,.85);border-radius:4px;padding:0 2px}'; document.head.appendChild(st); })();
window.stRemConf = stRemConf; window.stYes = stYes; window.ST_YES_DEF = ST_YES_DEF;
