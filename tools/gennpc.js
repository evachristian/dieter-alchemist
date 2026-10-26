// NPC 아홉의 그림 — 사람이 보낸 SVG(tools/ref/npc/sp_*.svg)를 그대로 옮겨 npcart.js 로 굽는다
//
//   node tools/gennpc.js            # npcart.js 를 다시 쓴다
//   node tools/gennpc.js --check    # 다시 뽑은 것과 파일이 같은가 (npm test 가 돈다)
//
// 받은 그림은 «얼굴이 빈» 전신 치비다 — 표정은 portrait.js 가 받은 둥근 표정 세트(ExpArt)로
// 그 얼굴 위에 얹는다. 얼굴의 자리(FACE)는 그림마다 «재서» 적은 값이고, 그림을 바꾸면 다시 잰다.
// ⚠️ **모양은 한 글자도 안 고친다** — path 의 d·transform 은 그대로 옮긴다. 고치는 것은 «색»뿐이다:
//    받은 그림은 래스터를 대고 딴 것이라 한 면이 «거의 같은 색» 수십 조각으로 갈려 있고(오릭스 117색 · 살색만 열 몇 가지),
//    가장자리에는 두 색이 섞인 띠가 조각마다 따로 남아 윤곽이 얼룩덜룩했다 (「가장자리 윤곽이 얼룩덜룩」 · 신고받았다).
//    그래서 굽기 전에 색을 «팔레트로 모은다»(`snapColors`) — ① 넓이 순으로 훑어 이미 고른 색과 가까우면(SNAP_NEAR)
//    그 색으로 합치고 ② 그래도 남는 «작은» 색(전체 넓이의 SNAP_SMALL 아래)의 조각은 밑에 깔린 조각의 색을 따른다
//    (SNAP_FAR 안에서만 — 멀면 일부러 칠한 작은 색이라 그대로 둔다 · 밑이 바탕이면 지운다)
// ⚠️ 받은 파일이라 **쓸 수 있는 것만** 통과시킨다 — 요소는 svg·path 뿐 · 속성은 d·fill·transform 뿐
// ⚠️ 바깥 그림(<image>)으로 걸지 않고 문자열로 굽는다 — 호박 밭이 초상화를 캔버스에 그리는데
//    그 안에서는 바깥 그림이 안 열린다
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'tools', 'ref', 'npc');
const OUT = path.join(ROOT, 'npcart.js');
const fail = m => { console.error('❌ gennpc — ' + m); process.exit(1); };

// 얼굴 자리 (그림 좌표) — cx: 얼굴 가운데 · ey: 두 눈 가운데 높이 · my: 입 가운데 높이 ·
// gap: 두 눈 사이(눈 가운데끼리) · rx: 얼굴 반폭 · chin: 턱 끝 높이 (같이 먹기 컷씬이 머리만 잘라 얹을 때 쓴다)
// ⚠️ 표정 세트를 얹어 그려 보고 맞춘 값이다 (tools/ref/npc 를 바꾸면 다시 잰다)
const FACE = {
  sp_althea:  { cx: 177,   ey: 137, my: 166, gap: 52, rx: 60, chin: 173 },
  sp_clemen:  { cx: 127.5, ey: 148, my: 187, gap: 56, rx: 66.5, chin: 195 },
  sp_kairos:  { cx: 156,   ey: 136, my: 173, gap: 46, rx: 50, chin: 191 },
  sp_orix:    { cx: 161,   ey: 124, my: 158, gap: 56, rx: 66, chin: 166 },
  sp_stark:   { cx: 133,   ey: 130, my: 176, gap: 58, rx: 69, chin: 185 },
  sp_sylvan:  { cx: 121.5, ey: 133, my: 166, gap: 52, rx: 61.5, chin: 173 },
  sp_valen:   { cx: 143.5, ey: 138, my: 180, gap: 58, rx: 68.5, chin: 188 },
  sp_ygritte: { cx: 160.5, ey: 148, my: 184, gap: 48, rx: 55.5, chin: 191 },
  sp_yutark:  { cx: 156.5, ey: 151, my: 185, gap: 46, rx: 52.5, chin: 191 },
};

