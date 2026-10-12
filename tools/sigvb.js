// 시그니처 애교 SVG 의 «움직임 전체»가 차지하는 상자를 잰다 → creature.js 의 SIGNATURE.vb
//
//   node tools/sigvb.js <구운 파일(…-anim.svg)>
//
// 한 바퀴(16초)를 0.05초마다 멈춰 찍어 칠한 데를 다 모은다 (`u`) · 첫 프레임(`first`)이 곧
// 쉬는 자세라 SIGNATURE.rest 와 견줄 수 있다. vb 는 `u` 에 2칸 여유를 두어 적는다(선 굵기 몫).
// ⚠️⚠️ **path 만 재면 안 된다** (2026-10-12) — 구름 볏 토끼의 «구름»이 circle·ellipse 라
//    잰 상자 밖이었고, 그대로 viewBox 가 되어 **구름 위쪽이 잘렸다** (신고받았다).
//    숯불 말랑이·용암 펭귄·다람쥐·아기곰·꼬북·곰돌도 같은 이유로 조금씩 잘려 있었다
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  let s = fs.readFileSync(process.argv[2], 'utf8').replace(/viewBox="[^"]*"/, 'viewBox="0 0 320 320" width="320" height="320"').replace(/preserveAspectRatio="[^"]*"/, '');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  await p.setContent(`<body style="margin:0">${s}</body>`);
  const r = await p.evaluate(() => {
    const svg = document.querySelector('svg'); svg.pauseAnimations();
    let u = [1e9, 1e9, -1e9, -1e9]; const per = [];
    for (let t = 0; t <= 16; t += 0.05) {
      svg.setCurrentTime(t);
      let v = [1e9, 1e9, -1e9, -1e9];
      svg.querySelectorAll('path,circle,ellipse,rect,polygon,polyline,line,use').forEach(el => {
        if (+getComputedStyle(el).opacity === 0) return;
        let o = 1, e = el; while (e && e !== svg) { o *= +getComputedStyle(e).opacity; e = e.parentElement; }
        if (o < 0.02) return;
        const q = el.getBoundingClientRect(); if (!q.width) return;
        v = [Math.min(v[0], q.left), Math.min(v[1], q.top), Math.max(v[2], q.right), Math.max(v[3], q.bottom)];
      });
      per.push([t.toFixed(2), v.map(x => +x.toFixed(1)).join(',')]);
      u = [Math.min(u[0], v[0]), Math.min(u[1], v[1]), Math.max(u[2], v[2]), Math.max(u[3], v[3])];
    }
    return { u, first: per[0], last: per[per.length - 1] };
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
