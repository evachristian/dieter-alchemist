// 튜토리얼을 처음부터 끝까지 **진짜 마우스로** 눌러 본다.
//
// checkUI 는 '그 화면이 읽히는가' 를 보고, 이쪽은 '그 화면을 통과할 수 있는가' 를 본다.
// 튜토리얼은 새 플레이어가 반드시 지나는 외길이라 **한 자리만 막혀도 게임을 시작조차
// 못 한다.** 눈으로는 확인할 수 없다 — 열여덟 단계를 매번 손으로 눌러 볼 수는 없다.
//
// 보는 것:
//   · 인트로가 끝나는 자리에서 튜토리얼이 이어받는가 (인트로 위에 겹치지 않는가)
//   · 열여덟 단계가 끝까지 진행되는가 (막다른 자리가 없는가)
//   · 구멍 안은 진짜로 눌리는가       — 아래 버튼이 클릭을 받는가
//   · 구멍 밖은 진짜로 안 눌리는가     — 막이 정말 막는가
//   · 끝나면 tutorialDone 이 켜지고 잠겼던 것들이 열리는가
//
// **el.click() 을 쓰면 안 된다.** 그것은 pointer-events 를 무시하므로 막이 뚫려
// 있는지 없는지를 전혀 검사하지 못한다 — 반드시 page.mouse.click 으로 누른다.
// 막의 칠해진 자리인지는 path.isPointInFill() 로 판정한다 (pointer-events 설정과 무관하다).
//
// 사용: node tools/checktut.js   (서버가 떠 있어야 한다 / 종료 코드 0 = 통과)
const BASE = process.env.BASE || 'http://localhost:8080';
const W = Number(process.env.W) || 390;
const H = Number(process.env.H) || 780;

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.error('playwright 가 없다. NODE_PATH 로 설치 위치를 알려 줄 것.'); process.exit(2); }

function launchOpts() {
  const pre = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  return require('fs').existsSync(pre) ? { executablePath: pre } : {};
}

// 튜토리얼이 구멍을 뚫을 만한 것들. 여기 없는 것을 대상으로 삼는 단계가 생기면
// '구멍 안에서 누를 것을 못 찾았다' 로 잡힌다 — 그때 이 목록에 더한다.
const CLICKABLE = '.tab-btn, .room-tab, .recipe-row, .cauldron-actions .btn-primary,'
  + ' .potion-card, .btn-gather, .bag-toggle, .ing-chip, .wr-item';

