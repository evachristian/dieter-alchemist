// NPC 아홉의 그림 — 사람이 보낸 SVG(tools/ref/npc/sp_*.svg)를 그대로 옮겨 npcart.js 로 굽는다
//
//   node tools/gennpc.js            # npcart.js 를 다시 쓴다
//   node tools/gennpc.js --check    # 다시 뽑은 것과 파일이 같은가 (npm test 가 돈다)
//
// 받은 그림은 «얼굴이 빈» 전신 치비다 — 표정은 portrait.js 가 받은 둥근 표정 세트(ExpArt)로
// 그 얼굴 위에 얹는다. 얼굴의 자리(FACE)는 그림마다 «재서» 적은 값이고, 그림을 바꾸면 다시 잰다.
// ⚠️ **그림은 한 글자도 안 고친다** — path 의 d·fill·transform 을 그대로 옮긴다
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

const list = {};
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
    paths.push(`<path d="${at.d}" fill="${at.fill}"${at.transform ? ` transform="${at.transform}"` : ''}/>`);
  }
  if (!paths.length) fail(`${id}.svg 에 그림이 없다`);
  list[id] = { w: +vb[1], h: +vb[2], face: FACE[id], art: paths.join('') };
}

const out = `// ⚠️ 생성 파일 — 손으로 고치지 않는다 (node tools/gennpc.js · 원본 tools/ref/npc/*.svg)
// NPC 아홉의 «얼굴이 빈» 전신 그림과 그 얼굴의 자리 → window.NpcArt (portrait.js 가 표정을 얹는다)
window.NpcArt = ${JSON.stringify(list)};
`;
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== out) fail('npcart.js 가 원본과 다르다 — node tools/gennpc.js 로 다시 뽑는다');
  console.log(`✅ gennpc — NPC ${Object.keys(list).length} · npcart.js 가 원본과 같다`);
} else { fs.writeFileSync(OUT, out); console.log(`✅ npcart.js — NPC ${Object.keys(list).length} · ${(out.length / 1024).toFixed(0)}KB`); }
