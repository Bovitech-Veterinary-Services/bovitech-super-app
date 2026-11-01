/* Bovitech Super App — a small QR code maker (byte mode, error correction level M, versions 1–15),
   used for the authenticator-app set-up code. Written from the QR code standard (ISO/IEC 18004);
   no outside code. bvpQR(text) → { size, dark(x, y) }  ·  bvpQRSvg(text) → an SVG string with a wide white border. */
'use strict';
(function (root) {
  const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24]; // error-correction codewords per block, level M
  const BLK = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10]; // blocks, level M
  const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
  function divisor(deg) { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 0x02); } return r; }
  function remainder(data, div) { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => (r[i] ^= mul(c, f))); } return r; }
  function bvpQR(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let ver = 1; for (; ver <= 15; ver++) { const cc = ver < 10 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCodewords(ver) * 8) break; } if (ver > 15) throw new Error('Too long for a QR code');
    const cap = dataCodewords(ver) * 8; const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8)); put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
    for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    // split into blocks, add error correction, interleave
    const nb = BLK[ver], el = ECC[ver], raw = Math.floor(rawModules(ver) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb); const div = divisor(el); const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length; const ecc = remainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ecc)); }
    const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) all.push(b[i]); });
    // the grid
    const size = ver * 4 + 17; const M = [...Array(size)].map(() => Array(size).fill(false)); const F = [...Array(size)].map(() => Array(size).fill(false));
    const fn = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); fn(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = []; if (ver > 1) { const n = Math.floor(ver / 7) + 2; const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2; al.push(6); for (let p = size - 7; al.length < n; p -= step) al.splice(1, 0, p); }
    al.forEach((ax, i) => al.forEach((ay, j) => { if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    const format = (mask) => { const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const b = ((d << 10) | r) ^ 0x5412; const g = (i) => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) fn(8, i, g(i)); fn(8, 7, g(6)); fn(8, 8, g(7)); fn(7, 8, g(8)); for (let i = 9; i < 15; i++) fn(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) fn(size - 1 - i, 8, g(i)); for (let i = 8; i < 15; i++) fn(8, size - 15 + i, g(i)); fn(8, size - 8, true); };
    format(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); fn(a, c, bit); fn(c, a, bit); } }
    let i = 0; for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v; if (!F[y][x] && i < all.length * 8) { M[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; } } }
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
    const apply = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => { let p = 0; for (let k = 0; k < 2; k++) for (let a = 0; a < size; a++) { let run = 1; for (let b = 1; b < size; b++) { const c = k ? M[b][a] : M[a][b], pr = k ? M[b - 1][a] : M[a][b - 1]; if (c === pr) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      let dark = 0; M.forEach((r) => r.forEach((c) => (dark += c ? 1 : 0))); p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10; return p; };
    let best = 0, bestP = Infinity; for (let m = 0; m < 8; m++) { apply(m); format(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } apply(m); }
    apply(best); format(best);
    return { size, ver, dark: (x, y) => M[y][x] };
  }
  function bvpQRSvg(text, px) { const q = bvpQR(text), b = 4, n = q.size + b * 2; let d = ''; for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.dark(x, y)) d += `M${x + b},${y + b}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px || 240}" height="${px || 240}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`; }
  root.bvpQR = bvpQR; root.bvpQRSvg = bvpQRSvg;
  if (typeof module !== 'undefined') module.exports = { bvpQR, bvpQRSvg };
})(typeof window !== 'undefined' ? window : globalThis);
