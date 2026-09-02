// 키워드 대화를 **진짜 화면에서 끝까지 걸어 본다** (STORY.md 「키워드 시스템」).
//
// `checktalk.js` 는 표만 본다 — 표가 맞아도 화면에서 안 눌리면 아무 소용이 없다.
// 여기서 보는 것:
//   · 마을 셋이 전부 잠긴 채로 시작하는가 (부엌 말고는 갈 데가 없다)
//   · 부엌 칩 → 일곱 굴뚝이 열리는가
//   · 마을 안에서 칩을 눌러 대답이 «말풍선에» 뜨는가
//   · 사슬 끝까지 걸어 셋이 다 열리는가
//   · 다시 물어도 되고, **주는 것은 한 번뿐인가**
//   · 새로 물어볼 것이 있는 마을 탭에 점(●)이 뜨는가 — 「길 잃음 방지」
//
// 사용: node tools/checkask.js      (종료 코드 0 = 통과)
const path = require('path');
const ROOT = path.join(__dirname, '..');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }
// 미리 깔려 있는 크로미움이 있으면 그것을 쓴다 (checktut·checkui 와 같은 규칙)
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
  // 인트로를 건너뛰고 시작한다 (여기서 볼 것이 아니다 — checkui·checktut 과 같은 규칙)
  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    // ⚠️ **이미 있으면 안 덮어쓴다.** 덮어쓰면 새로고침 검사가 스스로 세이브를 지워
    // 「안 남았다」가 나온다 (게임이 아니라 검사기의 잘못이다 — 실제로 그랬다)
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

  // 부엌이 열려 있어야 이야기가 시작된다
  await page.evaluate(() => {
    S.tutorialDone = true;
    S.name = '테스트';
    S.seenCuts = ['c_clemen_meet'];      // 인사 컷씬은 건너뛴다 (여기서 볼 것이 아니다)
    save(); render();
  });

  // ── 시작 상태
  let st = await page.evaluate(() => ({ kw: S.keywords.slice(), vl: S.villages.slice() }));
  ok(st.kw.length === 1 && st.kw[0] === 'kw_hunger', '시작 키워드는 「정신적 허기」 하나', st.kw.join(','));
  ok(st.vl.length === 0, '마을은 전부 잠겨 있다', `열린 곳 ${st.vl.length}`);

  // ── 부엌
  await page.evaluate(() => openKitchen());
  await page.waitForSelector('#kitchenSheet.show .ask-chip', { timeout: 4000 });
  let chips = await page.$$eval('#kitchenSheet .ask-chip', els => els.map(e => e.textContent.trim()));
  ok(chips.length === 1 && chips[0].includes('허기'), '부엌 칩은 가진 것 하나뿐', chips.join(' / '));
  ok(chips[0].includes('🆕'), '아직 안 물어본 것에 🆕 가 붙는다');

  await page.click('#kitchenSheet .ask-chip');
  await page.waitForTimeout(80);
  let said = await page.$eval('#kitchenSheet .q-text', e => e.textContent.trim());
  ok(said.includes('일곱 굴뚝'), '대답이 오늘의 한 마디를 밀어내고 뜬다', said.slice(0, 24));
  st = await page.evaluate(() => ({ kw: S.keywords.slice(), vl: S.villages.slice() }));
  ok(st.kw.includes('kw_beauty'), '「아름다움」을 얻는다');
  ok(st.vl.includes('vl_chimney'), '일곱 굴뚝이 열린다');

  chips = await page.$$eval('#kitchenSheet .ask-chip', els => els.map(e => e.textContent.trim()));
  ok(chips.length === 2, '칩이 둘로 는다', chips.join(' / '));
  ok(!chips.find(c => c.includes('허기')).includes('🆕'), '물어본 것은 🆕 가 사라진다 (칩은 남는다)');

  // **다시 물어도 되지만 주는 것은 한 번뿐이다**
  const before = await page.evaluate(() => S.keywords.length);
  await page.click('#kitchenSheet .ask-chip');
  await page.waitForTimeout(60);
  ok(await page.evaluate(() => S.keywords.length) === before, '다시 물어도 키워드가 두 번 안 들어온다');

  await page.evaluate(() => closeKitchen());

  // ── 마을 안에서 사슬을 끝까지
  async function askIn(village, spot, kwName) {
    await page.evaluate(([v, s]) => { switchTab('gather'); setGatherTab('village'); setVillage(v); tapVillageSpot(v, s); },
      [village, spot]);
    // **짧게 기다린다.** 사슬이 끊기면 이 자리는 영영 안 나타나는데, 기본 30초로 두면
    // 검사가 실패 대신 **멈춰 버린다** — 못 갔다는 사실이 결과에 안 나온다
    try { await page.waitForSelector('#villageBody .ask-chip', { timeout: 2000 }); }
    catch (e) { return null; }
    const idx = await page.$$eval('#villageBody .ask-chip',
      (els, n) => els.findIndex(e => e.textContent.includes(n)), kwName);
    if (idx < 0) return null;
    await page.$$eval('#villageBody .ask-chip', (els, i) => els[i].click(), idx);
    await page.waitForTimeout(80);
    return await page.$eval('#villageBody .npc-line', e => e.textContent.trim());
  }

  let line = await askIn('vl_chimney', 'vs_chimney_forge', '아름다움');
  ok(line && line.includes('깎인'), '오릭스가 말풍선에 답한다', (line || '').slice(0, 20));
  ok(await page.evaluate(() => S.keywords.includes('kw_gem')), '「광석」을 얻는다');
  await askIn('vl_chimney', 'vs_chimney_forge', '광석');
  await askIn('vl_chimney', 'vs_chimney_forge', '여왕');
  ok(await page.evaluate(() => S.keywords.includes('kw_song')), '「노래」까지 이어진다');

  // 굴뚝의 여관 — 카이로스. **점이 여기 떠 있어야 한다** (아직 안 물어본 것이 있다)
  await page.evaluate(() => { setVillage('vl_chimney'); leaveSpot(); });
  await page.waitForSelector('#villageBody .vil-pin', { timeout: 2000 }).catch(() => {});
  const pinDot = await page.$$eval('#villageBody .vil-pin',
    els => els.filter(e => e.querySelector('.tab-dot')).map(e => e.dataset.vspot));
  ok(pinDot.includes('vs_chimney_inn'), '새로 물어볼 것이 있는 건물에 점이 뜬다', pinDot.join(','));

  await askIn('vl_chimney', 'vs_chimney_inn', '노래');
  await askIn('vl_chimney', 'vs_chimney_inn', '독사과');
  ok(await page.evaluate(() => S.villages.includes('vl_apple')), '붉은 사과밭이 열린다');

  await askIn('vl_apple', 'vs_apple_empty', '독사과');
  await askIn('vl_apple', 'vs_apple_empty', '저주');
  ok(await page.evaluate(() => S.villages.includes('vl_mirror')), '거울 골짜기가 열린다');

  line = await askIn('vl_mirror', 'vs_mirror_pond', '저주');
  ok(line && line.includes('모르겠'), '유타르크는 저주에 「모르겠다」고 한다', (line || '').slice(0, 20));

  // ── 탭의 점 — 다 물어보고 나면 꺼진다
  await page.evaluate(() => { leaveSpot(); });
  await page.waitForSelector('#villageTabs .cat-tab', { timeout: 2000 }).catch(() => {});
  let dots = await page.$$eval('#villageTabs .cat-tab',
    els => els.filter(e => e.querySelector('.tab-dot')).map(e => e.dataset.village));
  ok(dots.length > 0, '아직 안 물어본 마을 탭에 점이 있다', dots.join(','));
  // 남은 것을 전부 물어본다
  await page.evaluate(() => {
    D.ASKS.forEach(a => { if (S.keywords.includes(a.kw)) doAsk(a.npc, a.kw); });
    leaveSpot();
  });
  await page.waitForTimeout(120);
  dots = await page.$$eval('#villageTabs .cat-tab',
    els => els.filter(e => e.querySelector('.tab-dot')).map(e => e.dataset.village));
  ok(dots.length === 0, '다 물어보면 점이 꺼진다', dots.join(','));

  // ── 새로고침해도 남는가 (세이브)
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  st = await page.evaluate(() => ({ kw: S.keywords.length, vl: S.villages.slice(), tk: S.talked.length }));
  ok(st.vl.length === 3, '연 마을 셋이 세이브에 남는다', st.vl.join(','));
  ok(st.kw === 8 && st.tk === 17, '키워드 8 · 물어본 것 17 이 남는다', `kw ${st.kw} · talked ${st.tk}`);

  ok(!errs.length, '콘솔 오류 없음', errs.slice(0, 2).join(' | '));

  await browser.close();
  console.log('── 키워드 대화');
  out.forEach(l => console.log(l));
  if (failed) { console.log(`\n❌ ${failed}건 실패`); process.exit(1); }
  console.log('\n키워드 대화 검사 전부 통과 ✅');
})();
