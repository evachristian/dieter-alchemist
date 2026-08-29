// 밭과 약탈이 **실제 화면에서** 뚫려 있는가 (9단계)
//
// `server/test.js` 가 API 를 보고 `npm test` 가 규칙을 보지만, 그 둘이 다 통과해도
// 화면에서 안 될 수 있다 — 버튼이 안 뜨거나 · 거둔 것이 가방에 안 들어가거나 ·
// 상대 목록이 안 그려지거나. 7단계에서 겪은 것과 같은 자리다 (`checkmelt.js`).
//
// **서버를 이 프로세스 안에서 띄운다.** 그래야 밭을 원하는 상태로 심어 놓을 수 있고,
// 무엇보다 **서버의 `Math.random` 을 갈아 끼울 수 있다** — 이기고 지는 것이 무작위라
// 그대로 두면 「돌아간다」만 보게 되고, 이겼을 때 무엇이 줄어야 하는지를 못 잰다.
//
// 보는 것:
//   ① 밭 시트가 지키개 · 이삭 · 약탈권 · 침입 기록을 그린다
//   ② 거두면 **가방에 들어오고** 밭이 빈다
//   ③ 이웃 밭 목록에 상대가 뜨고 **상성 딱지**가 붙는다
//   ④ 이기면 가방이 늘고 **남의 밭이 그만큼 준다** · 방패가 걸려 목록에서 빠진다
//   ⑤ 지면 아무것도 안 늘고 남의 밭도 그대로다
//   ⑥ 서버에 못 닿으면 **빈 밭이 아니라** 「지금은 볼 수 없다」로 말한다
//
// 사용: node tools/checkfarm.js   (종료 코드 0 = 통과)
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

const launchOpts = () => {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
};

const bad = [];
const ok = (c, m) => { if (!c) bad.push(m); };
const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);

