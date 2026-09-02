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
// 퀘스트 문구가 빠졌는지도 여기서 본다 — 빠지면 칩에 열쇠(`q_first_name`)가 그대로 뜬다
require(path.join(ROOT, 'i18n.js'));
const D = global.window.GameData;
const I = global.window.I18N;

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

// ─── 2-2. 특수 작물 (밭 · FARM.md) ────────────────────────────
// **채집으로는 절대 안 나오고, 밭 물약에는 반드시 들어간다.** 이 둘이 밭의 존재
// 이유 전체다 — 하나라도 깨지면 「밭이 없으면 못 만든다」가 거짓말이 된다.
// 생성기(`genfarm.js`)도 보지만, **여기서는 파일에 실제로 써진 것을 본다** —
// 생성기를 안 돌리고 손으로 고친 경우가 그쪽 검사에 안 걸린다
{
  const farmIngs = Object.values(D.INGREDIENTS).filter(x => x.farm);
  add('특수 작물이 하나도 없다', farmIngs.length ? [] : ['INGREDIENTS 에 farm:true 가 없다']);

  // 채집 풀·특별 재료 어디에도 없어야 한다
  const inPool = [];
  for (const m of D.MAPS) {
    for (const id of (m.pool || [])) {
      if ((D.INGREDIENTS[id] || {}).farm) inPool.push(`${m.id} pool ← ${id}`);
    }
    if ((D.INGREDIENTS[m.special] || {}).farm) inPool.push(`${m.id} special ← ${m.special}`);
  }
  add('특수 작물이 채집으로 나온다', inPool);

  // 히든(rare)으로 잘못 표시하면 채집 확률표(specialTier)가 흔들린다
  add('특수 작물이 히든으로도 표시돼 있다', farmIngs.filter(x => x.rare).map(x => x.id));

  // 작물마다 **그것을 쓰는 레시피가 적어도 하나** 있어야 한다 (죽은 재료 금지)
  const usedIn = new Map();
  for (const r of D.RECIPES) {
    for (const id of r.inputs) {
      if ((D.INGREDIENTS[id] || {}).farm) {
        if (!usedIn.has(id)) usedIn.set(id, []);
        usedIn.get(id).push(r.result.id);
      }
    }
  }
  add('아무 레시피도 안 쓰는 특수 작물',
    farmIngs.filter(x => !usedIn.has(x.id)).map(x => `${x.id} (${x.name})`));

  // 작물이 든 레시피에는 **작물이 정확히 하나** 들어간다.
  // 둘이 들어가면 밭 두 번을 기다려야 하고, 그건 기획에 없는 값이다
  const many = [];
  for (const r of D.RECIPES) {
    const n = r.inputs.filter(id => (D.INGREDIENTS[id] || {}).farm).length;
    if (n > 1) many.push(`${r.result.id}: 작물 ${n}개`);
  }
  add('한 레시피에 특수 작물이 둘 이상', many);

  // 그 레시피는 **지금 있는 솥에 들어가야 한다** — 없는 솥을 요구하면 영영 못 만든다
  const maxSlots = Math.max(...D.CAULDRONS.map(c => c.slots));
  const tooBig = [];
  for (const r of D.RECIPES) {
    if (!r.inputs.some(id => (D.INGREDIENTS[id] || {}).farm)) continue;
    if (r.inputs.length > maxSlots) tooBig.push(`${r.result.id}: ${r.inputs.length}구 (제일 큰 솥 ${maxSlots}구)`);
  }
  add('밭 물약이 들어갈 솥이 없다', tooBig);
}

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

// ─── 퀘스트 (QUEST.md) ────────────────────────────────────────
//
// **표 하나에 다섯 가지가 물려 있다** — 인물 · 목표가 가리키는 것 · 보상 · 문구 열쇠 ·
// 여는 순서. 하나만 어긋나도 화면에서는 「빈 칩」이나 「이름 없는 퀘스트」로만 보인다.
{
  const qIds = new Set();
  const bad = [];
  const kinds = ['brew', 'creature', 'drink', 'visit', 'deliver', 'charm', 'farm', 'kitchen'];
  D.QUESTS.forEach(q => {
    if (qIds.has(q.id)) bad.push(`${q.id} — id 가 겹친다`);
    qIds.add(q.id);
    take(q.id, '퀘스트');
    if (!D.speaker(q.npc)) bad.push(`${q.id} — 없는 인물 ${q.npc}`);
    const g = q.goal || {};
    if (kinds.indexOf(g.kind) < 0) bad.push(`${q.id} — 모르는 목표 종류 ${g.kind}`);
    if (!(g.n > 0)) bad.push(`${q.id} — 목표 수가 ${g.n} 이다`);
    // 목표가 가리키는 것이 실제로 있는가
    if (g.id) {
      const ok = g.kind === 'deliver' ? !!D.INGREDIENTS[g.id]
        : g.kind === 'visit' ? D.MAPS.some(m => m.id === g.id)
        : D.RECIPES.some(r => r.result.id === g.id && r.result.kind
            === (g.kind === 'creature' ? 'creature' : 'potion'));
      if (!ok) bad.push(`${q.id} — 목표가 없는 것을 가리킨다 (${g.kind} ${g.id})`);
    }
    // 보상의 재료도 실제로 있어야 한다
    Object.keys((q.reward || {}).items || {}).forEach(id => {
      if (!D.INGREDIENTS[id]) bad.push(`${q.id} — 보상에 없는 재료 ${id}`);
    });
    // 문구 넷 (이름 · 설명 · 대사). **빠지면 칩에 열쇠가 그대로 뜬다**
    ['_name', '_desc', '_in'].forEach(suf => {
      const k = q.id + suf;
      if (I.t(k) === k) bad.push(`${q.id} — 문구가 없다 (${k})`);
    });
  });
  // **여는 순서가 오름차순이어야 한다.** 큐가 표 순서대로 쌓이므로, 뒤에 있는 것이
  // 더 낮은 조건이면 「나중 이야기가 먼저 온다」
  D.QUESTS.forEach((q, i) => {
    if (i && q.at < D.QUESTS[i - 1].at) {
      bad.push(`${q.id}(${q.at}) 가 앞의 ${D.QUESTS[i - 1].id}(${D.QUESTS[i - 1].at}) 보다 먼저 열린다`);
    }
  });
  add('퀘스트 표가 어긋난다', bad);
}

