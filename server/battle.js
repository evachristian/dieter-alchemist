// ═══════════════════════════════════════════════════════════════
//  밭 · 전투 규칙 — **서버가 판정한다** (크리처 9단계)
//
//  약탈은 이 게임에서 처음으로 **서버가 판정을 갖는** 자리다.
//  세이브는 지금까지 클라이언트가 통째로 만들어 올렸고 서버는 그것을 보관만 했다.
//  약탈까지 그렇게 하면 "내가 이겼다" 를 공격자가 스스로 선언하는 셈이고,
//  남의 밭에서 무엇이 얼마나 줄어드는지도 공격자가 정하게 된다.
//  그래서 **판정에 필요한 것을 전부 서버가 직접 읽는다.**
//
//  다행히 서버는 이미 다 갖고 있다 — 세이브 안에 `creatures` · `pets` ·
//  `petRoom` · `petField` 가 들어 있다. 클라이언트가 보내는 것은
//  「누구의 밭을 턴다」 하나뿐이고, 전투력·속성·로열티는 서버가 세이브에서 뽑는다.
//
//  ⚠️ **규칙을 손으로 옮겨 적지 않는다.** 크리처 수치는 `data.js` 의 것을 그대로
//  읽는다 (`tools/gencreature.js` 가 만든 표). 서버에 사본을 만들면 축 표를
//  다시 뽑을 때마다 조용히 어긋난다 — 매력 총합(`meta.charm`)을 클라이언트에서
//  받는 것과 반대 방향의 선택인데, 이유가 다르다. 매력은 **게임 규칙**(아우라·
//  크리처 보너스)을 알아야 계산되고, 전투력은 **표에 적힌 수치**를 읽기만 하면 된다.
// ═══════════════════════════════════════════════════════════════
const path = require('path');

// ─── data.js 를 그대로 읽어 온다 ──────────────────────────────
// 브라우저 파일이라 `window` 에 붙인다. 읽고 나면 전역을 도로 치운다 —
// 서버 프로세스에 `window` 가 남아 있으면 다른 코드가 브라우저로 착각한다.
function loadGameData() {
  const had = Object.prototype.hasOwnProperty.call(global, 'window');
  const prev = global.window;
  global.window = {};
  global.localStorage = { getItem: () => null, setItem: () => {} };
  global.document = { querySelectorAll: () => [], documentElement: { setAttribute() {} } };
  try {
    require(path.join(__dirname, '..', 'data.js'));
    return global.window.GameData;
  } finally {
    if (had) global.window = prev; else delete global.window;
    delete global.localStorage;
    delete global.document;
  }
}

const D = loadGameData();

// 크리처 id → 결과물(속성·등급·전투력·생산물). 레시피의 `result` 가 곧 크리처다
const CREATURES = {};
for (const r of D.RECIPES) {
  if (r.result && r.result.kind === 'creature') CREATURES[r.result.id] = r.result;
}

// ─── 수치 (전부 임시값이다) ──────────────────────────────────
//
// **밭은 5일치까지만 자란다.** 8단계의 `PRODUCE_DAYS` 와 같은 값이어야 한다 —
// 「가방으로 오는 몫」과 「밭에 쌓이는 몫」의 상한이 다르면 설명이 두 벌이 된다.
const FARM_DAYS = 5;
// **자정이 아니라 24시간이다.** 서버는 플레이어의 시간대를 모른다.
// 자정으로 자르면 시차만큼 하루가 통째로 어긋나고, 그것을 맞추려면 세이브에
// 시간대를 넣어야 한다 (동기화 충돌거리가 하나 는다). 가방 쪽 생산은 지금처럼
// 기기의 자정에 정산하고, 밭은 마지막으로 자란 때부터 24시간마다 자란다.
const GROW_MS = 24 * 60 * 60 * 1000;

// 약탈권 — 세 개까지 갖고, 여덟 시간에 하나씩 찬다.
// 「하루 세 번」으로 하면 자정 기준이 또 필요하다(위와 같은 이유). 회복형이면
// 시간대를 몰라도 되고, AP 와 읽는 법이 같다.
const RAID_MAX = 3;
const RAID_REGEN_MS = 8 * 60 * 60 * 1000;
// 털린 뒤에는 두 시간 동안 아무도 못 턴다. **코지 게임에서 제일 중요한 수치다** —
// 이것이 없으면 잠든 사이에 밭이 열 번 털려서 아침에 빈 밭을 본다.
const SHIELD_MS = 2 * 60 * 60 * 1000;

