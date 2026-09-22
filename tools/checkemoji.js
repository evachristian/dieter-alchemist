// 이모지가 **제 배경 위에서 보이는가** — 챠콜(다크)에서 검은 이모지가 사라지던 자리
//
// ⚠️⚠️ **`checkTextStyle()` 은 이모지를 아예 안 잰다** — 「그림 글자의 대비는 재지 않는다」가
// 규칙이라(하트 ♥ 3.56:1 · ❔ 1.34:1 이 둘 다 0건이던 그 자리) 이모지는 검사망 밖이다.
// 밝은 테마 다섯에서는 그래도 됐다: 이모지는 대개 어두운 쪽이라 크림색 판 위에서 저절로
// 읽힌다. **챠콜에서만 반대가 된다** — 어두운 판 위의 어두운 이모지(🐾 · 🎒 · 🖤…)는
// 윤곽조차 안 남는다 (「동행 크리처 없음」 앞의 🐾 가 그렇게 신고받은 자리다).
//
// 그래서 **진짜 픽셀로** 잰다. 글자 색이 아니라 «그려진 그림»이 문제라 다른 길이 없다:
//   ① 화면에 뜬 이모지를 `Range` 로 한 덩어리씩 집어 상자를 얻고
//   ② 그 상자 «바깥» 띠의 가운뎃값을 배경으로 삼고
//   ③ 상자 «안»에서 배경과 제일 먼 픽셀을 찾아 대비를 낸다
//
// ⚠️⚠️ **절대 기준(3:1)을 그대로 문으로 쓰면 안 된다 — 재 보고서야 알았다.**
// 그 잣대로는 **에크루가 71건 · 챠콜이 20건**이다. 흰 판 위의 흰 자물쇠(🔒 1.03:1) ·
// 주황 딱지 위의 밤톨(🌰 1.04:1) 처럼 **밝은 테마에서도 원래 낮은 자리**가 잔뜩이라,
// 그것까지 고치라고 하면 이모지를 통째로 갈아 치우는 일이 된다. 게다가 그 목록은
// 이번 신고(「다크에서 이모지가 안 보인다」)와 아무 상관이 없다.
//
// **가르는 것은 «다크가 밝은 테마보다 못한가»다.** 밝은 다섯은 오래 눈으로 보아 온
// 화면이라 그것이 곧 기준선이고, 다크는 판의 명암이 뒤집히면서 **원래 잘 보이던 것이
// 안 보이게 된** 자리만 고치면 된다. 그래서 두 테마를 다 재서 견준다 —
// `MIN` 아래이면서 **밝은 테마보다도 낮은** 자리만 실패다.
//
// ⚠️ **밝기 차가 아니라 «대비»로 잰다** — 어두운 배경에서는 같은 밝기 차라도 훨씬 크게
// 보인다. 사람이 보는 것과 같은 잣대라야 테마를 옮겨도 같은 뜻이다.
//
// 사용: node tools/checkemoji.js     (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
//       VERBOSE=1 ...                (잰 것을 다 찍는다)
const BASE = process.env.BASE || 'http://localhost:8080';
const DARK = process.env.DARK || 'charcoal';   // 볼 테마
const REF  = process.env.REF  || 'ecru';       // 견줄 밝은 테마 (기본 테마다)
const MIN = Number(process.env.MIN) || 3;      // 그림의 대비 기준 (WCAG 1.4.11)

const { pngLumGrid } = require('./pnglum');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

const launchOpts = () => {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
};

const VW = 390, VH = 780;

// 화면에 뜬 이모지를 «덩어리»로 집어 상자를 잰다.
// ⚠️ 이모지 하나가 코드포인트 여럿이다 (변형자 · 피부색 · ZWJ). 한 글자씩 자르면
// 상자가 조각나 엉뚱한 자리를 재게 되므로 덩어리째 집는다
const COLLECT = `(() => {
  const RE = /(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E|[\\u{1F3FB}-\\u{1F3FF}]|\\u200D\\p{Extended_Pictographic})*)+/gu;
  const out = [];
  const shown = el => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.15) return false;
    }
    return true;
  };
  const nameOf = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList.length) s += '.' + [...el.classList].join('.');
    return s;
  };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const s = n.textContent;
    if (!s || !RE.test(s)) { RE.lastIndex = 0; continue; }
    RE.lastIndex = 0;
    const el = n.parentElement;
    if (!el || !shown(el)) continue;
    const cs = getComputedStyle(el);
    let m;
    while ((m = RE.exec(s))) {
      const r = document.createRange();
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const q = r.getBoundingClientRect();
      if (q.width < 6 || q.height < 6) continue;
      // 창 «안»에 온전히 들어온 것만 (잘린 상자는 배경 띠를 못 잰다)
      if (q.left < 6 || q.top < 6 || q.right > innerWidth - 6 || q.bottom > innerHeight - 6) continue;
      out.push({ ch: m[0], sel: nameOf(el), shadow: cs.textShadow,
                 x: q.left, y: q.top, w: q.width, h: q.height });
    }
  }
  return out;
})()`;

