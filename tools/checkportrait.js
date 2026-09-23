// 초상화(portrait.js) 검사 — **머리카락이 머리통에 붙어 있는가**
//
// 왜 이 검사가 생겼나: 머리카락의 바깥 호를 손으로 그려 두었더니 **두개골에서
// 12~14px 떠 있었고**, 껍질 두께가 정수리 12~14px / 관자놀이 5~7px 로 두 배 넘게
// 차이가 나서 실루엣이 세로로만 늘어났다 — 「콘헤드」로 신고받은 자리다.
// 지금은 `portrait.js` 의 `crown()` 이 두개골 타원에서 호를 뽑는데, **표의 값이 아니라
// «그려진 그림»을 재야** 다음에 누가 손으로 그린 path 를 도로 넣어도 걸린다.
//
// ⚠️ **재는 것은 `hair-front` 다.** 뻗친 가닥(wild)·매듭(updo)·어깨로 흐르는 몫(long)은
//    `hair-back` 에 있고 그것들은 «머리통이 아니라 얹은 것»이라 호 밖으로 나가도 된다.
//    `hair-front` 의 바깥 호가 곧 머리통의 꼭대기다.
//
// 보는 것 셋 —
//   ① **머리 껍질** : 제일 두꺼운 데 ÷ 제일 얇은 데 ≤ 1.7 · 어느 각도든 두께 ≤ 12px
//   ② **머리와 얼굴 사이** : 줄마다 **양옆이 막힌 «투명한» 구간**이 있는가
//      (`checkavatar` 의 「턱 밑 빈 자리」와 같은 방법이다).
//      앞머리만 두고 `back` 의 안쪽을 파면 그 사이로 배경이 비친다 — 예전에 관자놀이에서
//      6px 짜리 틈이 나서 머리와 얼굴이 떨어져 보였다 (그때는 `HAIR_FILL` 한 겹으로
//      막았는데, 호를 두개골에서 뽑으면서 그 채움이 덮을 자리가 없어져 지웠다).
//      **지키던 것을 없앤 것이 아니라 잴 수 있는 자리로 옮긴 것이다.**
//      ⚠️ **광선으로 재면 못 잡는다** — 틈이 나는 자리는 거의 수평한 관자놀이 «옆»이라
//         위쪽 각도만 쏘면 그 사이를 통째로 비껴간다 (그렇게 짰다가 사보타주가 지나갔다).
//   ③ **후드와 머리 사이** : 후드를 쓴 사람에게서 후드가 «보이는가» · 머리와 벌어지지
//      않는가. 후드의 안쪽 구멍도 `crown()` 에서 뽑는데(그 사람이 «쓴 머리»로), 숫자를
//      박아 두면 머리를 두껍게 고치는 순간 후드가 머리 «안»으로 들어가 통째로 안 보이고
//      얇게 고치면 그만큼 벌어진다. 둘 다 화면에 오류 하나 안 뜨는 종류다
//   ④ **한 스타일도 못 쟀는가** — 0건이 「통과」인지 「한 번도 안 쟀다」인지를 가른다
//
// ⚠️ **0건이 통과가 아니다** — 몇 스타일 · 몇 각도를 쟀는지를 통과할 때도 낸다.
//
//   node tools/checkportrait.js
const { chromium } = require('playwright');
const path = require('path');

