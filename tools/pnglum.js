// PNG 한 장을 풀어 픽셀마다 «상대 휘도»를 내는 한 함수.
//
// ⚠️ **검사기 둘이 같이 쓴다** (`checkui.js` · `checktheme.js`). 예전에는
// `checkui.js` 안에만 있었는데, 테마 검사가 같은 것이 필요해지면서 **베껴 쓸 자리**가
// 생겼다 — 베낀 값은 한쪽만 고쳤을 때 조용히 갈린다 (`REWARD_MAX` 를 모듈에서 읽는
// 것과 같은 규칙이다). 그래서 파일 하나로 빼고 둘이 여기서 읽는다.
const zlib = require('zlib');

// ─── PNG 한 장을 풀어 픽셀마다 «상대 휘도»를 낸다 ────────────────
//
// `checkTextStyle()` 이 못 보는 자리를 재려고 둔 것이다 — 글자 뒤가 **형제 요소**면
// 조상에서 배경을 찾는 방식으로는 영영 안 걸린다 (퀘스트 진행도 숫자가 그렇다:
// 배경이 「크림색 트랙」으로 읽히고 채워진 분홍은 한 번도 안 본다).
//
// ⚠️ 라이브러리를 안 쓴다 — 플레이라이트가 주는 8비트·비인터레이스 PNG 만 풀면
// 되고 필터 다섯만 되돌리면 된다. 모양이 다르면 **빈 배열을 돌려주고** 부르는 쪽이
// 「한 점도 못 읽었다」로 실패시킨다 (조용히 통과하지 않게).
function pngLums(buf) {
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      const d = buf.slice(pos + 8, pos + 8 + len);
      w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9];
    } else if (type === 'IDAT') idat.push(buf.slice(pos + 8, pos + 8 + len));
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (ctype !== 2 && ctype !== 6) || !w || !h) return [];
  const ch = ctype === 6 ? 4 : 3, stride = w * ch;
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch (e) { return []; }
  const g = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const out = [];
  let prev = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < h && p + 1 + stride <= raw.length; y++) {
    const f = raw[p++];
    const row = Buffer.from(raw.slice(p, p + stride)); p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? row[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
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
    for (let x = 0; x < w; x++) {
      const o = x * ch;
      out.push(0.2126 * g(row[o]) + 0.7152 * g(row[o + 1]) + 0.0722 * g(row[o + 2]));
    }
    prev = row;
  }
  return out;
}

module.exports = { pngLums };