// 상자 안에서 «배경과 제일 먼» 픽셀을 찾고, 상자 둘레 띠의 가운뎃값을 배경으로 삼는다.
//
// ⚠️⚠️ **테는 글리프 «밖»에 그려진다** — `Range` 가 주는 상자는 글자에 딱 붙어 있어서,
// 상자만 재면 테가 통째로 빠지고(고친 것이 안 재지고) 게다가 그 테가 둘레 띠에 섞여
// **배경이 밝아진 것처럼** 보인다. 실제로 테를 두르자마자 🏠 이 2.69 → 로 «떨어졌다»
// (고쳐 놓고 나빠진 것처럼 보이던 자리다). 그래서 상자를 `PAD` 만큼 넓혀 테까지 안에
// 넣고, 띠는 거기서 또 `GAP` 만큼 떨어뜨린다
function measure(grid, b) {
  const { w, h, l } = grid;
  const PAD = 4, GAP = 3, BAND = 3;
  const x0 = Math.max(0, Math.round(b.x) - PAD), y0 = Math.max(0, Math.round(b.y) - PAD);
  const x1 = Math.min(w, Math.round(b.x + b.w) + PAD), y1 = Math.min(h, Math.round(b.y + b.h) + PAD);
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  const ring = [];
  for (let y = y0 - GAP - BAND; y < y1 + GAP + BAND; y++) {
    if (y < 0 || y >= h) continue;
    for (let x = x0 - GAP - BAND; x < x1 + GAP + BAND; x++) {
      if (x < 0 || x >= w) continue;
      const inside = x >= x0 - GAP && x < x1 + GAP && y >= y0 - GAP && y < y1 + GAP;
      if (inside) continue;
      ring.push(l[y * w + x]);
    }
  }
  if (ring.length < 20) return null;
  ring.sort((a, c) => a - c);
  const bg = ring[ring.length >> 1];             // 가운뎃값 — 옆 글자가 걸려도 안 흔들린다
  let best = bg, bestD = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = l[y * w + x];
      const d = Math.abs(v - bg);
      if (d > bestD) { bestD = d; best = v; }
    }
  }
  const hi = Math.max(best, bg), lo = Math.min(best, bg);
  return { ratio: (hi + 0.05) / (lo + 0.05), bg, best, px: (x1 - x0) * (y1 - y0) };
}

const VIEWS = [
  ['마이 룸 · 옷',     () => { switchTab('showcase'); setRoomTab('clothes'); }],
  ['마이 룸 · 잡화',   () => { switchTab('showcase'); setRoomTab('stuff'); setStuffTab('potions'); }],
  ['마이 룸 · 음식',   () => { switchTab('showcase'); setRoomTab('stuff'); setStuffTab('foods'); }],
  ['마이 룸 · 크리처', () => { switchTab('showcase'); setRoomTab('creatures'); }],
  ['공방',            () => { switchTab('atelier'); }],
  ['탐험 · 필드',      () => { switchTab('gather'); setGatherTab('field'); }],
  ['탐험 · 마을',      () => { switchTab('gather'); setGatherTab('village'); }],
  ['랭킹',            () => { switchTab('league'); }],
];

