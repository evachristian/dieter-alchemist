// 표정 서른여덟 — 사람이 보낸 둥근 표정 세트(tools/ref/expr/*.svg)를 그대로 옮겨 expart.js 로 굽는다
//
//   node tools/genexpr.js            # expart.js 를 다시 쓴다
//   node tools/genexpr.js --check    # 다시 뽑은 것과 파일이 같은가 (npm test 가 돈다)
//
// 받은 SVG 는 160×160 한 캔버스에 그룹 넷(eyebrows · eyes · mouth · effects)이다.
// ⚠️ **그림은 한 글자도 안 고친다** — 그룹 «안»을 그대로 옮기고, 얼굴에 앉히는 자리·배율은
//    부르는 쪽(avatar.js · portrait.js)이 `ExpArt.draw(id, at)` 로 정한다. 그래서 얼굴의 자리를
//    옮겨도 이 파일은 안 바뀐다
// ⚠️ 받은 파일이라 **쓸 수 있는 것만** 통과시킨다 — 요소는 svg·title·g·path·ellipse·circle 뿐 ·
//    href · url( · on…= · <script 는 하나라도 있으면 멈춘다
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'tools', 'ref', 'expr');
const OUT = path.join(ROOT, 'expart.js');

const man = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const ALLOW = new Set(['svg', 'title', 'g', 'path', 'ellipse', 'circle', 'rect', 'line', 'polyline', 'polygon']);
const fail = m => { console.error('❌ genexpr — ' + m); process.exit(1); };

