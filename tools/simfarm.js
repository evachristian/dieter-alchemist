// ═══════════════════════════════════════════════════════════════
//  밭 · 약탈 밸런싱 시뮬레이터 (`FARM.md` 6단계 · `CREATURE.md` 10장)
//
//  기획서에 「사람이 여럿 붙어 봐야 하루에 몇 번 털리나를 알 수 있다」고 적어 두고
//  수치를 전부 임시값으로 두었다. **그런데 그중 상당수는 사람 없이도 알 수 있다.**
//  약탈권이 몇 개인지 · 방패가 몇 시간인지 · 가져가는 비율이 얼마인지는
//  전부 규칙에서 나오는 값이고, 규칙은 이미 `server/battle.js` 에 다 있다.
//
//  ⚠️ **규칙을 여기에 옮겨 적지 않는다.** 전투도 · 자람도 · 노획도 전부
//  `battle.js` 의 진짜 함수를 부른다. 사본을 만들면 수치를 고쳤을 때
//  시뮬레이터만 옛 규칙으로 돌아 **맞다고 착각하게 된다** —
//  서버가 `data.js` 를 그대로 읽는 것과 같은 이유다.
//
//  사람이 붙어 봐야만 아는 것은 따로 있다: **접속 빈도**다.
//  그래서 그것만 가정으로 두고(`POP`), 나머지는 규칙에서 나오게 했다.
//  가정을 바꿔 가며 돌려 보는 것이 이 도구의 쓸모다.
//
//    node tools/simfarm.js                  기본 (30일 × 200명)
//    node tools/simfarm.js --days 60        더 길게
//    node tools/simfarm.js --json           수치만 (다른 도구가 읽기 좋게)
// ═══════════════════════════════════════════════════════════════
const B = require('../server/battle.js');

// ─── 사람이 붙어 봐야 아는 것 — **접속 빈도만 가정한다** ──────
//
// 코지 게임이라 「하루에 한 번 들어와 밭을 거두는 사람」이 한가운데다.
// 열심히 하는 사람(하루 세 번)과 뜸한 사람(사흘에 한 번)을 양옆에 둔다.
// 뜸한 사람은 **밭이 가득 찬 채로 계속 놓여 있어서 제일 좋은 표적이 된다** —
// 이 층이 없으면 「털 데가 없다」가 되어 시뮬레이션이 거짓말을 한다.
const POP = [
  { kind: '열심',  share: 0.20, loginsPerDay: 3,     raidsPerLogin: 1 },
  { kind: '보통',  share: 0.50, loginsPerDay: 1,     raidsPerLogin: 3 },
  { kind: '뜸함',  share: 0.30, loginsPerDay: 1 / 3, raidsPerLogin: 3 },
];

const HOUR = 3600e3;
const DAY = 24 * HOUR;

// ─── 시드 고정 난수 ──────────────────────────────────────────
// **`Math.random` 을 그대로 쓰면 돌릴 때마다 답이 달라져** 수치를 바꾼 효과인지
// 운인지 구별할 수 없다. 게임의 날씨가 시드를 고정하는 것과 같은 이유다.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─── 플레이어 한 명 만들기 ───────────────────────────────────
//
// 밭은 여신 단계(매력 100)에 열린다. 그맘때면 크리처를 여럿 갖고 있지만
// **상급을 다섯이나 갖고 있지는 않다** — 상급은 속성당 하나뿐이고 재료가 비싸다.
// 그래서 「상급 하나 + 중급 몇 + 기초」 쯤으로 잡는다.
const ALL = Object.values(B.CREATURES);
const byPower = p => ALL.filter(c => B.combatPower(c) === p);

