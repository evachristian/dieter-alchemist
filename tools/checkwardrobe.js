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
  // ⚠️⚠️ **표정은 옷장 탭이 아니라 «제 시트»에 있다** (방 그림의 😊 버튼).
  // 그러면서 **굴림 통이 `.wr-items` 에서 `#slotSheetBody` 로 옮겨 갔다** — 통이 둘이라
  // `equip()` 이 한쪽만 붙들면 여기서 같은 사고가 그대로 되돌아온다.
  // 그래서 이 검사도 **여는 법과 굴림 통을 칸마다 적는다**
  const CASES = [
    { slot: 'expression', open: `openSlotSheet('expression')`, box: '#slotSheetBody' },
    { slot: 'necklace',   open: `setWardrobeTab('necklace')`, box: '.wr-items' },
  ];
  for (const c of CASES) {
    const slot = c.slot;
    const r = await page.evaluate(async (o) => {
      const sel = `[onclick*="equip('${o.slot}'"]`;
      if (typeof unlockAllOf === 'function') unlockAllOf(o.slot);
      (0, eval)(o.open);
      // ⚠️⚠️ **여는 것과 재는 것을 갈라 놓는다.** 시트는 `sheetup`(0.28초)으로 올라오는데,
      // 80ms 만 기다리고 `scrollIntoView` 를 하면 **아직 움직이는 상자**를 기준으로
      // 굴려 놓고 재게 되어 멀쩡한 화면이 「5px 밀렸다」로 잡힌다 (78건 유령과 같은
      // 종류다 · 실제로 그렇게 빨개졌다). 애니메이션이 끝나고 나서 잡는다
      await new Promise(r => setTimeout(r, 380));
      const at = i => document.querySelectorAll(sel)[i];
      const n = document.querySelectorAll(sel).length;
      const grid = document.querySelector(o.box);
      if (!grid) return { err: `${o.slot}: 굴림 통(${o.box})을 못 찾았다` };
      // **통 밖으로 나가는 칸이 없으면 아무것도 안 잰 것이다** (78건 유령과 같은 함정)
      if (grid.scrollHeight <= grid.clientHeight + 4) {
        return { err: `${o.slot}: 칸이 ${n}개뿐이라 ${o.box} 가 안 넘친다 — 잴 수가 없다` };
      }
      const i = n - 2;                                  // 맨 아랫줄 — 반드시 통 밖이다
      at(i).scrollIntoView({ block: 'center' });
      await new Promise(r => setTimeout(r, 80));
      const y0 = Math.round(at(i).getBoundingClientRect().top);
      at(i).click();
      await new Promise(r => setTimeout(r, 120));
      const y1 = Math.round(at(i).getBoundingClientRect().top);
      // **고른 테두리가 «그 자리에서» 옮겨 갔는가.** 아바타만 바뀌고 목록이 옛 칸에
      // 테를 둔 채면 「눌렀는데 아무 일도 없다」로 보인다 — 표정처럼 «시트»에 사는
      // 칸은 `renderShowcase()` 가 안 건드리므로 따로 그려 주지 않으면 그렇게 된다
      const want = at(i).dataset.item;
      const on = [...document.querySelectorAll(sel)].filter(b => b.classList.contains('on'));
      const onIds = on.map(b => b.dataset.item);
      const worn = S.outfit[o.slot];
      const tt = document.getElementById('toast');
      const shown = tt.classList.contains('show');
      const d = shown ? Math.round(Math.abs(tt.getBoundingClientRect().bottom - y0)) : -1;
      // 다음 칸을 위해 되돌린다
      tt.classList.remove('show');
      window.scrollTo(0, 0);
      if (typeof closeSlotSheet === 'function') closeSlotSheet();
      return { n: n, y0: y0, y1: y1, moved: y1 - y0, toast: d, shown: shown,
               want: want, worn: worn, onIds: onIds };
    }, c);

    if (r.err) { bad.push(r.err); continue; }
    rows.push(`${slot} ${r.n}칸 · 누른 칸 ${r.y0} → ${r.y1} · 토스트 ${r.toast}px`);
    if (Math.abs(r.moved) > MOVE_MAX) {
      bad.push(`${slot}: 누른 칸이 ${r.y0} → ${r.y1} 로 ${r.moved}px 밀렸다`
        + ` (${MOVE_MAX}px 까지) — 격자의 scrollTop 이 다시 그리며 0 으로 돌아간 것이다`);
    }
    if (r.worn !== r.want) bad.push(`${slot}: 눌렀는데 안 갈아 끼워졌다 (${r.worn})`);
    if (r.onIds.length !== 1 || r.onIds[0] !== r.want) {
      bad.push(`${slot}: 고른 테두리가 안 옮겨 갔다 (테가 [${r.onIds.join('·') || '없음'}] 에 있고`
        + ` 누른 것은 ${r.want} 다) — 그 목록을 다시 안 그린 것이다`);
    }
    if (!r.shown) bad.push(`${slot}: 토스트가 안 떴다`);
    else if (r.toast > TOAST_MAX) {
      bad.push(`${slot}: 토스트가 누른 칸에서 ${r.toast}px 떨어져 뜬다 (${TOAST_MAX}px 까지)`);
    }
  }

  // ─── 한 시트 안의 «갈래 탭» (⚜️ 일반 / ✏️ 눈썹) ─────────────────
  //
  // ⚠️⚠️ **`checkui` 의 「갈래둘」은 `setSlotTab()`·`equip()` 을 «직접» 부른다** —
  //    그래서 탭의 `onclick` 배선이 끊겨도 그대로 통과한다 (`Walnut.start()` 를
  //    직접 부르면 안 되는 것과 같은 구멍이다). 여기서는 **진짜 마우스로 탭을 눌러**
  //    갈래가 옮겨 가는지, 그 안의 칸이 갈아 끼워지는지를 본다.
  // ⚠️ 표에서 뽑는다 — `under` 를 한 줄 더 붙이면 이 검사도 저절로 따라온다
  {
    const g = await page.evaluate(() => {
      const heads = D.WARDROBE_SLOTS.filter(m => m.sheet && !m.under);
      for (const h of heads) {
        const sub = D.WARDROBE_SLOTS.filter(x => x.sheet && x.under === h.slot);
        if (sub.length) return { head: h.slot, sub: sub[0].slot };
      }
      return null;
    });
    if (!g) bad.push('갈래가 둘인 시트가 하나도 없다 — 탭을 한 번도 안 눌렀다');
    else {
      await page.evaluate((o) => {
        unlockAllOf(o.head); unlockAllOf(o.sub);
        // ⚠️⚠️ **머리 갈래를 «진짜로 하나 걸어 놓고» 시작한다.** 「없음」인 채로
        //    재면 벗겨졌는지를 `none → none` 으로 견주게 되어, 눈썹이 문신을
        //    벗기는 사고를 **무엇을 해도 통과시킨다** (가르지 못하는 잣대다)
        const first = (D.WARDROBE[o.head] || []).filter(i => i.kind !== 'none')[0];
        if (first) equip(o.head, first.id);
        openSlotSheet(o.head);
      }, g);
      await page.waitForTimeout(380);          // `sheetup` 이 끝난 뒤에 누른다
      const tab = await page.$(`#slotSheetTabs .wr-tab[onclick*="'${g.sub}'"]`);
      if (!tab) bad.push(`${g.sub} 갈래 탭이 없다`);
      else {
        await tab.click();
        await page.waitForTimeout(250);
        const r = await page.evaluate((o) => {
          const sel = `#slotSheetBody [onclick*="equip('${o.sub}'"]`;
          const list = document.querySelectorAll(sel);
          if (!list.length) return { err: `탭을 눌렀는데 ${o.sub} 칸이 하나도 없다` };
          // ⚠️ **머리 갈래의 칸이 남아 있으면 탭이 안 옮겨 간 것이다**
          if (document.querySelector(`#slotSheetBody [onclick*="equip('${o.head}'"]`))
            return { err: `탭을 눌렀는데 ${o.head} 칸이 그대로 있다` };
          if (/_none$/.test(S.outfit[o.head] || '')) return { err: `${o.head} 이 「없음」이라 벗겨짐을 못 잰다` };
          return { n: list.length, kept: S.outfit[o.head] };
        }, g);
        if (r.err) bad.push(r.err);
        else {
          const cells = await page.$$(`#slotSheetBody [onclick*="equip('${g.sub}'"]`);
          await cells[cells.length - 1].scrollIntoViewIfNeeded();
          await page.waitForTimeout(120);
          await cells[cells.length - 1].click();
          await page.waitForTimeout(250);
          const o2 = await page.evaluate((o) => ({ sub: S.outfit[o.sub], head: S.outfit[o.head] }), g);
          if (!o2.sub || /_none$/.test(o2.sub)) bad.push(`${g.sub} 칸을 눌렀는데 안 걸렸다 (${o2.sub})`);
          // ⚠️⚠️ **여기가 요점이다** — 「일반 하나 + 눈썹 하나」를 같이 걸 수 있어야 한다
          if (o2.head !== r.kept) bad.push(`${g.sub} 을 고르자 ${g.head} 이 벗겨졌다 (${r.kept} → ${o2.head})`);
          rows.push(`갈래탭 ${g.head}→${g.sub} ${r.n}칸 · ${g.head}=${o2.head} + ${g.sub}=${o2.sub}`);
        }
      }
      await page.evaluate(() => closeSlotSheet());
    }
  }

  // ─── 시트에서 «염색»이 되는가 (눈썹) ─────────────────────────
  //
  // ⚠️⚠️ **`checkui` 의 「칸시트」는 «줄이 있는가»만 본다** — 팔레트를 펴 놓고 칩이
  //    있는지까지는 보지만, **눌러서 그림이 바뀌는지는 한 번도 안 잰다.** 배선이
  //    끊겨도(아이콘에 `S.outfit` 을 넘기거나, 시트를 다시 안 그리거나) 그대로 통과한다.
  // ⚠️ **그려진 색으로 잰다** — `S.itemColor` 를 읽으면 「세이브에는 들어갔는데 화면은
  //    옛 색」인 자리를 영영 못 본다 (아이콘이 실제로 그랬다)
  {
    const slot = await page.evaluate(() =>
      (D.WARDROBE_SLOTS.find(m => m.sheet && (D.COLORABLE_SLOTS || []).includes(m.slot)) || {}).slot);
    if (!slot) bad.push('시트에 «색을 고르는 칸»이 하나도 없다 — 염색을 한 번도 안 쟀다');
    else {
      const r = await page.evaluate((sl) => {
        unlockAllOf(sl); unlockAllColors(); S.dye = 9;
        const wear = (D.WARDROBE[sl] || []).find(x => x.kind !== 'none');
        equip(sl, wear.id);
        openSlotSheet(sl);
        const ink = () => {
          const svg = document.querySelector('.char-body svg.avatar-svg');
          const g = svg && svg.querySelector('g[data-part="brow"], g.brow');
          // 그려진 눈썹의 색은 Avatar 가 쓰는 그 한 곳에서 읽는다 (hex 비교가 되게)
          return Avatar.browColorOf(outfitWithColors());
        };
        const icon = () => {
          const el = document.querySelector('#slotSheetBody .brow-icon path[stroke]');
          return el ? el.getAttribute('stroke') : null;
        };
        const was = { ink: ink(), icon: icon() };
        // 지금 색과 «확실히 다른» 색을 하나 고른다
        const c = D.COLORS.find(x => x.hex.toLowerCase() !== String(was.ink).toLowerCase());
        applyDye(sl, c.id, 'magic');
        return { was, now: { ink: ink(), icon: icon() }, want: c.hex,
                 bars: !!document.querySelector('#slotSheetBody .dye-bars') };
      }, slot);
      if (!r.bars) bad.push(`${slot} 시트에 팔레트 줄이 없다`);
      if (r.now.ink === r.was.ink) bad.push(`${slot} 을 염색해도 그려지는 색이 그대로다 (${r.was.ink})`);
      else if (String(r.now.ink).toLowerCase() !== String(r.want).toLowerCase())
        bad.push(`${slot} 의 색이 고른 것과 다르다 (고른 ${r.want} · 그려진 ${r.now.ink})`);
      if (!r.now.icon) bad.push(`${slot} 시트의 칸 그림을 못 찾았다`);
      // ⚠️⚠️ **칸 그림도 같이 물들어야 한다** — 아바타만 바뀌고 목록이 옛 색이면
      //    「무엇을 고르는 칸인지」가 거짓말을 한다 (붙이자마자 실제로 그랬다)
      else if (String(r.now.icon).toLowerCase() !== String(r.want).toLowerCase())
        bad.push(`${slot} 칸 그림이 안 물들었다 (고른 ${r.want} · 그림 ${r.now.icon})`);
      else rows.push(`염색 ${slot} ${r.was.ink} → ${r.now.ink} (칸 그림도 같이)`);
      await page.evaluate(() => closeSlotSheet());
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
