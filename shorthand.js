/* Bovitech Super App — v2.33: the ezyVet shortcuts (shorthand).
   Settings → Clinical records → ⌨️ Shortcuts: bring in the shortcuts file Claude made from ezyVet (ezyvet-shorthand.json — it stays private,
   it isn't part of the app), add, change or delete them.
   In a record, type a shortcut and a space (like "-PE " or "IM ") and it's replaced with its wording, the same as ezyVet:
   • a pick list (#INPUT#[question/answer/answer…]) asks the question, and an answer that's another shortcut is filled in too;
   • X in the answer is the amount — the app asks for it;
   • a product code in the answer ($$BVS_2380*99999$$) adds that product to the record's medications and items. */
const SH_ID = 'shorthand';
const shRec = () => crCfg(SH_ID);
const shList = () => (shRec() || {}).list || {};
const shOn = () => { const r = shRec(); const me = (typeof SBAuth !== 'undefined' && SBAuth.staff && SBAuth.staff.id) || (typeof crMe === 'function' ? crMe() : '') || 'device'; return !!r && !r.off && !(r.offFor || []).includes(me) && Object.keys(r.list || {}).length > 0; }; /* offFor: people who switched them off for themselves (settings2.js) */
function shFind(tok) { const L = shList(); if (Object.prototype.hasOwnProperty.call(L, tok)) return tok; if (/^[-#*]/.test(tok)) { const u = tok.toUpperCase(); const k = Object.keys(L).find((x) => x.toUpperCase() === u); if (k) return k; } return null; }
/* split a pick list "#INPUT#[q/a/b/ ]" — the question, then the answers (an empty last answer means "type your own") */
function shParse(s) { const m = /^#INPUT#\[([\s\S]*)\]$/.exec(s.trim()); if (!m) return null; const P = m[1].split('/'); const q = (P.shift() || '').trim().replace(/^['‘’"]+|['‘’"]+$/g, '').replace(/:$/, ''); const own = P.some((x) => !x.trim()); return { q, opts: P.map((x) => x.trim()).filter(Boolean), own }; }
const SH_PROD_RX = /\${2}(\$?[A-Za-z0-9_\-]+)(?:\*(\d+))?\${2}/g;
const shClean = (t) => t.replace(SH_PROD_RX, '').replace(/[ \t]{2,}/g, ' ').trim();
const shProdBy = (code) => { const c = String(code).replace(/^\$/, '').toUpperCase(); const m = (v) => v && String(v).replace(/^\$/, '').toUpperCase() === c; return crList('crprod').find((p) => !p.gone && m(p.code)) || crList('crprod').find((p) => !p.gone && m(p.packCode)) || null; };
const shPreview = (code) => { const t = shList()[code] || ''; const p = shParse(t); return p ? `asks “${p.q}”` : t.replace(/\s+/g, ' ').slice(0, 90); };
/* work out the wording for one shortcut; returns { text, prods:[{p, qty, code}] } or null if cancelled */
async function shExpand(code, depth = 0, out = { prods: [], miss: [] }) { const raw = String(shList()[code] || '').replace(/\r\n?/g, '\n'); if (depth > 6) return { text: raw, ...out };
  let text = ''; let rest = raw; const RX = /#INPUT#\[[^\]]*\]/; let m;
  while ((m = RX.exec(rest))) { text += rest.slice(0, m.index); rest = rest.slice(m.index + m[0].length); const pk = shParse(m[0]); if (!pk) continue;
    const opt = (o, i) => { const sc = shFind(o); return `<label class="bk-radio" style="display:block;margin:4px 0"><input type="radio" name="sh-a" data-ask="a" value="${i}" ${i === 0 ? 'checked' : ''}> ${sc ? `<b>${h(sc)}</b> <span class="hint">${h(shPreview(sc))}</span>` : h(shClean(o).replace(/\bX\b/g, '…') || o)}${/\${2}\$?[A-Za-z0-9_\-]+(\*\d+)?\${2}/.test(o) ? ' <span class="hint">· adds the product</span>' : ''}</label>`; };
    const ok = await askBox(h(pk.q || code), `<div style="max-height:55vh;overflow:auto">${pk.opts.map(opt).join('')}<label class="bk-radio" style="display:block;margin:4px 0"><input type="radio" name="sh-a" data-ask="a" value="own" ${pk.opts.length ? '' : 'checked'}> Other — type it</label><input data-ask="own" aria-label="Your own answer" style="width:100%;margin-top:4px"></div>`, 'Use this', false, 'Cancel');
    if (!ok) return null; const F = { ...ASK_FORM };
    let ans = F.a === 'own' || F.a == null ? (F.own || '').trim() : pk.opts[+F.a] || ''; const sc = shFind(ans);
    if (sc) { const sub = await shExpand(sc, depth + 1, out); if (!sub) return null; text += sub.text; continue; }
    const P = []; SH_PROD_RX.lastIndex = 0; let pm; while ((pm = SH_PROD_RX.exec(ans))) P.push({ code: pm[1], n: +pm[2] || 1 }); SH_PROD_RX.lastIndex = 0; ans = shClean(ans);
    if (/(^|[^A-Za-z])X(?=mL|[^A-Za-z]|$)/.test(ans) || P.some((x) => x.n === 99999)) { const q = await askBox('How much?', `<p>${h(ans.replace(/(^|[^A-Za-z])X(?=mL|[^A-Za-z]|$)/g, '$1…'))}</p><div class="f"><label for="sh-q">Amount</label><input id="sh-q" data-ask="q" inputmode="decimal" autofocus></div>`, 'OK', false, 'Cancel'); if (!q) return null; const n = String(ASK_FORM.q || '').trim() || '1';
      ans = ans.replace(/(^|[^A-Za-z])X(?=mL|[^A-Za-z]|$)/g, '$1' + n); P.forEach((x) => { if (x.n === 99999) x.n = parseFloat(n) || 1; }); }
    P.forEach((x) => { const p = shProdBy(x.code); if (p) out.prods.push({ p, qty: x.n, code: x.code }); else out.miss.push(x.code); }); text += ans; }
  text += rest;
  /* shortcuts inside the wording (like "-EXAM-FULL") are filled in as well */
  const parts = text.split(/(\s+)/); for (let i = 0; i < parts.length; i++) { const sc = /^\s*$/.test(parts[i]) ? null : shFind(parts[i]); if (sc && sc !== code && /^[-#]/.test(sc)) { const sub = await shExpand(sc, depth + 1, out); if (!sub) return null; parts[i] = sub.text; } }
  return { text: parts.join(''), ...out }; }
/* typing: a shortcut followed by a space or a new line */
const shField = (el) => el && (el.classList && el.classList.contains('rt-ed') || (/^(TEXTAREA|INPUT)$/.test(el.tagName) && (el.type === 'text' || el.tagName === 'TEXTAREA' || !el.type) && (el.dataset.crpr || el.closest('[data-crpr], .cr-edit, #sheet .cr-tplform'))));
let SH_BUSY = false;
document.addEventListener('input', async (e) => { const el = e.target; if (SH_BUSY || !e.isTrusted || !shOn() || !shField(el)) return; if (e.inputType && !/^insert(Text|LineBreak|Paragraph)$/.test(e.inputType)) return;
  let before, setRange; const isEd = el.classList.contains('rt-ed');
  if (isEd) { const sel = getSelection(); if (!sel.rangeCount) return; const r0 = sel.getRangeAt(0); const pre = r0.cloneRange(); pre.selectNodeContents(el); pre.setEnd(r0.endContainer, r0.endOffset); before = pre.toString(); }
  else before = el.value.slice(0, el.selectionStart);
  const m = /(^|[\s(])(\S+)([  \n])$/.exec(before); if (!m) return;
  const tok = m[2]; const code = shFind(tok); if (!code) return;
  const sp = m[3];
  if (isEd) { const sel = getSelection(); const r0 = sel.getRangeAt(0); const tn = r0.endContainer; const off = r0.endOffset; if (tn.nodeType !== 3 || off < tok.length + sp.length) return; const rng = document.createRange(); rng.setStart(tn, off - tok.length - sp.length); rng.setEnd(tn, off); setRange = () => { el.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(rng); }; }
  else { const end = el.selectionStart; const st = end - tok.length - sp.length; setRange = () => { el.focus(); el.setSelectionRange(st, end); }; }
  SH_BUSY = true; try { const res = await shExpand(code); if (!res) return; const txt = res.text + (sp === '\n' ? '\n' : ' '); setRange();
    let ok = false; try { ok = document.execCommand('insertText', false, txt); } catch (x) { ok = false; }
    if (!ok) { if (isEd) { const s = getSelection(); const r = s.getRangeAt(0); r.deleteContents(); r.insertNode(document.createTextNode(txt)); r.collapse(false); } else { el.setRangeText(txt, el.selectionStart, el.selectionEnd, 'end'); } el.dispatchEvent(new Event('input', { bubbles: true })); }
    if (!isEd) el.dispatchEvent(new Event('change', { bubbles: true }));
    if (res.prods.length) shAddProds(res.prods); if (res.miss.length) toast(`Not in the price list: ${[...new Set(res.miss)].join(', ')}`);
  } finally { SH_BUSY = false; } });
function shAddProds(L) { const r = typeof CR !== 'undefined' && CR.id && crGet('crrec', CR.id); if (!r || r.status === 'final') { toast('Open the record to add the products'); return; } r.items = r.items || [];
  L.forEach(({ p, qty, code }) => { const full = /FULL_/i.test(code); r.items.push({ id: uid('it'), prod: p.id, qty, as: full && p.pricePack ? 'pack' : 'dose', mode: full ? 'disp' : p.cat === 'merch' ? 'merch' : p.cat === 'consumable' ? 'cons' : 'admin', from: 'shorthand' }); });
  crSave(r); if (window.Sync) Sync.soon(); toast(`Added ${L.map((x) => x.p.name).join(', ')}`); setTimeout(() => { const a = document.activeElement; renderAll(); if (a && a.id) { const b = document.getElementById(a.id); if (b) b.focus(); } }, 50); }
/* Settings → Clinical records → ⌨️ Shortcuts */
function shCard() { const L = shList(); const ks = Object.keys(L).sort((a, b) => a.localeCompare(b)); const r = shRec();
  return `<div class="card"><h3><span class="sp">⌨️ Shortcuts</span></h3><div class="hint" style="margin-bottom:6px">Type a shortcut and a space in a record (like <b>-PE</b> or <b>IM</b>) and it's replaced with its wording — the same as ezyVet. Pick lists ask the question, and product codes add the product to the record.</div>
    <div class="kv" style="align-items:center"><div class="v">${ks.length ? `<b>${ks.length} shortcuts</b>${r && r.off ? ' — <b>switched off</b>' : ''}` : '<b>No shortcuts yet</b>'}<br><span class="hint">Choose the shortcuts file from ezyVet (ezyvet-shorthand.json). Bringing it in again adds new ones and updates the ones you haven't changed here.</span></div><label class="btn small">📥 Bring in the file<input type="file" accept=".json,application/json" data-act="sh-file" hidden></label></div>
    <div class="actions"><button class="btn small" data-act="sh-add">➕ New shortcut</button>${ks.length ? `<button class="btn small" data-act="sh-onoff">${r && r.off ? 'Switch on' : 'Switch off'}</button>` : ''}</div>
    ${ks.length ? `<details><summary>See the shortcuts</summary><div class="f" style="margin-top:6px"><label for="sh-q">🔍 Find a shortcut</label><input id="sh-q" type="search" style="width:100%"></div>${ks.map((k) => `<div class="kv bk-tap sh-row" data-act="sh-edit" data-k="${h(k)}"><div class="k"><b>${h(k)}</b></div><div class="v">${h(shPreview(k))}${(r.mine || []).includes(k) ? ' <span class="hint">(changed here)</span>' : ''}</div></div>`).join('')}</details>` : ''}</div>`; }
if (typeof crSettingsHtml === 'function') crSettingsHtml = (function (orig) { return function () { const html = orig.apply(this, arguments); const w = '<div class="cr-setwrap" data-tab="records">'; return html.includes(w) ? html.replace(w, w + shCard()) : html + shCard(); }; })(crSettingsHtml);
function shEnsure() { let r = shRec(); if (!r) { r = { id: SH_ID, cfg: 'shorthand', name: 'Shortcuts', list: {}, mine: [] }; touch(r); D.crcfg = D.crcfg || []; D.crcfg.push(r); } r.list = r.list || {}; r.mine = r.mine || []; return r; }
async function shImport(file) { let d; try { d = JSON.parse(await file.text()); } catch (x) { toast("That file couldn't be read"); return; } if (!d || d.kind !== 'ezyvet-shorthand' || !d.list || typeof d.list !== 'object') { toast("That isn't the ezyVet shortcuts file"); return; }
  const r = shEnsure(); let add = 0, upd = 0, kept = 0; Object.entries(d.list).forEach(([k, v]) => { k = String(k).trim(); if (!k) return; v = String(v || '').replace(/\r\n?/g, '\n'); if (r.mine.includes(k)) { kept++; return; } if (!(k in r.list)) add++; else if (r.list[k] !== v) upd++; r.list[k] = v; });
  crSave(r); if (window.Sync) Sync.soon(); NEXT_LOG_LABEL = 'ezyVet shortcuts brought in'; toast(`Shortcuts: ${add} added${upd ? `, ${upd} updated` : ''}${kept ? `, ${kept} kept as you changed them` : ''}`); renderAll(); }
document.addEventListener('change', (e) => { const el = e.target; if (el && el.dataset && el.dataset.act === 'sh-file' && el.files && el.files[0]) { shImport(el.files[0]); el.value = ''; } });
document.addEventListener('input', (e) => { if (e.target.id !== 'sh-q') return; const q = e.target.value.toLowerCase().trim(); document.querySelectorAll('.sh-row').forEach((x) => { x.hidden = !!q && !(x.dataset.k.toLowerCase().includes(q) || x.textContent.toLowerCase().includes(q)); }); });
document.addEventListener('click', async (e) => { const el = e.target.closest && e.target.closest('[data-act^=sh-]'); if (!el || el.dataset.act === 'sh-file') return; e.stopPropagation(); const a = el.dataset.act;
  if (a === 'sh-onoff') { const r = shEnsure(); r.off = !r.off; crSave(r); toast(r.off ? 'Shortcuts switched off' : 'Shortcuts switched on'); renderAll(); return; }
  const k0 = a === 'sh-edit' ? el.dataset.k : ''; const v0 = k0 ? shList()[k0] || '' : '';
  const res = await askBox(k0 ? `Shortcut ${h(k0)}` : 'New shortcut', `<div class="f"><label for="sh-k">Shortcut (what you type)</label><input id="sh-k" data-ask="k" value="${h(k0)}" autocomplete="off"></div><div class="f"><label for="sh-v">Wording</label><textarea id="sh-v" data-ask="v" rows="8">${h(v0)}</textarea></div><div class="hint">A pick list is written <b>#INPUT#[Question/answer one/answer two/ ]</b> (the empty answer at the end lets you type your own). <b>X</b> is the amount, and <b>$$CODE*99999$$</b> adds the product with that code.</div>`, 'Save', false, 'Cancel', k0 ? '🗑 Delete' : '');
  if (!res) return; const F = { ...ASK_FORM }; const r = shEnsure();
  if (res === 'alt') { if (!(await ask(`Delete the shortcut ${h(k0)}?`, 'Yes — delete'))) return; delete r.list[k0]; if (!r.mine.includes(k0)) r.mine.push(k0); crSave(r); toast('Deleted'); renderAll(); return; }
  const k = String(F.k || '').trim().replace(/\s+/g, ''); const v = String(F.v || '').trim(); if (!k || !v) { toast('Type the shortcut and its wording — nothing was saved'); return; }
  if (k !== k0 && k in r.list && !(await ask(`${h(k)} is already a shortcut. Replace it?`, 'Yes — replace'))) return;
  if (k0 && k !== k0) delete r.list[k0]; r.list[k] = v; if (!r.mine.includes(k)) r.mine.push(k); crSave(r); if (window.Sync) Sync.soon(); toast('Saved'); renderAll(); }, true);
window.shExpand = shExpand; window.shFind = shFind; window.shParse = shParse;
