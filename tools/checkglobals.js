// 전역 이름이 겹치는지 — **화면을 통째로 죽이는 종류**만 본다.
//
// 왜 필요한가: 이 게임에는 **모듈 시스템이 없다.** `<script>` 로 나란히 읽히므로
// `data.js` 의 최상위 `const X` 와 `game.js` 의 최상위 `const X` 는 **같은 전역 하나**다.
// 이름이 겹치면 브라우저가 `Identifier 'X' has already been declared` 를 던지고
// **그 파일이 통째로 실행되지 않는다.**
//
// 그때 화면은 오류를 안 띄운다 — 그냥 빈 껍데기가 되고, 콘솔을 안 열면 원인을 못 찾는다.
// `node --check` 도 못 잡는다: 파일 하나씩 보면 둘 다 멀쩡한 문법이기 때문이다.
// (`PAGE_TIERS` 를 data.js 로 옮기면서 game.js 에 그대로 남겨 놓아 실제로 겪었다)
//
// 사용: node tools/checkglobals.js      (종료 코드 0 = 안 겹침)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// `index.html` 이 읽는 순서 그대로 본다. 순서가 곧 의존성 순서다.
//
// ⚠️⚠️ **목록을 손으로 적어 두지 않는다.** 예전에는 여기에 파일 이름을 늘어놓았는데,
// 미니게임을 셋(`sparrow` · `pinwheel` · `driller`) 붙이는 동안 **아무도 여기에 안 넣어서**
// 그 셋은 한 번도 안 보고 있었다 — 새 파일이 전역을 겹쳐도 조용히 통과했을 것이다.
// (`checkui` 에 미니게임 화면 블록이 빠져 있던 것과 **같은 종류의 구멍**이다)
// 지금은 `index.html` 의 `<script>` 를 그대로 읽는다 — 게임이 읽는 것과 검사가 보는 것이
// 갈릴 수가 없다. ⚠️ 미니게임들은 IIFE 라 최상위 이름이 없는데, **없다는 것을 여기서 지킨다**
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FILES = [...HTML.matchAll(/<script\s+src="([^"?]+\.js)/g)].map(m => m[1]);
if (FILES.length < 10) {
  console.error(`❌ index.html 에서 스크립트를 ${FILES.length}개밖에 못 찾았다 — 읽는 식이 어긋났다`);
  process.exit(2);
}

// 최상위 선언만 뽑는다. **중괄호 깊이 0** 인 줄의 `const|let|var|function|class` 다.
// (IIFE 로 감싼 파일은 안쪽이 깊이 1 이상이라 저절로 빠진다 — 그쪽은 안 겹친다)
function topLevel(src) {
  const out = [];
  let depth = 0, i = 0, lineStart = true;
  while (i < src.length) {
    const ch = src[i];
    // 주석·문자열은 건너뛴다 — 그 안의 `const` 가 잡히면 안 된다
    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i); i = i < 0 ? src.length : i + 2; continue; }
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === q) break;
        // 템플릿 문자열 안의 `${…}` 는 중첩될 수 있지만, 그 안에 최상위 선언은 못 온다
      }
      i++; continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') { depth++; i++; lineStart = false; continue; }
    if (ch === '}' || ch === ')' || ch === ']') { depth--; i++; lineStart = false; continue; }
    if (ch === '\n') { lineStart = true; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
    if (depth === 0 && lineStart) {
      const m = src.slice(i).match(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/);
      if (m) { out.push(m[1]); i += m[0].length; lineStart = false; continue; }
    }
    lineStart = false;
    i++;
  }
  return out;
}

const owner = new Map();       // 이름 → 처음 선언한 파일
const clash = [];
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const names = topLevel(fs.readFileSync(p, 'utf8'));
  const seenHere = new Set();
  for (const n of names) {
    if (seenHere.has(n)) { clash.push(`${f} 안에서 «${n}» 을 두 번 선언한다`); continue; }
    seenHere.add(n);
    if (owner.has(n)) clash.push(`«${n}» — ${owner.get(n)} 와 ${f} 가 둘 다 선언한다`);
    else owner.set(n, f);
  }
}

if (!clash.length) {
  console.log(`✅ 전역 이름 안 겹침 (${FILES.length}개 파일 · 최상위 이름 ${owner.size}개)`);
  process.exit(0);
}
console.log('❌ 전역 이름이 겹친다 — 나중에 읽히는 파일이 «통째로» 실행되지 않는다\n');
clash.forEach(x => console.log('   ' + x));
console.log(`\n모두 ${clash.length}건`);
process.exit(1);
