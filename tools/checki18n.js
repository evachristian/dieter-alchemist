// 번역 빠진 곳 찾기 — 한국어를 고칠 때 영어도 같이 고쳤는지 확인한다.
//
// 왜 필요한가: 한국어만 추가하고 넘어가면 영어 화면에 한글이 그대로 남는다.
// 눈으로는 잘 안 보인다 — 영어로 바꿔 놓고 그 화면까지 들어가 봐야 알기 때문이다.
// 게다가 영어는 대체로 한국어보다 길어서, **번역이 빠진 자리는 폭 검사도 못 받은 자리**다.
// (checkUI 의 '라벨 2배 확대' 는 있는 문자열만 늘린다)
//
// 보는 것 두 가지:
//   1) STRINGS — 언어별 UI 문자열. ko 에 있는 키가 다른 언어에 없으면 빠진 것
//   2) NAMES   — 데이터(재료·맵·솥·레시피·옷·지대) id → 번역. 화면에 나오는 이름인데
//               NAMES 에 없으면 N() 이 한국어를 그대로 돌려준다
//
// 사용: node tools/checki18n.js      (종료 코드 0 = 빠진 것 없음)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// i18n.js 와 data.js 는 브라우저용이라 window 에 붙는다 — 흉내만 내고 읽는다
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} } };
require(path.join(ROOT, 'data.js'));
require(path.join(ROOT, 'i18n.js'));

const D = global.window.GameData;
const I = global.window.I18N;

// i18n.js 안의 STRINGS · NAMES 는 밖으로 안 나온다 — 소스에서 키만 뽑는다
const src = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
function blockKeys(head) {
  // "ko: {" ~ 짝이 맞는 "}" 까지에서 최상위 키만 센다
  const at = src.indexOf(head);
  if (at < 0) return null;
  let i = src.indexOf('{', at), depth = 0, end = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) { end = i; break; } }
  }
  const body = src.slice(src.indexOf('{', at) + 1, end);
  const keys = new Set();
  let d = 0;
  for (let j = 0; j < body.length; j++) {
    const ch = body[j];
    // **문자열 안은 건너뛴다.** 안 그러면 값 속의 "Owned: {n}" 같은 것이 키로 잡혀,
    // 있지도 않은 '한국어에 없는 키' 가 보고된다 (실제로 겪었다)
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      for (j++; j < body.length; j++) {
        if (body[j] === '\\') { j++; continue; }
        if (body[j] === q) break;
      }
      continue;
    }
    if (ch === '{' || ch === '[') d++;
    else if (ch === '}' || ch === ']') d--;
    else if (d === 0 && /[A-Za-z_]/.test(ch)) {
      const m = body.slice(j).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (m) { keys.add(m[1]); j += m[0].length - 1; }
    }
  }
  return keys;
}

const problems = [];

// ── 1. UI 문자열
const koKeys = blockKeys('    ko: {');
const enKeys = blockKeys('    en: {');
if (!koKeys || !enKeys) {
  console.error('i18n.js 의 STRINGS 블록을 못 찾았다 — 이 검사기가 파일 구조를 따라가야 한다');
  process.exit(2);
}
const missingStr = [...koKeys].filter(k => !enKeys.has(k));
const extraStr = [...enKeys].filter(k => !koKeys.has(k));
if (missingStr.length) problems.push(['영어에 없는 UI 문자열', missingStr]);
if (extraStr.length) problems.push(['한국어에 없는 UI 문자열 (영어에만 있음)', extraStr]);

