// 사람이 보낸 «시그니처 애교» SVG 를 게임이 읽을 모양으로 굽는다
//
//   node tools/gensig.js <받은 파일> <내보낼 파일>
//
// 2026-10-08 에 🔥 홍염 원숭이의 애교 SVG(`01-signature.svg` · 4.3MB)를 받았다.
// 그대로는 못 쓴다 — 아래 넷을 한 번에 한다. **그림(path·색·움직임)은 한 글자도
// 안 고친다** — 사람이 보낸 움직임이 아니게 되면 안 된다.
//
// ① **한 바퀴를 늘려 «오래 쉬게» 한다** (「A 로 적용해줘」 · 사람이 골랐다).
//    받은 것은 6초 남짓에 한 바퀴라(원숭이 6.2 · 나비 5.8 · 파일에서 읽는다) 거의 쉬지 않고 돈다. 게임의 애교는 «4초 움직이고
//    10초 쉰다»(`petidle.js`)라, keyTimes 를 OLD/NEW 로 줄이고 끝에 «마지막 자세 그대로»
//    한 칸을 덧붙인다 — **절대 시각은 안 바뀐다**(0.2초에 불꽃이 일기 시작해 6.2초에
//    제자리). ⚠️⚠️ **14초가 아니라 16초다** — 처음에 공통 리그와 같은 14초로 구웠는데,
//    불꽃이 0.2초부터 이는 탓에 쉬는 몫이 **7.6~7.9초**로 `checkcreature` 의
//    「쉬는 구간 8초 이상」에 걸렸다. 문턱을 내리는 대신 한 바퀴를 늘렸다 → 약 10초 쉰다
// ② **같은 자세가 세 번 이어지면 가운데를 뺀다.** 보간이 «linear» 라 그림은 같다.
//    프레임마다 몸 전체 path 를 통째로 다시 적어 둔 구조라 이것만으로 4분의 1이 준다
// ③ **path 좌표를 소수 첫째 자리로 줄인다.** 320 칸 상자라 0.05칸 = 화면 0.02px 안팎이다.
//    ⚠️ keyTimes·opacity·transform 값은 안 건드린다 — 거기서 자릿수를 잃으면 박자가 틀어진다
// ④ **움직임 줄이기용 사본(`.still`)과 그 `<style>` 을 걷는다.** `<image>` 로 불러오면
//    파일 안의 `@media(prefers-reduced-motion)` 는 **한 번도 안 먹는다**(CLAUDE.md) —
//    그 자리에서는 게임이 정지 그림(`peach-monkey.svg`)을 쓴다. 남겨 두면 안 보이는
//    사본이 용량만 먹는다
//
// ⚠️ viewBox 는 여기서 안 정한다 — 움직임 전체(불꽃·연기까지)를 «찍어서» 재야 해서
//    브라우저가 필요하다. 구운 뒤 `creature.js` 의 `SIGNATURE` 에 적힌 값을 넣는다
'use strict';
const fs = require('fs');
const [src, out, newArg] = process.argv.slice(2);
if (!src || !out) { console.error('쓰는 법: node tools/gensig.js <받은 파일> <내보낼 파일> [한 바퀴 초 · 기본 16]'); process.exit(2); }
// ⚠️ 받은 움직임이 길면 한 바퀴도 늘린다 — 숯불 말랑이(9.4초)는 16초로 구우면 6초밖에 안 쉬어
//    `checkcreature` 의 「쉬는 구간 8초 이상」에 걸린다. 그래서 20초로 굽는다
const NEW = Number(newArg) || 16;
let s = fs.readFileSync(src, 'utf8');
// 받은 한 바퀴는 파일마다 다르다 (원숭이 6.2초 · 나비 5.8초) — 하나여야 한다
const durs = [...new Set(s.match(/dur="[^"]*"/g) || [])];
if (durs.length !== 1) throw new Error(`한 바퀴가 한 박자가 아니다: ${durs}`);
const OLD = parseFloat(durs[0].slice(5));

// ④ 사본과 그 스타일을 걷는다 — `.moving` 의 껍데기는 그냥 <g> 로 남긴다
s = s.replace(/<style>[\s\S]*?<\/style>/, '');
const still = s.indexOf('<g class="still">');
if (still < 0) throw new Error('.still 을 못 찾았다 — 받은 파일의 짜임이 다르다');
s = s.slice(0, still) + '</svg>';
s = s.replace('<g class="moving">', '<g>');

// ② · ① — 애니메이션마다 keyTimes/values 를 한 벌로 다룬다
let dropped = 0, anims = 0;
s = s.replace(/<(animate|animateTransform)\b([^>]*?)\/>/g, (m, tag, body) => {
  const kt = /keyTimes="([^"]*)"/.exec(body), vs = /values="([^"]*)"/.exec(body);
  if (!kt || !vs) throw new Error('keyTimes/values 가 없는 애니메이션이 있다');
  
  if (/calcMode|keySplines|begin=/.test(body)) throw new Error('linear 가 아닌 애니메이션이 있다');
  let K = kt[1].split(';').map(Number), V = vs[1].split(';');
  if (K.length !== V.length) throw new Error('keyTimes 와 values 의 수가 다르다');
  const keep = V.map((v, i) => i === 0 || i === V.length - 1 || !(V[i - 1] === v && V[i + 1] === v));
  dropped += keep.filter(k => !k).length;
  K = K.filter((_, i) => keep[i]); V = V.filter((_, i) => keep[i]);
  K = K.map(k => +(k * OLD / NEW).toFixed(6));
  K.push(1); V.push(V[V.length - 1]);
  anims++;
  return `<${tag}` + body
    .replace(/dur="[^"]*"/, `dur="${NEW}s"`)
    .replace(/keyTimes="[^"]*"/, `keyTimes="${K.join(';')}"`)
    .replace(/values="[^"]*"/, `values="${V.join(';')}"`) + '/>';
});

// ③ path 좌표만 줄인다 (`d="…"` 와 path 모핑의 values)
const round = t => t.replace(/-?\d+\.\d+/g, x => String(+(+x).toFixed(1)));
s = s.replace(/ d="([^"]*)"/g, (m, d) => ` d="${round(d)}"`);
s = s.replace(/(<animate attributeName="d"[^>]*values=")([^"]*)"/g, (m, a, v) => a + round(v) + '"');

fs.writeFileSync(out, s);
console.log(`애니메이션 ${anims}개 · 뺀 프레임 ${dropped}칸 · ${(fs.statSync(src).size / 1048576).toFixed(2)}MB → ${(s.length / 1048576).toFixed(2)}MB`);
