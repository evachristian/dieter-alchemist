// PNG 한 장을 풀어 픽셀마다 «상대 휘도»를 내는 한 함수.
//
// ⚠️ **검사기 둘이 같이 쓴다** (`checkui.js` · `checktheme.js`). 예전에는
// `checkui.js` 안에만 있었는데, 테마 검사가 같은 것이 필요해지면서 **베껴 쓸 자리**가
// 생겼다 — 베낀 값은 한쪽만 고쳤을 때 조용히 갈린다 (`REWARD_MAX` 를 모듈에서 읽는
// 것과 같은 규칙이다). 그래서 파일 하나로 빼고 둘이 여기서 읽는다.
//
// ⚠️ **읽는 일 자체는 `tools/png.js` 한 곳**이다 — 여기는 그 위에 휘도만 얹는다.
// (예전에는 여기에 디코더가 또 있었고, `genlogo` 가 생기며 세 벌이 될 뻔했다)
// 못 읽는 모양이면 **빈 배열**을 돌려준다 — 부르는 쪽이 「한 점도 못 읽었다」로 실패시킨다
const { decode } = require('./png');

function pngLums(buf) {
  let im;
  try { im = decode(buf); } catch (e) { return []; }
  const g = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const out = new Array(im.w * im.h);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.2126 * g(im.px[i * 4]) + 0.7152 * g(im.px[i * 4 + 1]) + 0.0722 * g(im.px[i * 4 + 2]);
  }
  return out;
}

module.exports = { pngLums };
