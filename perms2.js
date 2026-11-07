/* Bovitech Super App — v2.30 (answers for the texts and emails work):
   • Scheduling permissions also cover emails: "Send bulk emails" and "Change email templates" (untick to stop someone — after go-live).
   • The 💬 button shows the number it texts from beside it (this device's own number, set in Settings → This device). */
if (typeof BK_PERMS !== 'undefined') { if (!BK_PERMS.some((x) => x[0] === 'emailbulk')) BK_PERMS.push(['emailbulk', 'Send bulk emails']); if (!BK_PERMS.some((x) => x[0] === 'emailtpl')) BK_PERMS.push(['emailtpl', 'Change email templates and the footer']); }
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-act=eml-bulk],[data-act=eml-tpl-new],[data-act=eml-tpl-edit],[data-act=eml-foot]'); if (!el || typeof Bk === 'undefined') return;
  const p = el.dataset.act === 'eml-bulk' ? 'emailbulk' : 'emailtpl'; if (!Bk.can(p)) { e.stopPropagation(); e.preventDefault(); toast("You don't have permission for this — ask the office"); } }, true);
if (typeof smsBtns === 'function') smsBtns = (function (orig) { return function (o) { const html = orig.apply(this, arguments); if (!html) return html; const me = typeof smsDevNo === 'function' ? smsDevNo() : ''; const lab = me ? smsNice(me) : 'this device';
  return html.replace(/(aria-label="Text [^"]* from this device">💬)<\/a>/, `$1<span class="smsfrom">${h(lab)}</span></a>`); }; })(smsBtns);
(function () { const st = document.createElement('style'); st.textContent = '.smsfrom{font-size:10px;margin-left:3px;opacity:.75;white-space:nowrap;vertical-align:middle}'; document.head.appendChild(st); })();
