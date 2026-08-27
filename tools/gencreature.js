// 크리처 30종을 **표 한 장에서** 뽑는다 — data.js 의 레시피와 i18n.js 의 영어 이름을 함께.
//
// 왜 생성기인가 (CLAUDE.md 6번):
//   · 손으로 서른 줄을 쓰면 **중복 조합**이 반드시 섞인다. RECIPE_MAP 이 조용히 덮어써서
//     레시피 하나가 소리 없이 사라진다 (그래서 tools/checkdata.js 도 같이 만들었다)
//   · 한국어만 늘리고 영어를 빠뜨린다. 여기서는 **같은 줄에서 둘이 같이 나온다**
//   · 수치(매력·전투력)를 등급에서 계산하므로 한 마리만 튀는 일이 없다
//
// ⚠️ **옛 id 는 절대 새로 뽑지 않는다.** butterfly · frog · unicorn 은 이미 세이브에 들어 있다.
// id 가 바뀌면 그 크리처를 가진 사람의 소유 기록이 통째로 날아간다. 조합도 그대로 둔다 —
// 레시피 북에서 「어제 본 조합」이 달라지면 그것도 잃어버린 것으로 읽힌다.
//
// 사용:
//   node tools/gencreature.js            data.js · i18n.js 를 다시 쓴다
//   node tools/gencreature.js --check    생성 결과와 파일이 어긋났는지만 본다 (npm test)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');

// ─── 속성 ─────────────────────────────────────────────────────
// 불 ➔ 땅 ➔ 바람 ➔ 물 ➔ 불 (화살표 = 강하다) · 빛 ↔ 암흑 (서로 카운터)
// 순환은 **채집에 안 쓴다** — 나중의 전투·약탈용이다 (CREATURE.md 2장)
const ATTRS = [
  { k: 'fire',  ko: '불',   en: 'Fire',  color: '#f0743c', beats: 'earth' },
  { k: 'earth', ko: '땅',   en: 'Earth', color: '#b0834e', beats: 'wind' },
  { k: 'wind',  ko: '바람', en: 'Wind',  color: '#7cc6bb', beats: 'water' },
  { k: 'water', ko: '물',   en: 'Water', color: '#4f9ada', beats: 'fire' },
  { k: 'light', ko: '빛',   en: 'Light', color: '#e8b545', beats: 'dark' },
  { k: 'dark',  ko: '암흑', en: 'Dark',  color: '#6f6191', beats: 'light' },
];

// ─── 등급 ─────────────────────────────────────────────────────
// 재료 수가 곧 등급이다 — 2개는 초반 솥에도 들어가고, 4개는 4구 솥부터다.
// 매력은 **장착한 한 마리만** 반영되므로(CREATURE.md 0장) 상급이 확실히 나아야 한다.
const GRADES = {
  basic: { ko: '기초', charm: 2, power: 4 },
  mid:   { ko: '중급', charm: 4, power: 9 },
  high:  { ko: '상급', charm: 6, power: 16 },
};

// ─── 그림 부품 ────────────────────────────────────────────────
// **한 마리씩 그리지 않는다.** creature.js 가 부품을 갖고 있고 여기서는 조합만 준다
// (portrait.js 가 인물을 그리는 방식과 같다). 새 부품 하나를 만들면 서른 마리가 같이 는다.
//   body   blob 둥근덩어리 / quad 날씬한네발 / bear 큰네발 / deer 다리긴네발 / bird 새 / bug 벌레 / fish 물고기
//   ear    none / round / long / tuft / fin
//   horn   none / single / pair / antler / crystal
//   wing   none / butterfly / bird / bat / fin
//   tail   none / puff / long / fish / leaf
//   eye    dot / round / sleepy / sharp
//   pat    none / spot / stripe / glow
const C = (body, ear, horn, wing, tail, eye, pat) => ({ body, ear, horn, wing, tail, eye, pat });

