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
  // 이삭은 **칸(plot)마다** 들어 있다 — 첫 칸에 심어 두고 나머지는 비운다
  const freshFarm = stash => ({
    plots: [{ crop: null, stash }, { crop: null, stash: {} }],
    grownAt: now(), shieldUntil: 0, raids: 3, raidAt: now(), log: [],
  });
  const ears = f => (f.plots || []).reduce((n, p) => n + sum(p.stash), 0);

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
      harvestOff: document.querySelector('.farm-do-harvest').disabled,
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
  ok(ears((await store.get(RID)).farm) === 0, '서버 쪽 밭도 비었다');

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
  const vBefore = ears((await store.get(VID)).farm);
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
  const vAfter = ears((await store.get(VID)).farm);
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
    g.shieldUntil = 0;
    g.plots.forEach(p => { p.stash = {}; });
    g.plots[0].stash = { firefly: 9 };
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
  ok(ears((await store.get(VID)).farm) === 9, '졌을 때는 남의 밭도 그대로');
  ok(lost.rec === 1, '진 것은 뚫은 횟수에 안 들어간다');
  ok((await store.get(VID)).farm.log[0].win === false, '막아 낸 것도 기록에 남는다');

  // ⑥ 서버에 못 닿을 때 — **빈 밭으로 그리지 않는다**
  await page.route('**/api/farm/**', route => route.abort());
  out = await page.evaluate(async () => {
    await refreshFarm(); renderFarm();
    return { farm: FARM, text: document.getElementById('farmBody').textContent.trim(),
             harvestHidden: !document.querySelector('.farm-do-harvest') };
  });
  ok(out.farm === null, '못 닿으면 밭을 「모른다」로 둔다');
  ok(/서버/.test(out.text), `못 닿으면 그렇게 말한다 — "${out.text}"`);
  ok(out.harvestHidden, '못 닿으면 「거두기」를 안 내놓는다 (눌러도 아무 일 없는 버튼을 두지 않는다)');
  await page.unroute('**/api/farm/**');

  // ⑦ 심기 (3단계) — **가방에서 값이 나가고, 시간은 서버가 잰다**
  {
    // 심을 수 있게 재료를 채우고 밭을 비운다
    await store.farmSet(RID, freshFarm({}));
    out = await page.evaluate(async () => {
      const c = D.FARM_CROPS[0];
      Object.keys(c.cost).forEach(id => { S.inventory[id] = c.cost[id] + 1; });
      save();
      await pullFarm();
      openPlant(0);
      const rows = [...document.querySelectorAll('#plantList .plant-item')];
      return {
        shown: document.getElementById('plantPick').classList.contains('show'),
        n: rows.length,
        off: rows.filter(r => r.classList.contains('off')).length,
        crop: c.id, cost: JSON.parse(JSON.stringify(c.cost)),
        bag: JSON.parse(JSON.stringify(S.inventory)),
      };
    });
    ok(out.shown && out.n === 6, `심기 시트에 작물 여섯 (${out.n})`);
    // **없는 재료는 목록에서 빼지 않고 회색으로 남긴다** — 빼면 무엇이 모자란지 모른다
    ok(out.off === 5, `못 심는 것은 회색으로 남는다 (${out.off}개 / 5 기대)`);

    const bagBefore = out.bag, crop = out.crop, cost = out.cost;
    out = await page.evaluate(async (id) => {
      await doPlant(id);
      const p = FARM && FARM.plots && FARM.plots[0];
      return { bag: JSON.parse(JSON.stringify(S.inventory)), plot: p,
               rec: S.record.planted, sheet: document.getElementById('plantPick').classList.contains('show') };
    }, crop);
    ok(out.plot && out.plot.crop === crop, `심었다 (${out.plot && out.plot.crop})`);
    ok(!out.sheet, '심으면 시트가 닫힌다');
    ok(out.rec === 1, `기록에 남는다 (${out.rec})`);
    const paid = Object.keys(cost).every(id => (bagBefore[id] || 0) - (out.bag[id] || 0) === cost[id]);
    ok(paid, `가방에서 값이 나갔다 — ${Object.keys(cost).map(id =>
      `${id} ${bagBefore[id]}→${out.bag[id] || 0}`).join(' · ')}`);
    // **시간은 서버가 잰다** — 클라이언트가 보낸 값이 아니다
    const sp = (await store.get(RID)).farm.plots[0];
    const hrs = Math.round((sp.ready - sp.at) / 3600e3);
    ok(hrs === 12, `서버가 잰 시간 ${hrs}시간 (12 기대)`);
    // 자라는 중에는 추수해도 안 나온다
    out = await page.evaluate(() =>
      document.querySelector('.plot-row').textContent.replace(/\s+/g, ' ').trim());
    ok(/시간 뒤/.test(out), `칸 줄에 남은 시간이 적힌다 — "${out}"`);

    // 여물게 해 두고 추수하면 **가방에 들어온다**
    { const g = (await store.get(RID)).farm; g.plots[0].ready = Date.now() - 1000; await store.farmSet(RID, g); }
    out = await page.evaluate(async () => {
      await pullFarm();
      const ripe = document.querySelector('.plot-row.ripe');
      const b0 = JSON.parse(JSON.stringify(S.inventory));
      await harvestFarm();
      return { ripe: !!ripe, b0, bag: JSON.parse(JSON.stringify(S.inventory)),
               plot: FARM && FARM.plots && FARM.plots[0] };
    });
    ok(out.ripe, '다 자란 칸은 눈에 띄게 그려진다 (.ripe)');
    ok((out.bag[crop] || 0) - (out.b0[crop] || 0) === 3, `추수하면 가방에 ${crop} +${(out.bag[crop] || 0) - (out.b0[crop] || 0)} (3 기대)`);
    ok(out.plot && out.plot.crop === null, '거둔 칸은 다시 빈 칸이 된다');

    // 칸 사기 — 현자의 결정으로 낸다
    out = await page.evaluate(async () => {
      S.crystal = 9999;
      const n0 = FARM.plots.length, c0 = S.crystal;
      await buyPlot();
      return { n0, c0, n: FARM.plots.length, c: S.crystal, cost: D.PLOT_COST[n0] };
    });
    ok(out.n === out.n0 + 1, `칸이 ${out.n0} → ${out.n}`);
    ok(out.c0 - out.c === out.cost, `현자의 결정 ${out.cost} 를 냈다 (${out.c0} → ${out.c})`);
  }

  // ⑧ 여신 전에는 밭 탭이 **그려진 크기가 0** 이어야 한다.
  // ⚠️ `hidden` 속성만으로는 안 숨는다 — `.room-tab{display:flex}` 에 진다.
  // 속성이 아니라 **재 본 크기**로 봐야 한다 (랭킹 탭에서 실제로 겪었다)
  out = await page.evaluate(() => {
    S.stats.charm = 0; S.charmPeak = 0;
    switchTab('gather'); render();
    const b = document.getElementById('gtabFarm');
    return { open: farmOpen(), w: b.getBoundingClientRect().width,
             disp: getComputedStyle(b).display };
  });
  ok(!out.open && out.w === 0, `여신 전에는 밭 탭이 안 보인다 (폭 ${out.w}px · ${out.disp})`);

  // ⑨ 여신이 되면 탭이 열리고, 마이 룸의 🌾 는 **그 탭으로 보낸다**
  out = await page.evaluate(async () => {
    S.stats.charm = 500; charmPeak();          // 최고 기록을 올린다
    switchTab('showcase'); render();
    openFarm();                                 // 마이 룸의 🌾 버튼과 같은 길
    await pullFarm();
    const panel = document.getElementById('farmPanelBody');
    return {
      open: farmOpen(), tab: currentTab, gtab: gatherTab,
      sheet: document.getElementById('farmSheet').classList.contains('show'),
      w: document.getElementById('gtabFarm').getBoundingClientRect().width,
      text: panel.textContent.replace(/\s+/g, ' ').trim(),
      btns: panel.querySelectorAll('.farm-btns .btn').length,
    };
  });
  ok(out.open && out.w > 0, `여신이 되면 밭 탭이 보인다 (폭 ${Math.round(out.w)}px)`);
  ok(out.tab === 'gather' && out.gtab === 'farm', `🌾 를 누르면 탐험의 밭 탭으로 간다 (${out.tab}/${out.gtab})`);
  ok(!out.sheet, '여신부터는 마이 룸 시트를 안 띄운다 (같은 것을 두 자리에서 보여 주지 않는다)');
  ok(out.btns === 2, `탭에도 버튼 둘이 있다 (${out.btns})`);
  ok(/지키는 아이/.test(out.text) && /다녀간 이웃/.test(out.text),
    `탭이 시트와 같은 내용을 그린다 — "${out.text.slice(0, 50)}…"`);

  // **한 번 연 것은 안 닫힌다** — 애착을 약한 것으로 바꿔 총합이 내려가도
  out = await page.evaluate(() => {
    S.stats.charm = 0;                          // 총합은 떨어지지만 최고 기록은 남는다
    render();
    return { open: farmOpen(), w: document.getElementById('gtabFarm').getBoundingClientRect().width };
  });
  ok(out.open && out.w > 0, '매력이 떨어져도 한 번 연 밭은 안 닫힌다 (charmPeak)');

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
