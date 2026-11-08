/* Bovitech Super App — v2.36: the old "Safety" boxes on yards.
   The Safety box has gone from the location form (warnings and cautions do that job). Any yards that had something in it get a job:
   "Old safety notes — move to a warning or caution". Each one: make it a major warning, make it a minor warning, or just delete it —
   either way the old safety note is then deleted. */
if (typeof JOB_TYPES !== 'undefined') JOB_TYPES.safetymove = { t: 'Old safety notes — move to a warning or caution', manual: false };
if (typeof JOB_INFO !== 'undefined') JOB_INFO.safetymove = ['farm', 'The Safety box has gone from yards — warnings and cautions do that job now. Move each old safety note to a major or minor warning, or delete it.'];
function sfOld() { const out = []; (D.farms || []).forEach((f) => { if (f.gone) return; const pins = [{ pin: null, name: f.name || f.address || 'Farm', sf: f.safety }, ...(f.extra || []).filter((x) => x.type !== 'turn').map((x) => ({ pin: x.id, name: x.name || (pinT(x.type) || {}).name || 'Yards', sf: x.safety }))];
  pins.forEach((p) => { const sf = p.sf || {}; if ((sf.status && sf.status !== 'ok') || (sf.note || '').trim()) out.push({ f, ...p }); }); }); return out; }
const sfText = (x) => { const sf = x.sf || {}; const st = sf.status && sf.status !== 'ok' ? (SAFETY[sf.status] || {}).l || sf.status : ''; return [x.pin ? x.name + ':' : '', (sf.note || '').trim() || (st ? 'Safety — ' + st : '')].filter(Boolean).join(' ') + (st && (sf.note || '').trim() ? ` (was marked "${st}")` : ''); };
if (typeof computeJobs === 'function') computeJobs = (function (orig) { return function () { const J = orig.apply(this, arguments); try { sfOld().forEach((x) => { const o = farmOwner(x.f) || {}; const b = o.b || null;
  J.push({ type: 'safetymove', key: `safetymove:${x.f.id}:${x.pin || 'main'}`, kind: 'business', id: b ? b.id : null, fid: x.f.id, sfPin: x.pin || '', who: `${b ? b.name + ' — ' : ''}${x.f.name || x.f.address || 'Farm'}`, note: `Old safety note: ${sfText(x)}` }); }); } catch (e) { console.warn('safety jobs', e); } return J; }; })(computeJobs);
if (typeof jobItemHtml === 'function') jobItemHtml = (function (orig) { return function (j) { const html = orig.apply(this, arguments); if (!j || j.type !== 'safetymove') return html; const A = (to, l, cls) => `<button class="btn small ${cls || ''}" data-act="sfmove" data-fid="${h(j.fid)}" data-pin="${h(j.sfPin || '')}" data-to="${to}">${l}</button>`;
  const btns = `<div class="actions sfmove-btns">${A('warn', '⚠️🛑 Make it a major warning')}${A('caution', '⚠️ Make it a minor warning')}${A('del', '🗑 Just delete it', '')}</div>`; const i = html.lastIndexOf('</div>'); return i < 0 ? html + btns : html.slice(0, i) + btns + html.slice(i); }; })(jobItemHtml);
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act=sfmove]'); if (!el) return; e.preventDefault(); e.stopPropagation(); const f = IDX.farms.get(el.dataset.fid); if (!f) return; const pin = el.dataset.pin; const x = sfOld().find((y) => y.f.id === f.id && (y.pin || '') === pin); if (!x) { renderAll(); return; }
  const to = el.dataset.to; const txt = sfText(x);
  if (to === 'del') { if (!(await ask(`Delete the old safety note "${h(txt)}"? It isn't kept anywhere.`, 'Yes — delete it'))) return; }
  else addNote(f, 'farm', to, txt);
  if (pin) { const p = (f.extra || []).find((y) => y.id === pin); if (p) delete p.safety; } else delete f.safety; touch(f);
  NEXT_LOG_LABEL = to === 'del' ? `Old safety note deleted: ${f.name || 'farm'}` : `Old safety note moved to a ${to === 'warn' ? 'major' : 'minor'} warning: ${f.name || 'farm'}`; S.skipConfirm = true; await changed(); toast(to === 'del' ? 'Deleted' : `Moved to a ${to === 'warn' ? 'major' : 'minor'} warning`); }, true);
window.sfOld = sfOld;
