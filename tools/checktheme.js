#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  UI 색상(테마) 검사 — npm run test:theme
//
//  세 층을 본다. **앞의 두 층은 브라우저가 없어도 돈다** (`npm test` 가 그것만 돌린다):
//   ① 짜임  — 여섯 블록이 «같은 토큰»을 다 가졌는가 · 없는 토큰을 부르는 데가 없는가 ·
//             컬러칩 색이 진짜 그 테마의 주 강조색인가 · 이름이 두 언어에 다 있는가
//   ② 대비  — 토큰끼리의 짝을 `TEXT_POLICY.md` 의 띠로 잰다 (화면에 아직 안 나온
//             조합까지 미리 걸린다 — `checkTextStyle()` 은 «그려진 것»만 잰다)
//   ③ 화면  — 여섯 테마로 실제로 띄워 주요 탭에서 `checkTextStyle()` 을 돌리고,
//             고르면 바뀌는가 · 새로고침해도 남는가 · 첫 페인트가 번쩍이지 않는가
//
//  ⚠️ ③ 은 «주요 탭»만 본다. 화면 «전부»를 그 테마에서 재려면
//     `FULL=1 THEME=charcoal node tools/checkui.js` 처럼 하나씩 돌린다
//     (여섯 × 전체는 한 판이 너무 길다).
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const themeJs = fs.readFileSync(path.join(ROOT, 'theme.js'), 'utf8');
const i18n = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
// PNG 픽셀 읽기는 `checkui.js` 와 **같은 한 곳**에서 온다 (베끼면 한쪽만 고쳐 갈린다)
const { pngLums } = require('./pnglum');

let fails = 0, notes = [];
const bad = m => { fails++; console.log('  ❌ ' + m); };
const ok = m => console.log('  OK  ' + m);

