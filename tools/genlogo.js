#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  로고를 «투명 배경» 으로 바꾼다 — npm run gen:logo
//
//  `logo.png` 는 원래 **투명 영역이 아예 없는 불투명 팔레트 이미지**였다.
//  그래서 스플래시 바탕을 테마 색으로 두면 **로고가 사각형으로 깨져 보였고**,
//  그 한 가지 때문에 로고 화면만 테마를 안 타고 고정 near-white 로 남아 있었다.
//
//  ⚠️⚠️ **「흰 것을 지운다」로는 안 된다 — 이 그림에는 «그림자»가 있다.**
//  로고는 산호색 그림과 그 아래로 깔린 부드러운 드롭 섀도가 흰 바탕에 «구워져» 있다.
//  near-white 만 지우면 그림자가 통째로 회색 얼룩으로 남고, 어두운 테마에서는
//  그것이 그림자가 아니라 **빛나는 자국**으로 보인다.
//
//  그래서 픽셀마다 「무엇이 얼마나 덮여 있나」(α)를 풀고, 바탕색을 **빼낸다**:
//
//      관찰된 색 c = f·α + 배경·(1−α)   →   f = (c − 배경·(1−α)) / α
//
//  α 는 두 갈래의 «큰 쪽»이다 — 하나로는 둘 다 못 잡는다:
//   · **그림(art)** — 채도(chroma)가 곧 얼마나 칠해졌는가다. 산호색은 chroma 70~124,
//     배경 잡티는 3 이하라 깨끗하게 갈린다
//   · **그림자(shadow)** — 중성색이라 chroma 로는 안 잡힌다. 배경보다 «얼마나 어두운가»
//     (ink)가 곧 α 다. 제일 짙은 데가 0.20 이라 그림자는 검정 20% 로 풀린다
//  ⚠️ 둘 다 **잡티 바닥**을 빼고 다시 편다 — 안 그러면 배경의 ±3 노이즈가
//  α 0.1 짜리 유령이 되어 **어두운 테마에서 온 화면에 흰 점**으로 뜬다
//
//  ⚠️ **팔레트 + tRNS 로 쓴다.** 서로 다른 RGBA 가 233가지라 256 안에 들어가서,
//  RGBA(158KB) 대신 **77KB** 다 — 불투명하던 원본(101KB)보다도 작다.
//  스플래시는 제일 먼저 받는 그림이라 이 차이가 그대로 첫 화면 시간이다
//
//  사용:
//    npm run gen:logo             # logo.png 를 투명 배경으로 (이미 투명하면 안 한다)
//    npm run gen:logo -- --check  # 투명한가 · 모서리가 비었는가 (npm test 가 돌린다)
//    node tools/genlogo.js 새그림.png   # 새 로고를 받아 logo.png 로 굽는다
//
//  ⚠️ **원본은 git 이 들고 있다** — 이 도구는 제자리에 덮어쓰므로 옛 불투명 그림이
//  필요하면 `git show 70f5dbb:logo.png` 다. 이미 투명한 파일에 두 번 돌리면
//  그림자가 또 빠지므로 **알파가 있으면 그 자리에서 멈춘다**
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const { decode, encodeIndexed, encode } = require('./png');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'logo.png');

// 잡티 바닥과 「다 칠해진 것」의 경계 — 그림에서 재서 잡았다 (위 주석 참고)
const CH_NOISE = 8;    // 배경 잡티의 chroma 상한
const CH_FULL = 26;    // 여기서부터는 그림이 다 칠해진 것으로 친다
const INK_NOISE = 0.014;  // 배경 휘도가 ±3 쯤 흔들린다

function bgOf(im) {
  // 네 모서리 8×8 의 «중앙값» — 평균은 잡티 한 점에 끌려간다
  const s = [];
  for (const [ox, oy] of [[0, 0], [im.w - 8, 0], [0, im.h - 8], [im.w - 8, im.h - 8]]) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const o = ((oy + y) * im.w + ox + x) * 4;
      s.push([im.px[o], im.px[o + 1], im.px[o + 2]]);
    }
  }
  return [0, 1, 2].map(i => { const a = s.map(c => c[i]).sort((p, q) => p - q); return a[a.length >> 1]; });
}
const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

