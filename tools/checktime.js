// 시간이 흐르는 값 검사 — 포만감 · 스태미나 · 방치 감소 · 단련 (EXERCISE.md)
//
// **시계를 옮겨 놓고 재야 잡힌다.** 지금 화면만 봐서는 전부 통과로 보인다 —
// 「하루 뒤」를 실제로 만들어 봐야 굶었을 때 스태미나가 안 찬다든지,
// 방치 감소가 부를 때마다 두 번 깎인다든지 하는 것이 드러난다.
//
// 페이지 안에서 Date.now 를 갈아 끼운다. 게임 코드는 전부 Date.now() 를 지나므로
// 이 한 곳만 바꾸면 시간이 통째로 움직인다.
//
// 사용: node tools/checktime.js  (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
const BASE = process.env.BASE || 'http://localhost:8080';

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
      { ver: 8, name: 'Tester', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });

  const lines = await page.evaluate(() => {
    const out = [], REAL = Date.now;
    let off = 0;
    Date.now = () => REAL.call(Date) + off;
    const jumpH = h => { off += h * 3600000; };
    const ok = (c, m) => out.push((c ? '✅ ' : '❌ ') + m);

    // ── 포만감은 시간이 지나면 준다. 행복이 낮을수록 빨리 ──
    const run = (happy, hours) => {
      S.aura.happy = happy; S.fullness = 100; S.bodyTs = Date.now();
      jumpH(hours); tickBody();
      return 100 - fullness();
    };
    const sad = run(0, 10), glad = run(1000, 10);
    out.push(`10시간 · 행복 0 → 포만감 −${sad.toFixed(1)} · 행복 1000 → −${glad.toFixed(1)}`);
    ok(sad > glad + 5, '행복이 낮으면 더 빨리 배고파진다');
    ok(Math.abs(sad - 50) < 1 && Math.abs(glad - 20) < 1, '시간당 5.0 / 2.0 (설계값)');

    // ── 굶으면 스태미나가 안 찬다 ──
    S.aura.happy = 500; S.fullness = 0; S.stamina = 0; S.bodyTs = Date.now();
    jumpH(24); tickBody();
    ok(Math.floor(stamina()) === 0, `굶은 채 24시간 → 스태미나 ${Math.floor(stamina())} (0이어야 한다)`);

    // ── 먹여 두면 찬다 ──
    S.fullness = 100; S.stamina = 0; S.bodyTs = Date.now();
    jumpH(24); tickBody();
    ok(Math.floor(stamina()) === staminaMax(), `배부른 채 24시간 → ${Math.floor(stamina())} / ${staminaMax()} (가득이어야 한다)`);

    // ── 방치 감소 ──
    S.aura.grit = 500; S.fit = 5; S.lastWorkoutTs = Date.now(); S.decayTs = Date.now();
    let d = decayIdle();
    ok(!d, '하루 전에는 안 깎는다 (' + JSON.stringify(d) + ')');
    jumpH(24 * 4);
    d = decayIdle();
    ok(d && d.days === 3, `4일 방치 → 봐 주는 하루를 빼고 3일치 (${d && d.days})`);
    ok(d && d.grit === 24, `근성 −${d && d.grit} (하루 8 × 3일)`);
    // **두 번 깎으면 안 된다**
    const g = S.aura.grit, again = decayIdle();
    ok(!again && S.aura.grit === g, '바로 다시 불러도 또 깎지 않는다');
    // 상한
    S.aura.grit = 1000; S.fit = 20; S.lastWorkoutTs = Date.now(); S.decayTs = Date.now();
    jumpH(24 * 60);
    d = decayIdle();
    ok(d && d.days === 7, `두 달 방치해도 7일치까지만 (${d && d.days}일)`);

    // ── 혼자 먹은 밤 (STORY.md) ──
    // **날이 바뀔 때만 판정한다.** 낮에 포만감이 0 이 돼도 아무 일도 없어야 한다
    S.aura.happy = 500; S.aura.grit = 500; S.fit = 0; S.binges = [];
    S.fullness = 0; S.bingeDay = dayKey();
    ok(!checkBinge(), '같은 날에는 아무리 굶어도 밤이 오지 않는다');

    jumpH(24);
    let n = checkBinge();
    ok(n && n.nights === 1, `굶은 채 날이 바뀌면 혼자 먹는다 (${n && n.nights}밤)`);
    // 깎인 값은 **쌓인 장면**에 들어 있다 (「흡입」 컷씬이 그걸 읽어 보여 준다)
    const ev = S.binges[S.binges.length - 1];
    ok(ev && ev.happy === 20 && ev.grit === 8,
      `장면에 남은 값 — 행복 −${ev && ev.happy} · 근성 −${ev && ev.grit}`);
    ok(ev && !!ev.food, `무엇을 먹었는지도 남는다 (${ev && ev.food})`);
    ok(Math.floor(fullness()) === 70, `배는 부르다 — 포만감 ${Math.floor(fullness())}`);
    // 같은 날 다시 불러도 두 번 먹지 않는다
    const h = S.aura.happy;
    ok(!checkBinge() && S.aura.happy === h, '같은 날 다시 불러도 또 먹지 않는다');

    // **배가 차 있으면 안 먹는다** — 이게 이 시스템의 유일한 예방책이다
    S.fullness = 80; S.bingeDay = dayKey();
    jumpH(24);
    ok(!checkBinge(), `배가 찬 채로 날이 바뀌면 아무 일도 없다 (포만감 ${Math.floor(fullness())})`);

    // 오래 비웠어도 세 밤까지
    S.fullness = 0; S.bingeDay = dayKey(); S.binges = [];
    jumpH(24 * 30);
    n = checkBinge();
    ok(n && n.nights === 3, `한 달을 비워도 세 밤까지 (${n && n.nights}밤)`);
    ok(S.binges.length === 3, `장면도 밤마다 하나씩 쌓인다 (${S.binges.length}개)`);

    // ── 언제 운동했는가 ──
    // **같은 운동도 시간에 따라 남는 것이 다르다.** 낮에만 재면 이 갈래가 통째로 빠진다.
    // 시각은 nowDate() 한 곳을 지나므로 시계만 옮기면 밤/아침이 따라온다
    const at = (hour) => {
      const d = new Date(REAL.call(Date));
      d.setHours(hour, 0, 0, 0);
      off = d.getTime() - REAL.call(Date);
      return exWhenKey();
    };
    ok(at(8) === 'morning' && at(14) === 'day' && at(23) === 'night' && at(3) === 'night',
      `시간대 판정 — 8시 ${at(8)} · 14시 ${at(14)} · 23시 ${at(23)} · 3시 ${at(3)}`);

    // ── 채집 시간대 · 날씨 (CREATURE.md 3·4장) ──
    //
    // 채집 시간대는 **운동 구간을 더 잘게 자른 것**이어야 한다. 하나가 운동 구간 둘에
    // 걸치면 20시 30분에 「운동은 낮인데 채집은 밤」이 되어 설명이 두 벌이 된다
    {
      const span = {};
      for (let h = 0; h < 24; h++) { at(h); (span[daypartNow().k] = span[daypartNow().k] || new Set()).add(exWhenKey()); }
      const bad = Object.entries(span).filter(([, s]) => s.size > 1).map(([k]) => k);
      ok(!bad.length, `채집 시간대가 운동 구간을 넘지 않는다${bad.length ? ` — ${bad}` : ''}`);
      at(8);  const m = daypartNow().k;
      at(14); const d2 = daypartNow().k;
      at(19); const k = daypartNow().k;
      at(23); const n = daypartNow().k;
      ok(m === 'morning' && d2 === 'day' && k === 'dusk' && n === 'night',
        `채집 시간대 — 8시 ${m} · 14시 ${d2} · 19시 ${k} · 23시 ${n}`);
    }
    {
      // **날씨는 부를 때마다 바뀌면 안 된다.** render() 마다 뽑으면 채집 한 번에 비가 왔다 갔다 한다
      at(14);
      const same = new Set(); for (let i = 0; i < 30; i++) same.add(weatherOf('p_hill').k);
      ok(same.size === 1, `같은 시각에 서른 번 물어도 같은 날씨 (${[...same].join(',')})`);
      // 그리고 시간이 지나면 바뀌긴 해야 한다 — 안 바뀌면 그냥 상수다
      const day = new Set(); for (let h = 0; h < 24; h++) { at(h); day.add(weatherOf('p_hill').k); }
      ok(day.size > 1, `하루 안에서는 바뀐다 (${day.size}가지)`);
      // 같은 시각에 맵마다 달라야 한다 — 같으면 시드가 맵 id 를 안 탄 것이다
      at(14);
      const perMap = new Set(GameData.MAPS.map(m => weatherOf(m.id).k));
      ok(perMap.size >= 4, `같은 시각에도 맵마다 다르다 (${perMap.size}가지)`);
    }

    // ── 먹이 버프 만료 (CREATURE.md 7장) ──
    //
    // **버프는 시각으로만 산다.** 「몇 시간 남았다」를 세이브에 카운트다운으로 넣으면
    // 앱을 꺼 둔 동안 시간이 안 가고, 두 기기에서 서로 다르게 흐른다.
    // 끝나는 시각 하나만 두고 nowDate() 와 견준다 — 그래서 여기서 검사할 수 있다
    {
      at(12);
      S.creatures = ['flame_fox'];
      S.petField = 'flame_fox';
      S.feeds = { feed_star: 3 };
      S.pets = {};
      const star = GameData.FEEDS.find(f => f.id === 'feed_star');
      openFeed('flame_fox'); setFeedKind('feed_star'); setFeedQty(1); doFeed(); closeFeed();
      const on = buffLeft('flame_fox') > 0, rate1 = palBonusRate('p_sunset');
      ok(on, `먹이면 버프가 걸린다 (${Math.round(buffLeft('flame_fox') / 60000)}분)`);
      jumpH(star.hours - 1);
      ok(buffLeft('flame_fox') > 0, '만료 한 시간 전에는 아직 살아 있다');
      jumpH(2);
      // ⚠️ 이름을 `off` 로 두면 **바깥의 시간 오프셋을 가린다** — jumpH/at 이 그것을 쓴다
      const expired = buffLeft('flame_fox') === 0, rate2 = palBonusRate('p_sunset');
      ok(expired, '시간이 지나면 저절로 풀린다');
      ok(rate1 - rate2 > 0.05, `버프가 확률을 올린다 (${rate1.toFixed(2)} → ${rate2.toFixed(2)})`);
      // 로열티는 **영구다** — 버프가 풀려도 안 줄어야 한다
      ok(loyaltyOf('flame_fox') === star.loyalty,
        `버프가 풀려도 로열티는 그대로 (${loyaltyOf('flame_fox')})`);
      // 다시 먹이면 **이어 붙지 않고 지금부터 다시**다 (몰아 먹여 하루짜리 버프를 못 만든다)
      S.feeds = { feed_grass: 2 };
      const grass = GameData.FEEDS.find(f => f.id === 'feed_grass');
      openFeed('flame_fox'); setFeedKind('feed_grass'); setFeedQty(1); doFeed();
      const a1 = buffLeft('flame_fox');
      setFeedQty(1); doFeed(); closeFeed();
      const a2 = buffLeft('flame_fox');
      ok(Math.abs(a1 - a2) < 2000 && a1 <= grass.hours * 3600e3 + 2000,
        `다시 먹여도 버프가 쌓이지 않는다 (${Math.round(a1 / 60000)}분 → ${Math.round(a2 / 60000)}분)`);
    }

    const ex = GameData.EXERCISES.find(x => x.id === 'ex_run');
    at(14); const day = exCost(ex, 60);
    at(23); const night = exCost(ex, 60);
    at(8);  const morn = exCost(ex, 60);
    ok(night.grit > day.grit, `밤에 근성이 더 붙는다 (낮 ${day.grit} → 밤 ${night.grit})`);
    ok(night.full > day.full, `밤에 더 배고파진다 (낮 ${day.full} → 밤 ${night.full})`);
    ok(night.happy < 0 && morn.happy > 0,
      `밤은 마음을 깎고 아침은 채운다 (밤 ${night.happy} · 아침 ${morn.happy})`);
    ok(day.happy === 0 && night.ap === day.ap && night.stam === day.stam,
      'AP·스태미나는 시간과 무관하다 (근성·포만감·행복만 갈린다)');
    off = 0;

    // ── 크리처 생산 (8단계) ──
    //
    // **하루에 한 번 · 방치 상한 5일치.** 한 달 만에 들어온 사람에게 30일치를 쏟으면
    // 「돌아왔더니 다 있네」가 되어 매일 들어올 이유가 없어진다.
    // 시계를 옮겨 놓지 않으면 이 셋 중 무엇도 확인할 수 없다.
    {
      const cr = D.RECIPES.find(r => r.result.kind === 'creature' && r.result.makes);
      const c = cr.result, mk = c.makes;
      const setup = () => {
        S.creatures = [c.id];
        S.petRoom = c.id; S.petField = c.id;      // 같은 마리 — **한 몫만** 만들어야 한다
        S.inventory[mk.id] = 0;
        S.produced = [];
        S.producedDay = dayKey();
        S.energyDay = dayKey();
      };
      // ① 하루가 지나면 한 몫이 들어온다 (같은 마리를 둘로 잡아도 두 몫이 아니다)
      setup();
      jumpH(25); refreshEnergy();
      ok(invCount(mk.id) === mk.n,
        `하루 뒤 ${mk.id} ${invCount(mk.id)}개 (한 몫 ${mk.n}개여야 한다 — 애착·동행이 같은 마리)`);
      ok(S.produced.length === 1, `기록 ${S.produced.length}줄 (1줄이어야 한다)`);
      ok(produceUnseen() === 1, `안 본 날 ${produceUnseen()} (1이어야 한다)`);

      // ② 같은 날 다시 봐도 안 쌓인다
      const was = invCount(mk.id);
      refreshEnergy();
      ok(invCount(mk.id) === was, `같은 날 다시 봐도 ${invCount(mk.id)}개 그대로`);

      // ③ 30일을 건너뛰어도 **5일치만** 들어온다
      setup();
      jumpH(24 * 30); refreshEnergy();
      ok(invCount(mk.id) === mk.n * 5,
        `30일 건너뛰고 ${invCount(mk.id)}개 (5일치 ${mk.n * 5}개여야 한다)`);
      ok(S.produced.length === 5, `기록 ${S.produced.length}줄 (상한 5줄과 같아야 한다)`);

      // ④ 아무도 안 데리고 있으면 안 쌓인다
      setup();
      S.petRoom = null; S.petField = null;
      jumpH(24 * 3); refreshEnergy();
      ok(invCount(mk.id) === 0, `크리처가 없으면 ${invCount(mk.id)}개 (0이어야 한다)`);
    }

    // ── 로엔 제국력 (탐험 일지) ──
    //
    // **현실 연도에서 1800 을 뺀다.** 2026 → 226 · 2027 → 227 · 2127 → 327.
    // 시계를 안 옮기면 이 규칙은 「올해 하나」로만 확인된다 — 226 을 상수로 박아 놔도
    // 오늘은 통과로 보이고 새해 첫날에 조용히 틀린다. 그래서 연도를 실제로 옮겨 본다.
    // 일지의 날짜가 전부 `nowDate()` 를 지나는지도 여기서 같이 잡힌다
    {
      const at = y => { off = new Date(y, 6, 1).getTime() - REAL.call(Date); return eraYear(); };
      const y26 = at(2026), y27 = at(2027), y2127 = at(2127);
      ok(y26 === 226, `2026년 → 로엔 제국력 ${y26}년 (226 기대)`);
      ok(y27 === 227, `2027년 → ${y27}년 (227 기대)`);
      ok(y2127 === 327, `2127년 → ${y2127}년 (327 기대)`);
      // 일지 한 줄이 **적힌 그날 날짜**를 갖는가 — 옮긴 시계를 그대로 따라야 한다
      S.diary = [];
      diaryAdd('di_slim', { step: 2 });
      const e = S.diary[0];
      ok(e && e.y === 327 && e.m === 7 && e.d === 1,
        `일지 줄의 날짜 ${e && e.y}년 ${e && e.m}월 ${e && e.d}일 (327년 7월 1일 기대)`);
      S.diary = [];
      off = 0;
    }

    // ── 단련이 몸을 움직이는가 ──
    S.stats.beauty = 30; S.fit = 0;
    const w0 = weightKg(), f0 = bodyFatPct();
    S.fit = 15;
    ok(weightKg() < w0 && bodyFatPct() < f0,
      `단련 +15 → 체중 ${w0.toFixed(1)}→${weightKg().toFixed(1)}kg · 체지방 ${f0.toFixed(1)}→${bodyFatPct().toFixed(1)}%`);
    S.fit = -20;
    ok(weightKg() > w0, `단련 −20 → 체중 ${weightKg().toFixed(1)}kg (늘어야 한다)`);
    Date.now = REAL;
    return out.join('\n');
  });

  await browser.close();
  console.log(lines);
  errs.forEach(e => console.log(e));
  const bad = lines.split('\n').filter(l => l.startsWith('\u274c')).length + errs.length;
  console.log(bad ? `\n\u274c ${bad}건` : '\n\u2705 시간이 흐르는 값 전부 통과');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