// ─── 색 셈 (WCAG) ──────────────────────────────────────────────
function rgb(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  m = v.match(/^rgba?\(([^)]+)\)$/i);
  if (m) return m[1].split(',').slice(0, 3).map(x => parseFloat(x));
  return null;
}
function lum(v) {
  const c = rgb(v);
  if (!c) return null;
  const g = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]);
}
function alphaOf(v) {
  const m = String(v).match(/^rgba\(([^)]+)\)$/i);
  if (!m) return 1;
  const p = m[1].split(',');
  return p.length > 3 ? parseFloat(p[3]) : 1;
}
// 반투명 토큰(`--well` · `--glass`…)은 «카드 위에 얹힌 것»으로 봐서 잰다 —
// 그러지 않으면 알파를 무시하고 원색을 재게 되어 멀쩡한 값이 걸리거나 그 반대가 된다
function flat(v, base) {
  const a = alphaOf(v);
  if (a >= 1) return v;
  const f = rgb(v), b = rgb(base);
  if (!f || !b) return v;
  const mix = [0, 1, 2].map(i => Math.round(f[i] * a + b[i] * (1 - a)));
  return 'rgb(' + mix.join(',') + ')';
}
function cr(a, b) {
  const l1 = lum(a), l2 = lum(b);
  if (l1 == null || l2 == null) return null;
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ─── ① 짜임 ────────────────────────────────────────────────────
console.log('── 테마의 짜임');

// 블록을 읽는다. `:root` 가 곧 «에크루» 다 — 기본이라 따로 안 적는다
const blocks = {};
const re = /\/\* <<<THEME:(\w+) \*\/([\s\S]*?)\/\* THEME:\1>>> \*\//g;
let m;
while ((m = re.exec(css))) {
  const kv = {};
  m[2].replace(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g, (_, k, v) => { kv[k] = v.trim(); return ''; });
  blocks[m[1]] = kv;
}
const names = Object.keys(blocks);
if (names.length < 2) bad(`style.css 에서 테마 블록을 ${names.length}개밖에 못 찾았다 («<<<THEME:» 표시를 지웠나)`);
else ok(`테마 블록 ${names.length}개 — ${names.join(' · ')}`);

// theme.js 의 목록과 같은가
const listed = [...themeJs.matchAll(/\{\s*id:\s*'(\w+)',\s*sw:\s*'(#[0-9a-f]{6})'/gi)].map(x => ({ id: x[1], sw: x[2] }));
const DEFAULT = (themeJs.match(/var DEFAULT = '(\w+)'/) || [])[1];
if (listed.length !== names.length || listed.some(t => !blocks[t.id])) {
  bad(`theme.js 의 목록(${listed.map(t => t.id).join(',')})과 style.css 의 블록(${names.join(',')})이 어긋난다`);
} else ok(`theme.js 목록과 style.css 블록이 같다 (${listed.length}개)`);
if (!DEFAULT || !blocks[DEFAULT]) bad(`기본 테마(${DEFAULT})의 블록이 없다`);
else ok(`기본은 «${DEFAULT}» 다`);

// ⚠️⚠️ 한 줄이라도 빠지면 그 자리에 앞 테마 값이 남는다 — 챠콜에서 그것은
// «밝은 판 위의 밝은 글자» 라 화면에 오류 하나 없이 안 읽히게 된다
const base = blocks[DEFAULT] || {};
const baseKeys = Object.keys(base).sort();
let miss = 0;
for (const [k, kv] of Object.entries(blocks)) {
  if (k === DEFAULT) continue;
  const lack = baseKeys.filter(t => !(t in kv));
  const extra = Object.keys(kv).filter(t => !(t in base));
  if (lack.length || extra.length) {
    miss++;
    bad(`«${k}» 가 토큰이 안 맞는다 — 빠짐 [${lack.join(' ')}] 더 있음 [${extra.join(' ')}]`);
  }
}
if (!miss) ok(`여섯이 같은 토큰 ${baseKeys.length}개를 «다» 가졌다`);

// 없는 토큰을 부르는 데가 없는가 (CSS 는 그런 선언을 «통째로» 버린다 — TEXT_POLICY 1장)
{
  // ⚠️ **주석을 먼저 걷어 낸다.** 이 저장소의 CSS 는 주석에 토큰 이름을 잔뜩 적어 두는데,
  // 그대로 훑으면 「예전에 이런 사고가 있었다」고 «적어 놓은» 이름까지 잡는다
  // (실제로 `--pink-1` 사고를 기록해 두자마자 그 줄이 스스로 걸렸다)
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const used = new Set([...bare.matchAll(/var\((--[a-z0-9-]+)/g)].map(x => x[1]));
  const declared = new Set([...bare.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(x => x[1]));
  // JS 가 인라인으로 심는 것들 — 목록을 손으로 적지 않는다 (적으면 사본이 생긴다)
  for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.js'))) {
    const j = fs.readFileSync(path.join(ROOT, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
    [...j.matchAll(/setProperty\('(--[a-z0-9-]+)'/g)].forEach(x => declared.add(x[1]));
    [...j.matchAll(/(--[a-z0-9-]+)\s*:\s*\$\{/g)].forEach(x => declared.add(x[1]));
  }
  const dead = [...used].filter(t => !declared.has(t)).sort();
  if (dead.length) bad(`선언 안 된 토큰을 부른다 — ${dead.join(' ')} (그 선언은 통째로 버려진다)`);
  else ok(`부르는 토큰 ${used.size}개가 다 선언돼 있다`);
}

// 컬러칩이 «그 테마의 색» 인가 — 다르면 고르기 «전»에는 무엇이 될지 알 수가 없다
{
  let wrong = 0;
  listed.forEach(t => {
    const want = (blocks[t.id] || {})['--pink-2'];
    if (!want) return;
    if (want.toLowerCase() !== t.sw.toLowerCase()) {
      wrong++;
      bad(`«${t.id}» 칩이 ${t.sw} 인데 그 테마의 주 강조는 ${want} 다`);
    }
  });
  if (!wrong) ok(`컬러칩 ${listed.length}개가 다 그 테마의 주 강조색이다`);
}

// 이름이 두 언어에 다 있는가 (칩에는 글자가 없어 `aria-label` 이 이름을 진다)
{
  let lack = [];
  listed.forEach(t => {
    const n = (i18n.match(new RegExp(`theme_${t.id}:`, 'g')) || []).length;
    if (n < 2) lack.push(`${t.id}(${n}개)`);
  });
  if (lack.length) bad(`테마 이름이 두 언어에 다 없다 — ${lack.join(' · ')}`);
  else ok(`테마 이름이 두 언어에 다 있다 (${listed.length} × 2)`);
}

// ─── ② 토큰끼리의 대비 ─────────────────────────────────────────
console.log('\n── 토큰끼리의 대비 (TEXT_POLICY.md 의 띠)');
// 일반 글자 4.5 · 파스텔-2 위의 강조는 «큰 글씨만» 이라 3.0 (그 표 그대로다)
const PAIRS = [
  ['--ink', '--card'], ['--ink', '--cream'], ['--ink', '--tint'],
  ['--ink', '--pink'], ['--ink', '--pink-2'], ['--ink', '--mint'], ['--ink', '--mint-2'],
  ['--ink', '--lav'], ['--ink', '--lav-2'],
  ['--ink-soft', '--card'], ['--ink-soft', '--cream'], ['--ink-soft', '--tint'],
  ['--ink-soft', '--pink'], ['--ink-soft', '--mint'], ['--ink-soft', '--lav'],
  ['--text-pink', '--card'], ['--text-pink', '--cream'], ['--text-pink', '--pink'], ['--text-pink', '--tint'],
  ['--text-mint', '--card'], ['--text-mint', '--cream'], ['--text-mint', '--mint'],
  ['--text-lav', '--card'], ['--text-lav', '--cream'], ['--text-lav', '--lav'],
  ['--text-warn', '--card'], ['--text-warn', '--cream'],
  ['--text-blue', '--blue'], ['--text-red', '--red'],
  ['--on-accent', '--text-pink'], ['--on-accent', '--text-red'],
  ['--toast-ink', '--toast-bg'],
  // 그라데이션 버튼의 두 끝은 **아래 `BTN` 이 따로 본다** — 테(`--btn-halo`)가 있느냐로
  // 잣대가 갈려서, 한 표에 같이 두면 둘 중 한 갈래가 반드시 틀린 값으로 재진다
  // 반투명 판 위 — 카드에 얹힌 것으로 쳐서 잰다 (`.potion-why` 의 ? 가 여기 산다)
  ['--ink', '--well'], ['--ink-soft', '--well'],
  // 글자 뒤의 테는 그 글자와 «반대쪽» 이어야 한다 (진행도 숫자가 채운 막대 위에 선다)
  ['--halo', '--text-pink'], ['--halo', '--text-lav'], ['--halo', '--text-mint'],
  // 페이지 바닥 그라데이션 — 로고 화면의 「Dream Syndicate Studio」가 여기 선다
  // (카드가 없는 자리라 글자가 **바탕 위에 바로** 얹힌다 · 세 스톱을 다 본다)
  ['--ink', '--bg-1'], ['--ink', '--bg-2'], ['--ink', '--bg-3'],
];
const BIG = [['--text-pink', '--pink-2'], ['--text-mint', '--mint-2'], ['--text-lav', '--lav-2']];
// ⚠️⚠️ **잠긴 콘텐츠는 `opacity: 0.8` 로 «흐려진 채» 읽혀야 한다** (style.css 의 잠긴
// 콘텐츠 공통 표현). 원색으로만 재면 그 8할이 안 보이는데, 실제로 퍼플의 비법서
// 「어디서 나는가」 줄이 **4.49:1** 로 내려앉아 있었다 (여섯 중 퍼플만 걸렸다 —
// 원색끼리는 7.21 이라 표가 한 번도 못 봤다). 합성해서 크림·카드 위에서 잰다
const LOCK_A = 0.8;
// ⚠️ **`--ink` «하나만» 본다.** 잠긴 콘텐츠 공통 표현이 「잠긴 요소의 글자는 `--ink` 로
// 진하게 잡는다」고 정해 두었으므로, 거기 서도 되는 색은 그것뿐이다.
// 강조색(`--text-*`)과 `--ink-soft` 는 0.8 로 흐려지면 3.8~4.4 로 떨어진다 —
// 목록에 넣는 대신 **그 색을 잠긴 자리에 두지 않는 것**이 답이다 (`.pg-where` 가 그랬다).
// ⚠️ 표에 «안 쓰는 조합»까지 넣으면 아무도 못 보는 자리 때문에 값을 옮기게 된다 —
// 표는 「실제로 서는 것」만 담아야 잣대가 된다 (넓게 잡았다가 일곱 건을 헛짚었다)
const LOCKED = [['--ink', '--cream'], ['--ink', '--card']];
// ⚠️⚠️ **그라데이션 버튼의 두 끝은 «끝마다» 따로 본다** —
// 「**글자**가 제 힘으로 서거나, **테**가 그 끝에서 4.5:1 이거나」. 밝은 버튼 위의 밝은
// 글자를 읽게 해 주는 것이 테이므로, 테가 안 읽히면 글자도 안 읽힌다.
// 거기에 «글자 ↔ 테»도 같이 본다 (제 테와 붙어 버리면 두른 뜻이 없다).
// ⚠️ **테마 단위로 뭉뚱그리면 안 된다.** 챠콜은 «밝은 끝»에서만 테가 일하고 어두운
// 끝에서는 글자가 제 힘으로 선다 — 「테를 켰으면 두 끝 다 테로 잰다」로 짰다가
// 멀쩡한 어두운 끝을 2.88 로 헛짚었다.
// ⚠️ **면제가 아니다.** 그림자는 `checkTextStyle()` 이 대비로 안 쳐 주므로, 테를 두른
// 자리는 ③의 「버튼글자」가 **진짜 픽셀을 떠서** 한 번 더 잰다. 여기만 두면
// 「테를 선언해 놓고 안 그리는」 사보타주가 그대로 통과한다
// ⚠️ **두 갈래를 각각 몇 번 쟀는지 낸다** — 한쪽이 0이면 그 방향은 아예 안 잰 것이다
const BTN = ['--btn-grad-a', '--btn-grad-b'];
let btnBare = 0, btnEdged = 0;
for (const t of names) {
  const kv = blocks[t];
  const f = [];
  let min = 99, minAt = '';
  const look = (a, b, need) => {
    const v = cr(flat(kv[a], kv['--card']), flat(kv[b], kv['--card']));
    if (v == null) { f.push(`${a}/${b} 를 못 읽었다`); return; }
    if (need === 4.5 && v < min) { min = v; minAt = `${a} on ${b}`; }
    if (v < need) f.push(`${a}(${kv[a]}) on ${b}(${kv[b]}) = ${v.toFixed(2)} — ${need} 필요`);
  };
  PAIRS.forEach(([a, b]) => look(a, b, 4.5));
  BIG.forEach(([a, b]) => look(a, b, 3));
  {
    const halo = (kv['--btn-halo'] || '').trim();
    const edged = halo && halo !== 'transparent' && halo !== 'none';
    if (!halo) f.push('--btn-halo 이 없다 (테를 안 두를 거면 transparent 라고 적는다)');
    else if (edged) {
      // 글자가 제 테와 붙으면 두른 뜻이 없다
      const iv = cr(flat(kv['--ink'], kv['--card']), flat(halo, kv['--card']));
      if (iv == null) f.push('--ink/--btn-halo 를 못 읽었다');
      else if (iv < 4.5) f.push(`--ink(${kv['--ink']}) 와 테(${halo})가 ${iv.toFixed(2)} 로 붙어 있다 — 4.5 필요`);
    }
    BTN.forEach(stop => {
      const bg = kv[stop];
      if (bg == null) { f.push(`${stop} 를 못 읽었다`); return; }
      const on = flat(bg, kv['--card']);
      const iv = cr(flat(kv['--ink'], kv['--card']), on);
      const hv = edged ? cr(flat(halo, kv['--card']), on) : null;
      if (iv == null || (edged && hv == null)) { f.push(`${stop} 위의 대비를 못 읽었다`); return; }
      const best = Math.max(iv, hv == null ? 0 : hv);
      const by = (hv != null && hv > iv) ? '테' : '글자';
      if (by === '테') btnEdged++; else btnBare++;
      if (best < min) { min = best; minAt = `${by} on ${stop}`; }
      if (best < 4.5) {
        f.push(`${stop}(${bg}) 위에서 글자 ${iv.toFixed(2)}`
          + (hv == null ? '' : ` · 테(${halo}) ${hv.toFixed(2)}`)
          + ' — 둘 중 하나는 4.5 여야 한다 (--btn-halo 로 테를 두를 수 있다)');
      }
    });
  }
  LOCKED.forEach(([a, b]) => {
    const fg = flat(kv[a], kv[b]), bg = kv[b];
    const c = rgb(fg), base = rgb(bg);
    if (!c || !base) { f.push(`${a}/${b} 를 못 읽었다`); return; }
    const mix = 'rgb(' + [0, 1, 2].map(i => Math.round(c[i] * LOCK_A + base[i] * (1 - LOCK_A))).join(',') + ')';
    const v = cr(mix, bg);
    if (v < min) { min = v; minAt = `${a} on ${b} (잠김)`; }
    if (v < 4.5) f.push(`${a} on ${b} 이 «잠긴 채»(opacity ${LOCK_A}) ${v.toFixed(2)} — 4.5 필요`);
  });
  if (f.length) { f.forEach(x => bad(`«${t}» ${x}`)); }
  else ok(`«${t}» ${PAIRS.length + BIG.length + LOCKED.length + BTN.length}짝 통과 (제일 빠듯한 곳 ${minAt} ${min.toFixed(2)}:1)`);
}
// ⚠️ **0건이 통과가 아니다** — 두 갈래를 몇 번씩 쟀는지 같이 내야 「한 끝도 안 쟀다」와 갈린다
if (btnBare + btnEdged !== names.length * BTN.length) {
  bad(`버튼 그라데이션의 끝을 ${btnBare + btnEdged}곳만 쟀다 (${names.length * BTN.length}곳이어야 한다)`);
} else {
  ok(`버튼 그라데이션 — 글자가 제 힘으로 선 끝 ${btnBare} · 테가 받친 끝 ${btnEdged} (다 4.5:1 위)`);
}

// ─── ③ 화면 ────────────────────────────────────────────────────
// ⚠️ playwright 는 **지연 require** 다 — `npm test` 가 브라우저 없이도 ①②를 돌게
//    (`checkname` 에서 배운 자리다)
async function onScreen() {
  // ⚠️ `npm test` 는 **브라우저 없이** 도는 자리다 — 거기서는 `--static` 으로 ①②만 본다.
  // 화면 층은 `npm run test:theme` 이 돌린다 (한 판에 여섯 번 띄워서 느리다)
  if (process.argv.includes('--static')) {
    console.log('\n── 화면: --static 이라 건너뛴다 (`npm run test:theme` 이 본다)');
    return;
  }
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    console.log('\n── 화면: playwright 가 없어 건너뛴다 (①②만 본 것이다)');
    return;
  }
  console.log('\n── 화면 (테마를 갈아 끼우며)');
  const opts = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const browser = await chromium.launch(opts);
  const BASE = 'file://' + ROOT + '/index.html';
  const SAVE = { ver: 8, name: 'Tester', nameClaimed: true, tutorialDone: true, crystal: 1240 };
  const TABS = ['showcase', 'atelier', 'gather'];

  async function open(theme, w) {
    const ctx = await browser.newContext({ viewport: { width: w || 390, height: 880 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript((t) => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(t.save));
      if (t.theme) localStorage.setItem('dieter_alchemist_theme_v1', t.theme);
      else localStorage.removeItem('dieter_alchemist_theme_v1');
    }, { save: SAVE, theme });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(2300);
    await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.classList.add('done'); });
    await page.waitForTimeout(150);
    return { ctx, page, errs };
  }

  // ⓐ 여섯 테마 × 주요 탭에서 대비를 잰다
  for (const t of names) {
    const { ctx, page, errs } = await open(t);
    let total = 0, measured = 0, blocked = false, first = null;
    for (const tab of TABS) {
      await page.evaluate(tb => switchTab(tb), tab);
      await page.waitForTimeout(220);
      const r = await page.evaluate(() => {
        const res = checkTextStyle();
        const row = (res.rows || [])[0];
        return { count: res.count, checked: res.checked, pass: res.pass,
                 // **무엇이 걸렸는지까지 낸다** — 숫자만 내면 원인을 찾느라 브라우저를
                 // 따로 띄우게 된다 (checkui 의 VERBOSE 에서 배운 자리다)
                 first: row ? `${row.선택자} «${String(row.텍스트).slice(0, 14)}» `
                            + `${row.글자색} on ${row.배경색} = ${row.대비}` : null };
      });
      total += r.count || 0;
      measured += r.checked || 0;
      if (!first && r.first) first = `${tab} · ${r.first}`;
      if (r.pass === false && !r.count) blocked = true;   // 「잴 수가 없다」와 「위반이 있다」를 가른다
    }
    if (errs.length) bad(`«${t}» 콘솔 오류 — ${errs[0]}`);
    // ⚠️ **0건이 통과가 아니다** — 몇 개를 쟀는지 같이 봐야 「한 번도 안 쟀다」와 갈린다
    if (blocked || measured < 50) bad(`«${t}» 를 제대로 못 쟀다 (잰 요소 ${measured}개)`);
    else if (total) bad(`«${t}» 에서 대비 위반 ${total}건 (탭 ${TABS.length}곳 · 잰 요소 ${measured}개)\n      첫 건: ${first}`);
    else ok(`«${t}» 탭 ${TABS.length}곳 대비 0건 (잰 요소 ${measured}개)`);

    // ⓔ **버튼 글자 — 진짜 픽셀로 잰다.**
    //
    // ⚠️⚠️ `checkTextStyle()` 은 이 자리를 영영 못 본다. 이유가 둘이다 —
    // ① 배경이 **그라데이션**이라 조상에서 색을 찾는 방식으로는 근사밖에 못 하고
    // ② **그림자는 대비로 안 쳐 준다** (바람개비 HUD·퀘스트 숫자에서 두 번 배운 자리다).
    // 그래서 챠콜처럼 «밝은 버튼 + 테 두른 글자» 로 가면 ②의 토큰 검사만으로는
    // 「테를 선언해 놓고 안 그리는」 사보타주가 그대로 통과한다.
    //
    // ⚠️ **재는 상자를 글자에 «붙인다»** — 버튼 상자를 통째로 찍으면 상자 안에서 제일
    // 밝은 점이 모서리 «밖»의 카드 배경이라, 테를 통째로 떼도 통과한다 (퀘스트 숫자에서
    // 사보타주가 검사기의 구멍을 찾아낸 자리다). `Range` 로 **글자줄**만 집는다.
    // ⚠️ 앞의 이모지(📢)는 뺀다 — 제 색이 있어서 그것만으로 대비가 부풀어 오른다
    {
      await page.evaluate(() => switchTab('showcase'));
      await page.waitForTimeout(200);
      const box = await page.evaluate(() => {
        const b = document.querySelector('.btn-flex');
        if (!b) return { err: '버튼(.btn-flex)을 못 찾았다' };
        b.scrollIntoView({ block: 'center' });
        const node = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
        if (!node) return { err: '버튼에 글자 노드가 없다' };
        const s = node.textContent;
        // 이모지·변형자·공백을 앞에서 걷어 낸다 (남는 것이 «글자»다)
        let i = 0;
        while (i < s.length && !/\p{L}|\p{N}/u.test(s[i])) i++;
        if (i >= s.length) return { err: '버튼 글자에 이모지밖에 없다' };
        const r = document.createRange();
        r.setStart(node, i); r.setEnd(node, s.length);
        const q = r.getBoundingClientRect();
        const cs = getComputedStyle(b);
        return { x: q.left, y: q.top, w: q.width, h: q.height,
                 text: s.slice(i).trim(), shadow: cs.textShadow };
      });
      if (box.err) bad(`«${t}» 버튼글자 — ${box.err}`);
      else if (box.w < 8 || box.h < 6) {
        bad(`«${t}» 버튼글자 — 글자 상자가 ${box.w.toFixed(0)}×${box.h.toFixed(0)}px 라 아무것도 안 쟀다`);
      } else {
        const shot = await page.screenshot({ clip: {
          x: Math.floor(box.x), y: Math.floor(box.y),
          width: Math.max(1, Math.ceil(box.w)), height: Math.max(1, Math.ceil(box.h)) } });
        const lums = pngLums(shot);
        if (!lums.length) bad(`«${t}» 버튼글자 — 픽셀을 한 점도 못 읽었다`);
        else {
          const lo = Math.min(...lums), hi = Math.max(...lums);
          const v = (hi + 0.05) / (lo + 0.05);
          if (v < 4.5) {
            bad(`«${t}» 버튼글자 — 「${box.text}」가 그라데이션 위에서 ${v.toFixed(2)}:1 이다`
              + ` (4.5:1 이상 · 테가 필요하면 --btn-halo 를 켠다 · 지금 그림자 ${box.shadow})`);
          } else {
            ok(`«${t}» 버튼글자 「${box.text}」 ${v.toFixed(2)}:1`
              + ` (밝은 ${hi.toFixed(2)} · 어두운 ${lo.toFixed(2)} · ${lums.length}점)`);
          }
        }
      }
    }
    await ctx.close();
  }

  // ⓑ 고르면 진짜 바뀌는가 — 여섯이 «서로 다른» 색이어야 한다.
  // ⚠️ 이것이 없으면 선택자가 한 글자 틀려 블록이 한 번도 안 걸려도 그대로 통과한다
  {
    const { ctx, page, errs } = await open('');
    const seen = {};
    for (const t of names) {
      const got = await page.evaluate((id) => {
        Theme.set(id);
        const cs = getComputedStyle(document.documentElement);
        return { attr: document.documentElement.getAttribute('data-theme'),
                 bg: cs.getPropertyValue('--bg-1').trim(),
                 accent: cs.getPropertyValue('--pink-2').trim(),
                 ink: cs.getPropertyValue('--ink').trim() };
      }, t);
      if (got.attr !== t) bad(`«${t}» 를 골랐는데 data-theme 가 «${got.attr}» 다`);
      seen[t] = got.accent + '/' + got.bg;
    }
    const uniq = new Set(Object.values(seen));
    if (uniq.size !== names.length) bad(`여섯 중 색이 겹치는 테마가 있다 — ${JSON.stringify(seen)}`);
    else ok(`여섯이 다 다른 색으로 그려진다`);

    // 고른 칩에 표시가 서는가 · 여섯이 다 떠 있는가 · **줄이 가운데 서는가**
    const chip = await page.evaluate(() => {
      Theme.set('charcoal'); openSettings(); renderSettings();
      const box = document.getElementById('setThemeList');
      const all = [...box.querySelectorAll('.set-sw')];
      // ⚠️ 칩마다 `max-width` 가 있어서 여섯을 다 채우고도 자리가 남는다 —
      // 그 남는 몫이 한쪽으로 몰리는지를 **양 끝 여백으로** 잰다 (「쏠려 보인다」로 신고받았다)
      const r = box.getBoundingClientRect();
      const first = all[0] && all[0].getBoundingClientRect();
      const last = all[all.length - 1] && all[all.length - 1].getBoundingClientRect();
      return { n: all.length, on: all.filter(b => b.classList.contains('on')).length,
               named: all.filter(b => (b.getAttribute('aria-label') || '').trim()).length,
               w: r.width,
               left: first ? first.left - r.left : null,
               right: last ? r.right - last.right : null };
    });
    if (chip.n !== names.length) bad(`설정에 칩이 ${chip.n}개 서 있다 (${names.length}개 기대)`);
    else if (chip.on !== 1) bad(`고른 칩 표시가 ${chip.on}개다 (하나여야 한다)`);
    else if (chip.named !== chip.n) bad(`이름(aria-label)이 없는 칩이 있다 — ${chip.n - chip.named}개`);
    else ok(`칩 ${chip.n}개 · 고른 것 하나에만 표시 · 이름이 다 있다`);
    // ⚠️ **못 잰 것을 «통과»로 흘리지 않는다** — 시트가 안 떠 있으면 폭이 0 이라
    // 아래의 「여백이 같은가」가 0 ↔ 0 으로 늘 참이 된다 (퀘스트 완료 버튼에서 배운 자리다)
    if (!(chip.w > 0) || chip.left == null) bad(`컬러칩 줄을 못 쟀다 (폭 ${chip.w}px) — 가운데 정렬을 한 번도 안 본 것이다`);
    else if (Math.abs(chip.left - chip.right) > 1) {
      bad(`컬러칩 줄이 한쪽으로 쏠렸다 — 왼쪽 ${chip.left.toFixed(0)}px · 오른쪽 ${chip.right.toFixed(0)}px`);
    } else ok(`컬러칩 줄이 가운데 선다 (양 끝 ${chip.left.toFixed(0)}px · 줄 폭 ${chip.w.toFixed(0)}px)`);
    if (errs.length) bad(`콘솔 오류 — ${errs[0]}`);
    await ctx.close();
  }

  // ⓓ **로고 화면도 테마를 «탄다»** — `logo.png` 가 투명 배경이 되면서 풀린 자리다.
  //
  // 예전에는 정반대였다: 불투명한 로고를 테마 바탕에 얹으면 **사각형으로 깨져 보여서**
  // 여기만 고정 near-white 였고, 이 검사도 「여섯이 다 같은 색인가」를 봤다.
  // 지금 볼 것은 셋이다 — ① 여섯이 «서로 다른가» ② 그 색이 정말 그 테마의 것인가
  // ③ **로고 자리에 사각형이 안 보이는가**(진짜 픽셀).
  //
  // ⚠️ ③ 이 없으면 **불투명 로고로 되돌려 놓아도 ①②는 그대로 통과한다** —
  //    바탕은 테마를 타는데 그 위에 흰 상자가 얹혀 있는 화면이 0건으로 나온다
  //    (`npm test` 의 `genlogo --check` 와 짝이다: 그쪽은 파일을, 이쪽은 화면을 본다)
  {
    // ⚠️ **스플래시는 0.9초 뒤 걷히기 시작해 2.5초에 DOM 에서 «완전히 제거»된다** —
    // 다른 검사처럼 기다렸다 재면 늘 「못 찾았다」가 나온다. 여기만 **뜨자마자** 잰다
    const seen = new Map();
    let boxBad = 0, boxSeen = 0;
    for (const t of names) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 880 } });
      const page = await ctx.newPage();
      await page.addInitScript((th) => {
        localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
        if (th) localStorage.setItem('dieter_alchemist_theme_v1', th);
      }, t);
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      // 그림이 실제로 그려진 뒤에 재야 «상자»를 볼 수 있다 (걷히기 전에 끝난다)
      await page.waitForFunction(() => {
        const i = document.getElementById('splashLogoImg');
        return !i || (i.complete && i.naturalWidth > 0);
      }, null, { timeout: 4000 }).catch(() => {});
      const got = await page.evaluate(() => {
        const el = document.getElementById('splash');
        if (!el) return null;
        const cs = getComputedStyle(el);
        const nm = document.querySelector('#splash .splash-name');
        const img = document.getElementById('splashLogoImg');
        const r = img ? img.getBoundingClientRect() : null;
        return {
          bg: cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : cs.backgroundColor,
          ink: nm ? getComputedStyle(nm).color : '(없음)',
          box: r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
          opacity: cs.opacity,
        };
      });
      if (!got) { bad('로고 화면(#splash)을 못 찾았다'); await ctx.close(); break; }
      // ⚠️ **바탕만으로 센다.** 글자색까지 묶어 열쇠를 만들면 「바탕은 못 박고 글자만
      // 테마를 타는」 판에서 여섯이 «다른» 것이 되어 「다 같다」 갈래가 영영 안 돈다
      // (사보타주 B 에서 실제로 그랬다 — 잡히기는 했지만 다른 줄이 잡았다)
      seen.set(t, { bg: got.bg, ink: got.ink });

      // ③ 로고 자리의 **네 귀퉁이**가 바탕과 같은가 — 흰 상자면 여기서 갈린다.
      // ⚠️ 바탕은 그라데이션이라 «바로 옆»과 견준다 (상자 바깥 8px 지점)
      if (!got.box) { boxBad++; bad(`«${t}» 로고 그림을 못 찾았다 (상자가 0이다)`); }
      else if (got.opacity !== '1') { boxBad++; bad(`«${t}» 스플래시가 벌써 걷히고 있다 (opacity ${got.opacity})`); }
      else {
        const b = got.box, P = 6;
        const shot = await page.screenshot({ clip: {
          x: Math.floor(b.x - 10), y: Math.floor(b.y - 10),
          width: Math.ceil(b.w + 20), height: Math.ceil(b.h + 20) } });
        const L = pngLums(shot);
        const W = Math.ceil(b.w + 20);
        const px = (x, y) => L[y * W + x];
        // 안쪽 귀퉁이(로고 그림 안) ↔ 바깥(그림 밖) — 둘이 같아야 «상자»가 없는 것이다
        const pairs = [[10 + P, 10 + P, 2, 2], [W - 11 - P, 10 + P, W - 3, 2]];
        let worst = 0, at = '';
        for (const [ix, iy, ox, oy] of pairs) {
          const a = px(ix, iy), c = px(ox, oy);
          if (a == null || c == null) continue;
          const v = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05);
          if (v > worst) { worst = v; at = `${a.toFixed(3)} ↔ ${c.toFixed(3)}`; }
        }
        if (!L.length) { boxBad++; bad(`«${t}» 로고 자리의 픽셀을 한 점도 못 읽었다`); }
        else if (worst > 1.12) {
          boxBad++;
          bad(`«${t}» 로고 귀퉁이가 바탕과 다르다 (${worst.toFixed(2)}배 · ${at})`
            + ' — 불투명 로고의 «사각형»이 드러난 것이다');
        } else boxSeen++;
      }
      await ctx.close();
    }
    const uniq = new Set([...seen.values()].map(v => v.bg));
    if (uniq.size === 1 && names.length > 1) {
      bad(`로고 화면 바탕이 여섯에서 다 같다 (${[...uniq][0]}) — 테마를 안 타고 있다`);
    } else if (uniq.size) {
      // 그 색이 «정말 그 테마의 것»인가 — 여섯이 다르기만 하면 아무 색이나 통과한다.
      // ⚠️ 글자로 견주지 않는다: 토큰은 `#dcefff` 인데 화면이 내놓는 것은
      // `rgb(220, 239, 255)` 라 **무슨 색이든 «없다»로 걸린다** (그렇게 짰다가 6건 났다)
      let wrong = 0;
      for (const [t, v] of seen) {
        const want = rgb((blocks[t] || {})['--bg-1'] || '');
        const got = (v.bg.match(/rgba?\([^)]+\)/g) || []).map(rgb).filter(Boolean);
        const hit = want && got.some(c => c.every((n, i) => Math.abs(n - want[i]) <= 1));
        if (!hit) { wrong++; bad(`«${t}» 로고 화면 바탕에 그 테마의 --bg-1(${(blocks[t] || {})['--bg-1']})이 없다 — ${v.bg}`); }
      }
      // ⚠️ **귀퉁이를 «몇 개나» 쟀는지 같이 낸다** — 상자 검사가 하나도 안 돌았는데
      // 「상자 없음」이라고 적으면 그 줄이 거짓말이 된다 (실제로 한 번 그렇게 적혀 있었다)
      if (!wrong && !boxBad) ok(`로고 화면이 여섯에서 «다 다르고» 제 테마 색이다 (귀퉁이 ${boxSeen}/${names.length}곳에 상자 없음)`);
      else if (!wrong) bad(`바탕은 테마를 타는데 로고 귀퉁이가 ${boxBad}곳에서 어긋난다`);
    }
  }

  // ⓒ 새로고침해도 남는가 + **첫 페인트부터** 그 테마인가
  // ⚠️ theme.js 가 문서 끝으로 밀리면 기본 색으로 한 번 그려진 뒤 얹혀 «번쩍인다».
  //    눈으로는 못 보므로 「CSS 가 오기 전에 이미 속성이 붙어 있었나」로 잰다
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 880 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_theme_v1', 'charcoal');
      // <body> 가 «붙는 순간»의 data-theme 를 적어 둔다.
      // ⚠️ 이 시점에는 `documentElement` 가 아직 없을 수 있어 **`document` 를** 본다
      window.__early = null;
      new MutationObserver((ms, o) => {
        if (window.__early === null && document.body && document.documentElement) {
          window.__early = document.documentElement.getAttribute('data-theme') || '(없음)';
          o.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({
      early: window.__early,
      now: document.documentElement.getAttribute('data-theme'),
      saved: localStorage.getItem('dieter_alchemist_theme_v1'),
      meta: (document.querySelector('meta[name="theme-color"]') || {}).content,
      bg1: getComputedStyle(document.documentElement).getPropertyValue('--bg-1').trim(),
    }));
    if (r.now !== 'charcoal' || r.saved !== 'charcoal') bad(`새로고침 뒤에 테마가 «${r.now}»(저장 ${r.saved}) 다`);
    else ok(`새로고침해도 고른 테마가 남는다`);
    if (r.early !== 'charcoal') bad(`첫 페인트에 테마가 «${r.early}» 였다 — theme.js 가 늦게 읽히면 화면이 번쩍인다`);
    else ok(`첫 <body> 가 붙기 전에 이미 테마가 서 있다 (번쩍임 없음)`);
    if ((r.meta || '').toLowerCase() !== r.bg1.toLowerCase()) bad(`주소창 색이 ${r.meta} 인데 배경은 ${r.bg1} 다`);
    else ok(`주소창 색(${r.meta})도 테마를 따라간다`);
    await ctx.close();
  }

  await browser.close();
}

onScreen().then(() => {
  console.log(fails ? `\n❌ UI 색상 검사 ${fails}건 걸렸다` : '\n UI 색상 검사 전부 통과 ✅');
  process.exit(fails ? 1 : 0);
}).catch(e => { console.error('\n하네스가 터졌다:', e); process.exit(2); });