// 제일 두꺼운 데 ÷ 제일 얇은 데. ⚠️ **한쪽만 보면 안 된다** — 「정수리 ÷ 관자놀이」로
// 두었더니 얼굴만 좁히는 사보타주(껍질이 옆으로만 두꺼워진다)가 그대로 통과했다.
// 진짜 머리카락 껍질은 «어디서나 비슷한 두께»이고, 그것이 곧 이 잣대다.
//
// ⚠️⚠️ **두 문턱은 «사람이 고른 부피»에 맞춰 한 번 옮겼다.** 처음에는 머리를 바짝
//   붙여 1.5 / 6px 이었는데, 「옛것과 새것의 중간으로」라는 결정에 맞춰 늘렸다
//   (지금 값 — 비 1.50~1.62 · 뜬 몫 6~10px).
//   **문턱을 옮길 때 지킬 것은 하나다: 옛 손그림 다섯이 여전히 다 걸려야 한다.**
//   ⚠️ **어느 한 문턱도 혼자서는 다섯을 다 못 잡는다** — 두께만 보면 옛 `updo`(11.0)가
//      지나가고, 비만 보면 「둘 다 두껍되 고르게」가 지나간다. **둘이 짝이다.**
//   ⚠️ 비는 여유가 0.08 밖에 없다(지금 1.62 · 옛것 중 제일 낮은 것 1.76).
//      부피를 더 키우려면 이 여유부터 보고, 「사보타주①」이 아직 걸리는지 확인할 것
const SHELL_MAX = 1.7;
// 어느 각도에서든 껍질이 이보다 두꺼우면 안 된다 — 머리통이 통째로 부푼 것이다.
// ⚠️ 처음에는 「두개골 위로 뜬 몫」(정수리 하나)만 봤는데, 문턱을 늦추자
//    **옆으로만 부풀리는 사보타주가 통과했다**(비 1.5 · 옆 12.8px). 뜬 몫은 정수리
//    두께와 같은 값이라 옆을 아예 못 본다 — 모든 각도를 보는 이쪽이 그것을 겸한다
const THICK_MAX = 12;
const HOOD_GAP = 3;       // 후드 안쪽과 머리 바깥 사이
// ⚠️ **-15° 는 짧은 머리의 «밑단보다 아래»라 머리카락이 원래 없는 자리다.**
//    거기를 재면 멀쩡한 short·wave·wild 가 「얼굴 밖으로 안 나온다」로 걸린다
//    (그렇게 짰다가 3건 헛짚었다). 관자놀이 몫은 -30° 로 잰다.
const ANGLES = [-90, -75, -60, -45, -30];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await br.newPage({ viewport: { width: 400, height: 400 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('file://' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'));
  await pg.waitForTimeout(400);

  const out = await pg.evaluate(async ({ ANGLES }) => {
    const D = window.GameData, S = 8, W = 120 * S, H = 130 * S;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');

    // 인물 하나를 그려서 «그 조각만» 남긴 마스크를 만든다
    async function mask(sp, keep) {
      const holder = document.createElement('div');
      holder.innerHTML = Portrait.bust(sp, 'def', { bare: true });
      const svg = holder.querySelector('svg');
      if (!svg) return null;
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      // 남길 조각만 검게, 나머지는 지운다 — 색이 아니라 «있고 없고»로 재려는 것이다
      let found = 0;
      svg.querySelectorAll('[data-part]').forEach(el => {
        if (keep.includes(el.getAttribute('data-part'))) { el.setAttribute('fill', '#000'); found++; }
        else el.remove();
      });
      // data-part 가 없는 것(옷·목·눈·입…)도 전부 지운다
      Array.from(svg.querySelectorAll('*')).forEach(el => {
        if (el.tagName === 'defs' || el.tagName === 'clipPath' || el.tagName === 'g') return;
        if (!el.hasAttribute('data-part')) el.remove();
      });
      if (!found) return null;
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok; img.onerror = no;
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.outerHTML)));
      });
      cx.clearRect(0, 0, W, H); cx.drawImage(img, 0, 0);
      const px = cx.getImageData(0, 0, W, H).data;
      return (x, y) => {
        const xi = Math.round(x * S), yi = Math.round(y * S);
        if (xi < 0 || yi < 0 || xi >= W || yi >= H) return false;
        return px[(yi * W + xi) * 4 + 3] > 128;
      };
    }
    const topOf = hit => {
      for (let y = 0; y < 130; y += 0.25)
        for (let x = 6; x < 114; x += 0.25) if (hit(x, y)) return y;
      return null;
    };
    const ray = (hit, cx0, cy0, deg) => {
      const a = deg * Math.PI / 180;
      let last = 0;
      for (let r = 0; r < 70; r += 0.25) {
        const x = cx0 + Math.cos(a) * r, y = cy0 + Math.sin(a) * r;
        if (x < 0 || x > 120 || y < 0 || y > 130) break;
        if (hit(x, y)) last = r;
      }
      return last;
    };

    // ⚠️ **«쓰는 사람이 있는» 머리만 재지 않는다** — updo 는 지금 요정 대모뿐인데
    //    그는 인트로 그림을 쓰므로 한 번도 안 재진다. 표(`Portrait.hairs`)를 그대로 돈다
    const base = D.SPEAKERS.find(sp => !sp.introArt);
    const res = [];
    for (const hair of Portrait.hairs) {
      if (hair === 'bald') continue;
      const sp = Object.assign({}, base, { hair, deco: 'none', beard: 'none' });
      const face = await mask(sp, ['face']);
      const hairM = await mask(sp, ['hair-front']);
      const all = await mask(sp, ['face', 'hair-front', 'hair-back', 'hair-bun']);
      if (!face || !hairM || !all) { res.push({ hair, err: '조각을 못 찾았다' }); continue; }
      const fTop = topOf(face), hTop = topOf(hairM);
      // 머리 한가운데 — 얼굴 타원의 중심
      const C = { x: 60, y: 66 };
      const sh = ANGLES.map(d => ({ d, t: +(ray(hairM, C.x, C.y, d) - ray(face, C.x, C.y, d)).toFixed(2) }));
      // ② 머리 + 얼굴을 합쳐 놓고 «줄마다» 양옆이 막힌 빈 구간을 센다.
      //    바깥 배경은 한쪽이 그림 끝이라 저절로 빠지고, 얼굴과 머리 사이에 갇힌 것만 남는다
      //    ⚠️ **창은 «앞머리가 있는 줄 · 앞머리의 가로 범위»다.** 통째로 훑으면 뻗친
      //       가닥(wild) 사이의 «공기»가 6.25px 짜리 틈으로 잡힌다 — 그건 틈이 아니라
      //       그 머리의 모양이다 (실제로 그렇게 헛짚었다). 메워야 할 자리는 앞머리와
      //       얼굴 사이뿐이고, 그 둘이 다 있는 줄에서만 볼 일이다
      let gap = 0, gapAt = null, rows = 0;
      for (let y = hTop; y <= 72; y += 0.5) {
        const on = [], fr = [];
        for (let x = 10; x <= 110; x += 0.25) { on.push(all(x, y)); fr.push(hairM(x, y)); }
        const first = fr.indexOf(true), last = fr.lastIndexOf(true);
        if (first < 0 || last - first < 4) continue;
        rows++;
        let run = 0;
        for (let i = first; i <= last; i++) {
          if (!on[i]) run++;
          else { if (run * 0.25 > gap) { gap = run * 0.25; gapAt = y; } run = 0; }
        }
      }
      const ts = sh.map(x => x.t);
      const top = Math.max.apply(null, ts), temple = Math.min.apply(null, ts);
      res.push({ hair, faceTop: fTop, hairTop: hTop, gap: +gap.toFixed(2), gapAt, rows,
                 lift: +(fTop - hTop).toFixed(2), shell: sh,
                 ratio: +(top / Math.max(temple, 0.01)).toFixed(2) });
    }
    // ③ 후드 — 쓴 사람마다
    const hoods = [];
    for (const sp of D.SPEAKERS) {
      if (sp.introArt || sp.deco !== 'hood') continue;
      const hairM = await mask(sp, ['hair-front', 'hair-back']);
      const hood = await mask(sp, ['deco-hood']);
      if (!hairM || !hood) { hoods.push({ id: sp.id, err: '조각을 못 찾았다' }); continue; }
      const gaps = ANGLES.map(d => {
        const a = d * Math.PI / 180;
        const rh = ray(hairM, 60, 66, d);
        for (let r = rh; r < 70; r += 0.25)
          if (hood(60 + Math.cos(a) * r, 66 + Math.sin(a) * r)) return +(r - rh).toFixed(2);
        return null;       // 후드가 머리에 가려 안 보인다
      });
      hoods.push({ id: sp.id, hair: sp.hair, gaps });
    }
    return { res, hoods };
  }, { ANGLES });
  const { res: _res, hoods } = out;

  const bad = [];
  let angles = 0, rows = 0;
  const list = _res;
  console.log('머리 껍질 — 각도마다 «얼굴 끝에서 머리카락 끝까지» (머리 한가운데 60,66 에서)');
  list.forEach(r => {
    if (r.err) { bad.push(`${r.hair}: ${r.err}`); console.log(`  ${r.hair.padEnd(6)} ${r.err}`); return; }
    angles += r.shell.length;
    const line = r.shell.map(s => `${s.d}°:${s.t.toFixed(1)}`).join(' ');
    console.log(`  ${r.hair.padEnd(6)} 꼭대기 y=${r.hairTop} (두개골 ${r.faceTop} · 위로 ${r.lift}px)`);
    console.log(`         ${line}   두꺼운데/얇은데 ${r.ratio}배 · 갇힌 틈 ${r.gap}px (${r.rows}줄)`);
    if (r.ratio > SHELL_MAX) bad.push(`${r.hair}: 껍질이 자리마다 ${r.ratio}배 차이 난다 (${SHELL_MAX} 까지) — 한쪽으로만 솟는다`);
    const thick = Math.max.apply(null, r.shell.map(s => s.t));
    if (thick > THICK_MAX) bad.push(`${r.hair}: 껍질이 ${thick}px 까지 두껍다 (${THICK_MAX} 까지) — 머리통이 통째로 부푼 것이다`);
    r.shell.forEach(s => { if (s.t < 0.5) bad.push(`${r.hair}: ${s.d}° 에서 머리카락이 얼굴 밖으로 안 나온다 (${s.t}px)`); });
    // 안티에일리어싱 한 칸(0.25px)은 넘겨 준다
    if (r.gap > 0.75) bad.push(`${r.hair}: 머리와 얼굴 사이 y=${r.gapAt} 에 ${r.gap}px 짜리 틈이 있다 — back 의 안쪽을 판 것이다`);
    if (!r.rows) bad.push(`${r.hair}: 틈을 «한 줄도» 안 쟀다`);
    rows += r.rows;
  });
  console.log('\n후드와 머리 사이 — 후드가 보이는가 · 벌어지지 않는가');
  if (!hoods.length) bad.push('후드를 쓴 사람이 하나도 없다 — 이 줄이 아무것도 안 쟀다');
  hoods.forEach(h => {
    if (h.err) { bad.push(`${h.id}: 후드 ${h.err}`); return; }
    const hid = h.gaps.filter(g => g === null).length;
    const mx = Math.max.apply(null, h.gaps.filter(g => g !== null).concat([0]));
    console.log(`  ${h.id.padEnd(10)} 머리 ${h.hair} · 틈 ${h.gaps.map(g => g === null ? '가려짐' : g).join(' ')}`);
    if (hid) bad.push(`${h.id}: 후드가 머리에 가려 ${hid}곳에서 안 보인다 — 구멍이 머리보다 좁다`);
    if (mx > HOOD_GAP) bad.push(`${h.id}: 후드와 머리가 ${mx}px 벌어졌다 (${HOOD_GAP} 까지)`);
  });
  if (errs.length) bad.push('페이지 오류: ' + errs.join(' / '));
  if (!list.length || angles === 0) bad.push('한 스타일도 못 쟀다 — 0건이 통과가 아니다');

  console.log(`\n잰것: 머리 모양 ${list.length}가지 × 각도 ${ANGLES.length} (${angles}번) · 틈은 ${rows}줄`);
  if (bad.length) { console.log('\n❌ ' + bad.length + '건\n' + bad.map(b => '  · ' + b).join('\n')); }
  else console.log('\n✅ 머리카락이 머리통에 붙어 있다');
  await br.close();
  process.exit(bad.length ? 1 : 0);
})();