const TAKE_RATE = 1 / 3;        // 이겼을 때 가져가는 비율
const TAKE_MAX = 12;            // 한 번에 가져갈 수 있는 최대 개수
const WIN_MIN = 0.10, WIN_MAX = 0.90;   // 확률의 바닥과 천장 — 확실한 승부는 없다
const ATTR_MUL = 1.5;           // 속성 순환에서 이기는 쪽
const LOYALTY_GAIN = 0.3;       // 로열티가 가득이면 전투력 +30%

// ─── 크리처 한 마리의 힘 ─────────────────────────────────────
const combatPower = c => {
  const b = (c && c.combat) || {};
  return (b.atk || 0) + (b.matk || 0) + (b.def || 0) + (b.mdef || 0);
};
// 먹이를 준 크리처는 잘 싸운다 — **공격이든 방어든 같이 오른다.**
// 초안에는 「로열티가 약탈 성공률을 올린다」(공격만)라고 적혀 있었는데,
// 그러면 마이 룸에 두는 크리처에게 먹이를 줄 이유가 하나도 없다.
// 양쪽에 같이 붙이면 설명이 한 줄로 끝난다.
const effPower = (c, loyalty) =>
  combatPower(c) * (1 + LOYALTY_GAIN * Math.min(1, Math.max(0, (loyalty || 0) / D.LOYALTY_MAX)));

// 속성 순환 — 불 ➔ 땅 ➔ 바람 ➔ 물 ➔ 불 · 빛 ↔ 암흑.
// **여기가 순환을 처음 쓰는 자리다** (채집은 「같으면 좋다」만 쓴다).
function attrMul(mine, theirs) {
  if (!mine || !theirs) return 1;
  const a = D.CREATURE_ATTRS.find(x => x.k === mine);
  const b = D.CREATURE_ATTRS.find(x => x.k === theirs);
  if (a && a.beats === theirs) return ATTR_MUL;
  if (b && b.beats === mine) return 1 / ATTR_MUL;
  return 1;
}

// ─── 세이브에서 뽑아 오는 것 ─────────────────────────────────
const owns = (state, id) => Array.isArray(state && state.creatures) && state.creatures.includes(id);
const loyaltyOf = (state, id) => {
  const p = state && state.pets && state.pets[id];
  return p && Number.isFinite(Number(p.loyalty)) ? Number(p.loyalty) : 0;
};
// 장착한 크리처 — **가진 것인지 한 번 거른다.** 재료로 녹였거나(7단계) 초기화한
// 뒤에는 `petRoom` 에 없는 id 가 그대로 남아 있을 수 있다 (CREATURE.md 11장)
function petOf(state, slot) {
  const id = state && state[slot];
  if (!id || !owns(state, id)) return null;
  const c = CREATURES[id];
  if (!c) return null;
  return { id, c, loyalty: loyaltyOf(state, id) };
}
const defender = state => petOf(state, 'petRoom');    // 밭은 애착 크리처가 지킨다
const attacker = state => petOf(state, 'petField');   // 나서는 것은 동행 크리처다

// 지금 무엇을 만드는가 — game.js 의 `producers()` 와 같은 규칙이다
function producers(state) {
  const ids = [...new Set([state && state.petRoom, state && state.petField])];
  return ids
    .filter(id => id && owns(state, id))
    .map(id => CREATURES[id])
    .filter(c => c && c.makes && D.INGREDIENTS[c.makes.id]);
}
// 하루치 { 재료id: 개수 }
function dailyYield(state) {
  const items = {};
  producers(state).forEach(c => { items[c.makes.id] = (items[c.makes.id] || 0) + c.makes.n; });
  return items;
}

