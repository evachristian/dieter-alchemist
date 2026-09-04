// ═══════════════════════════════════════════════════════════════
//  옷장을 «누른 자리»에 머무르게 하는가 (npm run test:wardrobe)
// ═══════════════════════════════════════════════════════════════
//
// ⚠️ **옷장 격자(`.wr-items`)는 제 스크롤 통이다** — `max-height` + `overflow-y: auto`.
// `equip()` 이 `renderShowcase()` 로 격자를 통째로 다시 그리면 **그 안의 scrollTop 이
// 0 으로 돌아가서**, 네 줄 밖에 있던 칸을 누르면 목록이 통째로 위로 솟는다.
// 누른 칸이 화면에서 사라지고, 옆에 붙는 토스트도 엉뚱한 데서 나온다
// (「스퀘어 아이콘을 누르면 원치 않는 스크롤이 생긴다」로 **두 번** 신고받았다).
//
// ⚠️ **페이지 스크롤만 붙들어서는 안 잡힌다.** 처음에 그렇게 고쳤다가 놓쳤다 —
// 재어 보면 페이지 스크롤은 832 → 832 로 멀쩡한데 누른 칸만 361 → 574 로 밀린다.
// 그래서 이 검사는 **누른 칸의 화면 좌표**를 보지, 스크롤 값을 보지 않는다.
//
// ⚠️ **`checkui` 안에 넣지 않는다.** 거기는 한 페이지에서 화면을 줄줄이 갈아 끼우며
// 재는 도구라, 여기서 옷장 탭을 바꾸고 칸을 누르면 **뒤에 오는 화면들이 그 상태에서
// 측정돼** 엉뚱한 위반이 18화면 × 4건씩 잡혔다. 상호작용 검사는 제 페이지에서 한다
// (`test:melt` · `test:bond` 와 같은 결이다).
'use strict';
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8080';
const MOVE_MAX = 4;      // px. 누른 칸이 이만큼 넘게 움직이면 안 된다
const TOAST_MAX = 60;    // px. 토스트는 누른 칸 «옆»에 떠야 한다

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const bad = [];
  const rows = [];

  await page.addInitScript(() => {
    localStorage.setItem('dieter_alchemist_intro_seen_v1', '1');
    localStorage.setItem('dieter_alchemist_save_v1', JSON.stringify(
      { ver: 8, name: 'Tester', nameClaimed: true, tutorialDone: true, crystal: 1240 }));
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const s = document.getElementById('splash'); if (s) s.remove();
    const i = document.getElementById('intro'); if (i) i.style.display = 'none';
    switchTab('showcase');
  });
  await page.waitForTimeout(300);

  // 칸이 많을수록 잘 드러난다 — 표정(38)과 목걸이(31)를 본다 (헤어는 축 두 개라 equip 을 안 쓴다)
  for (const slot of ['expression', 'necklace']) {
    const r = await page.evaluate(async (o) => {
      const sel = `[onclick*="equip('${o.slot}'"]`;
      if (typeof unlockAllOf === 'function') unlockAllOf(o.slot);
      setWardrobeTab(o.slot);
      await new Promise(r => setTimeout(r, 80));
      const at = i => document.querySelectorAll(sel)[i];
      const n = document.querySelectorAll(sel).length;
      const grid = document.querySelector('.wr-items');
      if (!grid) return { err: '옷장 격자를 못 찾았다' };
      // **통 밖으로 나가는 칸이 없으면 아무것도 안 잰 것이다** (78건 유령과 같은 함정)
      if (grid.scrollHeight <= grid.clientHeight + 4) {
        return { err: `${o.slot}: 칸이 ${n}개뿐이라 격자가 안 넘친다 — 잴 수가 없다` };
      }
      const i = n - 2;                                  // 맨 아랫줄 — 반드시 통 밖이다
      at(i).scrollIntoView({ block: 'center' });
      await new Promise(r => setTimeout(r, 80));
      const y0 = Math.round(at(i).getBoundingClientRect().top);
      at(i).click();
      await new Promise(r => setTimeout(r, 120));
      const y1 = Math.round(at(i).getBoundingClientRect().top);
      const tt = document.getElementById('toast');
      const shown = tt.classList.contains('show');
      const d = shown ? Math.round(Math.abs(tt.getBoundingClientRect().bottom - y0)) : -1;
      // 다음 칸을 위해 되돌린다
      tt.classList.remove('show');
      window.scrollTo(0, 0);
      return { n: n, y0: y0, y1: y1, moved: y1 - y0, toast: d, shown: shown };
    }, { slot: slot });

    if (r.err) { bad.push(r.err); continue; }
    rows.push(`${slot} ${r.n}칸 · 누른 칸 ${r.y0} → ${r.y1} · 토스트 ${r.toast}px`);
    if (Math.abs(r.moved) > MOVE_MAX) {
      bad.push(`${slot}: 누른 칸이 ${r.y0} → ${r.y1} 로 ${r.moved}px 밀렸다`
        + ` (${MOVE_MAX}px 까지) — 격자의 scrollTop 이 다시 그리며 0 으로 돌아간 것이다`);
    }
    if (!r.shown) bad.push(`${slot}: 토스트가 안 떴다`);
    else if (r.toast > TOAST_MAX) {
      bad.push(`${slot}: 토스트가 누른 칸에서 ${r.toast}px 떨어져 뜬다 (${TOAST_MAX}px 까지)`);
    }
  }

  await browser.close();
  console.log('옷장 칸을 눌렀을 때 — ' + rows.join(' · '));
  console.log(`  (칸은 ${MOVE_MAX}px 까지만 움직여도 되고, 토스트는 그 칸에서 ${TOAST_MAX}px 안이다)`);
  if (bad.length) {
    console.log(`❌ ${bad.length}건`);
    bad.forEach(m => console.log('   ' + m));
    process.exit(1);
  }
  console.log('✅ 누른 칸이 제자리에 있고 토스트도 그 옆에 뜬다');
})().catch(e => { console.error(e); process.exit(1); });
