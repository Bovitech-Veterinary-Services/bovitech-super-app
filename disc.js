/* Bovitech Super App — v2.41: 🏷️ discount rules, set on each price list item and each procedure.
   • "Always" — e.g. SDI and TSE work: the government subsidy (a % off, or a set price each).
   • "From a quantity" — e.g. a drug bought by the bottle, or pregnancy testing more than 500 head: once the quantity on the record
     reaches the number, every one is at the lower price (or % off).
   When more than one rule fits, the cheapest price wins. The invoice line says which discount was used. */
const DISC_ROW = (r) => `<div class="disc-row kv" style="align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0;padding:6px;border:1px solid var(--line,#ddd);border-radius:8px">
  <select class="disc-when" aria-label="When"><option value="always" ${r.when !== 'qty' ? 'selected' : ''}>Always</option><option value="qty" ${r.when === 'qty' ? 'selected' : ''}>From a quantity of</option></select>
  <input class="disc-min" type="number" min="1" step="any" value="${r.min || ''}" aria-label="Quantity" style="width:80px" ${r.when === 'qty' ? '' : 'hidden'}>
  <select class="disc-kind" aria-label="Discount"><option value="pct" ${r.kind !== 'price' ? 'selected' : ''}>% off</option><option value="price" ${r.kind === 'price' ? 'selected' : ''}>$ each (ex GST)</option></select>
  <input class="disc-val" type="number" min="0" step="any" value="${r.val != null ? r.val : ''}" aria-label="Amount" style="width:90px">
  <input class="disc-label" value="${h(r.label || '')}" aria-label="Shown on the invoice as" style="flex:1 1 160px;min-width:0">
  <button type="button" class="btn small disc-del" aria-label="Delete this rule">🗑️</button></div>`;
function discHtml(L, what) { return `<div class="f disc-box"><label>🏷️ Discount rules</label><div class="hint">For ${h(what || 'this item')}: e.g. "Always — 100% off — Government subsidy (SDI)", or "From a quantity of 10 — $4.50 each — bulk price". The last box is what the invoice line says. The cheapest rule that fits is used.</div>
  <div class="disc-list">${(L || []).map(DISC_ROW).join('')}</div><button type="button" class="btn small disc-add">➕ Add a discount rule</button></div>`; }
function discRead(root) { return [...(root || document).querySelectorAll('.disc-row')].map((el) => { const q = (c) => el.querySelector(c).value.trim(); const when = q('.disc-when'), kind = q('.disc-kind'), val = q('.disc-val');
  if (val === '') return null; return { id: uid('dr'), when, min: when === 'qty' ? Math.max(1, +q('.disc-min') || 1) : null, kind, val: +val || 0, label: q('.disc-label') }; }).filter(Boolean); }
document.addEventListener('click', (e) => { const t = e.target; if (!t.closest) return; const a = t.closest('.disc-add'); if (a) { e.preventDefault(); a.previousElementSibling.insertAdjacentHTML('beforeend', DISC_ROW({ when: 'always', kind: 'pct' })); return; }
  const d = t.closest('.disc-del'); if (d) { e.preventDefault(); d.closest('.disc-row').remove(); } });
document.addEventListener('change', (e) => { if (e.target.classList && e.target.classList.contains('disc-when')) e.target.closest('.disc-row').querySelector('.disc-min').hidden = e.target.value !== 'qty'; });
/* the best rule for a line */
function discBest(rules, qty, price) { let best = null; (rules || []).forEach((r) => { if (r.when === 'qty' && !(qty >= (+r.min || 1))) return; const p = r.kind === 'price' ? +r.val : crR4(price * (1 - Math.min(100, +r.val || 0) / 100)); if (!(p >= 0) || p >= price) return; if (!best || p < best.p) best = { p, r }; }); return best; }
if (typeof crBuildLines === 'function') crBuildLines = (function (orig) { return function (r) { const L = orig.apply(this, arguments);
  const tot = {}; L.forEach((l) => { tot[l.prod] = (tot[l.prod] || 0) + (+l.qty || 0); });
  L.forEach((l) => { const p = crProd(l.prod) || {}; const t = l.tpl ? crTpl(l.tpl) : null; const price = +l.price || 0; if (!price) return;
    const b1 = discBest(p.disc, tot[l.prod], price), b2 = t ? discBest(t.disc, +l.qty || 0, price) : null; const b = b1 && b2 ? (b1.p <= b2.p ? b1 : b2) : b1 || b2; if (!b) return;
    l.fullPrice = price; l.price = b.p; l.disc = b.r.id; l.desc = `${l.desc} — ${b.r.label || (b.r.kind === 'pct' ? b.r.val + '% off' : 'discounted')}`; });
  return L; }; })(crBuildLines);
window.discHtml = discHtml; window.discRead = discRead; window.discBest = discBest;