function makePlayer(i, rnd, kind) {
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  // 상급 0~1 · 중급 2~4 · 기초 나머지 — 여신 단계의 평범한 보유량
  const high = rnd() < 0.55 ? [pick(byPower(64))] : [];
  const mids = [];
  const nMid = 2 + Math.floor(rnd() * 3);
  while (mids.length < nMid) { const c = pick(byPower(36)); if (!mids.includes(c)) mids.push(c); }
  const lows = [];
  while (lows.length < 5) { const c = pick(byPower(16)); if (!lows.includes(c)) lows.push(c); }
  const roster = [...high, ...mids, ...lows];

  // 로열티 — 먹이를 꾸준히 주는 사람은 드물다. 대부분 애착 한 마리에만 준다
  const pets = {};
  roster.forEach((c, k) => { pets[c.id] = { loyalty: k === 0 ? Math.floor(rnd() * 101) : Math.floor(rnd() * 30) }; });

  // 부대 — **센 순서로 다섯** (게임의 `autoTeam` 과 같은 규칙이다)
  const strong = [...roster].sort((a, b) => B.combatPower(b) - B.combatPower(a)).slice(0, 5).map(c => c.id);
  return {
    idx: i, kind,
    state: {
      creatures: roster.map(c => c.id), pets,
      petRoom: roster[0].id, petField: roster[0].id,
      farmDef: strong.slice(), farmAtk: strong.slice(),
    },
    farm: null,
    // 통계
    lost: {}, gained: {}, hitTry: 0, hitWin: 0, raidTry: 0, raidWin: 0, harvested: 0,
    visits: 0, empty: 0, dueVisits: 0, wasted: 0, lastVisit: 0,
  };
}

// 한 사람의 하루 생산량 (규칙에서 그대로 읽는다)
const perDay = p => B.countOf(B.dailyYield(p.state));