// ─── 땅에 선 것 / 떠 있는 것 ──────────────────────────────────
//
// **손으로 붙이지 않고 그림 부품에서 끌어낸다.** 서른 마리에 하나씩 적으면
// 새 마리를 넣을 때 반드시 빠뜨리고, 빠뜨린 쪽은 조용히 「땅」이 된다.
//
//   날개가 있으면 뜬다 — 나비 · 박쥐 · 새 날개
//   물고기도 뜬다 — 방바닥에 세워 놓을 수가 없다
//   그 밖에는 전부 네 발로 선다
//
// ⚠️ **몸통(body)으로 가르면 틀린다.** 「햇살 암탉」은 body 가 bird 인데 날개가 없다 —
// 암탉은 걸어 다닌다. 유니콘(deer + 뿔, 날개 없음)도 같은 이유로 땅이다.
function moveOf(art) {
  return (art.wing !== 'none' || art.body === 'fish') ? 'air' : 'ground';
}

// ─── 서른 마리 ────────────────────────────────────────────────
// 속성마다 다섯: 기초 2 · 중급 2 · 상급 1.
// **기초는 평야·숲 재료만 쓴다** — 그 둘이 제일 먼저 열리는 지대라(0 · 38),
// 산악(112) 재료를 쓰면 「기초인데 못 만든다」가 된다.
const TABLE = [
  // ── 불 ──
  { id: 'ember_newt',       attr: 'fire',  grade: 'basic', ko: '불씨 도롱뇽',   en: 'Ember Newt',
    inputs: ['sun_seed', 'tree_resin'],                     art: C('quad', 'none', 'none', 'none', 'long', 'dot', 'spot') },
  { id: 'ash_moth',         attr: 'fire',  grade: 'basic', ko: '잿빛 나방',     en: 'Ash Moth',
    inputs: ['spider_silk', 'thistle'],                     art: C('bug', 'tuft', 'none', 'butterfly', 'none', 'dot', 'stripe') },
  { id: 'flame_fox',        attr: 'fire',  grade: 'mid',   ko: '화염 여우',     en: 'Flame Fox',
    inputs: ['berry', 'dry_root', 'flint'],                 art: C('quad', 'tuft', 'none', 'none', 'puff', 'sharp', 'none') },
  { id: 'charcoal_toad',    attr: 'fire',  grade: 'mid',   ko: '숯불 두꺼비',   en: 'Charcoal Toad',
    inputs: ['flint', 'mushroom', 'walnut'],                art: C('blob', 'none', 'none', 'none', 'none', 'sleepy', 'spot') },
  { id: 'ember_phoenix',    attr: 'fire',  grade: 'high',  ko: '불꽃 봉황',     en: 'Ember Phoenix',
    inputs: ['eagle_feather', 'flint', 'lizard_scale', 'sun_seed'], art: C('bird', 'none', 'none', 'bird', 'long', 'sharp', 'glow') },

  // ── 땅 ──
  { id: 'pebble_turtle',    attr: 'earth', grade: 'basic', ko: '조약돌 거북',   en: 'Pebble Turtle',
    inputs: ['clover', 'moss_branch'],                      art: C('blob', 'none', 'none', 'none', 'none', 'sleepy', 'spot') },
  { id: 'root_mole',        attr: 'earth', grade: 'basic', ko: '뿌리 두더지',   en: 'Root Mole',
    inputs: ['fern', 'walnut'],                             art: C('bear', 'round', 'none', 'none', 'puff', 'dot', 'none') },
  { id: 'moss_deer',        attr: 'earth', grade: 'mid',   ko: '이끼 사슴',     en: 'Moss Deer',
    inputs: ['cave_moss', 'herb', 'moss_branch'],           art: C('deer', 'long', 'antler', 'none', 'leaf', 'round', 'spot') },
  { id: 'crystal_pangolin', attr: 'earth', grade: 'mid',   ko: '수정 천산갑',   en: 'Crystal Pangolin',
    inputs: ['crystal', 'echo_stone', 'wild_ivy'],          art: C('bear', 'none', 'crystal', 'none', 'long', 'dot', 'stripe') },
  { id: 'boulder_bear',     attr: 'earth', grade: 'high',  ko: '바위 곰',       en: 'Boulder Bear',
    inputs: ['chestnut_pumpkin', 'echo_stone', 'iron_ore', 'pine_cone'], art: C('bear', 'round', 'none', 'none', 'puff', 'sharp', 'spot') },

  // ── 바람 ──
  { id: 'dandelion_hare',   attr: 'wind',  grade: 'basic', ko: '민들레 토끼',   en: 'Dandelion Hare',
    inputs: ['butter_flower', 'clover'],                    art: C('deer', 'long', 'none', 'none', 'puff', 'round', 'none') },
  { id: 'breeze_sparrow',   attr: 'wind',  grade: 'basic', ko: '산들 참새',     en: 'Breeze Sparrow',
    inputs: ['owl_feather', 'wheat'],                       art: C('bird', 'none', 'none', 'bird', 'none', 'dot', 'none') },
  { id: 'whirl_marten',     attr: 'wind',  grade: 'mid',   ko: '회오리 담비',   en: 'Whirl Marten',
    inputs: ['eagle_feather', 'wheat', 'wild_ivy'],         art: C('quad', 'tuft', 'none', 'none', 'long', 'sharp', 'stripe') },
  { id: 'cloud_goat',       attr: 'wind',  grade: 'mid',   ko: '구름 염소',     en: 'Cloud Goat',
    inputs: ['cloud_moss', 'clover', 'snow_bud'],           art: C('deer', 'long', 'pair', 'none', 'puff', 'sleepy', 'none') },
  { id: 'sky_falcon',       attr: 'wind',  grade: 'high',  ko: '하늘 매',       en: 'Sky Falcon',
    inputs: ['cloud_moss', 'eagle_feather', 'mist_drop', 'sun_seed'], art: C('bird', 'none', 'none', 'bird', 'long', 'sharp', 'stripe') },

  // ── 물 ──
  // frog 은 **옛 id** 다. 조합(mushroom + petal)도 그대로 둔다
  { id: 'frog',             attr: 'water', grade: 'basic', ko: '꽃개구리',     en: 'Blossom Frog',
    inputs: ['mushroom', 'petal'],                          art: C('blob', 'none', 'none', 'none', 'none', 'round', 'spot') },
  { id: 'droplet_otter',    attr: 'water', grade: 'basic', ko: '물방울 수달',   en: 'Droplet Otter',
    inputs: ['dew', 'night_dew'],                           art: C('quad', 'round', 'none', 'none', 'long', 'round', 'none') },
  { id: 'coral_seahorse',   attr: 'water', grade: 'mid',   ko: '산호 해마',     en: 'Coral Seahorse',
    inputs: ['coral', 'foam', 'seaweed'],                   art: C('fish', 'fin', 'none', 'fin', 'fish', 'dot', 'glow') },
  { id: 'dew_snail',        attr: 'water', grade: 'mid',   ko: '이슬 달팽이',   en: 'Dewdrop Snail',
    inputs: ['moss_branch', 'night_dew', 'shell'],          art: C('blob', 'long', 'none', 'none', 'none', 'sleepy', 'glow') },
  { id: 'deepsea_whale',    attr: 'water', grade: 'high',  ko: '심해 고래',     en: 'Deepsea Whale',
    inputs: ['driftwood', 'pearl_bit', 'sea_dew', 'seaweed'], art: C('fish', 'fin', 'none', 'fin', 'fish', 'sleepy', 'glow') },

  // ── 빛 ──
  // butterfly · unicorn 도 **옛 id** 다
  { id: 'butterfly',        attr: 'light', grade: 'basic', ko: '반짝 나비',     en: 'Glimmer Butterfly',
    inputs: ['crystal', 'dew'],                             art: C('bug', 'tuft', 'none', 'butterfly', 'none', 'round', 'glow') },
  { id: 'sunbeam_hen',      attr: 'light', grade: 'basic', ko: '햇살 암탉',     en: 'Sunbeam Hen',
    inputs: ['sun_seed', 'wheat'],                          art: C('bird', 'none', 'none', 'none', 'puff', 'dot', 'none') },
  { id: 'starlit_fawn',     attr: 'light', grade: 'mid',   ko: '별무리 사슴',   en: 'Starlit Fawn',
    inputs: ['butter_flower', 'honey', 'snow_bud'],         art: C('deer', 'long', 'antler', 'none', 'leaf', 'round', 'glow') },
  { id: 'dawn_owl',         attr: 'light', grade: 'mid',   ko: '여명 부엉이',   en: 'Dawn Owl',
    inputs: ['honey', 'mist_drop', 'owl_feather'],          art: C('bird', 'tuft', 'none', 'bird', 'none', 'round', 'spot') },
  { id: 'unicorn',          attr: 'light', grade: 'high',  ko: '유니콘',       en: 'Unicorn',
    inputs: ['berry', 'crystal', 'mushroom'],               art: C('deer', 'long', 'single', 'none', 'long', 'round', 'glow') },

  // ── 암흑 ──
  { id: 'newmoon_bat',      attr: 'dark',  grade: 'basic', ko: '그믐 박쥐',     en: 'Newmoon Bat',
    inputs: ['firefly', 'night_dew'],                       art: C('bug', 'long', 'none', 'bat', 'none', 'dot', 'none') },
  { id: 'shadow_cat',       attr: 'dark',  grade: 'basic', ko: '그림자 고양이', en: 'Shadow Cat',
    inputs: ['petal', 'spider_silk'],                       art: C('quad', 'tuft', 'none', 'none', 'long', 'sharp', 'none') },
  { id: 'nightmist_fox',    attr: 'dark',  grade: 'mid',   ko: '밤안개 여우',   en: 'Nightmist Fox',
    inputs: ['berry', 'mist_drop', 'wild_ivy'],             art: C('quad', 'tuft', 'none', 'none', 'puff', 'sleepy', 'stripe') },
  { id: 'obsidian_lizard',  attr: 'dark',  grade: 'mid',   ko: '흑요석 도마뱀', en: 'Obsidian Lizard',
    inputs: ['bone_frag', 'flint', 'lizard_scale'],         art: C('quad', 'none', 'crystal', 'none', 'long', 'sharp', 'stripe') },
  { id: 'abyss_raven',      attr: 'dark',  grade: 'high',  ko: '심연 까마귀',   en: 'Abyss Raven',
    inputs: ['black_feather', 'bone_frag', 'echo_stone', 'night_dew'], art: C('bird', 'none', 'none', 'bird', 'long', 'sharp', 'glow') },
];

