// 특수 작물 여섯 종을 **축 표 하나**에서 뽑는다 (FARM.md 4장)
//
// 손으로 늘리지 않는 이유는 크리처 서른 종·옷 150벌과 같다 —
// **한국어와 영어가 같은 줄에서 같이 나오면** 한쪽만 늘어나는 일이 없다.
// 재료 항목(INGREDIENTS)·작물 표(FARM_CROPS)·영어 이름이 여기서 한 번에 나온다.
//
//   node tools/genfarm.js           다시 뽑아 data.js · i18n.js 에 써 넣는다
//   node tools/genfarm.js --check   파일과 어긋났는지만 본다 (npm test 가 부른다)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

// ─── 축 표 ───────────────────────────────────────────────────
//
// **크리처 속성 여섯과 같은 축이다.** 축을 새로 만들면 외울 것이 하나 는다.
//
// 심는 값은 이미 있는 재료 두 가지다 — 씨앗이라는 새 물건을 만들면 재료·음식·먹이에
// 이어 **네 번째 가방**이 생기고, 얻는 길·보관 화면·번역이 한 벌씩 더 필요하다.
//
//   `made` 그 속성 크리처가 만드는 것 (평야·숲). 크리처 생산(8단계)이 밭의 입력이 된다
//   `late` **늦게 열리는 지대**의 재료 (산악·해안·황무지).
//          밭은 여신 단계에 열린다 — 초반 재료만으로 심을 수 있으면 초반 콘텐츠처럼 읽힌다
//          (크리처 생산이 평야·숲만 주는 것과 정확히 반대 방향이고, 이유는 같다)
//
// 시간·개수는 **임시값**이다. 사람이 붙어 봐야 12시간이 맞는지 알 수 있다.
const TABLE = [
  { attr: 'fire',  id: 'ember_chili',      emoji: '🌶️', ko: '불꽃 고추',     en: 'Ember Chili',
    made: 'sun_seed', late: 'flint' },
  { attr: 'earth', id: 'stone_potato',     emoji: '🥔',  ko: '바위 감자',     en: 'Stone Potato',
    made: 'walnut',   late: 'echo_stone' },
  { attr: 'wind',  id: 'whisper_corn',     emoji: '🌽',  ko: '속삭임 옥수수', en: 'Whisper Corn',
    made: 'wheat',    late: 'eagle_feather' },
  { attr: 'water', id: 'tear_lotus',       emoji: '🪷',  ko: '눈물 연꽃',     en: 'Tear Lotus',
    made: 'dew',      late: 'sea_dew' },
  { attr: 'light', id: 'dawn_tomato',      emoji: '🍅',  ko: '새벽 토마토',   en: 'Dawn Tomato',
    made: 'firefly',  late: 'sea_glass' },
  { attr: 'dark',  id: 'shadow_eggplant',  emoji: '🍆',  ko: '그림자 가지',   en: 'Shadow Eggplant',
    made: 'mushroom', late: 'black_feather' },
];

const MADE_N = 3;      // 그 속성 크리처의 생산물을 몇 개 내나
const LATE_N = 2;      // 늦은 지대 재료를 몇 개 내나
const HOURS = 12;      // 자라는 데 걸리는 시간 (임시값)
const YIELD = 3;       // 거두는 개수 (임시값)

// ─── 검사 ─────────────────────────────────────────────────────
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} } };
require(path.join(ROOT, 'data.js'));
const D = global.window.GameData;

const problems = [];
const EARLY = ['plain', 'forest'];
const seen = new Set();
// 크리처 속성이 무엇을 만드는지 — 축이 어긋나지 않았는지 여기서 대조한다
const madeByAttr = {};
for (const r of D.RECIPES) {
  const c = r.result;
  if (c && c.kind === 'creature' && c.makes) madeByAttr[c.attr] = c.makes.id;
}