// ─── 돌린다 ──────────────────────────────────────────────────
function run(opt) {
  const rnd = rng(opt.seed || 12345);
  const N = opt.n || 200, DAYS = opt.days || 30;
  const t0 = Date.UTC(2026, 0, 1);

  // 인구 구성
  const players = [];
  let made = 0;
  POP.forEach((g, gi) => {
    const n = gi === POP.length - 1 ? N - made : Math.round(N * g.share);
    for (let k = 0; k < n; k++) players.push(makePlayer(players.length, rnd, g.kind));
    made += n;
  });
  players.forEach(p => { p.farm = B.emptyFarm(t0); });

  const perLogin = {};
  POP.forEach(g => { perLogin[g.kind] = g; });

  // 한 시간마다 흘려 보낸다. 접속은 그 시간에 일어날 확률로 흩뿌린다 —
  // 다들 같은 시각에 들어오면 방패가 실제보다 잘 듣는 것처럼 보인다
  for (let h = 0; h < DAYS * 24; h++) {
    const now = t0 + h * HOUR;
    for (const p of players) {
      const g = perLogin[p.kind];
      if (rnd() >= g.loginsPerDay / 24) continue;         // 이 시각에 접속했는가

      B.grow(p.farm, p.state, now);                       // 자람 · 약탈권 회복

      // **들어왔을 때 밭에 무엇이 있었나** — 「아침에 빈 밭」의 수치다.
      // 재는 자리를 두 번 고쳤다:
      //  ① 거둔 **뒤에** 재면 방금 거둬서 빈 밭까지 센다 (28% 가 그것이었다)
      //  ② 그냥 「비었나」로 재면 **아직 안 자란 밭**까지 센다 — 생산은 하루 한 번인데
      //     열심히 하는 사람은 하루 세 번 들어오므로 셋 중 둘은 원래 빈 밭이다
      //     (그렇게 재서 열심 층이 68% 로 나왔다. 약탈과는 아무 상관이 없는 수치다)
      // 그래서 **「자랐어야 할 만큼 시간이 지났는데 비어 있는」 것만** 헛걸음으로 센다
      if (h > 24) {
        p.visits++;
        const due = p.lastVisit && (now - p.lastVisit) >= DAY;
        if (!B.farmCount(p.farm)) {
          p.empty++;
          if (due) p.wasted++;
        }
        if (due) p.dueVisits++;
      }
      p.lastVisit = now;

      // ① 거둔다 — 접속하면 늘 거둔다 (모아 두면 털리니까)
      const got = B.harvestEars(p.farm, now);
      p.harvested += B.countOf(got);

      // ② 턴다 — 있는 약탈권만큼
      for (let k = 0; k < g.raidsPerLogin && (p.farm.raids || 0) > 0; k++) {
        // 서버가 하는 것과 같은 순서: 남 중에서 **이삭이 있고 방패가 없는** 밭을 고른다.
        // 서버는 12명을 뽑아 5명까지 보여 준다 — 그 눈을 그대로 흉내 낸다
        const seen = [];
        for (let s = 0; s < 12 && seen.length < 5; s++) {
          const q = players[Math.floor(rnd() * players.length)];
          if (q === p || seen.includes(q)) continue;
          // 서버와 같다 — **남의 밭도 제 시계로 자라게 한 다음** 센다.
          // 안 그러면 저장된 밭이 늘 비어 있어 약탈이 한 번도 안 일어난다
          B.grow(q.farm, q.state, now);
          if (!B.farmCount(q.farm)) continue;
          if ((q.farm.shieldUntil || 0) > now) continue;
          seen.push(q);
        }
        if (!seen.length) break;
        // **제일 많이 쌓인 밭을 고른다** — 목록에 개수가 그대로 보이므로
        // 사람은 거의 다 이렇게 고른다 (감추지 않기로 한 것의 대가다)
        const q = seen.sort((a, b) => B.farmCount(b.farm) - B.farmCount(a.farm))[0];

        const r = B.resolveFive(B.atkTeam(p.state), B.defTeam(q.state), null);
        p.raidTry++; q.hitTry++;
        if ((p.farm.raids || 0) >= B.RAID_MAX) p.farm.raidAt = now;
        p.farm.raids--;
        if (r.win) {
          const items = B.lootPlots(q.farm, r.rounds, now, B.earsFloor(q.state));
          q.farm.shieldUntil = now + B.SHIELD_MS;
          p.raidWin++; q.hitWin++;
          for (const id of Object.keys(items)) {
            p.gained[id] = (p.gained[id] || 0) + items[id];
            q.lost[id] = (q.lost[id] || 0) + items[id];
          }
        }
      }
    }
  }

  // ─── 재 본다 ───────────────────────────────────────────────
  const stat = kind => {
    const g = players.filter(p => !kind || p.kind === kind);
    const sum = f => g.reduce((a, p) => a + f(p), 0);
    const lost = sum(p => B.countOf(p.lost));
    const gain = sum(p => B.countOf(p.gained));
    const grown = sum(p => perDay(p) * DAYS);
    return {
      층: kind || '전체', 명: g.length,
      피습일: +(sum(p => p.hitTry) / g.length / DAYS).toFixed(2),
      털린일: +(sum(p => p.hitWin) / g.length / DAYS).toFixed(2),
      약탈승률: +(sum(p => p.raidWin) / Math.max(1, sum(p => p.raidTry))).toFixed(3),
      잃은비율: +(lost / Math.max(1, grown)).toFixed(3),
      약탈이득: +(gain / Math.max(1, grown)).toFixed(3),
      순증: +((grown - lost + gain) / Math.max(1, grown)).toFixed(3),
      거둔일: +(sum(p => p.harvested) / g.length / DAYS).toFixed(2),
      // 그냥 빈 밭 (아직 안 자란 것 포함) — 참고용
      빈밭: +(sum(p => p.empty) / Math.max(1, sum(p => p.visits))).toFixed(3),
      // **헛걸음** — 하루가 지나 자랐어야 하는데 비어 있던 비율. 이것이 약탈의 몫이다
      헛걸음: +(sum(p => p.wasted) / Math.max(1, sum(p => p.dueVisits))).toFixed(3),
    };
  };
  return { rows: [stat(), ...POP.map(g => stat(g.kind))], players, DAYS };
}