// 세이브에 이미 들어 있는 id — 생성 뒤 셋이 다 살아 있는지 다시 확인한다
const LEGACY = ['butterfly', 'frog', 'unicorn'];

// ─── 전투력 (아직 아무도 안 읽는다) ───────────────────────────
// 「밭 약탈」이 들어올 자리다 (CREATURE.md 10장). 지금 넣어 두는 이유는,
// 나중에 서른 마리를 다시 훑으며 수치를 붙이는 일이 없게 하려는 것이다.
// 등급이 총량을 정하고 속성이 **어디에 쏠리는지**를 정한다 — 합은 속성과 무관하게 같다.
const TILT = {
  fire:  [0.40, 0.25, 0.20, 0.15],   // 물리 공격형
  earth: [0.20, 0.15, 0.45, 0.20],   // 물리 방어형
  wind:  [0.30, 0.30, 0.20, 0.20],   // 고른 편
  water: [0.15, 0.25, 0.20, 0.40],   // 마법 방어형
  light: [0.15, 0.45, 0.15, 0.25],   // 마법 공격형
  dark:  [0.25, 0.40, 0.15, 0.20],   // 마법 공격형(공격 쪽으로 조금)
};
function combatOf(attr, grade) {
  const total = GRADES[grade].power * 4;
  const t = TILT[attr];
  // 반올림 오차를 마지막 칸이 흡수해 **합이 정확히 total 이 되게** 한다 —
  // 안 그러면 같은 등급인데 총합이 1씩 다른 마리가 생긴다
  const v = t.slice(0, 3).map(x => Math.max(1, Math.round(total * x)));
  v.push(Math.max(1, total - v[0] - v[1] - v[2]));
  return { atk: v[0], matk: v[1], def: v[2], mdef: v[3] };
}

