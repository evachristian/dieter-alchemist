// 흐린 장 — **비법서가 답지가 아니라 수수께끼가 되는 것**을 진짜 화면에서 해 본다.
//
// ⚠️ **여기서 재는 것의 핵심은 「부담이 없는가」와 「안 막히는가」다.**
//   · 틀려도 **재료가 한 톨도 안 없어지는가** ← 이게 무너지면 시스템 전체가 벌이 된다
//   · 맞은 칸은 그 자리에서 밝혀지고 **다시 안 어두워지는가**
//   · 하나만 맞아도 진도가 나가서 **절대 안 막히는가**
//   · 튜토리얼이 가르치는 물약은 **안 가려지는가** (배우는 중의 수수께끼는 시험이다)
//   · 재료를 많이 모으면 **저절로 밝아지는가** (추리가 싫은 사람의 우회로)
//
// 사용: node tools/checklore.js      (종료 코드 0 = 통과)
const path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }
function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

const out = [];
let failed = 0;
function ok(cond, msg, extra) {
  out.push(`  ${cond ? 'OK ' : '❌ '} ${msg}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed++;
}

(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    if (!localStorage.getItem('dieter_alchemist_save_v1'))
      localStorage.setItem('dieter_alchemist_save_v1',
        JSON.stringify({ ver: 8, name: '테스트', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
  });

  // ── 표가 성립하는가
  const tbl = await page.evaluate(() => {
    const P = D.RECIPES.filter(r => r.result.kind === 'potion');
    const bad = [];
    let allShown = 0, some = 0;
    P.forEach(r => {
      const h = D.hiddenOf(r);
      // **한 칸은 언제나 보인다** — 전부 가리면 벽이 된다
      if (h.length > r.inputs.length - D.LORE.keepShown && r.inputs.length > 0)
        bad.push(`${r.result.id}: ${r.inputs.length}칸 중 ${h.length}칸을 가렸다`);
      if (h.length > D.LORE.hiddenMax) bad.push(`${r.result.id}: 상한(${D.LORE.hiddenMax})을 넘겼다`);
      // **밭 작물·크리처는 안 가린다** — 구하는 법 자체를 모르게 된다
      h.forEach(id => {
        const it = D.INGREDIENTS[id];
        if (!it) bad.push(`${r.result.id}: 크리처를 가렸다 (${id})`);
        else if (it.farm) bad.push(`${r.result.id}: 밭 작물을 가렸다 (${id})`);
      });
      if (!h.length) allShown++; else some++;
      // **두 번 불러도 같은 답** — 무작위면 어제 밝힌 칸이 오늘 다시 가려진다
      if (D.hiddenOf(r).join() !== h.join()) bad.push(`${r.result.id}: 부를 때마다 답이 다르다`);
    });
    return { bad: bad.slice(0, 3), allShown, some, plain: D.LORE.plain };
  });
  ok(!tbl.bad.length, '가리는 칸이 규칙을 지킨다 (한 칸은 남기고 · 상한 안 넘고 · 밭·크리처 제외)',
     tbl.bad.join(' / ') || `가린 장 ${tbl.some} · 안 가린 장 ${tbl.allShown}`);

  // ── 튜토리얼이 가르치는 물약은 안 가려진다
  const tut = await page.evaluate(() =>
    D.LORE.plain.every(id => {
      const r = D.RECIPES.find(x => x.result.id === id);
      return r && D.hiddenOf(r).length === 0;
    }));
  ok(tut, '튜토리얼이 가르치는 물약은 안 가려진다 (배우는 중의 수수께끼는 시험이다)');

  // ── 수수께끼가 후보를 «좁혀» 주는가. 안 좁히면 벽이고, 너무 좁히면 답이다
  const narrow = await page.evaluate(() => {
    const zoneOf = id => {
      const m = D.MAPS.find(x => (x.pool || []).includes(id) || x.special === id);
      return m ? m.zone : null;
    };
    const box = {};
    Object.values(D.INGREDIENTS).filter(i => !i.farm).forEach(i => {
      const k = zoneOf(i.id) + '|' + D.ingRarity(i.id);
      (box[k] = box[k] || []).push(i.id);
    });
    const sz = Object.values(box).map(v => v.length);
    return { max: Math.max(...sz), avg: sz.reduce((a, b) => a + b, 0) / sz.length };
  });
  ok(narrow.avg >= 3 && narrow.max <= 14,
     '수수께끼가 후보를 알맞게 좁힌다 (너무 좁으면 답을 적어 주는 것이다)',
     `평균 ${narrow.avg.toFixed(1)}개 · 최대 ${narrow.max}개`);

  // ═══ ⚠️ 핵심 — 틀려도 재료가 안 없어진다 ═══
  const miss = await page.evaluate(async () => {
    S.known = {}; S.gathered = {}; S.inventory = {}; S.discovered = [];
    // 가려진 칸이 둘인 장을 하나 고른다
    const r = D.RECIPES.find(x => x.result.kind === 'potion' && D.hiddenOf(x).length === 2);
    S.discovered.push(r.result.id);
    S.cauldronId = D.CAULDRONS[D.CAULDRONS.length - 1].id;
    S.energy = 9999;
    // 레시피 재료 + 엉뚱한 재료를 넉넉히
    r.inputs.forEach(id => { S.inventory[id] = 5; });
    const wrongId = Object.keys(D.INGREDIENTS).find(id => r.inputs.indexOf(id) < 0);
    S.inventory[wrongId] = 5;
    save();
    fillFromRecipe(r.result.id);
    const before = JSON.stringify(S.inventory);
    const apBefore = S.energy;
    addToCauldron(wrongId);            // 엉뚱한 것을 넣고
    brew();                             // 저어 본다
    await new Promise(x => setTimeout(x, 120));
    return {
      id: r.result.id, wrongId,
      invSame: JSON.stringify(S.inventory) === before,
      apSpent: apBefore - S.energy,
      learned: (S.known[r.result.id] || []).length,
      guess: S.guess,
    };
  });
  ok(miss.invSame, '⚠️ **틀려도 재료가 한 톨도 안 없어진다** (부담을 없애는 한 줄)');
  ok(miss.apSpent === 25, '   …AP 는 든다 (안 들면 아무 생각 없이 누르게 된다)', `${miss.apSpent}`);
  ok(miss.learned === 0, '   …틀린 것으로는 아무것도 안 밝혀진다');
  ok(miss.guess === miss.id, '   …목표를 안 놓는다 (놓으면 영영 못 맞힌다)', String(miss.guess));

  // ── 맞으면 그 칸이 밝혀지고, 하나만 맞아도 진도가 난다
  //
  // ⚠️ **목표를 놓친 상태를 «넘어져서» 알리면 안 된다.** 여기서 `S.guess` 가 비면
  // 아래가 undefined 를 만져 검사기가 통째로 죽는데, 그러면 «무엇이 잘못됐는지»가
  // 결과에 안 나온다 — 실패로 «보고»해야 사보타주가 뜻이 있다
  const hit = await page.evaluate(async () => {
    const r = D.RECIPES.find(x => x.result.id === S.guess);
    if (!r) return { lost: true };
    const un = unknownOf(r);
    const first = un[0];
    addToCauldron(first);
    brew();
    await new Promise(x => setTimeout(x, 120));
    const after = unknownOf(r);
    return { was: un.length, now: after.length, known: (S.known[r.result.id] || []).slice(),
             inv: S.inventory[first] };
  });
  ok(!hit.lost && hit.now === hit.was - 1, '맞은 칸이 하나 밝혀진다 (하나만 맞아도 진도가 난다)',
     hit.lost ? '⚠️ 목표를 놓쳤다 — 이 상태로는 영영 못 맞힌다' : `모르는 칸 ${hit.was} → ${hit.now}`);
  ok(!hit.lost && hit.inv === 5, '   …맞혔을 때도 재료는 안 없어진다',
     hit.lost ? '(목표를 놓쳐서 못 쟀다)' : `남은 것 ${hit.inv}`);

  // ── 다 밝히면 진짜로 만들어진다
  const done = await page.evaluate(async () => {
    const r = D.RECIPES.find(x => x.result.id === S.guess);
    if (!r) return { lost: true, left: -1, made: 0, guard: 0 };
    let guard = 0;
    while (unknownOf(r).length && guard++ < 6) {
      addToCauldron(unknownOf(r)[0]);
      brew();
      await new Promise(x => setTimeout(x, 80));
    }
    const before = S.potions[r.result.id] || 0;
    fillFromRecipe(r.result.id);
    brew();
    await new Promise(x => setTimeout(x, 200));
    // 결과 팝업이 떠 있으면 닫는다
    const okBtn = document.querySelector('#brewResult .btn-primary');
    if (okBtn) okBtn.click();
    return { left: unknownOf(r).length, made: (S.potions[r.result.id] || 0) - before, guard };
  });
  ok(done.left === 0, '몇 번 저으면 반드시 다 밝혀진다 (절대 안 막힌다)',
     done.lost ? '⚠️ 목표를 놓쳐서 이어서 못 한다' : `${done.guard}번`);
  ok(done.made === 1, '   …다 밝히면 진짜로 만들어진다', `${done.made}개`);

  // ── 한 번 밝힌 것은 다시 안 어두워진다
  const keep = await page.evaluate(() => {
    const r = D.RECIPES.find(x => x.result.kind === 'potion' && (S.known[x.result.id] || []).length);
    if (!r) return -1;                     // 아무것도 못 밝혔다 (앞이 이미 실패한 것이다)
    S.gathered = {};                       // 숙련을 지워도
    render();
    return unknownOf(r).length;
  });
  ok(keep === 0, '한 번 밝힌 칸은 다시 안 어두워진다',
     keep < 0 ? '⚠️ 밝혀낸 장이 하나도 없다' : '');

  // ── 재료를 많이 모으면 저절로 밝아진다 (추리가 싫은 사람의 우회로)
  const mastery = await page.evaluate(() => {
    S.known = {}; S.gathered = {};
    const r = D.RECIPES.find(x => x.result.kind === 'potion' && D.hiddenOf(x).length === 2);
    const before = unknownOf(r).length;
    D.hiddenOf(r).forEach(id => { S.gathered[id] = D.LORE.masteryAt; });
    const after = unknownOf(r).length;
    // 문턱 바로 아래면 아직 모른다
    S.gathered = {}; D.hiddenOf(r).forEach(id => { S.gathered[id] = D.LORE.masteryAt - 1; });
    return { before, after, justUnder: unknownOf(r).length, at: D.LORE.masteryAt };
  });
  ok(mastery.before === 2 && mastery.after === 0,
     `재료를 ${mastery.at}개 모으면 저절로 밝아진다`, `${mastery.before} → ${mastery.after}`);
  ok(mastery.justUnder === 2, `   …문턱 바로 아래(${mastery.at - 1}개)에서는 아직 모른다`);

  // ── 누적은 «쓰면 줄어드는 것»과 달라야 한다
  const cum = await page.evaluate(() => {
    S.gathered = {}; S.inventory = {};
    addInv('herb', 40);
    const g1 = S.gathered.herb;
    removeInv('herb', 40);                 // 다 써 버려도
    return { g1, g2: S.gathered.herb, inv: invCount('herb') };
  });
  ok(cum.g1 === 40 && cum.g2 === 40 && cum.inv === 0,
     '⚠️ 모아 본 누적은 «써도» 안 줄어든다 (inventory 를 쓰면 숙련이 도로 사라진다)',
     `누적 ${cum.g2} · 가진 것 ${cum.inv}`);

  // ── 화면 — 모르는 칸이 수수께끼로 그려진다
  const ui = await page.evaluate(() => {
    S.known = {}; S.gathered = {};
    const r = D.RECIPES.find(x => x.result.kind === 'potion' && D.hiddenOf(x).length === 2);
    if (!S.discovered.includes(r.result.id)) S.discovered.push(r.result.id);
    openPage(r.result.id);
    const rows = document.querySelectorAll('#pageSheet .pg-row');
    const un = document.querySelectorAll('#pageSheet .pg-row.unknown');
    if (!un.length) return '수수께끼 줄이 없다';
    if (un.length !== 2) return `수수께끼 줄이 ${un.length}개다 (2 기대)`;
    if (rows.length === un.length) return '전부 가려졌다 — 한 칸은 보여야 한다';
    const txt = un[0].textContent;
    // **어디서 나는지와 흔한 정도가 적혀 있어야** 후보를 좁힐 수 있다
    if (!/지대|평야|숲|산|해안|황무지/.test(txt)) return '수수께끼에 지대가 없다';
    // ⚠️ 재료 «이름»이 새어 나오면 안 된다
    const name = N(D.hiddenOf(r)[0], D.INGREDIENTS[D.hiddenOf(r)[0]].name);
    if (txt.indexOf(name) >= 0) return `수수께끼에 답이 그대로 적혀 있다 (${name})`;
    return null;
  });
  ok(ui === null, '비법서에 수수께끼 줄이 뜨고 답이 안 새어 나온다', typeof ui === 'string' ? ui : '');

  // ═══ ⚠️ 이미 하던 사람에게서 «뺏지» 않는가 (세이브 13 마이그레이션) ═══
  //
  // 그냥 바꾸면 어제까지 만들던 물약이 오늘 갑자기 수수께끼가 된다 —
  // 새 재미를 주려다 가지고 있던 것을 뺏는 꼴이다. 수수께끼는 **이 뒤에 오는 장부터**다.
  {
    const old = await browser.newContext();
    const op = await old.newPage();
    const known = ['p_06', 'p_07', 'p_08'];
    await op.addInitScript((ids) => {
      localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
      localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify({
        ver: 12, name: '옛사람', nameClaimed: true, tutorialDone: true,
        discovered: ['vitality', 'blush'].concat(ids),
        inventory: { herb: 44, berry: 7 },
        // 튜토리얼을 마친 상태로 둔다 — 안 그러면 첫 재료 주머니가 한 번 더 들어와
        // 누적이 44 가 아니라 45 가 된다 (게임이 아니라 심어 둔 세이브의 문제다)
        tut: { step: 0, beat: 0, done: true, did: { gift: true } },
      }));
    }, known);
    await op.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
    await op.waitForTimeout(2200);
    const kept = await op.evaluate((ids) => {
      const left = ids.map(id => {
        const r = D.RECIPES.find(x => x.result.id === id);
        return r ? unknownOf(r).length : -1;
      });
      return { ver: S.ver, left, herb: (S.gathered || {}).herb, mastered: ingMastered('herb') };
    }, known);
    ok(kept.left.every(n => n === 0),
       '⚠️ 이미 가진 장은 그대로 밝다 (하던 사람에게서 뺏지 않는다)',
       `모르는 칸 ${kept.left.join('/')}`);
    ok(kept.herb >= 44 && kept.mastered,
       '   …쌓아 둔 재료만큼은 모아 본 것으로 친다', `누적 ${kept.herb}`);
    // 그 뒤에 «새로» 들어오는 장은 흐리다
    const fresh = await op.evaluate(() => {
      const r = D.RECIPES.find(x => x.result.kind === 'potion'
        && !S.discovered.includes(x.result.id) && D.hiddenOf(x).length === 2
        && D.hiddenOf(x).every(id => !ingMastered(id)));
      if (!r) return -1;
      S.discovered.push(r.result.id);
      return unknownOf(r).length;
    });
    ok(fresh === 2, '   …그 뒤에 새로 오는 장부터 흐리다', `모르는 칸 ${fresh}`);
    await old.close();
  }

  ok(!errs.length, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));

  await browser.close();
  console.log('── 흐린 장');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n흐린 장 검사 전부 통과 ✅');
})();
