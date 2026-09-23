// 데이터가 스스로 어긋나 있지 않은지 — **조용히 깨지는 것들만** 본다.
//
// 왜 필요한가: `RECIPE_MAP` 은 `RECIPE_MAP[recipeKey(inputs)] = result` 로 만들어진다.
// 같은 조합을 쓰는 레시피가 둘이면 **나중 것이 앞 것을 조용히 덮어쓴다** —
// 오류도 안 나고, 화면도 멀쩡하고, 그냥 **레시피 하나가 사라진다.**
// 크리처를 서른 종으로 늘리면서 새 조합이 서른 개 생기므로 이 검사가 먼저 필요했다.
//
// 사용: node tools/checkdata.js      (종료 코드 0 = 이상 없음)
const fs = require('fs');
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

// ─── 채집지의 «형» (field type) ───────────────────────────────
//
// 형이 미니게임을 정한다. 여기서 어긋나면 **화면에 오류 하나 없이** 그 맵의 채집이
// 통째로 바뀌거나(엉뚱한 게임) 아무 일도 안 일어난다 — 사람 눈으로는 못 찾는다.
{
  const bad = [];
  const mapIds = new Set(D.MAPS.map(m => m.id));
  const typeKeys = new Set(D.FIELD_TYPES.map(t => t.k));
  // 표가 **없는 맵**을 가리키면 그 줄은 영영 안 읽힌다 (맵 id 를 바꿨을 때 생긴다)
  Object.keys(D.MAP_TYPES).forEach(id => {
    if (!mapIds.has(id)) bad.push(`형 표가 없는 맵을 가리킨다 — ${id}`);
    if (!typeKeys.has(D.MAP_TYPES[id])) bad.push(`${id}: 없는 형 ${D.MAP_TYPES[id]}`);
  });
  // 형마다 **이름 문구**가 두 언어에 있는가 (없으면 카드에 열쇠가 그대로 뜬다)
  D.FIELD_TYPES.forEach(t => {
    [t.name, t.tag].filter(Boolean).forEach(k => {
      if (I.t(k) === k) bad.push(`형 ${t.k}: 문구가 없다 (${k})`);
    });
  });
  // ⚠️ **미니게임이 있는 형에는 딱지가 있어야 한다.** 없으면 2분짜리 게임이
  // 카드에 아무 표시 없이 숨어 있다가 AP 를 내고 들어가야 드러난다
  D.FIELD_TYPES.filter(t => t.mini && !t.tag)
    .forEach(t => bad.push(`형 ${t.k}: 미니게임인데 카드 딱지가 없다`));
  // **쓰이는 형만 둔다** — 표에만 있고 아무 맵에도 안 붙은 형은 만들다 만 것이다
  const used = new Set(D.MAPS.map(m => D.mapType(m.id)));
  D.FIELD_TYPES.forEach(t => {
    if (!used.has(t.k)) bad.push(`형 ${t.k}: 쓰는 맵이 하나도 없다`);
  });
  // **미니게임 파일이 실제로 있는가.** `fieldMini` 가 돌려준 이름으로 `window.<X>` 를
  // 찾는데, 파일이 없으면 `gather()` 가 조용히 «그냥 줍기»로 떨어진다 —
  // 미니게임 맵인데 미니게임이 안 뜨는 상태가 오류 없이 만들어진다
  const MINI_FILE = { pumpkin: 'pumpkin.js', walnut: 'walnut.js', rock: 'rock.js', fish: 'fish.js',
                      sparrow: 'sparrow.js', pinwheel: 'pinwheel.js', driller: 'driller.js' };
  // ⚠️⚠️ **미니게임마다 규칙(❔)이 두 언어에 있어야 한다.** 카드의 딱지가 곧
  // 「규칙 보기」 버튼이라, 줄이 없으면 **눌렀는데 「규칙이 아직 안 적혀 있어요」**가
  // 뜬다 — 화면에 오류는 없고 안내만 조용히 비어 있는 종류다.
  // ⚠️ 줄 수를 여기 박지 않는다 — `mh_<형>_1` 이 있는지만 본다.
  // ⚠️⚠️ **「두 언어의 줄 수가 같은가」는 여기서 «잴 수가 없다».** 그렇게 짜 놓고
  // 사보타주(ko 에만 한 줄 늘리기)를 걸어 보니 **그대로 통과했다** — `I18N.t()` 는
  // 없는 열쇠를 **한국어로 떨어뜨려** 주므로, 물어보는 쪽에서는 영어가 빠진 것이
  // 영영 안 보인다. **가르지 못하는 잣대는 무슨 값을 넣어도 통과한다.**
  // 그쪽은 `npm run test:i18n`(`checki18n.js`)이 사전을 «직접 읽어» 잡는다
  // (같은 사보타주로 확인했다 — 「영어에 없는 UI 문자열: mh_rock_6」)
  // ⚠️ 여기서 `STRINGS` 를 직접 짚지 않는다 — i18n.js 안의 `const` 라 `window` 에
  // 안 붙는다 (「전역은 이름으로 찾는다」와 같은 자리다). 언어를 실제로 바꿔 가며
  // `I.t()` 로 묻는다: 없는 열쇠는 열쇠를 그대로 돌려주므로 그것이 곧 「없다」다.
  // 12 는 `game.js` 의 `MH_MAX` 와 같은 값이다 (그보다 길게 써도 화면에 안 뜬다)
  const mhCount = (kind) => {
    let n = 0;
    while (n < 12 && I.t(`mh_${kind}_${n + 1}`) !== `mh_${kind}_${n + 1}`) n++;
    return n;
  };
  D.FIELD_TYPES.filter(t => t.mini).forEach(t => {
    const n = mhCount(t.mini);
    if (!n) bad.push(`형 ${t.k}: ❔ 규칙(mh_${t.mini}_1)이 한 줄도 없다 — 딱지를 눌러도 빈 시트다`);
    // ⚠️⚠️ **한 판 상한을 규칙에 «숫자로 박지» 않는다.** 「최대 18개」라고 적어 두었다가
    // `REWARD_PER` 를 100 → 55 로 내린 날 **화면에 적힌 값과 받는 개수가 갈렸고**,
    // 호두밭은 상한이 20인데 규칙에 18이라고 적혀 있었다 (아무도 안 보고 있었다).
    // 수치의 원본은 그 게임의 모듈 하나뿐이라(`miniHelpVars`) `{max}` 로 적어야 한다.
    // ⚠️ `I.t()` 는 **값을 안 넘기면 자리표시자를 그대로** 돌려준다 — 그래서 여기서 보인다.
    // ⚠️ `{per}` 는 «안» 본다: 바위산처럼 요율이 1이면 「깬 줄 하나가 재료 하나」로
    //    쓰는 것이 맞는 글이라, 그것까지 요구하면 멀쩡한 줄을 틀렸다고 하게 된다
    const raw = [];
    for (let i = 1; i <= n; i++) raw.push(I.t(`mh_${t.mini}_${i}`));
    if (n && !/\{max\}/.test(raw.join(' '))) {
      bad.push(`형 ${t.k}: ❔ 규칙에 한 판 상한이 «숫자로 박혀» 있다 — {max} 로 적어야 값이 안 갈린다`);
    }
    // ⚠️⚠️ **지난 기록의 «단위»도 형마다 있어야 한다** (`mr_unit_<형>`).
    // 점수의 뜻이 게임마다 달라서(호두 «개» · 호박 «초» · 바위산 «줄» · 낚시 «마리» ·
    // 참새 «점» · 바람개비 «개» · 드릴러 «m») 한 낱말로 못 적는다 — 없으면
    // `T()` 가 **열쇠를 그대로** 돌려줘 기록 줄에 「mr_unit_rock」 이 뜬다.
    // 오류는 안 나고 **글자만 조용히 깨진다** (❔ 규칙에서 배운 것과 같은 자리다).
    // ⚠️ `{n}` 이 있는지도 같이 본다 — 자리표시자가 없으면 숫자가 통째로 사라져
    //    「줄」 한 글자만 남는다. `I.t()` 는 값을 안 넘기면 자리표시자를 그대로 준다
    const unit = I.t(`mr_unit_${t.mini}`);
    if (unit === `mr_unit_${t.mini}`) {
      bad.push(`형 ${t.k}: 지난 기록의 단위(mr_unit_${t.mini})가 없다 — 기록 줄에 열쇠가 그대로 뜬다`);
    } else if (!/\{n\}/.test(unit)) {
      bad.push(`형 ${t.k}: 지난 기록의 단위(mr_unit_${t.mini})에 {n} 이 없다 — 점수가 통째로 안 보인다`);
    }
    const f = MINI_FILE[t.mini];
    if (!f) bad.push(`형 ${t.k}: 미니게임 «${t.mini}» 의 파일을 모른다`);
    else if (!fs.existsSync(path.join(ROOT, f))) bad.push(`형 ${t.k}: ${f} 가 없다`);
    else if (!fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes(f)) {
      bad.push(`형 ${t.k}: index.html 이 ${f} 를 안 읽는다`);
    } else {
      // ⚠️⚠️ **끝낼 때 «점수»를 같이 돌려줘야 한다** — 📄 지난 기록이 그것을 적는다.
      // 빠뜨리면 `miniLogAdd` 가 0 으로 적어 **모든 줄이 「0개」로 쌓인다** — 오류도
      // 안 나고 기록만 조용히 거짓말을 한다 (호박 밭이 실제로 그랬다).
      // ⚠️ 값이 아니라 «모양»을 본다: 값을 베끼면 검사기만 옛 것으로 남지만,
      //    모양은 그 파일 하나가 원본이라 갈릴 데가 없다
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const end = src.match(/cb\(\{[^}]*\}\)/);
      if (!end) bad.push(`형 ${t.k}: ${f} 가 끝날 때 무엇을 돌려주는지 못 찾겠다`);
      else if (!/\bscore\b/.test(end[0])) {
        bad.push(`형 ${t.k}: ${f} 가 끝낼 때 score 를 안 돌려준다 — 지난 기록이 전부 0 으로 쌓인다`);
      }
    }
  });
  // ⚠️⚠️ **튜토리얼이 가리키는 맵은 반드시 «평범한 곳»이어야 한다.**
  // 튜토리얼 9단계는 「가서 두 개 주워 오세요」인데, 그 맵이 미니게임 맵이 되면
  // 버튼을 눌러도 **2분짜리 게임이 뜨고 튜토리얼은 그 자리에서 멈춘다** —
  // 새 플레이어가 게임을 시작조차 못 하는 종류다. 규칙을 고치다 `p_hill` 이
  // 과수원으로 걸리는 순간 조용히 그렇게 된다.
  // 단계표는 `tutorial.js` 에 **써진 것**을 그대로 읽는다 (`checktuttext` 와 같은 방식)
  {
    const tut = fs.readFileSync(path.join(ROOT, 'tutorial.js'), 'utf8');
    const spots = [...tut.matchAll(/data-spot="([a-z0-9_]+)"/g)].map(m => m[1]);
    if (!spots.length) bad.push('튜토리얼이 가리키는 채집 맵을 못 찾았다 — 선택자가 바뀌었으면 여기도 고칠 것');
    [...new Set(spots)].forEach(id => {
      if (D.fieldMini(id)) {
        bad.push(`튜토리얼이 미니게임 맵을 가리킨다 — ${id} (${D.mapType(id)}) · 새 플레이어가 거기서 갇힌다`);
      }
    });
  }
  add('채집지의 형이 어긋난다', bad);
}

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
  const kinds = ['brew', 'creature', 'drink', 'visit', 'deliver', 'charm', 'farm', 'kitchen',
                 'village', 'keyword', 'bond'];
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
        : g.kind === 'village' ? D.VILLAGES.some(v => v.id === g.id)
        : g.kind === 'keyword' ? D.KEYWORDS.some(k => k.id === g.id)
        : D.RECIPES.some(r => r.result.id === g.id && r.result.kind
            === (g.kind === 'creature' ? 'creature' : 'potion'));
      if (!ok) bad.push(`${q.id} — 목표가 없는 것을 가리킨다 (${g.kind} ${g.id})`);
    }
    // **여는 조건이 가리키는 것도 실제로 있어야 한다** (2막부터의 `need`).
    // ⚠️ 오타 하나면 조건이 «영영 안 차서» 그 퀘스트부터 뒷이야기가 통째로 안 온다 —
    // 화면에는 아무 오류도 안 뜨고 그냥 칩이 안 뜰 뿐이라 사람 눈으로는 못 찾는다
    {
      const nd = q.need || {};
      if (nd.kw && !D.KEYWORDS.some(k => k.id === nd.kw)) bad.push(`${q.id} — 없는 키워드 ${nd.kw}`);
      if (nd.village && !D.VILLAGES.some(v => v.id === nd.village)) bad.push(`${q.id} — 없는 마을 ${nd.village}`);
      if (nd.cut && !D.cutOf(nd.cut)) bad.push(`${q.id} — 없는 컷씬 ${nd.cut}`);
    }
    // **보상의 공방 단계**가 그림에 있는 범위인가 (없으면 올려도 화면이 안 바뀐다)
    if ((q.reward || {}).room !== undefined) {
      const n = q.reward.room;
      if (!(n >= 1 && n <= 5)) bad.push(`${q.id} — 공방 단계 보상이 ${n} 이다 (1~5)`);
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
  // ─ 강조 표시는 **두 언어에 같은 수**가 있어야 한다 ─
  //
  // 대사 안에서 낱말 하나를 강조하는 표시다 — 한국어 `«…»` · 영어 `*…*`
  // (「저는 공주님의 요리사 «클레멘» 입니다」 · 「It was *cut*.」).
  // 한쪽에만 넣으면 **그 언어에서만 금색으로 뜨고** 다른 쪽은 밋밋해지는데,
  // 영어로 바꿔 그 컷씬까지 들어가 보기 전에는 아무도 모른다
  // (실제로 `c_spire_in_3` 이 한국어에만 있었다).
  // ⚠️ 짝이 안 맞는 쪽 «수»만 본다 — 어느 낱말을 강조할지는 번역의 몫이다
  {
    const hi = (s) => (String(s).match(/«[^»]+»|\*[^*\s][^*]*\*/g) || []).length;
    const was = I.getLang();
    let looked = 0, marked = 0;
    const per = { ko: {}, en: {} };
    ['ko', 'en'].forEach(l => {
      I.setLang(l);
      D.CUTS.forEach(c => (c.lines || []).forEach((_, i) => {
        const k = `${c.id}_${i + 1}`;
        per[l][k] = hi(I.t(k));
      }));
    });
    I.setLang(was);
    Object.keys(per.ko).forEach(k => {
      looked++;
      if (per.ko[k]) marked++;
      if (per.ko[k] !== per.en[k])
        bad.push(`${k} — 강조 표시가 ko ${per.ko[k]}개 · en ${per.en[k]}개 (한 언어에서만 강조된다)`);
    });
    // 아무것도 안 잰 0건은 통과가 아니다 — 표시를 통째로 지우면 여기서 걸린다
    if (!looked) bad.push('컷씬 대사를 한 줄도 못 읽었다');
    else if (!marked) bad.push('강조 표시가 있는 줄이 하나도 없다 — 표시를 읽는 자리가 죽었는가');
  }
  // 퀘스트가 가리키는 컷씬이 실제로 있는가 ·
  // **주는 이가 그 컷씬에 나오는가** — 부탁한 얼굴과 보상을 주는 얼굴이 다르면
  // 누가 시킨 일이었는지가 흐려진다. 퀘스트 칩·시트에 뜨는 초상화가 `npc` 라
  // 컷씬에 그가 없으면 **눌렀더니 다른 사람이 나온다.**
  // ⚠️ 첫 퀘스트를 클레멘 → 요정 대모로 옮겼을 때 `c_meet_out` 이 실제로 이렇게
  // 어긋났다 (in 은 요정 대모인데 out 은 공주·클레멘뿐이었다)
  let cutPairs = 0;
  D.QUESTS.forEach(q => {
    ['in', 'out'].forEach(w => {
      const id = q.cut && q.cut[w];
      if (!id) return;
      const c = D.cutOf(id);
      if (!c) { bad.push(`${q.id} — 없는 컷씬 ${id} (${w})`); return; }
      cutPairs++;
      if (!(c.lines || []).some(([sp]) => sp === q.npc)) {
        const who = (D.speaker(q.npc) || {}).name || q.npc;
        const there = [...new Set((c.lines || []).map(l => (D.speaker(l[0]) || {}).name || l[0]))];
        bad.push(`${q.id} — 주는 이(${who})가 ${w} 컷씬 ${id} 에 한 줄도 없다 (나오는 사람: ${there.join(' · ')})`);
      }
    });
  });
  // 아무것도 안 잰 0건은 통과가 아니다
  if (!cutPairs) bad.push('퀘스트에 붙은 컷씬이 하나도 없다 — 주는 이를 한 번도 안 봤다');
  add('컷씬 표가 어긋난다', bad);
}