// ─── 검사 ─────────────────────────────────────────────────────
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} } };
require(path.join(ROOT, 'data.js'));
const D = global.window.GameData;

const problems = [];
const seenId = new Set();
const seenCombo = new Map();
const attrCount = {};
for (const c of TABLE) {
  if (seenId.has(c.id)) problems.push(`id 중복: ${c.id}`);
  seenId.add(c.id);
  if (!ATTRS.some(a => a.k === c.attr)) problems.push(`${c.id}: 없는 속성 ${c.attr}`);
  if (!GRADES[c.grade]) problems.push(`${c.id}: 없는 등급 ${c.grade}`);
  attrCount[c.attr] = (attrCount[c.attr] || 0) + 1;

  const sorted = [...c.inputs].sort();
  if (sorted.join() !== c.inputs.join()) problems.push(`${c.id}: inputs 를 정렬해서 적을 것`);
  const key = sorted.join('+');
  if (seenCombo.has(key)) problems.push(`조합 중복: ${c.id} 와 ${seenCombo.get(key)} — ${key}`);
  seenCombo.set(key, c.id);

  // 재료가 실제로 있는가 · **히든 재료는 안 쓴다** (0.1% 짜리를 기초 크리처에 넣을 수 없다)
  for (const id of c.inputs) {
    const ing = D.INGREDIENTS[id];
    if (!ing) { problems.push(`${c.id}: 없는 재료 ${id}`); continue; }
    if (ing.rare) problems.push(`${c.id}: 히든 재료 ${id} 를 쓴다`);
  }
  // **기초는 평야·숲만.** 그래야 초반에 만들 수 있다
  if (c.grade === 'basic') {
    const bad = c.inputs.filter(id => D.INGREDIENTS[id] && !['plain', 'forest'].includes(D.INGREDIENTS[id].zone));
    // butterfly 는 옛 조합이라 예외다 (crystal = 산악). 바꾸면 세이브의 레시피 북이 달라진다
    if (bad.length && c.id !== 'butterfly') {
      problems.push(`${c.id}: 기초인데 늦게 열리는 지대 재료 — ${bad.join(' ')}`);
    }
  }
  // 재료 수와 등급이 맞는가.
  // **옛 크리처는 빼고 본다** — 조합을 바꾸면 그 크리처를 가진 사람의 레시피 북이
  // 어제와 달라진다. 유니콘이 재료 셋짜리 상급인 것은 원래 그랬던 것이고,
  // 「빛 상급이 유독 싸다」는 그 대가다 (바꾸려면 조합을 바꿔야 하는데 그게 더 비싸다)
  const want = { basic: 2, mid: 3, high: 4 }[c.grade];
  if (c.inputs.length !== want && !LEGACY.includes(c.id)) {
    problems.push(`${c.id}: ${c.grade} 는 재료 ${want}개여야 한다 (${c.inputs.length})`);
  }
}
for (const a of ATTRS) {
  if (attrCount[a.k] !== 5) problems.push(`속성 ${a.ko}: ${attrCount[a.k] || 0}마리 (5여야 한다)`);
}
for (const id of LEGACY) if (!seenId.has(id)) problems.push(`옛 id 가 사라졌다: ${id}`);

