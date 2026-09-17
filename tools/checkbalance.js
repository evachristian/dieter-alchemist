// ═══════════════════════════════════════════════════════════════
//  밸런스 검사 — **수치끼리의 약속**을 못 박는다
//
//  이 게임의 수치는 혼자 서 있지 않다. 어떤 값은 다른 값보다 반드시 작아야 하고,
//  어떤 값들은 서로 같아야 한다. 그런데 그 관계는 **주석에만** 적혀 있어서,
//  나중에 한쪽만 고치면 조용히 깨진다 — 화면에는 아무 오류도 안 뜬다.
//
//  실제로 문서에 이렇게 적혀 있었다:
//    · 「실패 보상이 조합 값을 넘으면 일부러 실패해서 AP 를 무한히 번다」 (CLAUDE.md)
//    · 「PRODUCE_DAYS 와 FARM_DAYS 는 같은 값이어야 한다」            (battle.js)
//    · 「밭 물약 여섯의 값이 일부러 같다」                              (FARM.md 4단계)
//  셋 다 사람이 기억해야만 지켜지던 약속이다. 여기서 기계가 본다.
//
//  ⚠️ **수치를 여기에 옮겨 적지 않는다.** `data.js` · `game.js` · `battle.js` 에
//  써진 것을 읽어서 견준다. 사본을 만들면 이 파일만 옛 값으로 남는다.
//
//    node tools/checkbalance.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const B = require('../server/battle.js');
const D = B.D;

const ROOT = path.join(__dirname, '..');
const out = [];
const ok = (name, pass, detail) => out.push({ name, pass: !!pass, detail });
// 레시피 하나에 드는 AP (채집 + 조합). 아래 두 블록이 같은 식을 쓴다 —
// 사본을 두면 지대별 AP 를 고칠 때 한쪽만 고치게 된다
let apOfR;

// game.js 는 브라우저 파일이라 통째로 못 읽는다 — **써진 숫자를 그대로 본다.**
// (`checkdata` 가 생성 구간을 파일에서 읽는 것과 같은 방식이다)
const GAME = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const numIn = (re, what) => {
  const m = GAME.match(re);
  if (!m) throw new Error(`game.js 에서 ${what} 를 못 찾았다 — 이름이 바뀌었으면 여기도 고칠 것`);
  return Number(m[1]);
};

// ─── ① AP — 조합을 돌려서 AP 를 버는 고리가 없는가 ────────────
//
// 현자의 결정은 **AP 와 1:1 로 바꿀 수 있다**(`chargeCost / cap`). 그러니 조합
// 한 번에 돌려받는 결정이 조합 값(`cost.brew`)보다 크거나 같으면 **조합을 돌리는
// 것 자체가 AP 를 버는 방법**이 되고, 게임 전체의 시간 제한이 사라진다.
//
// ⚠️ 예전에는 이 자리가 **실패** 보상이었다. 비법서(장이 없으면 애초에 조합이
// 안 만들어진다)가 들어오면서 실패가 사라졌고, 결정은 **성공**에서 나온다.
{
  const { brewReward, failReward, cost, chargeCost, cap } = D.ENERGY;
  ok('AP 무한 고리', brewReward < cost.brew,
    `조합 보상 ${brewReward} < 조합 ${cost.brew} 이어야 한다 (같기만 해도 무한이다)`);
  ok('AP 무한 고리 (실패 쪽)', failReward < cost.brew,
    `실패 보상 ${failReward} < 조합 ${cost.brew} — 지금은 안 닿는 갈래지만 남겨 둔다`);
  ok('AP 충전 값', chargeCost >= cap,
    `가득 채우는 값 ${chargeCost} 이 AP 상한 ${cap} 보다 작으면 결정 하나로 AP 를 두 개 사는 셈이다`);
  // **결정이 들어오긴 하는가.** 유일한 수급원이 조합이라, 0 이면 AP 충전도
  // 밭 칸도 영영 못 연다 — 실패 보상을 없앴을 때 실제로 이 구멍이 생겼다
  ok('현자의 결정이 들어오는가', brewReward > 0,
    `조합 보상 ${brewReward} — 0 이면 밭 칸(${D.PLOT_COST.join('·')})을 살 길이 없다`);
}

