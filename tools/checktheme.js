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
  // 반투명 판 위 — 카드에 얹힌 것으로 쳐서 잰다 (`.potion-why` 의 ? 가 여기 산다)
  ['--ink', '--well'], ['--ink-soft', '--well'],
  // 글자 뒤의 테는 그 글자와 «반대쪽» 이어야 한다 (진행도 숫자가 채운 막대 위에 선다)
  ['--halo', '--text-pink'], ['--halo', '--text-lav'], ['--halo', '--text-mint'],
];
const BIG = [['--text-pink', '--pink-2'], ['--text-mint', '--mint-2'], ['--text-lav', '--lav-2']];
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
  if (f.length) { f.forEach(x => bad(`«${t}» ${x}`)); }
  else ok(`«${t}» ${PAIRS.length + BIG.length}짝 통과 (제일 빠듯한 곳 ${minAt} ${min.toFixed(2)}:1)`);
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

    // 고른 칩에 표시가 서는가 · 여섯이 다 떠 있는가
    const chip = await page.evaluate(() => {
      Theme.set('charcoal'); openSettings(); renderSettings();
      const all = [...document.querySelectorAll('#setThemeList .set-sw')];
      return { n: all.length, on: all.filter(b => b.classList.contains('on')).length,
               named: all.filter(b => (b.getAttribute('aria-label') || '').trim()).length,
               onIsCharcoal: all.findIndex(b => b.classList.contains('on')) };
    });
    if (chip.n !== names.length) bad(`설정에 칩이 ${chip.n}개 서 있다 (${names.length}개 기대)`);
    else if (chip.on !== 1) bad(`고른 칩 표시가 ${chip.on}개다 (하나여야 한다)`);
    else if (chip.named !== chip.n) bad(`이름(aria-label)이 없는 칩이 있다 — ${chip.n - chip.named}개`);
    else ok(`칩 ${chip.n}개 · 고른 것 하나에만 표시 · 이름이 다 있다`);
    if (errs.length) bad(`콘솔 오류 — ${errs[0]}`);
    await ctx.close();
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
