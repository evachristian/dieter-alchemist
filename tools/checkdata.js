// 데이터가 스스로 어긋나 있지 않은지 — **조용히 깨지는 것들만** 본다.
//
// 왜 필요한가: `RECIPE_MAP` 은 `RECIPE_MAP[recipeKey(inputs)] = result` 로 만들어진다.
// 같은 조합을 쓰는 레시피가 둘이면 **나중 것이 앞 것을 조용히 덮어쓴다** —
// 오류도 안 나고, 화면도 멀쩡하고, 그냥 **레시피 하나가 사라진다.**
// 크리처를 서른 종으로 늘리면서 새 조합이 서른 개 생기므로 이 검사가 먼저 필요했다.
//
// 사용: node tools/checkdata.js      (종료 코드 0 = 이상 없음)
const path = require('path');
const ROOT = path.join(__dirname, '..');

global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} } };
require(path.join(ROOT, 'data.js'));
const D = global.window.GameData;

const problems = [];
const add = (title, list) => { if (list.length) problems.push([title, list]); };

// ─── 1. 레시피 ────────────────────────────────────────────────
const byCombo = new Map();      // 조합 → 결과 id 들
const byResult = new Map();     // 결과 id → 조합 들
for (const r of D.RECIPES) {
  const key = D.recipeKey(r.inputs);
  if (!byCombo.has(key)) byCombo.set(key, []);
  byCombo.get(key).push(r.result.id);
  if (!byResult.has(r.result.id)) byResult.set(r.result.id, []);
  byResult.get(r.result.id).push(key);
}

// **같은 조합 둘** — RECIPE_MAP 이 덮어써서 앞 레시피가 사라진다
add('같은 조합을 쓰는 레시피 (뒤엣것이 앞엣것을 덮어쓴다)',
  [...byCombo].filter(([, ids]) => ids.length > 1)
    .map(([k, ids]) => `${k}  →  ${ids.join(' / ')}`));

// **같은 결과물 둘** — 만드는 길이 둘이면 레시피 북이 하나만 보여 준다
add('같은 결과물을 내는 레시피가 여럿',
  [...byResult].filter(([, ks]) => ks.length > 1)
    .map(([id, ks]) => `${id}  ←  ${ks.join(' / ')}`));

// **없는 재료를 가리키는 레시피** — 조합창에 빈 칸이 뜬다.
//
// ⚠️ 입력에는 **크리처 id 도 들어갈 수 있다** (7단계 — 상급이 중급을 재료로 먹는다).
// 그래서 재료 표만 보면 멀쩡한 레시피가 「없는 재료」로 잡힌다.
// 게임 쪽도 같은 이유로 조회를 `itemOf()` 한 곳에 모았다.
const creatureIds = new Set(
  D.RECIPES.filter(r => r.result.kind === 'creature').map(r => r.result.id));
const badInput = [], meltIn = [];
for (const r of D.RECIPES) {
  for (const id of r.inputs) {
    if (D.INGREDIENTS[id]) continue;
    if (creatureIds.has(id)) { meltIn.push(`${r.result.id} ← ${id}`); continue; }
    badInput.push(`${r.result.id} ← ${id}`);
  }
}
add('레시피가 없는 재료를 가리킨다', badInput);
MELT_N = meltIn.length;

// **크리처를 재료로 먹는 레시피** — 자기보다 아래 등급이어야 한다.
// 상급이 상급을 먹으면 「먼저 만들 수 있는 길」이 없어져 아무도 못 만든다
const GRADE_ORDER = { basic: 0, mid: 1, high: 2 };
const resultOf = id => (D.RECIPES.find(x => x.result.id === id) || {}).result;
add('크리처가 자기와 같거나 높은 등급을 재료로 먹는다',
  meltIn.map(t => t.split(' ← ')).filter(([out, into]) => {
    const a = resultOf(out), b = resultOf(into);
    return a && b && GRADE_ORDER[b.grade] >= GRADE_ORDER[a.grade];
  }).map(([out, into]) => `${out} ← ${into}`));