// ─── 부대를 잘 짜면 정말 달라지는가 ──────────────────────────
//
// 「자리 대 자리」의 목적은 **순서가 전략이 되게 하는 것**이다 (FARM.md 5장).
// 그런데 순서를 잘 짠 팀과 아무렇게나 짠 팀의 승률이 비슷하면 그 목적이 죽는다.
// 여기서는 같은 다섯 마리를 **속성 상성에 맞춰 세운 경우**와
// **거꾸로 세운 경우**의 매치 승률을 견준다.
function teamMatters(trials) {
  const rnd = rng(777);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  let best = 0, worst = 0, mid = 0;
  for (let t = 0; t < trials; t++) {
    // 수비 다섯 (속성 무작위 · 중급 위주)
    const def = [];
    while (def.length < 5) { const c = pick(ALL); if (!def.some(x => x.id === c.id)) def.push(c); }
    // 공격 다섯 — 같은 힘의 풀에서 고른다
    const pool = [];
    while (pool.length < 5) { const c = pick(ALL); if (!pool.some(x => x.id === c.id)) pool.push(c); }

    const state = arr => ({
      creatures: arr.map(c => c.id), pets: {},
      farmDef: arr.map(c => c.id), farmAtk: arr.map(c => c.id),
    });
    const D5 = B.defTeam(state(def));
    // ① 상성이 가장 좋아지는 순서를 **완전 탐색**으로 찾는다 (5! = 120)
    const perms = [];
    const go = (left, acc) => {
      if (!left.length) { perms.push(acc); return; }
      left.forEach((x, i) => go(left.filter((_, j) => j !== i), [...acc, x]));
    };
    go(pool, []);
    const score = order => B.resolveFive(B.atkTeam(state(order)), D5,
      [0.5, 0.5, 0.5, 0.5, 0.5]).rounds.reduce((a, r) => a + r.chance, 0);
    const scored = perms.map(o => ({ o, s: score(o) })).sort((a, b) => b.s - a.s);
    // 매치 승률(다섯 판 중 세 판)을 확률로 직접 계산한다 — 표본 오차 없이
    const matchP = order => {
      const cs = B.resolveFive(B.atkTeam(state(order)), D5, [.5, .5, .5, .5, .5]).rounds.map(r => r.chance);
      let dp = [1];
      for (const c of cs) {
        const nx = new Array(dp.length + 1).fill(0);
        dp.forEach((v, w) => { nx[w] += v * (1 - c); nx[w + 1] += v * c; });
        dp = nx;
      }
      return dp.slice(B.WIN_NEED).reduce((a, b) => a + b, 0);
    };
    best += matchP(scored[0].o);
    worst += matchP(scored[scored.length - 1].o);
    mid += matchP(scored[Math.floor(scored.length / 2)].o);
  }
  return {
    잘짠순서: +(best / trials).toFixed(3),
    보통순서: +(mid / trials).toFixed(3),
    나쁜순서: +(worst / trials).toFixed(3),
  };
}

// ─── 며칠 비웠다 돌아오면 얼마나 남아 있나 ───────────────────
//
// **코지 게임에서 제일 무서운 것은 「아침에 빈 밭」이다** (기획서에 그렇게 적었다).
// 접속 안 한 날 동안 밭이 얼마나 버티는지를 따로 잰다 — 위의 평균에 섞이면
// 열심히 하는 사람의 좋은 수치에 가려 안 보인다.
function awayCurve(opt) {
  const { players, DAYS } = opt;
  const away = players.filter(p => p.kind === '뜸함');
  const cap = away.map(p => B.FARM_DAYS * perDay(p));
  const left = away.map(p => B.farmCount(p.farm));
  const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  return {
    상한: +avg(cap).toFixed(1),
    남은것: +avg(left).toFixed(1),
    남은비율: +(avg(left) / Math.max(1, avg(cap))).toFixed(3),
    // **접속했을 때** 빈 밭이던 비율 (끝난 시점의 밭을 재면 방금 거둔 것까지 센다)
    빈밭: +(away.reduce((a2, p) => a2 + p.wasted, 0)
      / Math.max(1, away.reduce((a2, p) => a2 + p.dueVisits, 0))).toFixed(3),
  };
}

// ─── 확률의 바닥·천장에 닿는가 ───────────────────────────────
// 서른 마리 안에서 실제로 나올 수 있는 한 판 승률의 양 끝
function chanceRange() {
  let lo = 1, hi = 0;
  const one = c => ({ id: c.id, c, loyalty: 0 });
  const full = c => ({ id: c.id, c, loyalty: B.D.LOYALTY_MAX });
  for (const a of ALL) for (const d of ALL) {
    for (const A of [one(a), full(a)]) for (const Dd of [one(d), full(d)]) {
      const r = B.resolve(A, Dd, 0);
      lo = Math.min(lo, r.chance); hi = Math.max(hi, r.chance);
    }
  }
  return { 최저: +lo.toFixed(3), 최고: +hi.toFixed(3), 바닥: B.WIN_MIN, 천장: B.WIN_MAX };
}