// ─── 컷씬 (QUEST.md 2-2) ─────────────────────────────────────
//
// **화면은 멀쩡한데 대사만 빠지는 것을 잡는다.** 문구가 없으면 말풍선에 열쇠
// (`c_first_in_1`)가 그대로 뜨고, 표정이 없으면 조용히 기본 얼굴이 된다.
{
  const bad = [];
  const cIds = new Set();
  D.CUTS.forEach(c => {
    if (cIds.has(c.id)) bad.push(`${c.id} — id 가 겹친다`);
    cIds.add(c.id);
    take(c.id, '컷씬');
    if (!c.lines || !c.lines.length) bad.push(`${c.id} — 줄이 없다`);
    if (I.t(c.id + '_title') === c.id + '_title') bad.push(`${c.id} — 제목이 없다 (다시보기 목록에 열쇠가 뜬다)`);
    (c.lines || []).forEach(([spId, mood], i) => {
      const sp = D.speaker(spId);
      if (!sp) { bad.push(`${c.id} ${i + 1}줄 — 없는 인물 ${spId}`); return; }
      // **없는 표정은 조용히 기본 얼굴이 된다** — 오류도 안 나고 화면도 멀쩡하다
      if (mood && !sp.moods[mood]) bad.push(`${c.id} ${i + 1}줄 — ${spId} 에 «${mood}» 표정이 없다`);
      const k = `${c.id}_${i + 1}`;
      if (I.t(k) === k) bad.push(`${c.id} — 대사가 없다 (${k})`);
    });
  });
  // 퀘스트가 가리키는 컷씬이 실제로 있는가
  D.QUESTS.forEach(q => {
    ['in', 'out'].forEach(w => {
      const id = q.cut && q.cut[w];
      if (id && !D.cutOf(id)) bad.push(`${q.id} — 없는 컷씬 ${id} (${w})`);
    });
  });
  add('컷씬 표가 어긋난다', bad);
}

// ─── 비법서 장이 나오는 두 길 (QUEST.md 6장) ──────────────────
//
// 장은 **퀘스트 보상**으로 나오고, 같은 묶음을 **단계 지급(그물)**이 한 단계 늦게
// 한 번 더 준다. 여기서 보는 것은 둘이다:
//
//   ① **136장이 다 나오는가** — 어느 길로도 못 얻는 장이 있으면 그 레시피는
//      게임 안에 있는데 «영영 못 만드는» 것이 된다. 화면에는 `?` 로만 보인다
//   ② **퀘스트가 그물보다 «먼저» 오는가** — 그물이 먼저 주면 퀘스트를 깨도
//      들어오는 장이 0이다. 「받았는데 아무 일도 안 일어난다」가 된다
{
  const bad = [];
  if (D.PAGE_TIERS.length !== D.TIERS.length) {
    bad.push(`단계 지급이 ${D.PAGE_TIERS.length}칸인데 매력 단계는 ${D.TIERS.length}칸이다`);
  }
  const net = new Map();            // 장 → 그물이 주는 매력
  D.PAGE_TIERS.forEach((specs, i) => {
    const at = (D.TIERS[i] || {}).min;
    specs.forEach(sp => {
      const list = D.pagesForSpec(sp);
      if (!list.length) bad.push(`단계 지급에 빈 묶음이 있다 (${sp})`);
      list.forEach(id => { if (!net.has(id)) net.set(id, at); });
    });
  });
  const byQuest = new Set();
  D.QUESTS.forEach(q => {
    ((q.reward || {}).pages || []).forEach(sp => {
      const list = D.pagesForSpec(sp);
      if (!list.length) { bad.push(`${q.id} — 보상의 묶음이 비었다 (${sp})`); return; }
      list.forEach(id => byQuest.add(id));
      // ② 그물이 먼저 오면 퀘스트 보상이 빈손이 된다
      const netAt = net.get(list[0]);
      if (netAt !== undefined && netAt <= q.at) {
        bad.push(`${q.id}(매력 ${q.at}) 보다 그물이 먼저 준다 (${sp} → 매력 ${netAt})`);
      }
    });
  });
  // ① 어느 길로도 못 얻는 장
  const orphan = D.RECIPES.map(r => r.result.id)
    .filter(id => !net.has(id) && !byQuest.has(id));
  if (orphan.length) {
    bad.push(`어느 길로도 못 얻는 장 ${orphan.length}개 (${orphan.slice(0, 4).join(' · ')}…)`);
  }
  add('비법서 배분이 어긋난다', bad);
}

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