// **inputs 가 정렬돼 있어야 한다.** recipeKey 는 정렬해서 비교하므로 동작은 하지만,
// 데이터를 눈으로 훑을 때 어긋나 보이고 생성기 결과와도 안 맞는다
add('레시피 inputs 가 정렬돼 있지 않다',
  D.RECIPES.filter(r => [...r.inputs].sort().join() !== r.inputs.join())
    .map(r => `${r.result.id}: ${r.inputs.join(' ')}`));

// **솥에 안 들어가는 레시피** — 가장 큰 솥보다 재료가 많으면 영영 못 만든다
const maxSlots = Math.max(...D.CAULDRONS.map(c => c.slots));
add(`가장 큰 솥(${maxSlots}구)보다 재료가 많은 레시피`,
  D.RECIPES.filter(r => r.inputs.length > maxSlots)
    .map(r => `${r.result.id}: ${r.inputs.length}개`));

// ─── 2. 맵 ────────────────────────────────────────────────────
const badPool = [];
for (const m of D.MAPS) {
  (m.pool || []).forEach(id => { if (!D.INGREDIENTS[id]) badPool.push(`${m.id} pool ← ${id}`); });
  if (m.special && !D.INGREDIENTS[m.special]) badPool.push(`${m.id} special ← ${m.special}`);
  if (!m.pool || !m.pool.length) badPool.push(`${m.id}: 채집 풀이 비어 있다`);
}
add('맵이 없는 재료를 가리킨다', badPool);

// 맵의 지대가 실제로 있는 지대인가
const zoneIds = new Set(D.ZONES.map(z => z.id));
add('맵의 지대가 ZONES 에 없다',
  D.MAPS.filter(m => !zoneIds.has(m.zone)).map(m => `${m.id} → ${m.zone}`));

// ─── 3. id 중복 ───────────────────────────────────────────────
// **id 가 겹치면 세이브가 엉킨다.** 옷은 생성기가 보지만, 그 밖은 아무도 안 봤다
const seen = new Map();
const claim = (id, where) => {
  if (seen.has(id)) return `${id} — ${seen.get(id)} 와 ${where}`;
  seen.set(id, where); return null;
};
const dupId = [];
const take = (id, where) => { const m = claim(id, where); if (m) dupId.push(m); };
Object.values(D.INGREDIENTS).forEach(x => take(x.id, '재료'));
D.RECIPES.forEach(r => take(r.result.id, '레시피 결과물'));
D.MAPS.forEach(x => take(x.id, '맵'));
D.CAULDRONS.forEach(x => take(x.id, '솥'));
D.FOODS.forEach(x => take(x.id, '음식'));
D.EXERCISES.forEach(x => take(x.id, '운동'));
Object.values(D.WARDROBE).forEach(list => (list || []).forEach(x => take(x.id, '옷')));
D.COLORS.forEach(x => take(x.id, '색'));
D.SPEAKERS.forEach(x => take(x.id, '인물'));
add('id 가 겹친다', dupId);

// ─── 결과 ─────────────────────────────────────────────────────
if (!problems.length) {
  console.log(`✅ 데이터 이상 없음 (레시피 ${D.RECIPES.length} · 맵 ${D.MAPS.length}`
    + ` · 재료 ${Object.keys(D.INGREDIENTS).length} · id ${seen.size}`
    + ` · 크리처를 재료로 먹는 레시피 ${MELT_N})`);
  process.exit(0);
}
console.log('❌ 데이터가 어긋나 있다\n');
let total = 0;
for (const [title, list] of problems) {
  total += list.length;
  console.log(`── ${title} (${list.length})`);
  list.forEach(x => console.log('   ' + x));
  console.log('');
}
console.log(`모두 ${total}건`);
process.exit(1);