// ─── ①-2. 지대별 채집 AP ─────────────────────────────────────
//
// 앞은 싸고 뒤는 비싸야 한다. 뒤 지대가 더 싸면 앞 지대를 지날 이유가 없어진다.
{
  const aps = D.ZONES.map(z => D.zoneAp(z.id));
  const up = aps.every((v, i) => i === 0 || v >= aps[i - 1]);
  ok('지대 AP 가 오름차순인가', up,
    D.ZONES.map((z, i) => `${z.name} ${aps[i]}`).join(' · '));
  // 제일 비싼 지대라도 **하루에 한 병은 만들 수 있어야** 한다. 못 만들면
  // 그 지대는 열려도 못 쓰는 땅이다 (재료가 제일 많이 드는 레시피로 잰다)
  const maxIn = Math.max(...D.RECIPES.map(r => (r.inputs || []).length));
  const worst = Math.max(...aps) * maxIn + D.ENERGY.cost.brew;
  const dayCap = D.ENERGY.cap + (D.TIERS.length - 1) * D.ENERGY.capPerTier;
  ok('제일 비싼 물약도 하루에 되는가', worst <= dayCap,
    `재료 ${maxIn}개 × ${Math.max(...aps)} + 조합 ${D.ENERGY.cost.brew} = ${worst} AP · 여신의 하루 ${dayCap} AP`);
}

// ─── ② 밭 — 상한과 바닥 ──────────────────────────────────────
{
  const produceDays = numIn(/const PRODUCE_DAYS = (\d+)/, 'PRODUCE_DAYS');
  ok('방치 상한이 한 벌인가', produceDays === B.FARM_DAYS,
    `가방 ${produceDays}일 · 밭 ${B.FARM_DAYS}일 — 다르면 「며칠치까지 쌓이나」의 답이 두 개가 된다`);

  // **바닥이 상한과 같아지면 약탈이 사라진다.** 하루치를 남기는 규칙(RAID_FLOOR_DAYS)이
  // 5일 상한에 닿으면 아무도 아무것도 못 가져간다 — 방어대·부대가 통째로 장식이 된다
  ok('약탈이 존재하는가', B.RAID_FLOOR_DAYS < B.FARM_DAYS,
    `남기는 ${B.RAID_FLOOR_DAYS}일 < 쌓이는 ${B.FARM_DAYS}일 이어야 가져갈 것이 남는다`);
  // 반대쪽 — 바닥이 0 이면 며칠 못 들어온 사람이 바닥까지 긁힌다 (시뮬레이션에서 확인했다)
  ok('빈 밭을 막는가', B.RAID_FLOOR_DAYS >= 1,
    `하루치는 남겨야 한다 (지금 ${B.RAID_FLOOR_DAYS}일) — 0 이면 생산의 42% 를 잃는다`);

  // 방패가 하루에 몇 번까지 털리게 두는가
  const perDay = Math.floor(24 * 3600e3 / B.SHIELD_MS);
  ok('하루 피습 상한', perDay <= 6,
    `방패 ${B.SHIELD_MS / 3600e3}시간 → 하루 최대 ${perDay}번. 여섯 번을 넘으면 자는 사이에 바닥난다`);
}

// ─── ③ 밭 물약 여섯의 값이 같은가 ────────────────────────────
//
// **일부러 같게 두었다** (`FARM.md` 4단계). 하나가 더 좋으면 나머지 다섯 작물이
// 죽은 콘텐츠가 되고, 그러면 특수 작물을 여섯 종 만든 뜻이 사라진다.
{
  const hf = D.RECIPES.filter(r => r.result && r.result.kind === 'potion'
    && D.FARM_CROPS.some(c => (r.inputs || []).includes(c.id))).map(r => r.result);
  const same = k => new Set(hf.map(r => r[k] || 0)).size === 1;
  ok('밭 물약 여섯이 같은 값', hf.length === D.FARM_CROPS.length && same('charm') && same('beauty'),
    `${hf.length}종 · 매력 ${[...new Set(hf.map(r => r.charm))].join('/')}`
    + ` · 비주얼 ${[...new Set(hf.map(r => r.beauty))].join('/')}`);
}

// ─── ③-2 히든 재료의 천장 — 바닥이지 지급이 아니다 (외부 비평 2.4) ─────
//
// `pity` 는 «연달아 헛걸음» 몇 번이면 다음은 반드시인가다. 기대값(1 ÷ rate)보다
// 짧아야 천장이고(1 을 넘으면 거의 안 닿는 장식이다), 너무 짧으면 확률이 뜻을 잃고
// 「N 번 누르면 준다」가 된다. 그 사이(0.3 ~ 0.8)에 둔다. 귀할수록 천장도 높아야 한다
{
  const tiers = D.SPECIAL_TIERS.slice().sort((a, b) => a.rate - b.rate);   // 귀한 → 흔한
  tiers.forEach(t => {
    const k = (t.rate || 0) * (t.pity || 0);
    ok(`히든 천장 · ${t.label}`, t.pity > 0 && k >= 0.3 && k <= 0.8,
      `rate ${t.rate} × pity ${t.pity} = ${k.toFixed(2)} (0.3~0.8)`);
  });
  const asc = tiers.every((t, i) => i === 0 || t.pity <= tiers[i - 1].pity);
  ok('히든 천장은 귀할수록 높다', asc, tiers.map(t => `${t.label} ${t.pity}`).join(' ≥ '));
}

