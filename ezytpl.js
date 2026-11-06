/* Bovitech Super App — v2.29: the ezyVet clinical templates.
   Settings → Templates → Procedure templates → 📥 Bring in the ezyVet templates: choose the file Claude made from the ezyVet backup
   (bovitech-ezyvet-templates.json — it stays private, it isn't part of the app). Each ezyVet template becomes a procedure template:
   its headings become sections, its pick lists become choices (with "Other — type it"), its set wording stays as set wording,
   and boxes that used an ezyVet shortcut (like -IDSIG or -PE) become typed answers. Bringing them in again updates them (nothing is doubled).
   The templates you've already changed here are left alone. */
const ezTpls = () => crTpls().filter((t) => t.from === 'ezyvet');
function ezTplCard() { const n = ezTpls().length; return `<div class="kv" style="align-items:center;margin-bottom:6px"><div class="v">${n ? `<b>${n} templates from ezyVet</b> <span class="hint">(listed below)</span>` : '<b>ezyVet templates</b> — not brought in yet'}<br><span class="hint">Choose the ezyVet templates file (bovitech-ezyvet-templates.json). Bringing it in again updates them — any you've changed here are kept.</span></div><label class="btn small" style="white-space:nowrap">📥 ${n ? 'Bring in again' : 'Bring in the ezyVet templates'}<input type="file" accept=".json,application/json" data-act="eztpl-file" hidden></label></div>`; }
function ezTplList() { const L = ezTpls(); if (!L.length) return ''; return `<details class="eztpl"><summary><b>From ezyVet (${L.length})</b></summary>${L.map((t) => `<div class="kv bk-tap" data-act="cr-tpledit" data-id="${t.id}"><div class="v"><b>${h(t.name)}</b>${t.edited ? ' <span class="hint">(changed here)</span>' : ''}<br><span class="hint">${t.species && t.species[0] === 'sheep' ? '🐑 Sheep' : '🐄 Cattle'} · ${(t.sections || []).length} sections · ${(t.sections || []).flatMap((s) => s.inputs).filter((i) => !i.fixed).length} questions</span></div></div>`).join('')}</details>`; }
async function ezTplImport(file) { let d; try { d = JSON.parse(await file.text()); } catch (e) { toast("That file couldn't be read"); return; }
  if (!d || d.kind !== 'bovitech-ezyvet-templates' || !Array.isArray(d.list)) { toast("That isn't the ezyVet templates file"); return; }
  const off = d.list.filter((t) => t.active === false).length; let withOff = false;
  if (off) withOff = await askBox('ezyVet templates', `<p>${d.list.length - off} templates are in use in ezyVet, and ${off} were switched off there (old or test ones). Bring in the switched-off ones too?</p>`, `Yes — all ${d.list.length}`, false, `No — just the ${d.list.length - off}`);
  let add = 0, upd = 0, kept = 0;
  d.list.filter((t) => withOff || t.active !== false).forEach((t) => { const ex = crList('crcfg').find((x) => x.id === t.id);
    const name = t.active === false ? `${t.name} (switched off in ezyVet)` : t.name;
    if (!ex) { const r = { ...bkClone(t), name }; delete r.active; touch(r); D.crcfg.push(r); add++; return; }
    if (ex.edited) { kept++; return; } Object.assign(ex, { sections: bkClone(t.sections), species: t.species, gone: false }); if (!ex._renamed) ex.name = name; touch(ex); upd++; });
  save(); if (window.Sync) Sync.soon(); NEXT_LOG_LABEL = 'ezyVet templates brought in'; toast(`ezyVet templates: ${add} added${upd ? `, ${upd} updated` : ''}${kept ? `, ${kept} kept as you changed them` : ''}`); renderAll(); }
document.addEventListener('change', (e) => { const el = e.target; if (!el || el.dataset.act !== 'eztpl-file' || !el.files || !el.files[0]) return; ezTplImport(el.files[0]); el.value = ''; });
/* a template changed here is marked, so bringing the file in again doesn't undo the change */
if (typeof crTplOpen === 'function') crTplOpen = (function (orig) { return function (t) { const r = orig.apply(this, arguments); if (t && t.from === 'ezyvet' && typeof SHEET !== 'undefined' && SHEET && SHEET.onSave) { const os = SHEET.onSave; const n0 = t.name; SHEET.onSave = async () => { const res = await os(); const ex = crCfg(t.id); if (res !== false && ex) { ex.edited = true; if (ex.name !== n0) ex._renamed = true; touch(ex); save(); } return res; }; } return r; }; })(crTplOpen);
(function () { const st = document.createElement('style'); st.textContent = '.cr-fixed{white-space:pre-wrap;margin:4px 0 8px;padding:6px 8px;border-left:3px solid var(--line);font-size:13px}.eztpl summary{cursor:pointer;padding:6px 0}'; document.head.appendChild(st); })();
window.ezTplCard = ezTplCard; window.ezTplList = ezTplList; window.ezTplImport = ezTplImport;
