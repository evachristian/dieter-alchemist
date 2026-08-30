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
// `pot` 은 그 작물로 빚는 **밭 물약**이다 (4장). 작물과 같은 줄에 두는 이유는
// 「이 작물이 무엇이 되는가」가 한눈에 보여야 하기 때문이다 — 표가 둘이면 어긋난다.
const TABLE = [
  { attr: 'fire',  id: 'ember_chili',      emoji: '🌶️', ko: '불꽃 고추',     en: 'Ember Chili',
    made: 'sun_seed', late: 'flint',
    pot: { id: 'hf_fire', emoji: '🌋', ko: '용암의 숨', en: 'Breath of Lava',
      with: ['flint', 'dry_root', 'salt_crust', 'sand_grain', 'lizard_scale'] } },
  { attr: 'earth', id: 'stone_potato',     emoji: '🥔',  ko: '바위 감자',     en: 'Stone Potato',
    made: 'walnut',   late: 'echo_stone',
    pot: { id: 'hf_earth', emoji: '🗿', ko: '대지의 맹세', en: 'Oath of Earth',
      with: ['echo_stone', 'iron_ore', 'cave_moss', 'pine_cone', 'bone_frag'] } },
  { attr: 'wind',  id: 'whisper_corn',     emoji: '🌽',  ko: '속삭임 옥수수', en: 'Whisper Corn',
    made: 'wheat',    late: 'eagle_feather',
    pot: { id: 'hf_wind', emoji: '🌬️', ko: '바람의 노래', en: 'Song of Wind',
      with: ['eagle_feather', 'cloud_moss', 'mist_drop', 'owl_feather', 'spider_silk'] } },
  { attr: 'water', id: 'tear_lotus',       emoji: '🪷',  ko: '눈물 연꽃',     en: 'Tear Lotus',
    made: 'dew',      late: 'sea_dew',
    pot: { id: 'hf_water', emoji: '🌊', ko: '심연의 눈물', en: 'Tear of the Deep',
      with: ['sea_dew', 'foam', 'seaweed', 'coral', 'pearl_bit'] } },
  { attr: 'light', id: 'dawn_tomato',      emoji: '🍅',  ko: '새벽 토마토',   en: 'Dawn Tomato',
    made: 'firefly',  late: 'sea_glass',
    pot: { id: 'hf_light', emoji: '☀️', ko: '새벽의 관', en: 'Crown of Dawn',
      with: ['sea_glass', 'starfish', 'snow_bud', 'crystal', 'honey'] } },
  { attr: 'dark',  id: 'shadow_eggplant',  emoji: '🍆',  ko: '그림자 가지',   en: 'Shadow Eggplant',
    made: 'mushroom', late: 'black_feather',
    pot: { id: 'hf_dark', emoji: '🌑', ko: '그믐의 장막', en: 'Veil of the New Moon',
      with: ['black_feather', 'mushroom', 'night_dew', 'frog_egg', 'rust_nail'] } },
];

const MADE_N = 3;      // 그 속성 크리처의 생산물을 몇 개 내나
const LATE_N = 2;      // 늦은 지대 재료를 몇 개 내나
const HOURS = 12;      // 자라는 데 걸리는 시간 (임시값)
const YIELD = 3;       // 거두는 개수 (임시값)