// ─── 비법서 장이 나오는 두 길 (QUEST.md 6장) ──────────────────
//
// 장은 **퀘스트가 고른 한 장**과 **조합이 흘리는 한 장**, 둘로만 나온다.
// ⚠️ **예전 검사는 `reward.pages`(등급 등분)를 훑고 있었다.** 그 칸이 없어지면
// 반복문이 0번 돌아 **아무것도 안 재고 통과한다** — 0건이 「통과」가 아니라
// 「한 번도 안 쟀다」가 되는, 이 저장소에서 몇 번씩 난 그 사고다.
// 그래서 **몇 개를 쟀는지를 통과할 때도 낸다.**
{
  const bad = [];
  if (D.PAGE_TIERS.length !== D.TIERS.length) {
    bad.push(`천장 표가 ${D.PAGE_TIERS.length}칸인데 매력 단계는 ${D.TIERS.length}칸이다`);
  }
  const RES = new Map(D.RECIPES.map(r => [r.result.id, r]));

  // ① **퀘스트는 장을 «한 장»만 준다** — 열일곱이 다, 서로 겹치지 않게
  const seen = new Map();
  let picked = 0;
  D.QUESTS.forEach(q => {
    const r = q.reward || {};
    if (r.pages) bad.push(`${q.id} — 아직 «여러 장»(reward.pages)을 준다. 한 장(reward.page)이어야 한다`);
    if (!r.page) { bad.push(`${q.id} — 주는 장이 없다 (reward.page)`); return; }
    picked++;
    if (!RES.has(r.page)) { bad.push(`${q.id} — 없는 레시피의 장이다 (${r.page})`); return; }
    if (seen.has(r.page)) bad.push(`${q.id} 와 ${seen.get(r.page)} 가 같은 장을 준다 (${r.page}) — 한쪽은 빈손이 된다`);
    seen.set(r.page, q.id);
  });

  // ② **그 시점에 «만들 수 있는» 장이다** — 재료가 아직 안 열린 지대에서만
  //    나오면 받아도 못 만드는 죽은 장이다. 크리처가 상급 물약의 재료라서
  //    «닫힘»까지 돌린다 (만들 수 있는 것이 또 재료가 된다).
  //    ⚠️ 매력 100(여신)에서도 만들 수 있는 것은 57장뿐이다 — 맵이 매력 510 까지
  //    열리기 때문이다. 그래서 후반 퀘스트도 중급까지만 줄 수 있다
  const CROPS = new Set(D.FARM_CROPS.map(c => c.id));
  const makeable = at => {
    const have = new Set();
    D.MAPS.forEach(m => {
      if ((m.unlock || 0) > at) return;
      (m.pool || []).forEach(i => have.add(i));
      if (m.special) have.add(m.special);
    });
    if (at >= 100) CROPS.forEach(c => have.add(c));      // 밭은 여신부터
    const ok = new Set();
    for (let grew = true; grew;) {
      grew = false;
      D.RECIPES.forEach(r => {
        if (ok.has(r.result.id)) return;
        if (!r.inputs.every(i => have.has(i))) return;
        ok.add(r.result.id); have.add(r.result.id); grew = true;
      });
    }
    return ok;
  };
  let checked = 0;
  D.QUESTS.forEach(q => {
    const id = (q.reward || {}).page;
    if (!id || !RES.has(id)) return;
    checked++;
    if (!makeable(q.at).has(id)) {
      bad.push(`${q.id}(매력 ${q.at}) 가 주는 「${RES.get(id).result.name}」 은 그 매력에서 못 만든다`
        + ` — 재료가 아직 안 열린 지대에서만 난다`);
    }
  });

  // ③ **흘림이 136장을 다 덮는다** — 어느 길로도 못 얻는 장이 있으면 그 레시피는
  //    게임 안에 있는데 «영영 못 만드는» 것이 된다. 화면에는 `?` 로만 보인다
  const flow = D.pageFlow();
  const ids = flow.map(p => p.id);
  if (new Set(ids).size !== ids.length) bad.push('흘림 차례에 같은 장이 두 번 있다');
  const miss = D.RECIPES.map(r => r.result.id).filter(id => !ids.includes(id));
  if (miss.length) bad.push(`흘림이 못 닿는 장 ${miss.length}개 (${miss.slice(0, 4).join(' · ')}…)`);

  // ④ **퀘스트 몫은 흘림의 «맨 뒤»다** — 안 그러면 흘림이 먼저 건네 버려
  //    퀘스트를 깼는데 빈손이 된다 (「받았는데 아무 일도 안 일어난다」)
  const firstLate = flow.findIndex(p => seen.has(p.id));
  const lateBlock = firstLate >= 0 && flow.slice(firstLate).every(p => seen.has(p.id));
  if (firstLate < 0) bad.push('흘림 차례에 퀘스트 몫이 하나도 없다 — 무엇을 잰 것인지 알 수 없다');
  else if (!lateBlock) bad.push('퀘스트 몫이 흘림의 맨 뒤에 안 몰려 있다 — 흘림이 먼저 주면 퀘스트가 빈손이 된다');

  // ⑤ **시작 밑천은 천장 0단계 그대로다** — 첫 퀘스트가 「생기 물약을 만들어라」라
  //    그 장이 없으면 시작조차 못 한다
  const starter = (D.PAGE_TIERS[0] || []).reduce((a, sp) => a.concat(D.pagesForSpec(sp)), []);
  if (!starter.includes('vitality')) bad.push('시작 밑천에 「생기 물약」이 없다 — 첫 퀘스트를 깰 수가 없다');

  add('비법서 배분이 어긋난다', bad);
  if (!bad.length) {
    console.log(`   비법서 — 퀘스트 ${picked}장(만들 수 있는지 ${checked}장 잼)`
      + ` · 흘림 ${flow.length}장(조합 ${D.PAGE_DRIP}회에 한 장 · 맨 뒤 ${flow.length - firstLate}장이 퀘스트 몫)`);
  }
}