const SNAP_NEAR = 22, SNAP_FAR = 80, SNAP_SMALL = 0.004;
const rgb = c => { c = c.slice(1); if (c.length === 3) c = c.replace(/./g, '$&$&'); return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16)); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// 대략의 넓이 — 좌표 짝을 차례로 이은 신발끈 공식 (제어점이 섞여도 «어느 색이 큰가»를 가르기엔 충분하다)
const areaOf = d => { const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number); let a = 0;
  for (let i = 0; i + 3 < n.length; i += 2) a += n[i] * n[i + 3] - n[i + 2] * n[i + 1]; return Math.abs(a / 2); };
// 좌표 짝을 차례로 이은 다각형 (제어점이 섞여도 «이 점이 그 조각 안인가»를 가르기엔 충분하다)
const polyOf = p => { const n = (p.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const tr = (p.transform || '').match(/-?[\d.]+/g) || [0, 0]; const pts = [];
  for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i] + +tr[0], n[i + 1] + +(tr[1] || 0)]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  return { pts, box: [x0, y0, x1, y1] }; };
const inside = (P, x, y) => { if (x < P.box[0] || x > P.box[2] || y < P.box[1] || y > P.box[3]) return false;
  let c = false; const q = P.pts;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++)
    if ((q[i][1] > y) !== (q[j][1] > y) && x < (q[j][0] - q[i][0]) * (y - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
  return c; };
function snapColors(items) {
  const W = {}; let total = 0;
  items.forEach(p => { const c = p.fill.toLowerCase(); W[c] = (W[c] || 0) + p.area; total += p.area; });
  const cols = Object.keys(W).sort((a, b) => W[b] - W[a] || (a < b ? -1 : 1));
  const pal = [], map = {};
  for (const c of cols) {
    const near = pal.find(q => dist(rgb(q.c), rgb(c)) < SNAP_NEAR);
    if (near) { map[c] = near.c; near.w += W[c]; } else { pal.push({ c, w: W[c] }); map[c] = c; }
  }
  const small = new Set(pal.filter(q => q.w < total * SNAP_SMALL).map(q => q.c));
  // ② 작은 색의 조각은 «그 밑에 깔린 조각»의 색을 따른다 — 가장자리 띠는 두 면이 섞인 색이라 어느 «가까운 색»으로
  //    보내도 틀린 데가 생긴다(옅은 파랑 띠가 흰 머리 색이 되어 망토 가장자리에 흰 점으로 남았다). 밑에 아무것도
  //    없으면(바탕 위) 그 조각은 지운다. 밑의 색과 멀면(SNAP_FAR) 일부러 칠한 작은 색이라 그대로 둔다
  const polys = items.map(polyOf);
  const out = items.map(p => map[p.fill.toLowerCase()]);
  items.forEach((p, i) => {
    if (!small.has(out[i])) return;
    const P = polys[i], cx = (P.box[0] + P.box[2]) / 2, cy = (P.box[1] + P.box[3]) / 2;
    let under = -1;
    for (let j = i - 1; j >= 0; j--) if (!small.has(out[j]) && inside(polys[j], cx, cy)) { under = j; break; }
    if (under < 0) out[i] = null;
    else if (dist(rgb(out[under]), rgb(out[i])) < SNAP_FAR) out[i] = out[under];
  });
  return { out, n: new Set(out.filter(Boolean)).size, from: cols.length, drop: out.filter(c => !c).length };
}

// ⚠️ 받은 그림의 «바탕 흰색»이 실루엣 안에 갇힌 칸으로 남은 것 — 망치 손잡이와 머리 사이(오릭스) · 활과 시위 사이(슈타르크) ·
//    머리와 어깨 사이(카이로스). 둘레가 막혀 있어 따는 쪽이 «면»으로 땄다 (「망치, 활 사이에 흰색 영역」 · 신고받았다).
//    그 색(팔레트로 모은 뒤의 색)의 조각은 그리지 않고 «구멍»(`hole`)으로 따로 내보낸다 — 그냥 지우면 그 밑에 깔린
//    큰 조각(슈타르크는 살색)이 비쳤다. portrait.js 가 구멍을 마스크로 도려낸다.
//    ⚠️ 흰 머리(알테이아)·회색 바지(발렌)는 다른 색이라 안 걸린다
const BG_DROP = { sp_orix: '#f9f6ef', sp_stark: '#fdfcf5', sp_kairos: '#fcfcf6' };
const list = {}, snapLog = [];
for (const id of Object.keys(FACE)) {
  const svg = fs.readFileSync(path.join(SRC, id + '.svg'), 'utf8');
  if (/<script|href|url\(|\son[a-z]+\s*=|<!ENTITY|<!DOCTYPE/i.test(svg)) fail(`${id}.svg 에 쓸 수 없는 것이 있다`);
  const vb = svg.match(/<svg\b[^>]*\bviewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vb) fail(`${id}.svg 에 viewBox 가 없다`);
  const body = svg.replace(/<\?xml[^>]*\?>/, '').replace(/<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const paths = [];
  const re = /<path\b([^>]*)\/>|(\S)/g; let t;
  while ((t = re.exec(body))) {
    if (t[2]) fail(`${id}.svg 에 path 말고 다른 것이 있다 (${body.slice(t.index, t.index + 20)})`);
    const at = {};
    for (const a of t[1].matchAll(/\s([a-zA-Z-]+)="([^"]*)"/g)) at[a[1]] = a[2];
    const keys = Object.keys(at);
    if (keys.some(k => !['d', 'fill', 'transform'].includes(k))) fail(`${id}.svg 의 path 에 모르는 속성 (${keys})`);
    if (!/^[MmCcLlHhVvSsQqTtAaZz\d\s.,-]+$/.test(at.d || '')) fail(`${id}.svg 의 d 가 이상하다`);
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(at.fill || '')) fail(`${id}.svg 의 fill 이 이상하다 (${at.fill})`);
    if (at.transform && !/^translate\([\d.\s,-]+\)$/.test(at.transform)) fail(`${id}.svg 의 transform 이 이상하다`);
    paths.push({ d: at.d, fill: at.fill, transform: at.transform, area: areaOf(at.d) });
  }
  if (!paths.length) fail(`${id}.svg 에 그림이 없다`);
  const sn = snapColors(paths);
  if (BG_DROP[id]) { const k = sn.out.filter(c => c === BG_DROP[id]).length;
    if (!k) fail(`${id}.svg 에서 지울 바탕색(${BG_DROP[id]})을 못 찾았다 — 그림이나 팔레트가 바뀌었다`);
    sn.hole = paths.filter((p, i) => sn.out[i] === BG_DROP[id]).map(p => `<path d="${p.d}"${p.transform ? ` transform="${p.transform}"` : ''}/>`).join('');
    sn.out = sn.out.map(c => c === BG_DROP[id] ? null : c); sn.drop += k; } snapLog.push(`${id} ${sn.from}→${sn.n}색(−${sn.drop})`);
  const art = paths.map((p, i) => sn.out[i] ? `<path d="${p.d}" fill="${sn.out[i]}"${p.transform ? ` transform="${p.transform}"` : ''}/>` : '').join('');
  list[id] = Object.assign({ w: +vb[1], h: +vb[2], face: FACE[id], art }, sn.hole ? { hole: sn.hole } : {});
}

const out = `// ⚠️ 생성 파일 — 손으로 고치지 않는다 (node tools/gennpc.js · 원본 tools/ref/npc/*.svg)
// NPC 아홉의 «얼굴이 빈» 전신 그림과 그 얼굴의 자리 → window.NpcArt (portrait.js 가 표정을 얹는다)
window.NpcArt = ${JSON.stringify(list)};
`;
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== out) fail('npcart.js 가 원본과 다르다 — node tools/gennpc.js 로 다시 뽑는다');
  console.log(`✅ gennpc — NPC ${Object.keys(list).length} · npcart.js 가 원본과 같다`);
} else { fs.writeFileSync(OUT, out); console.log(`✅ npcart.js — NPC ${Object.keys(list).length} · ${(out.length / 1024).toFixed(0)}KB · ${snapLog.join(' · ')}`); }