// 땅/공중이 **눈으로 본 것과 맞는가.** 규칙 한 줄이라 조용히 뒤집히기 쉬워서
// 사람이 「이건 분명 이쪽」이라고 아는 몇 마리를 못으로 박아 둔다.
// 유니콘이 허공에 뜬 채로 배포됐던 적이 있다 — 그때는 서른 마리가 다 떠 있었다.
const MOVE_MUST = {
  unicorn: 'ground', frog: 'ground', butterfly: 'air',
  sunbeam_hen: 'ground',      // body 가 bird 인데 날개가 없다 — 암탉은 걷는다
  ember_phoenix: 'air', moss_deer: 'ground', boulder_bear: 'ground',
  coral_seahorse: 'air',      // 물고기는 방바닥에 세울 수가 없다
};
for (const c of TABLE) {
  const want = MOVE_MUST[c.id];
  if (want && moveOf(c.art) !== want) {
    problems.push(`${c.id}: ${want} 여야 하는데 ${moveOf(c.art)} 로 나온다`);
  }
}
// 한쪽으로 다 쏠리면 규칙이 죽은 것이다 (전부 air 였던 것이 원래 사고였다)
{
  const air = TABLE.filter(c => moveOf(c.art) === 'air').length;
  if (air === 0 || air === TABLE.length) problems.push(`땅/공중이 한쪽으로 쏠렸다: 공중 ${air}/${TABLE.length}`);
}