const list = {};
for (const { id, name } of man.expressions) {
  if (!/^[a-z]+$/.test(id)) fail(`id 가 이상하다: ${id}`);
  const svg = fs.readFileSync(path.join(SRC, id + '.svg'), 'utf8');
  if (/<script|href|url\(|\son[a-z]+\s*=|<!ENTITY|<!DOCTYPE/i.test(svg)) fail(`${id}.svg 에 쓸 수 없는 것이 있다`);
  for (const t of svg.matchAll(/<([a-zA-Z][\w-]*)/g)) if (!ALLOW.has(t[1])) fail(`${id}.svg 에 <${t[1]}> 가 있다`);
  if (!/viewBox="0 0 160 160"/.test(svg)) fail(`${id}.svg 의 캔버스가 160×160 이 아니다`);
  const grp = {};
  for (const k of ['eyebrows', 'eyes', 'mouth', 'effects']) {
    // ⚠️ 그룹 안에 그룹이 또 있을 수 있다 (생각 중의 눈이 translate 한 겹을 더 쓴다) — 깊이를 세며 닫는 짝을 찾는다
    const open = svg.match(new RegExp(`<g id="${k}"((?:\\s+transform="[^"]*")?)\\s*(/?)>`));
    if (!open) fail(`${id}.svg 에 ${k} 그룹이 없다`);
    const tf = (open[1].match(/transform="([^"]*)"/) || [])[1] || '';
    let body = '';
    if (!open[2]) {
      const from = open.index + open[0].length;
      const re = /<(\/?)g\b[^>]*?(\/?)>/g; re.lastIndex = from;
      let depth = 1, t;
      while ((t = re.exec(svg))) {
        if (t[1]) depth--; else if (!t[2]) depth++;
        if (!depth) { body = svg.slice(from, t.index).trim(); break; }
      }
      if (depth) fail(`${id}.svg 의 ${k} 그룹이 안 닫힌다`);
    }
    grp[k] = body ? (tf ? `<g transform="${tf}">${body}</g>` : body) : '';
  }
  if (!grp.eyes) fail(`${id}.svg 에 눈이 없다`);
  // 색 둘은 «예전 색»으로 되돌린다 (사람이 정했다 · 받은 SVG 는 그대로 둔다)
  //  · 볼터치 #F4B5C5 → 인트로 공주·옛 아바타의 볼터치(#ff9db4 · 0.6)
  //  · 반함의 하트 눈 #DD829B → 옛 하트 색(Avatar.HEART.base #e03040) — 분홍은 너무 흐렸다
  const fx = grp.effects.split('fill="#F4B5C5"').join('fill="#ff9db4" opacity="0.6"');
  const eyes = grp.eyes.split('#DD829B').join('#e03040');
  list[id] = { name, brows: grp.eyebrows, eyes, mouth: grp.mouth, fx };
}
if (Object.keys(list).length !== 38) fail(`표정이 ${Object.keys(list).length}개다 (38 이어야 한다)`);

const body = `// ⚠️ 생성 파일 — 손으로 고치지 않는다 (node tools/genexpr.js · 원본 tools/ref/expr/*.svg)
// 둥근 표정 서른여덟. 160×160 캔버스 그대로이고, 얼굴에 앉히는 자리는 부르는 쪽이 정한다 → window.ExpArt
(function () {
  'use strict';
  const LIST = ${JSON.stringify(list, null, 1)};
  // 받은 캔버스의 기준 — 두 눈 가운데(80,76) · 입 가운데(80,99 · 그룹의 translate(0 -8) 를 지난 뒤)
  const EYE_C = [80, 76], MOUTH_C = [80, 99];
  const f = n => +n.toFixed(3);
  // at = { ex, ey: 두 눈 가운데 · mx, my: 입 가운데 · s: 배율 · sm: 입 배율(없으면 s) · eyePart: 눈 그룹 속성 · noBrows: 눈썹 빼기 · eyeColor: 눈동자 색 }
  // ⚠️ 눈 조각(eyePart)은 transform 이 «없는» 겉 그룹에 붙인다 — 깜박임의 CSS 가 속성 변환을 덮어쓰지 않게
  // ⚠️ 눈썹·눈·효과(볼·눈물)는 «눈»을 기준으로, 입은 «입»을 기준으로 따로 앉힌다 —
  //    얼굴마다 눈과 입 사이가 달라서 한 변환으로는 둘 다 못 맞춘다
  // at.sey — 눈만 세로로 더 늘리는 몫(1 이면 받은 그대로) · 동그란 눈이 타원이 된다 (아바타가 「어리둥절」에 맞춘다)
  // at.cheek = { l: [x, y], r: [x, y], kx, ky } — 볼터치(받은 cx 41/119 · cy 87)와 그 위의 빗금을
  //   «볼 가운데»를 축으로 그 자리에 옮기고 kx·ky 배로 늘린다. 없으면 눈 변환을 그대로 탄다 (NPC)
  // ⚠️ 볼과 빗금은 «한 변환»을 탄다 — 따로 옮기면 크기를 바꿀 때 빗금이 볼 밖으로 나간다
  function cheekSplit(fx) {
    const L = [], R = [], rest = [];
    fx.replace(new RegExp('<(?:ellipse|path) [^>]*/>', 'g'), el => {
      const cx = +((el.match(/ cx="([0-9.]+)"/) || [])[1]);
      // ⚠️ 옅은 볼(무표정·차가움·노려봄 · rx8 ry4)도 «같은 크기»로 편다 — 볼터치는 어느 표정이든 한 크기다
      if (/^<ellipse/.test(el) && / cy="87"/.test(el) && (cx === 41 || cx === 119)) (cx < 80 ? L : R).push(el.replace(/ rx="[0-9.]+" ry="[0-9.]+"/, ' rx="11" ry="6"'));
      else if (/stroke="#DC91A7"/.test(el)) {
        const d = el.match(/ d="([^"]+)"/)[1], subs = d.match(/M[^M]+/g) || [];
        const side = w => subs.filter(p => (parseFloat(p.slice(1)) < 80) === w).join(' ').trim();
        if (side(true)) L.push(el.replace(d, side(true)));
        if (side(false)) R.push(el.replace(d, side(false)));
      } else rest.push(el);
      return '';
    });
    return { L: L.join(''), R: R.join(''), rest: rest.join('') };
  }
  function draw(id, at) {
    const e = LIST[id] || LIST.def;
    const s = at.s, sm = at.sm || s;
    const te = \`translate(\${f(at.ex)},\${f(at.ey)}) scale(\${f(s)}) translate(\${-EYE_C[0]},\${-EYE_C[1]})\`;
    const tm = \`translate(\${f(at.mx)},\${f(at.my)}) scale(\${f(sm)}) translate(\${-MOUTH_C[0]},\${-MOUTH_C[1]})\`;
    const tey = at.sey ? \`translate(\${f(at.ex)},\${f(at.ey)}) scale(\${f(s)},\${f(s * at.sey)}) translate(\${-EYE_C[0]},\${-EYE_C[1]})\` : te;
    let fx = e.fx ? \`<g transform="\${te}">\${e.fx}</g>\` : '';
    if (e.fx && at.cheek) {
      const c = at.cheek, sp = cheekSplit(e.fx);
      const one = (p, cx, body) => body ? \`<g transform="translate(\${f(p[0])},\${f(p[1])}) scale(\${f(c.kx)},\${f(c.ky)}) translate(\${-cx},-87)">\${body}</g>\` : '';
      fx = one(c.l, 41, sp.L) + one(c.r, 119, sp.R) + (sp.rest ? \`<g transform="\${te}">\${sp.rest}</g>\` : '');
    }
    return \`<g data-part="exp" data-exp="\${LIST[id] ? id : 'def'}">\`
      + fx
      + (e.brows && !at.noBrows ? \`<g transform="\${te}">\${e.brows}</g>\` : '')
      + \`<g \${at.eyePart || ''}><g transform="\${tey}">\${at.eyeColor ? e.eyes.split('#49363B').join(at.eyeColor) : e.eyes}</g></g>\`
      + (e.mouth ? \`<g transform="\${tm}"><g transform="translate(0 -8)">\${e.mouth}</g></g>\` : '')
      + '</g>';
  }
  window.ExpArt = { draw, has: id => !!LIST[id], hasBrows: id => !!(LIST[id] && LIST[id].brows), ids: Object.keys(LIST), nameOf: id => LIST[id] && LIST[id].name };
})();
`;
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== body) fail('expart.js 가 원본과 다르다 — node tools/genexpr.js 로 다시 뽑는다');
  console.log('✅ genexpr — 표정 38 · expart.js 가 원본과 같다');
} else { fs.writeFileSync(OUT, body); console.log('✅ expart.js — 표정 38'); }