// 한 테마를 통째로 훑어 «자리마다 제일 나쁜 대비»를 돌려준다
async function sweep(browser, theme, bad) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page = await ctx.newPage();
  page.on('pageerror', e => bad.push(`«${theme}» [pageerror] ${e.message}`));

  await page.addInitScript((t) => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    localStorage.setItem('dieter_alchemist_theme_v1', t);
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
      { ver: 8, name: 'Emo', nameClaimed: true, tutorialDone: true, crystal: 1240 }));
  }, theme);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });

  // ─── 가진 것을 채운다 ───
  // **아무것도 없는 세이브는 검사망에 구멍을 남긴다** (`checkui` 의 FULL 과 같은 이유다) —
  // 재료·물약·크리처가 없으면 그 칸이 아예 안 그려져 이모지도 같이 사라진다
  const seedErr = await page.evaluate(() => {
    if (typeof devFillItems !== 'function') return '개발용 함수가 없다';
    devFillItems();
    D.RECIPES.filter(r => r.result.kind === 'potion').slice(0, 3)
      .forEach((r, i) => { S.potions[r.result.id] = i + 1; });
    const crs = D.RECIPES.filter(r => r.result.kind === 'creature').slice(0, 2);
    S.creatures = crs.map(r => r.result.id);
    if (typeof bagOpen !== 'undefined' && !bagOpen) toggleBag();
    try { localStorage.setItem('dieter_alchemist_devvillage_v1', '1'); } catch (e) {}
    S.villages = D.villagesShown().map(v => v.id);
    S.keywords = D.KEYWORDS.map(k => k.id);
    S.bond = {}; D.bondNpcs().forEach((npc, i) => { S.bond[npc] = D.BOND_TIERS[i % 5].at; });
    S.aura = Object.assign({}, S.aura, { grit: 200 });
    S.binges = [{ food: 'food_cake', happy: 20, grit: 8, fit: 0.8 }];
    D.FOODS.slice(0, 3).forEach((f, i) => { S.foods[f.id] = i + 1; });
    S.stats.charm = Math.max(S.stats.charm || 0, D.LEAGUE.openAt + 40);
    S.league = 26;
    S.week = { key: weekKey(), score: 480 };
    save(); render();
    return null;
  });
  if (seedErr) { bad.push(`«${theme}» 준비 실패 — ${seedErr}`); await ctx.close(); return null; }
  await page.waitForTimeout(300);

  const seen = new Map();
  let measured = 0, views = 0;
  for (const [label, fn] of VIEWS) {
    const err = await page.evaluate(src => {
      try { (0, eval)('(' + src + ')()'); return null; } catch (e) { return e.message; }
    }, fn.toString());
    if (err) { bad.push(`«${theme}» 의 «${label}» 를 열 수가 없다 — ${err}`); continue; }
    await page.waitForTimeout(260);
    views++;

    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let top = 0; top === 0 || top < total - VH * 0.4; top += VH - 80) {
      await page.evaluate(y => window.scrollTo(0, y), top);
      await page.waitForTimeout(90);
      const spots = await page.evaluate(COLLECT);
      if (!spots.length) continue;
      const grid = pngLumGrid(await page.screenshot());
      if (!grid) { bad.push(`«${theme}» 의 «${label}» 화면을 한 점도 못 읽었다`); break; }
      for (const s of spots) {
        const m = measure(grid, s);
        if (!m) continue;
        measured++;
        const key = s.ch + ' @ ' + s.sel;
        const old = seen.get(key);
        // 같은 이모지가 여러 자리에 나오면 **제일 나쁜 자리**를 남긴다
        if (!old || m.ratio < old.ratio) seen.set(key, { ...m, ch: s.ch, sel: s.sel, label });
      }
    }
  }
  await ctx.close();
  return { seen, measured, views };
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  const bad = [];
  const dark = await sweep(browser, DARK, bad);
  const ref  = await sweep(browser, REF,  bad);
  await browser.close();
  if (!dark || !ref) { bad.forEach(b => console.log('   ' + b)); process.exit(1); }

  const rows = [...dark.seen.values()]
    .map(r => ({ ...r, ref: (ref.seen.get(r.ch + ' @ ' + r.sel) || {}).ratio }))
    .sort((a, b) => a.ratio - b.ratio);

  console.log(`이모지 대비 — «${DARK}» 화면 ${dark.views}곳 · 잰 이모지 ${dark.measured}개`
    + ` (서로 다른 자리 ${rows.length}) · 견줄 테마 «${REF}» ${ref.measured}개`);
  const line = r => `${r.ratio.toFixed(2)}:1 (${REF} ${r.ref ? r.ref.toFixed(2) : '?'})  ${r.ch}  ${r.sel}  [${r.label}]`;
  if (process.env.VERBOSE) rows.forEach(r => console.log('   ' + line(r)));
  else rows.slice(0, 5).forEach(r => console.log('   제일 낮은 쪽 ' + line(r)));

  // **다크가 밝은 테마보다 못한 자리**만 실패다 (머리말의 이유 참고).
  // 견줄 짝을 못 찾은 자리(다크에만 있는 화면)는 절대 기준으로 본다
  const fails = rows.filter(r => r.ratio < MIN && (r.ref == null || r.ratio < r.ref * 0.98));
  // 둘 다 낮은 자리는 **주의**다 — 이번 일과 무관하지만 알고는 있어야 한다
  const note = rows.filter(r => r.ratio < MIN && !fails.includes(r));

  // ⚠️ **0건이 통과가 아니다** — 몇 개를 쟀는지 같이 봐야 「한 번도 안 쟀다」와 갈린다
  if (dark.measured < 60 || ref.measured < 60) {
    bad.push(`잰 이모지가 ${dark.measured} / ${ref.measured} 개뿐이다 (화면을 제대로 못 열었다)`);
  }
  if (rows.some(r => r.ref == null) && rows.filter(r => r.ref != null).length < 40) {
    bad.push('두 테마에서 같이 잰 자리가 너무 적다 (견주기가 성립하지 않는다)');
  }
  fails.forEach(r => bad.push(
    `${r.ch} 가 «${r.label}» 의 ${r.sel} 에서 ${r.ratio.toFixed(2)}:1`
    + ` — «${REF}» 에서는 ${r.ref ? r.ref.toFixed(2) : '?'}:1 이다 (다크가 더 안 보인다)`));

  if (note.length) {
    console.log(`   ※ 두 테마에서 다 낮은 자리 ${note.length}곳 (이번 일과 무관 · 이모지 자체가 배경색을 닮았다)`);
    note.slice(0, 5).forEach(r => console.log(`      ${r.ch} ${r.sel} — ${DARK} ${r.ratio.toFixed(2)} · ${REF} ${r.ref.toFixed(2)}`));
  }
  if (bad.length) {
    console.log('❌ ' + bad.length + '건');
    bad.forEach(b => console.log('   ' + b));
    process.exit(1);
  }
  console.log(`✅ «${DARK}» 가 밝은 테마보다 못한 이모지가 없다`
    + ` (${MIN}:1 아래 ${note.length}곳은 «${REF}» 에서 더 낮다)`);
})();