function cut(im) {
  const bg = bgOf(im), bgL = lum(bg);
  const out = Buffer.alloc(im.w * im.h * 4);
  let clear = 0, solid = 0;
  for (let i = 0; i < im.w * im.h; i++) {
    const c = [im.px[i * 4], im.px[i * 4 + 1], im.px[i * 4 + 2]];
    const chroma = Math.max(...c) - Math.min(...c);
    const art = Math.min(1, Math.max(0, (chroma - CH_NOISE) / (CH_FULL - CH_NOISE)));
    const inkRaw = Math.max(0, (bgL - lum(c)) / bgL);
    const ink = Math.min(1, Math.max(0, (inkRaw - INK_NOISE) / (1 - INK_NOISE)));
    const a = Math.max(art, ink);
    const o = i * 4;
    if (a <= 0.002) {
      // ⚠️ 완전 투명한 칸도 **색은 배경색으로** 남긴다. 브라우저는 대개 알파를 곱해
      // 놓고 줄이지만(그러면 이 색은 안 보인다), 안 그러는 자리에서도 예전과 «같은»
      // near-white 가 번질 뿐이라 새로 생기는 자국이 없다
      out[o] = bg[0]; out[o + 1] = bg[1]; out[o + 2] = bg[2]; out[o + 3] = 0;
      clear++; continue;
    }
    for (let k = 0; k < 3; k++) {
      out[o + k] = Math.max(0, Math.min(255, Math.round((c[k] - bg[k] * (1 - a)) / a)));
    }
    out[o + 3] = Math.round(a * 255);
    if (out[o + 3] === 255) solid++;
  }
  return { out, bg, bgL, clear, solid };
}

// ─── --check : 지금 파일이 «투명한가» ────────────────────────────
// ⚠️ 이 줄이 없으면 누가 불투명 로고로 되돌려 놓아도 아무도 모른다 —
// 화면에는 오류 하나 없이 **여섯 테마 전부에서 로고가 사각형**이 된다
if (process.argv.includes('--check')) {
  let bad = 0;
  const say = m => { bad++; console.log('  ❌ ' + m); };
  let im;
  try { im = decode(fs.readFileSync(OUT)); }
  catch (e) { console.log('  ❌ logo.png 를 못 읽었다 — ' + e.message); process.exit(1); }
  if (!im.hasAlpha) say('logo.png 에 알파가 없다 (불투명 로고는 테마 바탕에서 사각형으로 깨져 보인다)');
  const corner = [[0, 0], [im.w - 1, 0], [0, im.h - 1], [im.w - 1, im.h - 1]]
    .map(([x, y]) => im.px[(y * im.w + x) * 4 + 3]);
  if (corner.some(a => a !== 0)) say(`모서리가 안 비어 있다 — 알파 [${corner}]`);
  // 그림이 통째로 날아가지 않았는가 (가운데가 살아 있는가)
  let solid = 0;
  for (let i = 0; i < im.w * im.h; i++) if (im.px[i * 4 + 3] === 255) solid++;
  const pct = solid / (im.w * im.h) * 100;
  if (pct < 30) say(`꽉 찬 칸이 ${pct.toFixed(1)}% 뿐이다 — 그림까지 지워졌나`);
  if (!bad) console.log(`  OK  로고가 투명 배경이다 (모서리 0 · 꽉 찬 칸 ${pct.toFixed(1)}%)`);
  process.exit(bad ? 1 : 0);
}

// ─── 굽기 ──────────────────────────────────────────────────────
const src = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : OUT;
const im = decode(fs.readFileSync(src));
if (im.hasAlpha && !process.argv.includes('--force')) {
  console.log(`  ${path.basename(src)} 는 이미 알파가 있다 — 그대로 둔다`);
  console.log('  (두 번 구우면 그림자가 또 빠진다. 정말 다시 하려면 --force)');
  process.exit(0);
}
const r = cut(im);
const buf = encodeIndexed(im.w, im.h, r.out) || encode(im.w, im.h, r.out);
const before = fs.existsSync(OUT) ? fs.statSync(OUT).size : 0;
fs.writeFileSync(OUT, buf);
console.log(`  배경 rgb(${r.bg}) · 휘도 ${r.bgL.toFixed(1)}`);
console.log(`  완전 투명 ${r.clear} · 꽉 찬 칸 ${r.solid} · 반투명 ${im.w * im.h - r.clear - r.solid}`);
console.log(`  logo.png ${before} → ${buf.length} 바이트 (${decode(buf).ctype === 3 ? '팔레트+tRNS' : 'RGBA'})`);