// ─── 건물 «안» 그림 ───────────────────────────────────────────
// ⚠️ `Village.interior()` 는 `spot.shape` 로 방을 고르고 **모르는 모양이면 `house` 로
//   조용히 떨어진다.** 그래서 오타 하나에 「낡은 나루터」가 여관 거실이 되는데
//   화면에는 오류가 하나도 안 뜬다 — 실제로 여덟 곳이 그 상태였다.
// ⚠️ **목록을 손으로 적지 않는다** — `Village.shapes` 를 그대로 읽는다
//   (`Portrait.hairs` 와 같은 규칙이다)
{
  require(path.join(ROOT, 'village.js'));
  const V = global.window.Village;
  const bad = [];
  if (!V || !Array.isArray(V.shapes) || !V.shapes.length) {
    bad.push('village.js 가 `shapes` 를 안 내놓는다 — 방 모양을 한 가지도 잴 수가 없다');
  } else {
    const used = new Map();
    for (const v of D.VILLAGES) for (const s of (v.spots || [])) {
      if (!used.has(s.shape)) used.set(s.shape, []);
      used.get(s.shape).push(`${s.id}(${s.name})`);
    }
    for (const [sh, ids] of used) {
      if (!sh) bad.push(`모양이 아예 없다 — ${ids.join(' · ')}`);
      else if (!V.shapes.includes(sh)) bad.push(`없는 모양 «${sh}» — ${ids.join(' · ')}`);
    }
    // 반대쪽도 본다 — 아무도 안 쓰는 방은 «그려 놓고 영영 못 보는» 그림이다
    V.shapes.forEach(sh => { if (!used.has(sh)) bad.push(`«${sh}» 방을 쓰는 건물이 하나도 없다`); });
    if (!bad.length) {
      console.log(`   건물 안 — 모양 ${V.shapes.length}가지를 건물 ${[...used.values()]
        .reduce((a, x) => a + x.length, 0)}곳이 다 쓴다`);
    }
  }
  add('건물 안 그림이 어긋난다', bad);
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