(async () => {
  const browser = await chromium.launch(launchOpts());
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
  page.on('console', m => {
    // 폰트·파비콘 같은 바깥 자원은 이 검사와 무관하다 (오프라인 환경에서 늘 실패한다)
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('[console] ' + m.text());
  });

  // **진짜 첫 실행에서 시작한다** — 인트로부터 본다. 튜토리얼은 인트로가 끝나는
  // 자리에서 이어받게 되어 있고, 그 이음매가 이 검사의 첫 항목이다.
  // 이름만 미리 넣어 둔다 (이름 입력 팝업은 이 검사의 대상이 아니다).
  // ver 는 최신으로 — 그래야 마이그레이션이 '옛 세이브' 로 보고 튜토리얼을 꺼 버리지 않는다.
  await page.addInitScript(() => {
    localStorage.removeItem('dieter_alchemist_intro_seen_v1');
    localStorage.setItem('dieter_alchemist_save_v1',
      JSON.stringify({ ver: 10, name: 'Tester', nameClaimed: true }));
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  await page.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });

  const bad = [];
  {
    const during = await page.evaluate(() => ({
      playing: window.Intro ? Intro.isPlaying() : false,
      tutOn: document.getElementById('tut').classList.contains('on'),
      berry: (S.inventory || {}).berry || 0,
    }));
    if (!during.playing) bad.push('첫 실행인데 인트로가 안 떴다');
    // 인트로(z 9990)가 튜토리얼(z 60)보다 위라 겹쳐도 눈에 안 띈다 — 그래서 여기서 본다
    if (during.tutOn) bad.push('인트로가 도는 동안 튜토리얼 막이 떴다');
    if (during.berry) bad.push('인트로 도중에 첫 재료 주머니가 들어왔다');
    await page.evaluate(() => Intro.skip());
    await page.waitForTimeout(1600);
    const after = await page.evaluate(() => ({
      playing: Intro.isPlaying(),
      tutOn: document.getElementById('tut').classList.contains('on'),
      berry: (S.inventory || {}).berry || 0, herb: (S.inventory || {}).herb || 0,
    }));
    if (after.playing) bad.push('인트로가 안 끝났다');
    if (!after.tutOn) bad.push('인트로가 끝났는데 튜토리얼이 이어받지 않았다');
    if (after.berry !== 1 || after.herb !== 1) bad.push('첫 재료 주머니가 안 왔다');
  }

  const info = () => page.evaluate(() => {
    const el = document.getElementById('tut');
    return {
      on: !!(el && el.classList.contains('on')),
      loose: !!(el && el.classList.contains('loose')),
      step: S.tut.step, beat: S.tut.beat, done: S.tut.done,
      line: ((el && el.querySelector('.tut-line')) || {}).textContent || '',
      act: ((el && el.querySelector('.tut-act')) || {}).textContent || '',
      dots: el ? el.querySelectorAll('.tut-dot').length : 0,
      more: !!(el && el.querySelector('.tut-more')),
      tab: window.currentTab,
    };
  });

  // 말풍선의 '다음' 을 진짜로 눌러 대사를 끝까지 넘긴다
  async function readAll(log) {
    for (let i = 0; i < 16; i++) {
      const a = await info();
      if (!a.on || !a.more) return a;
      if (log && !log.seen.has(a.step)) { log.seen.add(a.step); log.push(a); }
      const box = await page.evaluate(() => {
        const r = document.querySelector('#tut .tut-more').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(140);
      const b = await info();
      if (b.step === a.step && b.beat === a.beat) return b;
    }
    return info();
  }

  // 막이 정말 막는가 — 막의 칠해진 자리에 있는 탭 버튼을 진짜로 눌러 본다
  async function blockedCheck() {
    const st = await info();
    if (!st.on || st.loose) return null;
    const target = await page.evaluate(() => {
      const path = document.querySelector('#tut .tut-hole');
      if (!path || !path.isPointInFill) return null;
      for (const b of document.querySelectorAll('.tab-btn')) {
        const r = b.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;                 // 숨겨진 탭은 제외
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        // 칠해진 자리 = 막혀 있어야 하는 자리 (구멍은 칠이 빠져 있다)
        if (path.isPointInFill(new DOMPoint(x, y))) return { x, y, tab: b.dataset.tab };
      }
      return null;
    });
    if (!target) return null;
    const before = st.tab;
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(160);
    const after = (await info()).tab;
    return after !== before ? `막힌 자리(${target.tab})가 눌렸다 — ${before} → ${after}` : null;
  }

  // 구멍 안의 눌러야 할 것을 진짜 마우스로 누른다
  async function doAct() {
    const target = await page.evaluate((sel) => {
      const layer = document.getElementById('tut');
      const path = layer.querySelector('.tut-hole');
      for (const c of document.querySelectorAll(sel)) {
        const r = c.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (path && path.isPointInFill && path.isPointInFill(new DOMPoint(x, y))) continue;  // 막혀 있다
        const top = document.elementFromPoint(x, y);
        if (!top || layer.contains(top)) continue;             // 말풍선이 덮고 있다
        if (c === top || c.contains(top)) return { x, y, what: c.className.slice(0, 28) };
      }
      return null;
    }, CLICKABLE);
    if (!target) return null;
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(340);
    return target.what;
  }

  const lines = [];
  const log = { seen: new Set(), push: (st) => lines.push(
    `  ${String(st.step).padStart(2)} · 닷${st.dots} · ${st.line.slice(0, 22)}${st.act ? ' → ' + st.act : ''}`) };

  let guard = 0, lastSig = '', same = 0;
  while (guard++ < 80) {
    const st = await readAll(log);
    if (!st.on || st.done) break;
    if (!log.seen.has(st.step)) { log.seen.add(st.step); log.push(st); }
    const sig = st.step + ':' + st.beat;
    // 같은 단계를 여러 번 해야 하는 자리가 있다 (두 번 채집 · 재료 두 개 담기)
    same = (sig === lastSig) ? same + 1 : 0;
    if (same >= 4) { bad.push(`${st.step}단계에서 더 진행되지 않는다 — 막다른 자리다`); break; }
    lastSig = sig;
    if (st.loose) bad.push(`${st.step}단계: 구멍 대상을 못 찾았다 (막이 클릭을 막지 않는 상태)`);

    const b = await blockedCheck();
    if (b) bad.push(`${st.step}단계: ${b}`);

    const did = await doAct();
    if (await page.evaluate(() => !!document.querySelector('#brewModal.show'))) {
      await page.evaluate(() => closeBrewModal());
      await page.waitForTimeout(260);
    }
    if (!did) {
      const st2 = await info();
      if (st2.step === st.step && st2.beat === st.beat) {
        bad.push(`${st.step}단계: 구멍 안에서 누를 것을 못 찾았다`);
        break;
      }
    }
  }

  const fin = await page.evaluate(() => ({
    step: S.tut.step, done: S.tut.done, tutorialDone: S.tutorialDone,
    pot: S.cauldronId, dress: S.outfit.dress,
    layerOn: document.getElementById('tut').classList.contains('on'),
    creatureOpen: !document.querySelector('.room-tab[data-rtab="creatures"]').classList.contains('locked'),
    wardrobeTabs: document.querySelectorAll('.wr-tab').length,
    brews: S.record.brews, drinks: S.record.drinks, gathered: S.record.gathered,
  }));

  // 끝났으면 **잠겼던 것이 실제로 열려 있어야 한다.** 깃발만 켜고 화면이 그대로면
  // 튜토리얼을 마친 보람이 하나도 없다 (원래 이 문들이 안 열리던 것이 문제였다)
  if (!fin.done) bad.push('튜토리얼이 끝까지 가지 않았다 (' + fin.step + '단계에서 멈춤)');
  if (!fin.tutorialDone) bad.push('tutorialDone 이 안 켜졌다');
  if (fin.layerOn) bad.push('끝났는데 막이 남아 있다');
  if (fin.dress !== 'dress_onepiece') bad.push('선물받은 원피스로 갈아입지 않았다 (' + fin.dress + ')');
  if (!fin.creatureOpen) bad.push('크리처 탭이 안 열렸다');
  if (fin.wardrobeTabs < 11) bad.push('옷장 칸이 안 열렸다 (' + fin.wardrobeTabs + '칸)');
  if (fin.pot !== 'cd_iron') bad.push('3구 무쇠 솥으로 안 바뀌었다 (' + fin.pot + ')');
  bad.push(...errs);

  await browser.close();
  console.log(`튜토리얼 ${log.seen.size}단계를 눌러 봄 (${W}×${H})`);
  if (process.env.V) console.log(lines.join('\n'));
  console.log(`  조합 ${fin.brews} · 마심 ${fin.drinks} · 채집 ${fin.gathered}`);
  if (!bad.length) { console.log('✅ 튜토리얼을 끝까지 통과함'); process.exit(0); }
  console.log(`❌ ${bad.length}건`);
  bad.forEach(m => console.log('   ' + m));
  process.exit(1);
})().catch(e => { console.error('하네스 실패:', e); process.exit(2); });
