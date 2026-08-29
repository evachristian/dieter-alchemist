// 크리처를 재료로 녹이는 길이 **실제로 뚫려 있는가** (7단계)
//
// 표만 보면 안 된다 — `data.js` 의 상급 조합에 중급 크리처 id 가 들어가 있어도,
// 가방에 안 뜨거나 솥이 안 받거나 조합할 때 개체가 안 줄면 아무 소용이 없다.
// 그래서 **진짜 게임 화면에서 담고 조합해** 개체 수까지 센다.
//
// 보는 것 넷:
//   ① 한 마리뿐이면 못 녹인다 (가방에 안 뜨고, 넣으려 하면 막힌다)
//   ② 두 마리면 초과분 하나가 가방에 뜬다
//   ③ 레시피를 누르면 솥에 크리처까지 담긴다
//   ④ 조합하면 상급이 나오고 **중급이 하나 줄어든다** (남는 것은 한 마리)
//
// 사용: node tools/checkmelt.js  (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
const BASE = process.env.BASE || 'http://localhost:8080';

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

const launchOpts = () => {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
};

(async () => {
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
      { ver: 8, name: 'Melt', nameClaimed: true, tutorialDone: true }));
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.classList.add('done');
  });

  const out = await page.evaluate(() => {
    const bad = [], D = window.GameData;
    // 크리처를 재료로 먹는 레시피 하나를 데이터에서 **찾아서** 쓴다 —
    // id 를 박아 두면 축 표가 바뀔 때 검사만 조용히 헛돈다
    const isCr = id => D.RECIPES.some(x => x.result.id === id && x.result.kind === 'creature');
    const target = D.RECIPES.find(r => r.result.kind === 'creature'
      && r.inputs.some(isCr));
    if (!target) return { bad: ['크리처를 재료로 먹는 레시피가 하나도 없다'] };
    const meltId = target.inputs.find(isCr);
    const ings = target.inputs.filter(id => !isCr(id));

    // 솥을 그 가짓수에 맞게 열어 두고, 재료를 넉넉히 넣는다
    S.record = S.record || { pots: [] };
    const pot = D.CAULDRONS.filter(c => c.slots >= target.inputs.length)
      .sort((a, b) => a.slots - b.slots)[0];
    S.cauldronId = pot.id;
    if (!S.record.pots.includes(pot.id)) S.record.pots.push(pot.id);
    // 솥 해금 점수 — `isCauldronOpen` 은 `totalCharm()`(비주얼+매력)을 본다
    S.stats.beauty = 9999;
    S.energy = 999;
    switchTab('atelier');                 // **공방을 열어야** 가방이 그려진다
    ings.forEach(id => { S.inventory[id] = 5; });
    S.discovered = S.discovered || [];
    if (!S.discovered.includes(target.result.id)) S.discovered.push(target.result.id);

    const bagIds = () => [...document.querySelectorAll('#ingredientBag .ing-chip')]
      .map(e => (e.getAttribute('onclick') || '').replace(/.*'(.+)'.*/, '$1'));

    // ① 한 마리뿐이면 못 녹인다
    S.creatures = [meltId];
    S.cauldron = []; S.want = [];
    render();
    if (bagIds().includes(meltId)) bad.push('한 마리뿐인데 가방에 떴다');
    if (stockOf(meltId) !== 0) bad.push(`한 마리뿐인데 stockOf 가 ${stockOf(meltId)}`);
    addToCauldron(meltId);
    if (S.cauldron.includes(meltId)) bad.push('한 마리뿐인데 솥에 들어갔다');

    // ② 두 마리면 초과분 하나
    S.creatures = [meltId, meltId];
    S.cauldron = []; S.want = [];
    render();
    if (!bagIds().includes(meltId)) bad.push('두 마리인데 가방에 안 뜬다');
    if (stockOf(meltId) !== 1) bad.push(`두 마리인데 stockOf 가 ${stockOf(meltId)}`);

    // ③ 레시피를 누르면 솥에 크리처까지 담긴다
    if (!hasAllInputs(target)) bad.push('재료가 다 있는데 hasAllInputs 가 false');
    fillFromRecipe(target.result.id, null);
    const key = D.recipeKey(S.cauldron);
    if (key !== D.recipeKey(target.inputs)) {
      bad.push(`솥에 담긴 것이 레시피와 다르다: ${S.cauldron.join('+')}`);
    }

    // ④ 조합하면 상급이 나오고 중급이 하나 줄어든다
    const before = S.creatures.filter(x => x === meltId).length;
    brew();
    const after = S.creatures.filter(x => x === meltId).length;
    if (after !== before - 1) bad.push(`녹인 뒤 개체가 ${before} → ${after} (하나 줄어야 한다)`);
    if (!S.creatures.includes(target.result.id)) bad.push('상급 크리처가 안 생겼다');
    // **남는 한 마리는 그대로다** — 장착이 풀리거나 로열티가 날아가면 안 된다
    if (after !== 1) bad.push(`남은 개체가 ${after}마리다 (한 마리여야 한다)`);

    return { bad, target: target.result.id, melt: meltId, ings: ings.join(' ') };
  });

  await browser.close();
  if (errs.length) out.bad = (out.bad || []).concat(errs);
  console.log(`크리처 녹이기: ${out.melt} 둘 → ${out.target} (재료 ${out.ings})`);
  if (out.bad.length) {
    console.log('❌ ' + out.bad.length + '건');
    out.bad.forEach(b => console.log('   ' + b));
    process.exit(1);
  }
  console.log('✅ 초과분만 녹고 · 마지막 한 마리는 남는다');
})();