// ─── ④ 리그 — 맨 위가 닿을 수 있는 자리인가 ──────────────────
//
// 주간 점수는 **그 주에 오른 매력**이다 (`addWeekScore`). 그러니 한 주에 낼 수 있는
// 최고 점수는 **AP 로 정해진다** — 일주일치 AP 를 가장 매력 효율이 좋은 물약에
// 전부 쏟았을 때가 상한이다. 맨 위 리그의 1위 목표가 그것을 넘으면
// **아무리 잘해도 못 올라가는 리그**가 되고, 사다리 끝이 장식이 된다.
{
  const E = D.ENERGY;
  // ⚠️ **재료마다 값이 다르다.** 지대별 채집 AP 가 들어오면서 「재료 수 × 10」으로는
  // 못 잰다. 그리고 **밭 작물은 채집으로 얻는 것이 아니라** 심어서 기르는 것이라
  // 채집 AP 를 한 푼도 안 낸다 — 옛 식은 여기에 10 씩을 매겨 상한을 낮게 잡고 있었다
  const cropIds = new Set((D.FARM_CROPS || []).map(c => c.id));
  // ⚠️ **왕자의 호위가 위험 지대의 값을 깎는다** (`BOND_GIVES.guard`).
  // 그 몫을 안 빼면 상한을 실제보다 낮게 잡는다 — 「맨 위 리그에 닿는가」가
  // 조용히 헐거워지는 자리다. **제일 유리한 쪽(각별한 사이)으로 잰다**
  const G = D.BOND_GIVES.guard;
  const cut = G.v[G.v.length - 1];
  const floorAp = D.zoneAp('plain');
  const zAp = z => Math.max(floorAp, D.zoneAp(z) - (G.zones.indexOf(z) >= 0 ? cut : 0));
  apOfR = r => (r.inputs || []).reduce((sum, id) => {
    if (cropIds.has(id)) return sum;                       // 밭에서 기른다
    const m = D.MAPS.find(x => (x.pool || []).includes(id) || x.special === id);
    return sum + (m ? zAp(m.zone) : E.cost.gather);
  }, 0) + E.cost.brew;
  const apOf = apOfR;
  const eff = D.RECIPES
    .filter(r => r.result && r.result.kind === 'potion' && (r.result.charm || 0) > 0)
    .map(r => {
      const ap = apOf(r);
      return { id: r.result.id, charm: r.result.charm, ap, per: r.result.charm / ap };
    })
    .sort((a, b) => b.per - a.per);
  // 맨 위 리그에 있는 사람은 **여신**이다 — 그 사람의 상한으로 잰다.
  // `dailyFill` 고정값으로 재면 상한이 매력 단계로 늘어난 몫을 통째로 빠뜨린다
  const weekAP = 7 * (E.cap + (D.TIERS.length - 1) * E.capPerTier);
  const ceiling = Math.floor(weekAP / eff[0].ap) * eff[0].charm;

  const paceTop = numIn(/function leaguePace\(i\) \{ return (\d+)/, 'leaguePace 의 시작값')
    + (D.LEAGUES.length - 1) * Number(GAME.match(/function leaguePace\(i\) \{ return \d+ \+ i \* (\d+)/)[1]);

  ok('맨 위 리그에 닿는가', paceTop < ceiling,
    `한 주 상한 ${ceiling}점 (${eff[0].id} 만 반복) · 맨 위 리그 1위 목표 ${paceTop}점`
    + ` — 여유 ${Math.round((1 - paceTop / ceiling) * 100)}%`);
  // 너무 헐렁해도 안 된다 — 절반도 안 쓰고 꼭대기면 사다리가 32주짜리 산책이 된다
  ok('맨 위 리그가 헐겁지 않은가', paceTop > ceiling * 0.4,
    `맨 위 목표가 상한의 ${Math.round(paceTop / ceiling * 100)}% (40% 이상이어야 한다)`);
}

// ─── ④-2 채집 미니게임 — **셋이 같은 자리에 있는가** ───────
//
// 미니게임은 「AP 한 번에 2분을 내고 재료를 많이 받는」 거래다. 그러니 «한 판 최대»가
// 크게 다르면 **후한 쪽 맵만 돌게 되고** 나머지 맵은 죽은 콘텐츠가 된다
// (밭 물약 여섯을 같은 값으로 둔 것과 같은 이유다).
//
// ⚠️ **수치를 여기에 옮겨 적지 않는다** — 게임 파일에 써진 상수를 그대로 읽는다.
// ⚠️ **「한 판 최대」를 내는 식은 게임마다 다르다** (버틴 시간 · 판의 크기 · 상한).
// 그래서 게임마다 한 줄씩 여기 적고, **형 표와 이 목록이 어긋나면 실패시킨다** —
// 새 미니게임을 붙이면서 밸런스를 안 보고 지나갈 수 없게 하는 자리다.
{
  const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const num = (s, re, what) => {
    const m = s.match(re);
    if (!m) throw new Error(`${what} 를 못 찾았다 — 이름이 바뀌었으면 여기도 고칠 것`);
    return Number(m[1]);
  };
  const dur = s => num(s, /const DUR_MS\s*=\s*(\d+)/, 'DUR_MS');

  const GAMES = {
    // 호박 밭 — 2분을 `REWARD_EVERY` 마다 하나씩, 끝까지 버티면 2개 더
    pumpkin: () => {
      const f = src('pumpkin.js');
      const every = num(f, /const REWARD_EVERY\s*=\s*(\d+)/, 'REWARD_EVERY');
      return { name: '호박 밭', dur: dur(f), max: Math.floor(dur(f) / every) + 2 };
    },
    // 호두밭 — 호두 `REWARD_PER` 개마다 하나씩, 판을 다 지워도 `REWARD_MAX` 까지
    walnut: () => {
      const f = src('walnut.js');
      const per = num(f, /const REWARD_PER\s*=\s*(\d+)/, 'REWARD_PER');
      const cap = num(f, /const REWARD_MAX\s*=\s*(\d+)/, 'REWARD_MAX');
      const cols = num(f, /const COLS\s*=\s*(\d+)/, 'COLS');
      const rows = num(f, /const ROWS\s*=\s*(\d+)/, 'ROWS');
      return { name: '호두밭', dur: dur(f), max: Math.min(cap, Math.floor(cols * rows / per)), per, cap, cols, rows };
    },
    // 바위산 — 깬 줄 `REWARD_PER` 줄마다 하나씩, `REWARD_MAX` 까지.
    // ⚠️ 여기는 **판 크기가 상한을 안 잡는다** (줄을 깨면 판이 비어 또 쌓을 수 있다) —
    // 상한 자체가 곧 한 판 최대이므로, 그 상한이 «진짜 일»인지는 아래에서 따로 본다
    rock: () => {
      const f = src('rock.js');
      const per = num(f, /const REWARD_PER\s*=\s*(\d+)/, 'REWARD_PER');
      const cap = num(f, /const REWARD_MAX\s*=\s*(\d+)/, 'REWARD_MAX');
      const rows = num(f, /const ROWS\s*=\s*(\d+)/, 'ROWS');
      return { name: '바위산', dur: dur(f), max: cap, per, cap, rows };
    },
    // 낚시터 — 한 번 건질 때마다 `REWARD_PER` 개, `REWARD_MAX` 까지.
    // 한 바퀴의 **최소**가 「입질까지 + 그물에 붙들고 있는 시간 + 건져 올리는 연출」이라
    // 2분에 몇 번인지가 거기서 나온다
    fish: () => {
      const f = src('fish.js');
      const per = num(f, /const REWARD_PER\s*=\s*(\d+)/, 'REWARD_PER');
      const cap = num(f, /const REWARD_MAX\s*=\s*(\d+)/, 'REWARD_MAX');
      const bite = num(f, /const BITE_MIN\s*=\s*(\d+)/, 'BITE_MIN');
      const ctc = num(f, /const CATCH_MS\s*=\s*(\d+)/, 'CATCH_MS');
      const land = num(f, /const LAND_MS\s*=\s*(\d+)/, 'LAND_MS');
      const cycle = bite + ctc + land;
      const d = dur(f);
      return { name: '낚시터', dur: d, max: Math.min(cap, Math.floor(d / cycle) * per), per, cap, cycle };
    },
    // 밀밭 — 참새 `REWARD_PER` 마리마다 하나, `REWARD_MAX` 까지.
    // ⚠️ 여기서 한 판 최대를 잡는 것은 **스폰 간격**이다 (호두밭의 판 크기와 같은 자리다) —
    // 2분 동안 나오는 참새를 «다» 쫓아도 그 이상은 못 받는다.
    // 제일 촘촘할 때(`SPAWN_MIN`)로 세므로 여기서 나오는 수는 **넉넉한 쪽**이다
    sparrow: () => {
      const f = src('sparrow.js');
      const per = num(f, /const REWARD_PER\s*=\s*(\d+)/, 'REWARD_PER');
      const cap = num(f, /const REWARD_MAX\s*=\s*(\d+)/, 'REWARD_MAX');
      const spawn = num(f, /SPAWN_MIN\s*=\s*(\d+)/, 'SPAWN_MIN');
      const d = dur(f);
      // ⚠️ **떼를 안 세면 마릿수가 통째로 틀린다** — 한 번 스폰에 한 마리가 아니다.
      // 뒤로 갈수록 떼로 오므로 «평균 떼 크기»를 곱한다 (넉넉한 쪽으로 센다 —
      // 그래야 「단발로는 못 닿는다」를 헐겁게 통과시키지 않는다)
      const fb = num(f, /FLOCK_BASE\s*=\s*([\d.]+)/, 'FLOCK_BASE');
      const ft = num(f, /FLOCK_TOP\s*=\s*([\d.]+)/, 'FLOCK_TOP');
      const AVG_K = 2.75;                       // 떼 하나의 평균 마릿수 (2~5)
      const perSpawn = 1 + ((fb + ft) / 2) * (AVG_K - 1);
      const birds = Math.floor(d / spawn * perSpawn);
      // ⚠️ **멀티킬이 «제곱»으로 들어온다** — 한 발에 다섯이면 25점이다.
      // 그래서 한 판 최대는 «점»으로 세야 한다 (마릿수로 세면 상한을 못 넘는 것처럼 보인다)
      const best = Math.floor(Math.floor(birds / 5) * 25 / per);   // 다 펜타로 맞혔을 때
      return { name: '밀밭', dur: d, max: Math.min(cap, best), per, cap, spawn, birds };
    },
  };

  // **형 표와 이 목록이 같은 것을 가리키는가.** 형에만 있으면 밸런스를 아무도 안 본
  // 게임이 하나 늘어난 것이고, 여기에만 있으면 붙은 맵이 없는 게임이다
  const minis = D.FIELD_TYPES.filter(t => t.mini).map(t => t.mini).sort();
  const known = Object.keys(GAMES).sort();
  ok('미니게임 목록이 형 표와 같다', minis.join() === known.join(),
     `형 ${minis.join(' · ')} / 여기 ${known.join(' · ')}`);

  const G = {};
  minis.filter(k => GAMES[k]).forEach(k => { G[k] = GAMES[k](); });
  const all = Object.values(G);

  // **«분당» 같은 자리에서 준다** — 제일 후한 쪽이 제일 박한 쪽의 1.5배 안.
  // ⚠️ 예전에는 「다 같은 시간을 쓴다」 + 「한 판 최대가 1.5배 안」 두 줄이었는데,
  // 밀밭이 30초가 되면서 그 짝이 깨졌다. **길이가 다르면 한 판 최대로는 못 견준다** —
  // 4분의 1 시간에 같은 것을 주면 나머지는 죽은 콘텐츠가 되고, 시간에 딱 비례해서
  // 깎으면 「AP 한 번」의 값이 4분의 1 이 된다. 지킬 것은 **분당 수확**이다
  const rate = g => g.max / (g.dur / 60000);
  const hi = Math.max(...all.map(rate)), lo = Math.min(...all.map(rate));
  ok('미니게임이 다 «분당» 같은 자리에서 준다', hi <= lo * 1.5,
     all.map(g => `${g.name} ${g.dur / 1000}초에 ${g.max}개(분당 ${rate(g).toFixed(1)})`).join(' · ')
     + ' (1.5배 안이어야 한다)');
  // ⚠️ **분당만 보면 「30초에 18개」도 통과한다** — 그건 같은 AP 를 내고 4분의 1 시간에
  // 같은 것을 받는 것이라, 나머지 넷이 통째로 죽는다. 그렇다고 「한 판 최대도 1.5배 안」을
  // 같이 걸 수는 없다: 길이가 4배 다르면 두 줄이 **동시에 참일 수가 없다**.
  //
  // 지킬 것은 **「어느 하나가 다른 것을 «두 축 모두»에서 덮지 않는다」**이다 —
  // 분당도 훨씬 낫고 한 판 수확도 안 밀리면 그건 나머지를 죽이는 것이고,
  // 한쪽만 나으면 「빨리 끝나는 쪽 / 한 번에 많이 받는 쪽」이라는 **고를 거리**가 된다.
  // ⚠️ 문턱(1.25배)은 «값이 통과하도록» 고른 것이 아니다 — 지금도 호두밭이 낚시터보다
  // 분당 1.11배 · 한 판 1.11배로 조금씩 나은데, 그 정도는 「덮는다」가 아니다
  const dom = [];
  for (const a2 of all) for (const b2 of all) {
    if (a2 === b2) continue;
    if (rate(a2) > rate(b2) * 1.25 && a2.max >= b2.max) {
      dom.push(`${a2.name}(분당 ${rate(a2).toFixed(1)} · 한 판 ${a2.max}) 가 `
             + `${b2.name}(분당 ${rate(b2).toFixed(1)} · 한 판 ${b2.max}) 를 둘 다에서 덮는다`);
    }
  }
  ok('어느 미니게임도 다른 것을 «두 축 모두»에서 덮지 않는다', !dom.length,
     dom.join(' / ') || all.map(g => `${g.name} ${rate(g).toFixed(1)}/분 · ${g.max}개`).join(' · '));
  // 미니게임 한 판이 **평범한 채집 한 번보다는** 나아야 2분을 낼 이유가 생긴다
  ok('미니게임이 그냥 줍는 것보다 낫다', all.every(g => g.max > 1),
     `평범한 채집은 한 번에 1개다 · ${all.map(g => g.name + ' ' + g.max).join(' · ')}`);

  // ── 호두밭 — **상한이 실제로 걸려야 한다.** 판을 다 지웠을 때가 상한보다 적으면
  // `REWARD_MAX` 는 아무 일도 안 하는 장식이고, 판을 늘리는 순간 조용히 후해진다
  if (G.walnut) {
    const w = G.walnut, full = Math.floor(w.cols * w.rows / w.per);
    ok('호두밭 상한이 장식이 아니다', full >= w.cap, `판을 다 지우면 ${full}개 · 상한 ${w.cap}개`);
    // ⚠️ **상한만 보면 요율이 안 보인다.** `REWARD_PER` 를 5 → 2 로 후하게 바꿔도
    // 상한(20)이 그대로라 위의 「같은 자리」 검사가 **통과했다** — 실제로는 호두를
    // 40개만 지워도 꼭대기라 절반도 안 한 사람이 다 받는다.
    // **상한은 «거의 다 지운 사람»의 것**이어야 한다: 판의 절반은 지워야 닿는다
    const frac = (w.cap * w.per) / (w.cols * w.rows);
    ok('호두밭 상한이 «거의 다 지운 사람»의 것이다', frac >= 0.5,
       `상한에 닿으려면 호두 ${w.cap * w.per}개 = 판의 ${Math.round(frac * 100)}% (50% 이상)`);
  }
  // ── 낚시터 — 여기도 판 크기가 아니라 **시간**이 상한을 잡는다.
  // 상한이 헐거우면 「두어 번 건지고 꼭대기」가 된다: **2분의 절반 가까이는
  // 쉬지 않고 건져야** 상한에 닿아야 한다
  if (G.fish) {
    const f = G.fish, need = Math.ceil(f.cap / f.per) * f.cycle;
    ok('낚시터 상한이 «쉬지 않고 건진 사람»의 것이다', need >= f.dur * 0.4,
       `상한에 닿으려면 ${Math.ceil(f.cap / f.per)}번 × ${f.cycle / 1000}초 = ${Math.round(need / 1000)}초`
       + ` (2분의 40% = ${Math.round(f.dur * 0.4 / 1000)}초 이상)`);
  }
  // ── 바위산 — 같은 이유를 **줄 수**로 잰다. 판 크기가 상한을 안 잡으니
  // 상한이 헐거우면 「몇 줄 깨고 꼭대기」가 된다: **판 하나를 통째로 비우는 것보다는
  // 많이 깨야** 상한에 닿아야 한다
  if (G.rock) {
    const r = G.rock, need = r.cap * r.per;
    ok('바위산 상한이 «판을 비우고도 더 깬 사람»의 것이다', need >= r.rows,
       `상한에 닿으려면 ${need}줄 · 판은 ${r.rows}줄짜리다 (판 하나보다 많아야 한다)`);
  }
  // ── 밀밭 — 같은 이유를 **참새 수**로 잰다. ⚠️ 상한만 보면 요율이 안 보인다
  // (호두밭에서 배운 자리다): 스폰되는 것의 절반도 안 쫓고 꼭대기에 닿으면
  // 「2분을 내는」 거래가 아니라 그냥 기다리는 시간이 된다
  if (G.sparrow) {
    const s2 = G.sparrow, need = s2.cap * s2.per;
    // ① **단발로는 못 닿는다** — 이것이 「떼를 노린다」를 규칙으로 못 박는 자리다.
    // 다 단발로 맞혀도 나오는 마릿수만큼(1점씩)이라 상한에 못 미쳐야 한다
    ok('밀밭 상한은 «단발로는» 못 닿는다 (떼를 노려야 한다)', need > s2.birds,
       `상한 ${need}점 · 30초에 제일 촘촘해도 ${s2.birds}마리(단발이면 ${s2.birds}점)`);
    // ② **그래도 닿을 수는 있어야 한다** — 제곱으로도 못 닿으면 상한이 장식이다.
    // 제일 좋은 길(다 펜타)로 몇 마리가 드는지를 보고, 나오는 것의 절반 안이면 된다
    const bestBirds = Math.ceil(need / 25) * 5;
    ok('밀밭 상한이 «떼를 노리면» 닿는다', bestBirds <= s2.birds * 0.6,
       `펜타로 가면 ${bestBirds}마리면 닿는다 · 나오는 것은 ${s2.birds}마리`);
  }
}

// ─── ⑤ 시뮬레이터의 목표를 지나는가 ──────────────────────────
//
// 위의 넷은 **한 줄짜리 약속**이고, 이것은 **돌려 봐야 아는 것**이다.
// `simfarm` 이 200명을 30일 살게 해서 털리는 횟수·잃는 비율·헛걸음을 잰다.
{
  const sim = require('./simfarm.js');
  const res = sim.run({ days: 30, n: 200, seed: 12345 });
  sim.judge(res.rows).forEach(m => {
    ok(`시뮬 · ${m.what}`, m.pass, `${m.값} (${m.lo}~${m.hi})`);
  });
}

// ─── 호감도 — **답례가 값보다 크면 안 된다** ────────────────
//
// 호감도가 「눌러서 재료 받기」가 되면 안 된다. 한 사람을 각별한 사이까지 올리려면
// 물약을 몇 개 만들어 줘야 하고(=그만큼의 AP), 그 값보다 답례가 크면
// **선물이 곧 파밍**이 된다 — 채집을 건너뛰고 선물만 도는 고리가 생긴다.
{
  const T = D.BOND_TIERS, G = D.BOND_GAIN, GF = D.BOND_GIFTS;
  const top = T[T.length - 1].at;
  // 제일 빨리 올리는 방법 = 좋아하는 등급을 «처음 주는 종류»로만 계속 주는 것
  const best = G.fresh + G.like;
  const potions = Math.ceil(top / best);
  // 물약 하나에 드는 AP — 제일 싼 물약으로 잡는다 (가장 유리한 쪽으로 재야 한다)
  const cheapest = Math.min(...D.RECIPES
    .filter(r => r.result && r.result.kind === 'potion').map(r => apOfR(r)));
  const spend = potions * cheapest;
  const back = GF.reduce((n, g) => n + (g ? g.crystal : 0), 0);
  // 답례 결정을 AP 로 환산한다 — 결정은 AP 충전으로 바꿀 수 있어서 같은 저울에 올라간다
  const backAp = back * (D.ENERGY.cap / D.ENERGY.chargeCost);
  ok('호감도 답례 < 들인 값', backAp < spend,
     `물약 ${potions}개 ≈ ${spend} AP 들여서 답례 💎${back}(≈${Math.round(backAp)} AP)`);
  // 단계가 «오르기만» 하는가 — 문턱이 뒤로 갈수록 커야 한다
  ok('호감도 문턱이 오름차순', T.every((b, i) => !i || b.at > T[i - 1].at),
     T.map(b => b.at).join(' → '));
  // 「처음 주는 종류」가 커야 초반 레시피가 안 죽는다
  ok('처음 주는 종류가 더 크다', G.fresh > G.again, `처음 ${G.fresh} > 두 번째 ${G.again}`);
  // **호위 할인이 지대 순서를 뒤집지 않는가.** 후반 지대가 초반보다 싸지면
  // 「비싼 곳일수록 좋은 것이 난다」가 무너져서 지대를 나눈 뜻이 없어진다
  const gz = D.BOND_GIVES.guard;
  const maxCut = gz.v[gz.v.length - 1];
  const plainAp = D.zoneAp('plain');
  // ⚠️ **`gatherCost()` 의 바닥(`Math.max`)을 여기서 다시 씌우면 안 된다.**
  // 그러면 무슨 값을 넣어도 통과하는 «스스로 맞는» 검사가 된다 (실제로 그렇게 썼다가
  // 사보타주가 안 잡혀서 알았다). 바닥은 마지막 안전장치이고, **표 자체가
  // 바닥을 안 건드려야 한다** — 건드리면 그 순간부터 단계를 올려도 값이 안 내려간다
  const flipped = D.ZONES.filter(z => gz.zones.indexOf(z.id) >= 0)
    .filter(z => z.ap - maxCut < plainAp);
  ok('호위 할인이 지대 순서를 안 뒤집는다 (바닥에 안 닿는다)', !flipped.length,
     gz.zones.map(id => {
       const z = D.ZONES.find(x => x.id === id);
       return `${id} ${z.ap}→${z.ap - maxCut}`;
     }).join(' · ') + ` (평야 ${plainAp})`);
  // **한 사람이 하나씩만 담당한다.** 둘이 같은 것을 담당하면 `bondGiver` 가
  // 앞엣것만 돌려줘서 뒷사람의 몫이 조용히 사라진다
  const kinds = Object.keys(D.BONDS).map(id => D.BONDS[id].give).filter(Boolean);
  ok('담당이 겹치지 않는다', new Set(kinds).size === kinds.length, kinds.join(' · '));
  ok('담당 이름이 모두 표에 있다', kinds.every(k => D.BOND_GIVES[k]),
     Object.keys(D.BOND_GIVES).join(' · '));

  // ─── 호감도가 «막는» 문 — 2막이 얼마나 멀리 있는가 ──────────
  //
  // 2막은 「유리관」에서 열리는데 그 키워드가 **호감도 뒤에** 있다. 매력은 물약을
  // «마셔서» 오르고 호감도는 «선물»해야 오르므로 **둘이 서로 다른 동작**이라,
  // 이 문이 멀면 1막을 끝낸 사람의 손이 통째로 빈다 (`PLAYFLOW.md` 8장).
  //
  // ⚠️ **AP 로 재지 않는다.** 여기서 드는 것은 시간이 아니라 **물약의 «종류»**다 —
  // 같은 것을 스무 개 줘도 `again`(1) 이라 거의 안 오른다. 그러니 재야 할 것은
  // 「비법서가 얼마나 넓어야 이 문이 열리는가」이고, 그 잣대가 **기초 등급의 종류 수**다
  // (제일 좁은 비법서가 곧 그것이다 — 첫 퀘스트가 주는 몫도 같은 크기다).
  const opener = D.ASKS.filter(a => a.need && a.need.bond && (a.gives || []).length);
  const gradeKinds = g => D.RECIPES.filter(r => r.result
    && r.result.kind === 'potion' && r.result.grade === g).length;
  // 한 줄을 여는 데 드는 «종류» 수 — 좋아하는 등급을 줄 수 있으면 `fresh+like`, 아니면 `fresh`
  const costOf = a => {
    const at = T[a.need.bond].at, like = (D.BONDS[a.npc] || {}).like;
    return Math.min(Math.ceil(at / (G.fresh + G.like)) + (gradeKinds(like) ? 0 : 99),
                    Math.ceil(at / G.fresh));
  };
  // 2막의 문은 **둘 중 하나만** 열면 된다 (오릭스 · 슈타르크) — 제일 싼 쪽으로 잰다
  const gate = Math.min(...opener.filter(a => (a.gives || []).includes('kw_glass')).map(costOf));
  ok('2막의 문이 비법서 안에서 열린다', gate <= gradeKinds('basic'),
     `물약 ${gate}종을 선물하면 열린다 (기초 등급이 ${gradeKinds('basic')}종 — 그 안이어야 한다)`);
  // **다리 퀘스트의 목표가 곧 그 문이어야 한다.** 둘이 갈리면 둘 다 나쁘다 —
  // 목표가 더 낮으면 깼는데 2막이 안 열리고(「다 했는데 왜 안 되지」),
  // 더 높으면 2막이 이미 열린 뒤에도 퀘스트가 안 끝난다
  const bridge = D.QUESTS.filter(q => (q.goal || {}).kind === 'bond');
  const gateTier = Math.min(...opener.filter(a => (a.gives || []).includes('kw_glass'))
    .map(a => a.need.bond));
  ok('다리 퀘스트의 목표가 곧 2막의 문이다',
     bridge.length === 1 && bridge[0].goal.n === gateTier,
     bridge.length
       ? `${bridge[0].id} 목표 ${T[bridge[0].goal.n].name}(${bridge[0].goal.n}) · 문 ${T[gateTier].name}(${gateTier})`
       : '호감도를 목표로 하는 퀘스트가 없다');
  // **막는 줄은 안 막는 줄보다 낮다.** 「신뢰에서야 털어놓는 말」은 아무것도 안 주므로
  // 깊은 자리에 둬도 아무도 안 갇히지만, 키워드를 «주는» 줄이 거기 있으면 진행이 멎는다
  const blocking = Math.max(...opener.map(a => a.need.bond));
  const telling = D.ASKS.filter(a => a.need && a.need.bond && !(a.gives || []).length);
  ok('진행을 막는 문이 더 낮다', !telling.length
      || blocking <= Math.min(...telling.map(a => a.need.bond)),
     `주는 줄 최대 ${T[blocking].name}(${blocking}) ≤ 안 주는 줄 최소 `
     + (telling.length ? T[Math.min(...telling.map(a => a.need.bond))].name : '없음'));

  // 답례가 단계마다 커지는가 — 뒤 단계가 더 싸면 올릴 이유가 없다
  const gs = GF.filter(Boolean);
  ok('답례가 단계마다 커진다', gs.every((g, i) => !i || (g.n > gs[i - 1].n && g.crystal > gs[i - 1].crystal)),
     gs.map(g => `${g.n}/💎${g.crystal}`).join(' → '));
}

// ─── 결과 ────────────────────────────────────────────────────
const bad = out.filter(r => !r.pass);
out.forEach(r => console.log(`${r.pass ? 'OK ' : '❌ '} ${r.name} — ${r.detail}`));
console.log('');
if (bad.length) {
  console.log(`❌ 밸런스 약속 ${bad.length}건이 깨졌다`);
  process.exit(1);
}
console.log(`✅ 밸런스 약속 ${out.length}건 전부 지켜졌다`);