// **기존 물약 레시피와 조합이 겹치면 안 된다** — RECIPE_MAP 이 덮어쓴다
for (const r of D.RECIPES) {
  if (r.result.kind === 'creature') continue;      // 크리처는 이 표가 통째로 갈아 끼운다
  const key = D.recipeKey(r.inputs);
  if (seenCombo.has(key)) problems.push(`물약 ${r.result.id} 와 조합이 겹친다: ${seenCombo.get(key)} — ${key}`);
}

if (problems.length) {
  console.error('❌ 축 표에 문제가 있다\n' + problems.map(p => '   ' + p).join('\n'));
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

const artKeys = ['body', 'ear', 'horn', 'wing', 'tail', 'eye', 'pat'];
const q = s => `'${s}'`;
let dataBody = '';
for (const a of ATTRS) {
  dataBody += `  // ${a.ko} — 기초 2 · 중급 2 · 상급 1\n`;
  for (const c of TABLE.filter(x => x.attr === a.k)) {
    const g = GRADES[c.grade];
    const cb = combatOf(c.attr, c.grade);
    const art = artKeys.map(k => `${k}: ${q(c.art[k])}`).join(', ');
    dataBody +=
      `  { inputs: [${c.inputs.map(q).join(', ')}],\n` +
      `    result: { id: ${q(c.id)}, kind: 'creature', grade: ${q(c.grade)}, name: ${q(c.ko)},\n` +
      `      attr: ${q(c.attr)}, charmBonus: ${g.charm}, move: ${q(moveOf(c.art))},\n` +
      `      combat: { atk: ${cb.atk}, matk: ${cb.matk}, def: ${cb.def}, mdef: ${cb.mdef} },\n` +
      `      art: { ${art} } } },\n`;
  }
}

// 속성 표도 같은 곳에서 나온다 — 이름이 두 군데로 갈라지지 않게
const attrBody =
  `const CREATURE_ATTRS = [\n` +
  ATTRS.map(a => `  { id: 'attr_${a.k}', k: '${a.k}', name: '${a.ko}', color: '${a.color}', beats: '${a.beats}' },`).join('\n') +
  `\n];\n`;

let enBody = '';
for (const a of ATTRS) {
  enBody += `      // ${a.en}\n`;
  for (const c of TABLE.filter(x => x.attr === a.k)) enBody += `      ${c.id}: '${c.en}',\n`;
}
enBody += `      // 속성 이름 (UI 낱말이라 STRINGS 쪽에도 있다)\n`;
enBody += ATTRS.map(a => `      attr_${a.k}: '${a.en}',`).join('\n') + '\n';

const changed = [
  replaceBlock(path.join(ROOT, 'data.js'), 'creature', dataBody),
  replaceBlock(path.join(ROOT, 'data.js'), 'creature-attrs', attrBody),
  replaceBlock(path.join(ROOT, 'i18n.js'), 'creature-en', enBody),
].some(Boolean);

if (CHECK) {
  if (changed) {
    console.error('❌ 크리처 표와 파일이 어긋났다 — `node tools/gencreature.js` 를 돌릴 것');
    process.exit(1);
  }
  console.log(`✅ 크리처 ${TABLE.length}종이 표와 같다`);
  process.exit(0);
}
console.log(`✅ 크리처 ${TABLE.length}종 (속성 ${ATTRS.length} × 5) · 옛 id ${LEGACY.length}개 유지`
  + ` · 조합 중복 0 · 물약과 겹침 0`);
