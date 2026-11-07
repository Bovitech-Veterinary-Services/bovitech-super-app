/* Bovitech Super App — v2.33: Records → 📚 Clinical histories.
   On the Records page: search for a client, and see their clinical history — the records made in the app, and (kept separate for now)
   the 📚 ezyVet history. Every name is a link to the client's page. */
const H3 = { bid: null, q: '' };
function h3Card() { const b = H3.bid ? IDX.biz.get(H3.bid) : null; const q = H3.q.toLowerCase().trim();
  const hits = !b && q ? D.businesses.filter((x) => !x.gone && (x.name || '').toLowerCase().includes(q)).slice(0, 12) : [];
  let body = '';
  if (b) { const L = crList('crrec').filter((r) => !r.gone && r.bid === b.id).sort((x, y) => String(y.date).localeCompare(String(x.date)));
    body = `<div class="kv" style="align-items:center"><div class="v"><span class="lnk" data-act="open" data-kind="business" data-id="${b.id}"><b>${h(b.name)}</b></span></div><button class="btn small" data-act="h3-clear">✕ Another client</button></div>
      <h4 style="margin:8px 0 4px">Records in the app (${L.length})</h4>${L.map(crRecRow).join('') || '<div class="hint">None yet.</div>'}
      <h4 style="margin:12px 0 4px">📚 From ezyVet</h4>${typeof ezyBizCard === 'function' ? ezyBizCard(b) || '<div class="hint">Nothing from ezyVet for this client.</div>' : ''}`; }
  else body = `<div class="f"><label for="h3-q">🔍 The client's name</label><input id="h3-q" type="search" value="${h(H3.q)}" autocomplete="off" style="width:100%"></div>${hits.map((x) => `<div class="kv bk-tap" data-act="h3-pick" data-id="${x.id}"><div class="v"><b>${h(x.name)}</b>${typeof bizCat === 'function' && ['inactive', 'dna'].includes(bizCat(x)) ? ' <span class="hint">(inactive)</span>' : ''}</div></div>`).join('')}${q && !hits.length ? '<div class="hint">No client by that name.</div>' : ''}`;
  return `<details class="card h3card" ${b || q ? 'open' : ''}><summary><b>📚 Clinical histories</b> <span class="hint">— a client's records in the app and from ezyVet</span></summary><div style="margin-top:6px">${body}</div></details>`; }
if (typeof crRecsHtml === 'function') crRecsHtml = (function (orig) { return function () { const html = orig.apply(this, arguments); const m = '<div class="actions"><button class="btn primary" data-act="cr-new">'; const i = html.indexOf(m); return i < 0 ? html : html.slice(0, i) + h3Card() + html.slice(i); }; })(crRecsHtml);
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=h3-pick], [data-act=h3-clear]'); if (!el) return; e.stopPropagation(); if (el.dataset.act === 'h3-pick') { H3.bid = el.dataset.id; H3.q = ''; } else { H3.bid = null; H3.q = ''; } renderAll(); if (!H3.bid) setTimeout(() => { const i = document.getElementById('h3-q'); if (i) i.focus(); }, 30); }, true);
document.addEventListener('input', (e) => { if (e.target.id !== 'h3-q') return; H3.q = e.target.value; const pos = e.target.selectionStart; renderAll(); const i = document.getElementById('h3-q'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (x) { } } });
window.h3Card = h3Card; window.H3 = H3;