(async () => {
  // ─── 서버를 여기서 띄운다 (메모리 저장소) ───
  delete process.env.DATABASE_URL; delete process.env.DATA_DIR;
  const { app, store } = require(path.join(__dirname, '..', 'server', 'index.js'));
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const BASE = 'http://127.0.0.1:' + server.address().port;

  const VID = 'p_' + 'v'.repeat(20), VSEC = 'v'.repeat(32);
  const RID = 'p_' + 'r'.repeat(20), RSEC = 'r'.repeat(32);
  const now = () => Date.now();
  const freshFarm = stash => ({
    stash, grownAt: now(), shieldUntil: 0, raids: 3, raidAt: now(), log: [],
  });

  // 털리는 쪽 — 유니콘이 지키고 반딧불이 9개가 여물어 있다
  await store.claimName(VID, VSEC, '밭주인');
  await store.put(VID, VSEC, 3,
    { name: '밭주인', creatures: ['unicorn'], petRoom: 'unicorn', pets: {} }, { charm: 220 });
  await store.farmSet(VID, freshFarm({ firefly: 9 }));
  // 터는 쪽의 이름만 미리 잡아 둔다 (세이브는 브라우저가 올린다)
  await store.claimName(RID, RSEC, '도둑고양이');

  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  await page.addInitScript(([id, sec]) => {
    localStorage.setItem('dieter_alchemist_player_v1', JSON.stringify({ playerId: id, secret: sec }));
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify({
      ver: 12, rev: 9, name: '도둑고양이', nameClaimed: true, tutorialDone: true,
      // 방을 지키는 아이(하늘 매)와 데리고 나갈 아이(불꽃 봉황)를 따로 둔다 —
      // 한 마리만 두면 「지키개 줄」과 「동행 줄」 중 하나를 한 번도 못 잰다
      creatures: ['sky_falcon', 'ember_phoenix'],
      petRoom: 'sky_falcon', petField: 'ember_phoenix', pets: {},
    }));
  }, [RID, RSEC]);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
  });
  // 세이브가 서버로 올라갈 때까지 (sync.js 는 3초 디바운스다)
  await page.waitForFunction(() => window.Sync && Sync.status === 'saved', null, { timeout: 15000 })
    .catch(() => bad.push('세이브가 서버에 안 올라갔다'));
  {
    const row = await store.get(RID);
    ok(row && row.state && row.state.petField === 'ember_phoenix',
      `터는 쪽 세이브가 서버에 있다 (petField=${row && row.state && row.state.petField})`);
  }

  // ① 밭 시트
  await store.farmSet(RID, freshFarm({ walnut: 4, wheat: 2 }));
  let out = await page.evaluate(async () => {
    await openFarm();
    await refreshFarm(); renderFarm();
    const body = document.getElementById('farmBody');
    return {
      shown: document.getElementById('farmSheet').classList.contains('show'),
      text: body.textContent.replace(/\s+/g, ' ').trim(),
      count: FARM && FARM.count, raids: FARM && FARM.raids,
      def: FARM && FARM.def && FARM.def.id,
      harvestOff: document.getElementById('farmHarvest').disabled,
      bag: JSON.parse(JSON.stringify(S.inventory)),
    };
  });
  ok(out.shown, '밭 시트가 열린다');
  ok(out.count === 6, `이삭 ${out.count} (6 기대)`);
  ok(out.def === 'sky_falcon', `지키개 = ${out.def} (마이 룸의 애착 크리처)`);
  ok(!out.harvestOff, '이삭이 있으면 「거두기」가 살아 있다');
  ok(/하늘 매/.test(out.text), `지키개 이름이 화면에 있다 — "${out.text.slice(0, 60)}…"`);
  ok(/호두/.test(out.text) && /밀/.test(out.text), '여문 이삭이 이름으로 적힌다');

  // ② 거두기 — **가방에 들어와야 한다**
  const bag0 = out.bag;
  out = await page.evaluate(async () => {
    await harvestFarm();
    return { bag: JSON.parse(JSON.stringify(S.inventory)), count: FARM && FARM.count,
             rec: S.record.harvested };
  });
  ok((out.bag.walnut || 0) - (bag0.walnut || 0) === 4 && (out.bag.wheat || 0) - (bag0.wheat || 0) === 2,
    `거둔 것이 가방에 들어왔다: 호두 +${(out.bag.walnut || 0) - (bag0.walnut || 0)} · 밀 +${(out.bag.wheat || 0) - (bag0.wheat || 0)}`);
  ok(out.count === 0, `거둔 뒤 밭이 비었다 (${out.count})`);
  ok(out.rec === 6, `기록에 6개가 적혔다 (${out.rec})`);
  ok(sum((await store.get(RID)).farm.stash) === 0, '서버 쪽 밭도 비었다');

  // ③ 이웃 밭 목록
  await page.evaluate(() => openRaidPick());
  await page.waitForFunction(
    () => document.querySelectorAll('#raidList .raid-item').length > 0, null, { timeout: 8000 })
    .catch(() => bad.push('이웃 밭 목록이 안 그려진다'));
  out = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#raidList .raid-item')];
    return {
      n: rows.length,
      names: rows.map(r => r.querySelector('.raid-name').textContent),
      tags: rows.map(r => r.querySelector('.raid-tag').textContent.trim()),
      text: rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    };
  });
  ok(out.n === 1 && out.names[0] === '밭주인', `상대 목록 = ${JSON.stringify(out.names)}`);
  // 불꽃 봉황(불) 대 유니콘(빛) — 순환에 없는 짝이라 「보통」이어야 한다
  ok(out.tags[0] === '보통', `상성 딱지 = ${out.tags[0]} (보통 기대)`);
  ok(/유니콘/.test(out.text[0]) && /반딧불이/.test(out.text[0]),
    `상대 줄에 지키개와 이삭이 같이 있다 — "${out.text[0]}"`);

  // ④ 이기면 — **서버의 주사위를 고정한다**
  const vBefore = sum((await store.get(VID)).farm.stash);
  const realRandom = Math.random;
  Math.random = () => 0;                      // 반드시 이긴다
  const won = await page.evaluate(async () => {
    const b0 = JSON.parse(JSON.stringify(S.inventory));
    await doRaid(0);
    return { b0, bag: JSON.parse(JSON.stringify(S.inventory)),
             rec: S.record.raidWon, tries: S.record.raids };
  });
  Math.random = realRandom;
  const got = (won.bag.firefly || 0) - (won.b0.firefly || 0);
  const vAfter = sum((await store.get(VID)).farm.stash);
  ok(got > 0, `이겼을 때 가방에 반딧불이 +${got}`);
  ok(vBefore - vAfter === got, `남의 밭이 그만큼 줄었다: ${vBefore} → ${vAfter} (가져온 ${got})`);
  ok(won.rec === 1 && won.tries === 1, `기록: 나간 ${won.tries}번 · 뚫은 ${won.rec}번`);
  ok((await store.get(VID)).farm.shieldUntil > Date.now(), '털린 밭에 방패가 걸린다');
  ok((await store.get(VID)).farm.log[0].by === '도둑고양이', '털린 쪽에 침입 기록이 남는다');

  // 방패가 걸린 밭은 목록에서 빠진다
  await page.evaluate(() => openRaidPick());
  await page.waitForTimeout(600);
  out = await page.evaluate(() => document.getElementById('raidList').textContent.trim());
  ok(!/밭주인/.test(out), `방패 걸린 밭은 목록에 안 뜬다 — "${out}"`);

  // ⑤ 지면 — 아무것도 안 늘고 남의 밭도 그대로
  {
    const g = (await store.get(VID)).farm;
    g.shieldUntil = 0; g.stash = { firefly: 9 };
    await store.farmSet(VID, g);
  }
  await page.evaluate(() => openRaidPick());
  await page.waitForFunction(
    () => document.querySelectorAll('#raidList .raid-item').length > 0, null, { timeout: 8000 })
    .catch(() => bad.push('두 번째 목록이 안 그려진다'));
  Math.random = () => 0.999;                  // 반드시 진다
  const lost = await page.evaluate(async () => {
    const b0 = JSON.parse(JSON.stringify(S.inventory));
    await doRaid(0);
    return { b0, bag: JSON.parse(JSON.stringify(S.inventory)), rec: S.record.raidWon };
  });
  Math.random = realRandom;
  ok((lost.bag.firefly || 0) === (lost.b0.firefly || 0), '졌을 때는 가방이 안 는다');
  ok(sum((await store.get(VID)).farm.stash) === 9, '졌을 때는 남의 밭도 그대로');
  ok(lost.rec === 1, '진 것은 뚫은 횟수에 안 들어간다');
  ok((await store.get(VID)).farm.log[0].win === false, '막아 낸 것도 기록에 남는다');

  // ⑥ 서버에 못 닿을 때 — **빈 밭으로 그리지 않는다**
  await page.route('**/api/farm/**', route => route.abort());
  out = await page.evaluate(async () => {
    await refreshFarm(); renderFarm();
    return { farm: FARM, text: document.getElementById('farmBody').textContent.trim(),
             harvestHidden: document.getElementById('farmHarvest').hidden };
  });
  ok(out.farm === null, '못 닿으면 밭을 「모른다」로 둔다');
  ok(/서버/.test(out.text), `못 닿으면 그렇게 말한다 — "${out.text}"`);
  ok(out.harvestHidden, '못 닿으면 「거두기」를 숨긴다 (눌러도 아무 일 없는 버튼을 두지 않는다)');
  await page.unroute('**/api/farm/**');

  await browser.close();
  await new Promise(r => server.close(r));

  if (errs.length) bad.push(...errs);
  if (bad.length) {
    console.log('❌ ' + bad.length + '건');
    bad.forEach(b => console.log('   ' + b));
    process.exit(1);
  }
  console.log('✅ 밭 · 약탈 — 거두고 · 털고 · 털리고 · 못 닿을 때까지');
  process.exit(0);
})();
