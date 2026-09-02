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
  apOfR = r => (r.inputs || []).reduce((sum, id) => {
    if (cropIds.has(id)) return sum;                       // 밭에서 기른다
    const m = D.MAPS.find(x => (x.pool || []).includes(id) || x.special === id);
    return sum + (m ? D.zoneAp(m.zone) : E.cost.gather);
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
