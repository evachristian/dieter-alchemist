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
//   · **그림(art)** — 채도(chroma)가 곧 얼마나 칠해졌는가다. 배경이 중성색이라
//     chroma 는 «덮인 만큼»에 정확히 비례한다 (`c = α·f + (1−α)·회색` 이면
//     max(c)−min(c) = α·(max(f)−min(f)) 이다). 그래서 **다 칠해진 그림의 chroma**
//     (`CH_FULL`)로 나눈 것이 곧 α 다
//   · **그림자(shadow)** — 중성색이라 chroma 로는 안 잡힌다. 「색이 0~255 안에
//     남으려면 적어도 이만큼은 덮여 있어야 한다」는 **최소 α** 가 곧 그림자의 α 다
//     (아래 `floorOf`). 제일 짙은 데가 0.20 이라 그림자는 검정 20% 로 풀린다
//  ⚠️ 둘 다 **잡티 바닥**을 빼고 다시 편다 — 안 그러면 배경의 ±3 노이즈가
//  α 0.1 짜리 유령이 되어 **어두운 테마에서 온 화면에 흰 점**으로 뜬다
//
//  ⚠️⚠️ **`CH_FULL` 을 좁게 잡으면 안티에일리어싱이 통째로 날아간다.** 한때 26 이라
//  **chroma 26 만 넘으면 무조건 불투명**이었다 — 30% 만 덮인 가장자리 칸이 100%
//  산호색이 되어 «계단»이 됐다 (「챠콜 테마에서 안티앨리어싱 안 먹는다」로 신고받았다).
//  ⚠️ **밝은 테마에서는 이 사고가 «안 보인다»** — α 를 무엇으로 잡든 옛 배경에
//  도로 얹으면 원본이 그대로 나오기 때문이다(`f·α + 배경·(1−α) = c` 는 항등식이다).
//  α 가 틀린 것은 **다른 바탕에 얹어야** 드러난다. 그래서 「옛 화면과 같은가」만으로는
//  이 종류를 영영 못 잡고, `--check` 가 **가장자리에 중간 단계가 있는가**를 따로 본다
//
//  ⚠️ **밝은 쪽은 α 에 안 센다.** 배경이 245 라 위쪽 여유가 10 밖에 없어서,
//  베벨 하이라이트(250)를 「최소 α」에 넣으면 0.5 짜리 «흰 테»가 생긴다 —
//  어두운 테마에서 글자 둘레가 은색으로 빛난다 (그려 보고 되돌렸다)
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
// 「다 칠해진 그림」의 chroma. **그림의 «속»에서 재서 잡았다** — 반지름 2 안이 전부
// 그림인 칸 6만 개의 chroma 는 5% 분위 90 · 중앙값 107 이다. 90 이면 속의 95% 가
// 불투명해지고, 가장자리는 0~90 을 타고 내려가는 «진짜 ramp» 가 된다
const CH_FULL = 90;
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

// 「색이 0~255 안에 남으려면 적어도 이만큼은 덮여 있어야 한다」 — 채널마다
// `f = (c − 배경·(1−α))/α ≥ 0` 을 α 에 대해 풀면 `α ≥ (배경 − c)/배경` 이다.
// ⚠️ 이것이 곧 **그림자의 α** 이기도 하다 (검정 몇 % 로 덮였는가) — 중성색 칸에서는
// 예전의 「휘도로 잰 ink」와 같은 값이고, 색이 있는 칸에서는 늘 그보다 크다.
// 그래서 이 한 줄이 **두 가지를 같이 한다**: 그림자를 풀고, 색이 넘쳐 잘리는 것을 막는다
// (되얹었을 때의 어긋남이 최대 6.6 → 5.0 으로 오히려 줄었다)
const floorOf = (c, bg) => Math.max(0, ...[0, 1, 2].map(j => (bg[j] - c[j]) / bg[j]));

function cut(im) {
  const bg = bgOf(im), bgL = lum(bg);
  const out = Buffer.alloc(im.w * im.h * 4);
  let clear = 0, solid = 0;
  for (let i = 0; i < im.w * im.h; i++) {
    const c = [im.px[i * 4], im.px[i * 4 + 1], im.px[i * 4 + 2]];
    const chroma = Math.max(...c) - Math.min(...c);
    const art = Math.min(1, Math.max(0, (chroma - CH_NOISE) / (CH_FULL - CH_NOISE)));
    const inkRaw = floorOf(c, bg);
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
  // ⚠️⚠️ **가장자리에 «중간 단계»가 있는가** — 안티에일리어싱이 살아 있는가.
  // 꽉 찬 칸마다 제 이웃 넷 중 «제일 진한 반투명 이웃»을 보고, 그 분포의 10% 분위를 잰다.
  // 계단진 그림에서는 불투명 칸 바로 옆이 훅 비어 이 값이 바닥으로 내려간다
  // (옛 `CH_FULL = 26` 짜리 파일이 22 · 지금 159).
  // ⚠️ **「투명한가」·「되얹으면 같은가」로는 이것을 영영 못 잡는다** — α 를 어떻게
  // 잡든 옛 배경에 도로 얹으면 원본이 그대로 나온다 (위 주석). 잣대가 따로 있어야 한다
  const near = [];
  for (let y = 1; y < im.h - 1; y++) for (let x = 1; x < im.w - 1; x++) {
    if (im.px[(y * im.w + x) * 4 + 3] !== 255) continue;
    let best = -1;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const a = im.px[((y + dy) * im.w + x + dx) * 4 + 3];
      if (a < 255) best = Math.max(best, a);
    }
    if (best >= 0) near.push(best);
  }
  near.sort((p, q) => p - q);
  const RAMP_MIN = 64;
  const ramp = near.length ? near[Math.floor(near.length * 0.1)] : -1;
  if (ramp < 0) say('가장자리를 한 칸도 못 쟀다 — 꽉 찬 칸과 반투명 칸이 안 맞닿는다');
  else if (ramp < RAMP_MIN) say(`가장자리가 계단이다 — 이웃 α 10% 분위 ${ramp} (${RAMP_MIN} 이상이어야 한다)`);
  if (!bad) console.log(`  OK  로고가 투명 배경이다 (모서리 0 · 꽉 찬 칸 ${pct.toFixed(1)}% · 가장자리 ramp ${ramp})`);
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