// ─── 나온 값을 목표와 견준다 ─────────────────────────────────
//
// **목표를 먼저 적어 두고 잰다.** 수치를 보고 나서 목표를 정하면
// 무엇을 고쳐도 「이 정도면 됐다」가 되어 밸런싱이 안 끝난다.
const GOALS = [
  { id: '털린일', what: '하루에 실제로 털리는 횟수', lo: 0.3, hi: 1.5,
    why: '한 번도 안 털리면 방어대를 짤 이유가 없고, 두 번을 넘으면 접속할 때마다 빈 밭이다' },
  { id: '잃은비율', what: '생산 대비 잃은 비율', lo: 0.02, hi: 0.25,
    why: '4분의 1을 넘으면 「모아 봐야 뺏긴다」가 된다. 너무 낮으면 방패·부대가 장식이다' },
  { id: '순증', what: '털리고 털고 난 뒤에도 느는가', lo: 0.9, hi: 1.35,
    why: '1 아래면 밭이 줄어드는 콘텐츠다. 1.35 위면 약탈이 채집보다 남는다' },
  { id: '헛걸음', what: '하루가 지나 자랐을 텐데 들어오니 빈 밭', lo: 0, hi: 0.10,
    why: '기획서가 처음부터 무서워한 것이 이것이다 — 「아침에 빈 밭」을 열 번에 한 번 넘게 보면 그만둔다' },
];

function judge(rows) {
  const all = rows[0];
  return GOALS.map(g => {
    const v = all[g.id];
    return { ...g, 값: v, pass: v >= g.lo && v <= g.hi };
  });
}

// ─── 출력 ────────────────────────────────────────────────────
// **직접 돌릴 때만 찍는다.** `checkbalance` 가 require 로 불러 쓰는데,
// 여기서 바로 찍으면 그 검사 결과 위에 시뮬 보고서가 통째로 끼어든다
const arg = k => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : null;
};
if (require.main === module) main();
function main() {
const days = Number(arg('--days')) || 30;
const n = Number(arg('--n')) || 200;
const out = run({ days, n, seed: Number(arg('--seed')) || 12345 });
const team = teamMatters(Number(arg('--trials')) || 40);
const away = awayCurve(out);
const range = chanceRange();
const marks = judge(out.rows);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows: out.rows, team, away, range, marks }, null, 1));
} else {
  console.log(`\n밭 · 약탈 시뮬레이션 — ${n}명 × ${days}일`);
  console.log('(접속 빈도만 가정이고, 전투·자람·노획은 server/battle.js 의 진짜 규칙이다)\n');
  const cols = Object.keys(out.rows[0]);
  console.log(cols.map(c => c.padStart(9)).join(''));
  out.rows.forEach(r => console.log(cols.map(c => String(r[c]).padStart(9)).join('')));
  console.log(`\n한 판 승률이 실제로 닿는 범위: ${range.최저} ~ ${range.최고}`
    + ` (바닥 ${range.바닥} · 천장 ${range.천장})`);
  console.log(`부대 순서가 바꾸는 것 — 매치 승률: 잘 짜면 ${team.잘짠순서}`
    + ` · 보통 ${team.보통순서} · 나쁘게 ${team.나쁜순서}`);
  console.log(`사흘에 한 번 들어오는 사람의 밭: 상한 ${away.상한}개 중 ${away.남은것}개 남음`
    + ` (${Math.round(away.남은비율 * 100)}%) · 빈 밭을 보는 비율 ${Math.round(away.빈밭 * 100)}%`);
  console.log('');
  marks.forEach(m => console.log(`${m.pass ? '✅' : '❌'} ${m.what}: ${m.값}`
    + ` (${m.lo}~${m.hi}) — ${m.why}`));
  console.log('');
  if (marks.every(m => m.pass)) console.log('✅ 목표 안에 있다');
  else { console.log('❌ 목표를 벗어났다'); process.exitCode = 1; }
}

}

module.exports = { run, teamMatters, awayCurve, chanceRange, GOALS, judge };