// ─── 밭 — 칸(plot) 다섯까지 ──────────────────────────────────
//
// **칸 하나 = 심으면 특수 작물, 비워 두면 크리처의 이삭.** (`FARM.md` 3장)
// 규칙을 하나로 합쳐 두면 「아직 못 심겠는데 밭이 비어서 심심하다」는 자리가 없어진다.
//
//   { crop: null, stash: { walnut: 6 } }              비어 있는 칸 — 이삭이 쌓인다
//   { crop: 'ember_chili', at: …, ready: …, n: 3 }    심은 칸 (3단계에서 쓴다)
//
// 지금(1단계)은 **그릇만 바꾼다.** 심는 길은 아직 없어서 모든 칸이 빈 칸이고,
// 밖에서 보면 예전과 똑같이 이삭 한 무더기로 보인다 (`mergedStash`).
const PLOT_MAX = 5;
const PLOT_START = 2;      // 처음부터 있는 칸. 두 칸은 있어야 「무엇을 먼저 심을까」가 생긴다

const emptyPlot = () => ({ crop: null, stash: {} });
const emptyFarm = now => ({
  plots: Array.from({ length: PLOT_START }, emptyPlot),
  grownAt: now, shieldUntil: 0,
  raids: RAID_MAX, raidAt: now, log: [],
});

const countOf = stash => Object.values(stash || {}).reduce((a, b) => a + b, 0);
// 칸을 통틀어 이삭을 한 무더기로 — 화면과 약탈은 아직 이 눈으로 본다
function mergedStash(farm) {
  const out = {};
  for (const p of (farm && farm.plots) || []) {
    for (const id of Object.keys(p.stash || {})) out[id] = (out[id] || 0) + p.stash[id];
  }
  return out;
}
const farmCount = farm => countOf(mergedStash(farm));

// ⚠️ **옛 모양(`stash` 하나)을 칸으로 옮긴다.** 밭은 서버에 있으므로 세이브의
// `SAVE_VER` 와는 다른 자리에서, 읽을 때마다 한 번 본다.
// **옛 이삭을 버리지 않는다** — 첫 칸에 그대로 담는다 (세이브 마이그레이션의
// 「기존 진행은 지우지 말고 없는 것만 채운다」와 같은 규칙이다).
function migrateFarm(farm) {
  let changed = false;
  if (!Array.isArray(farm.plots)) {
    farm.plots = [{ crop: null, stash: (farm.stash && typeof farm.stash === 'object') ? farm.stash : {} }];
    delete farm.stash;
    changed = true;
  }
  // 칸이 모자라면 채우고, 넘치면 자른다 (자를 때도 이삭은 앞 칸으로 옮긴다)
  while (farm.plots.length < PLOT_START) { farm.plots.push(emptyPlot()); changed = true; }
  while (farm.plots.length > PLOT_MAX) {
    const gone = farm.plots.pop();
    for (const id of Object.keys(gone.stash || {})) {
      farm.plots[0].stash[id] = (farm.plots[0].stash[id] || 0) + gone.stash[id];
    }
    changed = true;
  }
  for (const p of farm.plots) {
    if (!p.stash || typeof p.stash !== 'object') { p.stash = {}; changed = true; }
    if (p.crop === undefined) { p.crop = null; changed = true; }
  }
  return changed;
}

// 흐른 시간만큼 자란다. **밭을 바꿨으면 true 를 돌려준다** (저장할지 판단용)
function grow(farm, state, now) {
  const day = dailyYield(state);
  const per = countOf(day);
  let changed = migrateFarm(farm);

  const elapsed = now - (farm.grownAt || now);
  let days = Math.floor(elapsed / GROW_MS);
  if (days > 0) {
    // **못 받은 날은 버린다.** 남은 나머지(24시간 미만)는 그대로 두고 시계만 당긴다 —
    // `grownAt = now` 로 밀면 아슬아슬하게 하루가 안 찬 시간이 매번 날아간다
    farm.grownAt = now - (elapsed % GROW_MS);
    changed = true;
    if (per > 0) {
      days = Math.min(days, FARM_DAYS);
      // 안 거두면 더 안 자란다 — 상한도 5일치다.
      // **칸 수를 타지 않는다** — 칸이 늘었다고 이삭이 다섯 배가 되면 특수 작물을
      // 심을 이유가 사라진다. 하루치는 그대로 두고 **빈 칸끼리 나눠 갖는다**
      const cap = FARM_DAYS * per;
      for (let i = 0; i < days; i++) {
        if (farmCount(farm) >= cap) break;
        dealToPlots(farm, day);
      }
    }
  }
  // 약탈권도 같이 회복시킨다 (AP 와 같은 방식)
  const tick = Math.floor((now - (farm.raidAt || now)) / RAID_REGEN_MS);
  if (tick > 0 && (farm.raids || 0) < RAID_MAX) {
    farm.raids = Math.min(RAID_MAX, (farm.raids || 0) + tick);
    farm.raidAt = now - ((now - farm.raidAt) % RAID_REGEN_MS);
    changed = true;
  } else if (tick > 0) {
    farm.raidAt = now;                    // 가득이면 시계만 당긴다 (쌓아 두지 않는다)
    changed = true;
  }
  return changed;
}