// 밭 물약 — **여섯의 값이 일부러 같다.** 하나가 더 좋으면 모두 그것만 심고
// 나머지 다섯 작물이 죽은 콘텐츠가 된다. 무엇을 심을지는 **가진 재료**가 정해야 한다.
// 16 은 지금 제일 센 상급(15)보다 하나 위다 — 밭이 제일 깊은 콘텐츠이기 때문이다.
const POT_BEAUTY = 16, POT_CHARM = 16;
// 넣는 것은 여섯 (작물 1 + 재료 5) → **6구 은빛 솥**(해금 110)이 필요하다.
// 밭이 열리는 여신(매력 100) 바로 다음 솥이라 순서가 자연스럽게 맞는다

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
// ─── 밭 물약 ───
{
  // ⚠️ **이 표가 만든 것은 「기존」에서 뺀다.** `data.js` 에는 지난번에 뽑아 둔
  // 밭 물약이 이미 들어 있어서, 그대로 견주면 **자기 자신과 겹친다**고 나온다
  // (`--check` 는 늘 그 상태에서 돈다). 다시 뽑을 때마다 6건이 뜨던 자리다
  const own = new Set(TABLE.map(c => c.pot && c.pot.id).filter(Boolean));
  const mine = D.RECIPES.filter(r => !own.has(r.result.id));
  const potIds = new Set(mine.map(r => r.result.id));
  const combos = new Map();
  for (const r of mine) combos.set(D.recipeKey(r.inputs), r.result.id);
  const seenPot = new Set();
  for (const c of TABLE) {
    const P = c.pot;
    if (!P) { problems.push(`${c.id}: 밭 물약이 없다`); continue; }
    if (seenPot.has(P.id)) problems.push(`물약 id 중복: ${P.id}`);
    seenPot.add(P.id);
    // **결과물 id 가 겹치면 안 된다** — 겹치면 레시피 북에서 둘이 한 칸으로 보인다
    if (potIds.has(P.id)) problems.push(`${P.id}: 이미 있는 결과물 id 다`);
    // 넣는 재료 — 있는가 · 히든이 아닌가 · 작물이 아닌가 · 한 조합 안에서 안 겹치는가
    const inSeen = new Set();
    for (const id of P.with) {
      const ing = D.INGREDIENTS[id];
      if (!ing) { problems.push(`${P.id}: 없는 재료 ${id}`); continue; }
      if (ing.rare) problems.push(`${P.id}: 히든 재료를 쓴다 — ${id}`);
      if (ing.farm) problems.push(`${P.id}: 특수 작물을 재료 자리에 넣었다 — ${id}`);
      if (inSeen.has(id)) problems.push(`${P.id}: 같은 재료가 두 번 — ${id}`);
      inSeen.add(id);
    }
    if (P.with.length !== 5) problems.push(`${P.id}: 재료가 5개여야 한다 (${P.with.length})`);
    // **기존 레시피와 조합이 겹치면 안 된다** — `RECIPE_MAP` 이 조용히 덮어써서
    // 레시피 하나가 소리 없이 사라진다. 작물이 하나 들어가므로 원래는 겹칠 수 없지만,
    // 조합을 손보다가 작물을 빼면 그때부터 겹칠 수 있다
    const key = D.recipeKey([c.id, ...P.with]);
    if (combos.has(key)) problems.push(`${P.id}: 조합이 ${combos.get(key)} 와 겹친다`);
    combos.set(key, P.id);
    // **넣는 것이 여섯이면 6구 솥이 있어야 한다** — 없는 솥을 요구하면 영영 못 만든다
    if (!D.CAULDRONS.some(x => x.slots >= 6)) problems.push(`${P.id}: 6구 이상 솥이 없다`);
  }
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

// ③ 밭 물약 레시피 — **inputs 는 정렬해서 낸다** (`recipeKey` 가 정렬 기준이다)
let potBody = '';
for (const c of TABLE) {
  const P = c.pot;
  const ins = [c.id, ...P.with].sort().map(x => `'${x}'`).join(', ');
  potBody +=
    `  { inputs: [${ins}],\n` +
    `    result: { id: '${P.id}', kind: 'potion', grade: 'high', emoji: '${P.emoji}', name: '${P.ko}',\n` +
    `      desc: '밭에서 기른 ${c.ko} 없이는 빚을 수 없다.', beauty: ${POT_BEAUTY}, charm: ${POT_CHARM} } },\n`;
}

// ④ 영어 이름 (작물 + 물약). **같은 표에서 나오므로 한쪽만 빠질 수 없다**
let enBody = '';
for (const c of TABLE) enBody += `      ${c.id}: '${c.en}',\n`;
for (const c of TABLE) enBody += `      ${c.pot.id}: '${c.pot.en}',\n`;

const changed = [
  replaceBlock(path.join(ROOT, 'data.js'), 'farm-ing', ingBody),
  replaceBlock(path.join(ROOT, 'data.js'), 'farm-crops', cropBody),
  replaceBlock(path.join(ROOT, 'data.js'), 'farm-recipe', potBody),
  replaceBlock(path.join(ROOT, 'i18n.js'), 'farm-en', enBody),
].some(Boolean);

if (CHECK) {
  if (changed) {
    console.error('❌ 작물 표와 파일이 어긋났다 — `node tools/genfarm.js` 를 돌릴 것');
    process.exit(1);
  }
  console.log(`✅ 특수 작물 ${TABLE.length}종 · 밭 물약 ${TABLE.length}종이 표와 같다`);
  process.exit(0);
}
console.log(`✅ 특수 작물 ${TABLE.length}종 (속성 ${D.CREATURE_ATTRS.length} × 1)`
  + ` · 자라는 데 ${HOURS}시간 · ${YIELD}개`
  + ` / 밭 물약 ${TABLE.length}종 (재료 6 · 비주얼·아우라 ${POT_BEAUTY})`);
