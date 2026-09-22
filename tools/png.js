// PNG 한 장을 읽고 쓰는 한 곳. **8비트 · 비인터레이스**만 다룬다.
//
// ⚠️ 라이브러리를 안 쓴다 — 저장소에 이미지 의존성을 들이지 않으려는 것이고,
// 실제로 필요한 것은 플레이라이트가 주는 스크린샷과 `logo.png` 뿐이다.
// 모양이 다르면 **던진다** — 부르는 쪽이 「못 읽었다」로 실패시킨다 (조용히 통과하지 않게).
//
// ⚠️ **검사기 셋이 같이 쓴다** (`checkui` · `checktheme` · `genlogo`). 예전에는
// `checkui.js` 안에만 있었는데, 테마 검사가 같은 것을 필요로 하면서 **베낄 자리**가
// 생겼다 — 베낀 값은 한쪽만 고쳤을 때 조용히 갈린다.
'use strict';
const zlib = require('zlib');

// ─── 읽기 ─────────────────────────────────────────────────────
// 무엇으로 저장돼 있든 **RGBA 한 줄**(`px`)로 펴서 돌려준다 —
// 팔레트(+tRNS) · 회색 · 회색+알파 · RGB · RGBA 를 다 받는다
function decode(buf) {
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, inter = 0;
  const idat = []; let plte = null, trns = null;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const d = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; inter = d[12]; }
    else if (type === 'PLTE') plte = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || inter !== 0) throw new Error(`못 읽는 PNG — 비트깊이 ${depth} · 인터레이스 ${inter}`);
  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!CH) throw new Error('못 읽는 PNG — 색 타입 ' + ctype);
  if (ctype === 3 && !plte) throw new Error('팔레트 PNG 인데 PLTE 가 없다');
  const stride = w * CH;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < h && p + 1 + stride <= raw.length; y++) {
    const f = raw[p++];
    const row = Buffer.from(raw.slice(p, p + stride)); p += stride;
    unfilter(row, prev, f, CH, stride);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * CH;
      if (ctype === 3) {
        const i = row[s];
        px[o] = plte[i * 3]; px[o + 1] = plte[i * 3 + 1]; px[o + 2] = plte[i * 3 + 2];
        px[o + 3] = trns && i < trns.length ? trns[i] : 255;
      } else if (ctype === 0) { px[o] = px[o + 1] = px[o + 2] = row[s]; px[o + 3] = 255; }
      else if (ctype === 4) { px[o] = px[o + 1] = px[o + 2] = row[s]; px[o + 3] = row[s + 1]; }
      else if (ctype === 2) { px[o] = row[s]; px[o + 1] = row[s + 1]; px[o + 2] = row[s + 2]; px[o + 3] = 255; }
      else { px[o] = row[s]; px[o + 1] = row[s + 1]; px[o + 2] = row[s + 2]; px[o + 3] = row[s + 3]; }
    }
    prev = row;
  }
  return { w, h, px, ctype, depth, hasAlpha: ctype === 4 || ctype === 6 || (ctype === 3 && !!trns) };
}

function unfilter(row, prev, f, CH, stride) {
  for (let i = 0; i < stride; i++) {
    const a = i >= CH ? row[i - CH] : 0, b = prev[i], c = i >= CH ? prev[i - CH] : 0;
    let v = row[i];
    if (f === 1) v += a;
    else if (f === 2) v += b;
    else if (f === 3) v += (a + b) >> 1;
    else if (f === 4) {
      const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
      v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
    }
    row[i] = v & 255;
  }
}

// ─── 쓰기 ─────────────────────────────────────────────────────
function crc32(b) {
  let t = crc32.t;
  if (!t) {
    t = crc32.t = [];
    for (let n = 0; n < 256; n++) { let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0; }
  }
  let r = 0xffffffff;
  for (let i = 0; i < b.length; i++) r = t[(r ^ b[i]) & 255] ^ (r >>> 8);
  return (r ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length);
  return out;
}
// 줄마다 필터를 다 재 보고 «합이 제일 작은» 것을 고른다 (PNG 표준 휴리스틱)
function filterRows(px, w, h, CH, pick) {
  const stride = w * CH, out = Buffer.alloc((stride + 1) * h);
  let prev = Buffer.alloc(stride), o = 0;
  for (let y = 0; y < h; y++) {
    const row = px.slice(y * stride, (y + 1) * stride);
    let best = null, bestSum = Infinity, bestF = 0;
    for (const f of pick) {
      const t = Buffer.alloc(stride); let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= CH ? row[i - CH] : 0, b = prev[i], c = i >= CH ? prev[i - CH] : 0;
        let v;
        if (f === 0) v = row[i];
        else if (f === 1) v = row[i] - a;
        else if (f === 2) v = row[i] - b;
        else if (f === 3) v = row[i] - ((a + b) >> 1);
        else { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
          v = row[i] - ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)); }
        t[i] = v & 255; sum += Math.min(t[i], 256 - t[i]);
      }
      if (sum < bestSum) { bestSum = sum; best = t; bestF = f; }
    }
    out[o++] = bestF; best.copy(out, o); o += stride;
    prev = row;
  }
  return out;
}
function head(w, h, ctype) {
  const d = Buffer.alloc(13);
  d.writeUInt32BE(w, 0); d.writeUInt32BE(h, 4);
  d[8] = 8; d[9] = ctype; d[10] = 0; d[11] = 0; d[12] = 0;
  return d;
}
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// RGBA 그대로 쓴다
function encode(w, h, px) {
  const raw = filterRows(px, w, h, 4, [0, 1, 2, 3, 4]);
  return Buffer.concat([SIG, chunk('IHDR', head(w, h, 6)),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// 팔레트(색 타입 3) + tRNS 로 쓴다 — **서로 다른 RGBA 가 256개 이하일 때만**, 아니면 null.
// ⚠️ 알파가 낮은 것부터 정렬해 **tRNS 를 꼬리에서 자른다** (255 인 칸은 안 적어도 된다).
// 로고는 이렇게 쓰면 RGBA(158KB) 의 절반(77KB)이고 **원본 팔레트 PNG(101KB)보다도 작다**
function encodeIndexed(w, h, px) {
  const seen = new Set();
  for (let i = 0; i < w * h; i++) seen.add(px.readUInt32BE(i * 4));
  if (seen.size > 256) return null;
  const keys = [...seen].sort((a, b) => (a & 255) - (b & 255));
  const idx = new Map(keys.map((k, i) => [k, i]));
  const plte = Buffer.alloc(keys.length * 3), alpha = Buffer.alloc(keys.length);
  keys.forEach((k, i) => {
    plte[i * 3] = (k >>> 24) & 255; plte[i * 3 + 1] = (k >>> 16) & 255; plte[i * 3 + 2] = (k >>> 8) & 255;
    alpha[i] = k & 255;
  });
  let last = keys.length;
  while (last > 0 && alpha[last - 1] === 255) last--;
  const ind = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) ind[i] = idx.get(px.readUInt32BE(i * 4));
  // 인덱스는 «값» 이 아니라 번호라 평균·Paeth 는 뜻이 없다 — 없음/Sub/Up 만 재 본다
  const raw = filterRows(ind, w, h, 1, [0, 1, 2]);
  const parts = [SIG, chunk('IHDR', head(w, h, 3)), chunk('PLTE', plte)];
  if (last > 0) parts.push(chunk('tRNS', alpha.slice(0, last)));
  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

module.exports = { decode, encode, encodeIndexed };