// 하루치를 **빈 칸들이 돌아가며 하나씩** 나눠 갖는다.
// 빈 칸이 없으면(다 심었으면) 이삭은 안 쌓인다 — 밭을 다 쓰고 있다는 뜻이다
function dealToPlots(farm, day) {
  const open = farm.plots.filter(p => !p.crop);
  if (!open.length) return;
  let k = 0;
  for (const id of Object.keys(day)) {
    for (let n = 0; n < day[id]; n++) {
      const p = open[k++ % open.length];
      p.stash[id] = (p.stash[id] || 0) + 1;
    }
  }
}

// 이삭을 통째로 거둔다 — 거둔 목록을 돌려주고 칸을 비운다
function harvestEars(farm) {
  const items = mergedStash(farm);
  for (const p of farm.plots) p.stash = {};
  return items;
}

// 이겼을 때 실제로 빼 간다 — `loot()` 이 정한 만큼을 **앞 칸부터** 덜어 낸다
function takeFrom(farm, take) {
  for (const id of Object.keys(take)) {
    let left = take[id];
    for (const p of farm.plots) {
      if (left <= 0) break;
      const have = p.stash[id] || 0;
      const n = Math.min(have, left);
      if (n > 0) { p.stash[id] = have - n; left -= n; }
      if (!p.stash[id]) delete p.stash[id];
    }
  }
}

// 이겼을 때 가져가는 것 — 많은 것부터 `TAKE_RATE` 씩, 합쳐서 `TAKE_MAX` 까지
function loot(stash) {
  const take = {};
  let left = TAKE_MAX;
  const ids = Object.keys(stash || {}).sort((a, b) => stash[b] - stash[a] || a.localeCompare(b));
  for (const id of ids) {
    if (left <= 0) break;
    const n = Math.min(left, Math.ceil(stash[id] * TAKE_RATE));
    if (n > 0) { take[id] = n; left -= n; }
  }
  return take;
}

// 판정. `roll` 을 넘기면 그것을 쓴다 (검사에서 확률을 고정하려고)
function resolve(att, def, roll) {
  const mine = att ? effPower(att.c, att.loyalty) * attrMul(att.c.attr, def ? def.c.attr : null) : 0;
  const theirs = def ? effPower(def.c, def.loyalty) : 0;
  // **밭을 안 지키면 거의 털린다.** 그래도 천장이 0.9 라 확실하지는 않다
  const raw = mine + theirs > 0 ? mine / (mine + theirs) : 0.5;
  const chance = Math.min(WIN_MAX, Math.max(WIN_MIN, raw));
  const r = typeof roll === 'number' ? roll : Math.random();
  return { win: r < chance, chance, mine, theirs };
}

module.exports = {
  D, CREATURES,
  FARM_DAYS, GROW_MS, RAID_MAX, RAID_REGEN_MS, SHIELD_MS,
  TAKE_RATE, TAKE_MAX, WIN_MIN, WIN_MAX, ATTR_MUL, LOYALTY_GAIN,
  combatPower, effPower, attrMul,
  owns, loyaltyOf, petOf, defender, attacker,
  producers, dailyYield,
  PLOT_MAX, PLOT_START, emptyPlot, emptyFarm, migrateFarm,
  countOf, mergedStash, farmCount, dealToPlots, harvestEars, takeFrom,
  grow, loot, resolve,
};
