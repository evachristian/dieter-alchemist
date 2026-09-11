// 채집 — 히든 재료의 «천장» (외부 비평 2.4 · CREATURE.md 4단계)
//
// 확률만 두면 꼬리가 너무 길다 — 귀한 맵(0.05%)은 95% 가 얻는 데 5,990회다.
// 그래서 **그 맵에서 연달아 `pity` 번 헛걸음이면 다음은 반드시**다 (`D.SPECIAL_TIERS`).
//
// ⚠️ **확률로는 못 잰다.** 0.5% 를 100번 굴려서 안 나오는 경우가 61% 라 «천장이 있어서
// 나왔는지 운이 좋아서 나왔는지» 구별이 안 된다. 그래서 `Math.random` 을 갈아 끼워
// 히든이 «절대» 안 나오게 해 두고 정확히 천장에서 나오는지, 나온 뒤 0 으로 돌아가는지,
// 확률로 나와도 0 으로 돌아가는지를 본다. 게임 코드는 `gather()` 그대로 지난다.
//
// 사용: node tools/checkgather.js  (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
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
      { ver: 15, name: 'Tester', nameClaimed: true, tutorialDone: true,
        tut: { step: 0, beat: 0, done: true, did: { gift: true } } }));
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });

  const lines = await page.evaluate(() => {
    const out = [];
    const ok = (c, m) => out.push((c ? '✅ ' : '❌ ') + m);
    const REAL = Math.random;
    // 미니게임 맵은 제 길로 간다 — 보통 맵 중 제일 흔한 등급 하나
    const map = D.MAPS.find(m => !m.mini && m.unlock === 0);
    const pity = D.specialTier(map.unlock).pity;
    const sp = map.special;
    const setup = () => { S.energy = 99999; S.inventory = {}; S.spMiss = {}; S.petField = null; S.charmPeak = 999; };
    const got = () => invCount(sp);

    // ① 절대 안 나오게 해 두고 천장까지 — 「연달아 N 번」이면 N+1 번째에 나온다
    setup();
    Math.random = () => 0.999999;
    for (let i = 0; i < pity; i++) gather(map.id);
    const before = got(), missAt = specialMiss(map.id);
    ok(before === 0 && missAt === pity,
      `${map.id} · 천장 ${pity} — ${pity}번 헛걸음까지는 안 나온다 (히든 ${before} · 헛걸음 ${missAt})`);
    gather(map.id);
    ok(got() === 1, `   …${pity + 1}번째는 반드시 나온다 (히든 ${got()})`);
    ok(specialMiss(map.id) === 0, `   …나오면 0 으로 돌아간다 (헛걸음 ${specialMiss(map.id)})`);
    ok((S.record.specials || 0) >= 1, '   …기록(specials)에도 적힌다');

    // ② 확률로 나와도 0 으로 돌아간다 — 천장 카운터가 «확률 히든»을 모르면 안 된다
    setup();
    Math.random = () => 0.999999;
    for (let i = 0; i < 7; i++) gather(map.id);
    Math.random = () => 0;                        // 무조건 나온다
    gather(map.id);
    ok(got() === 1 && specialMiss(map.id) === 0,
      `확률로 나와도 헛걸음이 0 으로 돌아간다 (히든 ${got()} · 헛걸음 ${specialMiss(map.id)})`);

    // ③ 맵마다 따로 센다 — 한 맵의 헛걸음이 다른 맵의 천장을 당기면 안 된다
    setup();
    const other = D.MAPS.find(m => !m.mini && m.id !== map.id && m.unlock === 0);
    Math.random = () => 0.999999;
    for (let i = 0; i < pity; i++) gather(map.id);
    gather(other.id);
    ok(invCount(other.special) === 0 && specialMiss(other.id) === 1,
      `맵마다 따로 센다 — ${other.id} 는 아직 헛걸음 ${specialMiss(other.id)} (1 기대)`);

    // ④ 힌트가 남은 횟수를 말한다 — 규칙을 감추면 「아는 사람과 모르는 사람의 차이」만 남는다
    setup();
    Math.random = () => 0.999999;
    for (let i = 0; i < 3; i++) gather(map.id);
    ok(specialLeft(map) === pity - 3, `힌트의 남은 횟수 ${specialLeft(map)} (${pity - 3} 기대)`);
    ok(/5/.test(I18N.t('special_pity', { n: 5 })) && !/\{n\}/.test(I18N.t('special_pity', { n: 5 })),
      `문구에 숫자가 들어간다 — "${I18N.t('special_pity', { n: 5 })}"`);

    // ⑤ 새로고침을 넘어 살아남는다 — 세이브에 있는가
    setup();
    Math.random = () => 0.999999;
    for (let i = 0; i < 4; i++) gather(map.id);
    save();
    const raw = JSON.parse(localStorage.getItem('dieter_alchemist_save_v1'));
    ok(raw.spMiss && raw.spMiss[map.id] === 4, `세이브에 남는다 (${raw.spMiss && raw.spMiss[map.id]} · 4 기대)`);

    Math.random = REAL;
    return out.join('\n');
  });

  await browser.close();
  console.log(lines);
  errs.forEach(e => console.log(e));
  const bad = lines.split('\n').filter(l => l.startsWith('❌')).length + errs.length;
  console.log(bad ? `\n❌ ${bad}건` : '\n✅ 히든 천장 전부 통과');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
