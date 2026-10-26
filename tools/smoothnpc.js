// NPC 그림의 머리카락 윤곽을 다듬어 tools/ref/npc-smooth/sp_*.svg 로 굽는다 (한 번 굽고 저장소에 둔다)
//
//   node tools/smoothnpc.js     # 브라우저 + python3(cv2) 필요 · 끝나면 node tools/gennpc.js 를 다시 돌린다
//
// 받은 그림(tools/ref/npc)은 래스터를 대고 딴 것이라 머리카락 가장자리가 계단·톱니로 들쭉날쭉했다
// (「머리카락 윤곽도 매끄럽게 다듬어줘」 · 신고받았다). 조각 하나하나를 펴서는 안 된다 — 들쭉날쭉한 윤곽은
// «여러 조각이 겹친 경계»라 조각마다 펴도 그대로였다 (해 보고 알았다). 그래서 «그려진 그림»을 다시 딴다:
//   ① gennpc 가 색을 모은 그림(--raw)을 SCALE 배로 앤티에일리어싱 없이 찍고
//   ② smoothnpc.py 가 머리색만 가우시안 다수결로 다듬고 층을 다시 딴다
// ⚠️ 머리색(HAIR)은 그림마다 «재서» 적은 값이다 — 그림을 바꾸면 다시 잰다 (정수리부터 눈높이까지 훑어 본다)
// ⚠️ 바뀌는 자리는 「머리 ↔ 머리·살·바탕」 사이뿐이다 — 활시위·바이올린 활처럼 가는 것은 안 먹힌다
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'tools', 'ref', 'npc-smooth');
const SCALE = 4, SIGMA = 1.6, ITER = 4, EPS = 0.6;
const HAIR = {
  sp_althea: ['#ebebfb'], sp_clemen: ['#3c3137'], sp_kairos: ['#835337'], sp_orix: ['#d25f38'],
  sp_stark: ['#754930'], sp_sylvan: ['#6d422b'], sp_valen: ['#fdd07b', '#e7a847'],
  sp_ygritte: ['#bc4038'], sp_yutark: ['#e0d9e8', '#d0c1d8'],
};

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'smoothnpc-'));
  const raw = path.join(work, 'raw.js');
  execFileSync('node', [path.join(__dirname, 'gennpc.js'), '--raw', raw], { stdio: 'inherit' });
  global.window = {}; require(raw); const NA = window.NpcArt;
  const { chromium } = require('playwright');
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  for (const [id, a] of Object.entries(NA)) {
    if (!HAIR[id]) throw new Error('머리색이 없다 — ' + id);
    const ps = a.art.match(/<path [^>]*\/>/g);
    const pal = [...new Set(ps.map(m => m.match(/fill="([^"]*)"/)[1]))];
    HAIR[id].forEach(c => { if (!pal.includes(c)) throw new Error(`${id} 의 머리색 ${c} 가 팔레트에 없다`); });
    const W = Math.ceil(a.w * SCALE), H = Math.ceil(a.h * SCALE);
    const art = a.hole ? `<mask id="m" maskUnits="userSpaceOnUse" x="-10" y="-10" width="${a.w + 20}" height="${a.h + 20}"><rect x="-10" y="-10" width="${a.w + 20}" height="${a.h + 20}" fill="#fff"/><g fill="#000">${a.hole}</g></mask><g mask="url(#m)">${a.art}</g>` : a.art;
    const p = await b.newPage({ viewport: { width: W, height: H } });
    await p.setContent(`<body style="margin:0;background:transparent"><svg width="${W}" height="${H}" viewBox="0 0 ${a.w} ${a.h}" shape-rendering="crispEdges" style="display:block">${art}</svg></body>`);
    await p.screenshot({ path: path.join(work, id + '.png'), omitBackground: true });
    await p.close();
    fs.writeFileSync(path.join(work, id + '.json'), JSON.stringify({ id, w: a.w, h: a.h, scale: SCALE, sigma: SIGMA, iter: ITER, eps: EPS,
      pal, hair: HAIR[id], face: a.face }));
  }
  await b.close();
  execFileSync('python3', ['-I', path.join(__dirname, 'smoothnpc.py'), work], { stdio: 'inherit' });
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of Object.keys(NA)) fs.copyFileSync(path.join(work, id + '.svg'), path.join(OUT, id + '.svg'));
  fs.rmSync(work, { recursive: true, force: true });
  console.log('✅ smoothnpc — tools/ref/npc-smooth/ 아홉 · 이제 node tools/gennpc.js');
})().catch(e => { console.error('❌ smoothnpc — ' + e.message); process.exit(1); });
