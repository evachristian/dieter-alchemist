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
