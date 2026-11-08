/* Bovitech Super App — v2.35: 🔧 Vehicle maintenance appointments.
   • A "🔧 Vehicle maintenance" appointment type: book it like any appointment, under the service provider's business, and choose the
     vehicle, what it's for and the day it comes back. The vehicle shows as away on Scheduling → Vehicles for those days.
   • Maintenance planned from Scheduling → Vehicles (🔧 needs maintenance → Book) also makes one of these appointments.
   • Each shows in the provider's Appointments on their business page, so the business keeps a log of what was done when.
   • They never send texts to the provider (no booking text, no reminder). */
const VM_TYPE = 'type-vmaint';
function vmTypeEnsure() { if (typeof Bk === 'undefined' || !Bk.get || !Bk.cfg('type').length || Bk.get(VM_TYPE)) return; const who = {}; Bk.people().forEach((p) => { who[p.id] = true; });
  const r = { id: VM_TYPE, cfg: 'type', name: '🔧 Vehicle maintenance', colour: '#6b7280', pattern: 'stripes', where: 'farm', who, fixedMins: 30, vmaint: true, order: 99 }; touch(r); D.bkcfg.push(r); }
const vmIs = (b) => !!b && (b.type === VM_TYPE || !!(Bk.get(b.type) || {}).vmaint);
/* keep each maintenance appointment and the vehicle's "away" record together */
function vmSync() { if (typeof Bk === 'undefined' || !Bk.list) return; vmTypeEnsure(); let ch = false;
  Bk.list('bookings').forEach((b) => { if (!vmIs(b)) return; if (!b.sms || b.sms.send || !b.sms.noReminder) { b.sms = { ...(b.sms || {}), send: false, noReminder: true }; touch(b); ch = true; }
    let r = b.vsvc ? Bk.get(b.vsvc) : null; const want = b.gone || !b.vmVeh ? null : { veh: b.vmVeh, mech: b.bid || null, what: b.vmWhat || 'Service', from: b.date, to: b.vmBack && b.vmBack >= b.date ? b.vmBack : b.date };
    if (!want) { if (r && !r.gone) { r.gone = true; touch(r); Bk.list('blocks').filter((x) => x.vsvc === r.id && !x.gone).forEach((x) => { x.gone = true; touch(x); }); ch = true; } return; }
    if (!r) { r = { id: uid('vsvc'), cfg: 'vsvc', bk: b.id, ...want }; touch(r); D.bkcfg.push(r); b.vsvc = r.id; touch(b); ch = true; return; }
    const diff = Object.keys(want).some((k) => (r[k] || null) !== (want[k] || null)) || r.gone; if (diff) { Object.assign(r, want, { gone: false, bk: b.id }); touch(r); ch = true; } });
  if (ch && typeof save === 'function') { save(); if (window.Sync) Sync.soon(); } }
/* maintenance booked from Scheduling → Vehicles also becomes an appointment */
if (typeof vehBook === 'function') vehBook = (function (orig) { return function (vid, mech, what, s) { const rec = orig.apply(this, arguments); try { vmTypeEnsure(); const st = (s.drop && [s.drop.a, s.drop.b].filter(Boolean)) || [];
  const b = { id: uid('bk'), type: VM_TYPE, bid: mech && IDX.biz.get(mech.id) ? mech.id : null, status: 'confirmed', staff: st, svcs: [{ staff: [...st] }], mins: 30, date: s.d, start: s.drop ? bkHHMM(s.drop.t) : '', sms: { send: false, noReminder: true }, notes: `${vehName(vid)} — ${what || 'Service'}`, vmVeh: vid, vmWhat: what || 'Service', vmBack: s.back || s.d, vsvc: rec.id };
  touch(b); Bk.list('bookings').push(b); rec.bk = b.id; touch(rec); } catch (e) { console.warn(e); } return rec; }; })(vehBook);
/* the booking form: which vehicle, what for, back on */
if (typeof bkFormHtml === 'function') bkFormHtml = (function (orig) { return function () { const html = orig.apply(this, arguments); if (!vmIs(BKF)) return html; const V = typeof vehList === 'function' ? vehList() : [];
  const box = `<div class="card vm-box" style="border-left:4px solid #6b7280"><div class="lbl" style="margin-bottom:4px">🔧 Vehicle maintenance</div><div class="hint" style="margin-bottom:6px">Book it under the service provider's business. No texts go to them.</div>
    <div class="grid2"><div class="f"><label for="vm-veh">Which vehicle</label><select id="vm-veh"><option value=""></option>${V.map((v) => `<option value="${h(v.id)}" ${BKF.vmVeh === v.id ? 'selected' : ''}>🚗 ${h(v.name)}</option>`).join('')}</select></div><div class="f"><label for="vm-what">What for</label><input id="vm-what" value="${h(BKF.vmWhat || 'Service')}"></div></div>
    <div class="f"><label for="vm-back">Back on (if they keep it longer than the day)</label><input id="vm-back" type="date" value="${h(BKF.vmBack || '')}"></div></div>`;
  const i = html.indexOf('<div class="f">'); return i < 0 ? box + html : html.slice(0, i) + box + html.slice(i); }; })(bkFormHtml);
document.addEventListener('change', (e) => { const t = e.target; if (typeof BKF === 'undefined' || !BKF || !/^vm-(veh|what|back)$/.test(t.id)) return; const k = { 'vm-veh': 'vmVeh', 'vm-what': 'vmWhat', 'vm-back': 'vmBack' }[t.id]; BKF[k] = t.value.trim() || undefined; if (!BKF[k]) delete BKF[k]; });
document.addEventListener('input', (e) => { const t = e.target; if (typeof BKF !== 'undefined' && BKF && t.id === 'vm-what') BKF.vmWhat = t.value; });
if (typeof renderAll === 'function') renderAll = (function (orig) { return function () { try { vmSync(); } catch (x) { console.warn(x); } return orig.apply(this, arguments); }; })(renderAll);
window.vmSync = vmSync; window.vmIs = vmIs; window.VM_TYPE = VM_TYPE;