for (const c of TABLE) {
  if (seen.has(c.id)) problems.push(`id 중복: ${c.id}`);
  seen.add(c.id);
  if (!D.CREATURE_ATTRS.some(a => a.k === c.attr)) problems.push(`${c.id}: 없는 속성 ${c.attr}`);
  // **작물 id 가 기존 재료와 겹치면 안 된다** — 겹치면 원래 재료를 조용히 덮어쓴다
  const cur = D.INGREDIENTS[c.id];
  if (cur && !cur.farm) problems.push(`${c.id}: 이미 있는 재료 id 다`);

  for (const [key, id] of [['made', c.made], ['late', c.late]]) {
    const ing = D.INGREDIENTS[id];
    if (!ing) { problems.push(`${c.id}: 없는 재료 ${id}`); continue; }
    // 히든(0.1%)을 심는 값으로 쓰면 밭이 사실상 안 돌아간다
    if (ing.rare) problems.push(`${c.id}: 히든 재료를 낸다 — ${id}`);
    if (ing.farm) problems.push(`${c.id}: 특수 작물을 심는 값으로 쓴다 — ${id}`);
    if (key === 'late' && EARLY.includes(ing.zone)) {
      problems.push(`${c.id}: 둘째 재료가 초반 지대다 — ${id} (${ing.zone})`);
    }
    if (key === 'made' && !EARLY.includes(ing.zone)) {
      problems.push(`${c.id}: 첫째 재료가 초반 지대가 아니다 — ${id} (${ing.zone})`);
    }
  }
  // **크리처 생산물과 같은 축인가.** 여기가 어긋나면 「불 크리처를 키우면 불 작물이
  // 잘 자란다」는 설명이 통째로 거짓말이 된다
  if (madeByAttr[c.attr] && madeByAttr[c.attr] !== c.made) {
    problems.push(`${c.id}: ${c.attr} 크리처는 ${madeByAttr[c.attr]} 를 만드는데 ${c.made} 를 낸다`);
  }
}
for (const a of D.CREATURE_ATTRS) {
  if (!TABLE.some(c => c.attr === a.k)) problems.push(`속성 ${a.name}: 작물이 없다`);
}
// 심는 값이 통째로 겹치면 무엇을 심든 같은 값이라 고르는 일이 사라진다
{
  const m = new Map();
  for (const c of TABLE) {
    const key = [c.made, c.late].join('+');
    if (m.has(key)) problems.push(`심는 값이 겹친다: ${c.id} 와 ${m.get(key)} — ${key}`);
    m.set(key, c.id);
  }
}

if (problems.length) {
  console.error('❌ 작물 축 표에 문제가 있다\n' + problems.map(p => '   ' + p).join('\n'));
  process.exit(1);
}

// ─── 파일에 써 넣기 ───────────────────────────────────────────
function replaceBlock(file, tag, body) {
  const src = fs.readFileSync(file, 'utf8');
  const head = `// <<<GEN:${tag}`, tail = `// GEN:${tag}>>>`;
  const i = src.indexOf(head), j = src.indexOf(tail);
  if (i < 0 || j < 0) { console.error(`${path.basename(file)} 에 ${head} ~ ${tail} 표시가 없다`); process.exit(2); }
  const before = src.slice(0, src.indexOf('\n', i) + 1);
  const out = before + body + src.slice(j);
  if (out === src) return false;
  if (!CHECK) fs.writeFileSync(file, out);
  return true;
}

// ① INGREDIENTS 안 — **`farm: true` 로 「채집으로는 안 나온다」를 표시한다.**
//    `rare` 로 잘못 표시하면 채집의 히든 확률표(specialTier)가 흔들린다
let ingBody = '';
for (const c of TABLE) {
  ingBody += `  ${c.id}: { id: '${c.id}', emoji: '${c.emoji}', name: '${c.ko}',`
    + ` zone: 'farm', weight: 0, farm: true },\n`;
}

// ② 작물 표
let cropBody = 'const FARM_CROPS = [\n';
for (const c of TABLE) {
  cropBody += `  { id: '${c.id}', attr: '${c.attr}', hours: ${HOURS}, n: ${YIELD},\n`
    + `    cost: { ${c.made}: ${MADE_N}, ${c.late}: ${LATE_N} } },\n`;
}
cropBody += '];\n';

// ③ 영어 이름
let enBody = '';
for (const c of TABLE) enBody += `      ${c.id}: '${c.en}',\n`;

const changed = [
  replaceBlock(path.join(ROOT, 'data.js'), 'farm-ing', ingBody),
  replaceBlock(path.join(ROOT, 'data.js'), 'farm-crops', cropBody),
  replaceBlock(path.join(ROOT, 'i18n.js'), 'farm-en', enBody),
].some(Boolean);

if (CHECK) {
  if (changed) {
    console.error('❌ 작물 표와 파일이 어긋났다 — `node tools/genfarm.js` 를 돌릴 것');
    process.exit(1);
  }
  console.log(`✅ 특수 작물 ${TABLE.length}종이 표와 같다`);
  process.exit(0);
}
console.log(`✅ 특수 작물 ${TABLE.length}종 (속성 ${D.CREATURE_ATTRS.length} × 1)`
  + ` · 자라는 데 ${HOURS}시간 · ${YIELD}개`);
