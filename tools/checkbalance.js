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

// game.js 는 브라우저 파일이라 통째로 못 읽는다 — **써진 숫자를 그대로 본다.**
// (`checkdata` 가 생성 구간을 파일에서 읽는 것과 같은 방식이다)
const GAME = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const numIn = (re, what) => {
  const m = GAME.match(re);
  if (!m) throw new Error(`game.js 에서 ${what} 를 못 찾았다 — 이름이 바뀌었으면 여기도 고칠 것`);
  return Number(m[1]);
};

// ─── ① AP — 일부러 실패해서 버는 고리가 없는가 ───────────────
//
// 조합에 실패하면 위로금(`failReward`)을 준다. 그것이 조합 값(`cost.brew`)보다
// 크거나 같으면 **일부러 실패하는 것이 AP 를 버는 방법**이 된다.
// 이 한 줄 때문에 게임 전체의 시간 제한이 사라진다.
{
  const { failReward, cost, chargeCost, cap } = D.ENERGY;
  ok('AP 무한 고리', failReward < cost.brew,
    `실패 보상 ${failReward} < 조합 ${cost.brew} 이어야 한다 (같기만 해도 무한이다)`);
  ok('AP 충전 값', chargeCost >= cap,
    `가득 채우는 값 ${chargeCost} 이 AP 상한 ${cap} 보다 작으면 결정 하나로 AP 를 두 개 사는 셈이다`);
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
  const eff = D.RECIPES
    .filter(r => r.result && r.result.kind === 'potion' && (r.result.charm || 0) > 0)
    .map(r => {
      const ap = (r.inputs || []).length * E.cost.gather + E.cost.brew;
      return { id: r.result.id, charm: r.result.charm, ap, per: r.result.charm / ap };
    })
    .sort((a, b) => b.per - a.per);
  const weekAP = 7 * E.dailyFill;
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

// ─── 결과 ────────────────────────────────────────────────────
const bad = out.filter(r => !r.pass);
out.forEach(r => console.log(`${r.pass ? 'OK ' : '❌ '} ${r.name} — ${r.detail}`));
console.log('');
if (bad.length) {
  console.log(`❌ 밸런스 약속 ${bad.length}건이 깨졌다`);
  process.exit(1);
}
console.log(`✅ 밸런스 약속 ${out.length}건 전부 지켜졌다`);