// ── 1-2. **쓰고 있는데 없는 키** — 화면에 키 이름이 그대로 나온다
//
// `T('room_potions')` 처럼 없는 키를 부르면 i18n 이 **키 문자열을 그대로 돌려준다.**
// 오류도 안 나고, 화면에 `room_potions` 라고 적힌 탭이 뜬다 — 실제로 그랬다
// (잡화 탭을 만들며 room_potions 를 지웠는데 레시피 북이 그걸 쓰고 있었다).
//
// 리터럴로 적힌 것만 본다. `T(ex.id + '_d')` 같은 조립형은 안 잡히지만,
// 안 잡히는 쪽으로 틀리는 것이 낫다 — 거짓 경보가 나면 이 검사를 아무도 안 믿는다.
const SRC = ['index.html', 'game.js', 'tutorial.js', 'village.js', 'intro.js', 'portrait.js', 'sfx.js'];
const missingKeys = [];
SRC.forEach(f => {
  const file = path.join(__dirname, '..', f);
  if (!fs.existsSync(file)) return;
  const src = fs.readFileSync(file, 'utf8');
  const seen = new Set();
  // T('key') · T("key") · data-i18n="key"
  // 따옴표 **다음에 바로 `,` 나 `)`** 가 와야 리터럴 한 개다.
  // 이 조건이 없으면 `T('a_' + k)` 의 앞토막까지 키로 잡힌다 (실제로 5건 오탐이 났다)
  const RE = /(?:\bT\(\s*['"]([a-z0-9_]+)['"]\s*[,)]|data-i18n="([a-z0-9_]+)")/g;
  let m;
  while ((m = RE.exec(src))) {
    const key = m[1] || m[2];
    if (seen.has(key)) continue;
    seen.add(key);
    if (!koKeys.has(key)) missingKeys.push(`${f} — ${key}`);
  }
});

if (missingKeys.length) problems.push(['쓰고 있는데 STRINGS 에 없는 키 (화면에 키 이름이 그대로 나온다)', missingKeys]);

// ── 2. 데이터 이름
// 화면에 이름이 나오는 것 전부. N(id, 한국어) 로 부르는 것들이다.
const dataNames = [];
const push = (id, ko, kind) => dataNames.push({ id, ko, kind });
Object.values(D.INGREDIENTS).forEach(x => push(x.id, x.name, '재료'));
D.MAPS.forEach(x => { push(x.id, x.name, '맵'); push(x.id + '_desc', x.desc, '맵 설명'); });
D.ZONES.forEach(x => push(x.id, x.name, '지대'));
// 마을은 아직 잠겨 있어도 이름·설명이 화면에 그대로 나온다
D.VILLAGES.forEach(x => {
  push(x.id, x.name, '마을'); push(x.id + '_desc', x.desc, '마을 설명');
  (x.spots || []).forEach(s => push(s.id, s.name, '마을 건물'));
});
D.CAULDRONS.forEach(x => push(x.id, x.name, '솥'));
D.RECIPES.forEach(r => push(r.result.id, r.result.name, '레시피'));
D.WARDROBE_SLOTS.forEach(x => push(x.slot, x.label, '옷장 칸'));
Object.entries(D.WARDROBE).forEach(([slot, items]) =>
  (items || []).forEach(it => push(it.id, it.name, '옷')));
// 헤어는 벌 이름과 별개로 **축 이름**(뒷머리 6 · 앞머리 5)이 칸에 그대로 나온다
Object.values(D.HAIR_AXES).forEach(list => list.forEach(x => push(x.id, x.name, '헤어 축')));
D.RECIPE_CATS.forEach(c => push(c.id + '_cat', c.label, '레시피 카테고리'));
D.COLORS.forEach(c => push(c.id, c.name, '옷 색'));
D.EXERCISES.forEach(x => push(x.id, x.name, '운동 종목'));
D.FOODS.forEach(x => push(x.id, x.name, '음식'));
// 리그 이름은 '계열 + 단계' 로, NPC 이름은 '앞말 + 뒷말' 로 조합된다 —
// 조합 결과가 아니라 **낱말**에 번역이 있어야 한다
// 인물 이름은 초상화·대화 화면에 그대로 나온다
D.SPEAKERS.forEach(x => push(x.id, x.name, '인물'));
D.LEAGUE_FAMS.forEach(f => push(f.id, f.name, '리그 계열'));
D.NPC_HEAD.concat(D.NPC_TAIL).forEach(w => push(w.id, w.name, 'NPC 이름 낱말'));

// N() 이 한국어를 그대로 돌려주면 번역이 없는 것이다
I.setLang('en');
const missingNames = dataNames.filter(x => x.ko && I.n(x.id, x.ko) === x.ko);
I.setLang('ko');
if (missingNames.length) {
  const by = {};
  missingNames.forEach(x => { (by[x.kind] = by[x.kind] || []).push(`${x.id}(${x.ko})`); });
  Object.entries(by).forEach(([kind, list]) => problems.push([`영어 이름 없음 — ${kind}`, list]));
}

// ── 결과
if (!problems.length) {
  console.log(`✅ 번역 빠진 곳 없음 (UI 문자열 ${koKeys.size}개 · 데이터 이름 ${dataNames.length}개)`);
  process.exit(0);
}
console.log('❌ 번역이 빠진 곳이 있다 — 한국어를 고칠 때 영어도 같이 고쳐야 한다\n');
let total = 0;
for (const [title, list] of problems) {
  total += list.length;
  console.log(`── ${title} (${list.length})`);
  list.forEach(k => console.log('   ' + k));
  console.log('');
}
console.log(`모두 ${total}건`);
process.exit(1);
