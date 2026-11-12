/* Bovitech Super App — v2.41: 📴 Work offline (loaded first, before everything else).
   When reception is poor the app can work offline on purpose: it stops trying to reach the internet (the practice database,
   Google, maps…) so it stays quick, keeps every change on this device, and syncs when you tap Go online. */
(function () {
  const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
  const real = () => (desc && desc.get ? desc.get.call(navigator) : true);
  let off = false; try { off = localStorage.getItem('bvp-offmode') === '1'; } catch (e) { }
  window.OFFMODE = { on: off, real };
  try { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !window.OFFMODE.on && real() }); } catch (e) { }
})();
