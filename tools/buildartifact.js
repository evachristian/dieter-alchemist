#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  아티팩트 빌드 — 게임 전체를 «파일 하나»로 접는다
//
//  왜 필요한가
//    아티팩트(claude.ai 에 올리는 페이지)는 외부 호스트에서 스크립트·스타일·
//    이미지를 못 받아 온다 (CSP 허용 목록은 CDN 몇 곳과 구글 폰트뿐이다).
//    그래서 index.html 이 `<script src>` 로 부르던 열넷과 style.css · logo.png 를
//    전부 안쪽으로 접어 넣어야 «주소 없이 그 자체로 도는» 한 장이 된다.
//
//  주의할 것
//    · <!DOCTYPE>·<html>·<head>·<body> 는 넣지 않는다. 아티팩트가 그 껍데기를
//      스스로 씌우기 때문에, 여기서 또 쓰면 문서가 두 겹이 된다
//    · 서버 동기화는 끈다 (enabled() → false). 아티팩트에서는 /api/* 로 나가는
//      요청이 전부 막히는데, 켜 둔 채로 두면 부팅마다 실패한 요청이 쌓이고
//      상태 표시가 계속 '오프라인' 으로 깜빡인다. file:// 로 열었을 때와 같은
//      길로 보내면 게임은 로컬 세이브만으로 그대로 돈다 (로컬이 정본이다)
//    · 스크립트 «순서»가 곧 의존성 순서다. index.html 에 적힌 차례를 그대로 쓴다
//
//  쓰는 법
//    node tools/buildartifact.js [나갈 경로]        (기본 build/artifact.html)
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const out = process.argv[2] || path.join(ROOT, 'build', 'artifact.html');

function read(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }

// ─── 1. index.html 에서 <body> 안쪽만 꺼낸다 ───
const html = read('index.html');
const bodyStart = html.indexOf('<body>');
const bodyEnd = html.lastIndexOf('</body>');
if (bodyStart < 0 || bodyEnd < 0) throw new Error('index.html 에서 <body> 를 못 찾았다');
let body = html.slice(bodyStart + '<body>'.length, bodyEnd);

// ─── 2. logo.png → data URI ───
// 아티팩트는 외부는 물론 같은 폴더의 파일도 못 받는다 (파일 하나만 올라간다).
const logo = fs.readFileSync(path.join(ROOT, 'logo.png')).toString('base64');
body = body.replace(/src="logo\.png(\?[^"]*)?"/g, `src="data:image/png;base64,${logo}"`);

// ─── 3. <script src="…"> 를 내용으로 갈아 끼운다 ───
const inlined = [];
body = body.replace(/<script src="([^"?]+)(\?[^"]*)?"><\/script>/g, (_, file) => {
  let js = read(file);
  if (file === 'sync.js') js = disableSync(js, file);
  // 스크립트 안에 </script> 가 있으면 그 자리에서 태그가 끊긴다.
  // 지금은 하나도 없지만, 나중에 문자열로 들어와도 조용히 깨지지 않게 막아 둔다.
  js = js.replace(/<\/script/gi, '<\\/script');
  inlined.push(file);
  return `<script>\n${js}\n</script>`;
});

// ─── 서버 동기화 끄기 ───
// enabled() 한 곳만 막으면 push·pull·밭까지 전부 «없는 셈» 으로 떨어진다
// (sync.js 안의 모든 출구가 이미 이 함수를 먼저 본다).
function disableSync(js, file) {
  const mark = 'function enabled() {';
  const at = js.indexOf(mark);
  if (at < 0) throw new Error(`${file} 의 enabled() 를 못 찾았다 — 아티팩트 빌드가 동기화를 못 끈다`);
  const patched = js.slice(0, at + mark.length) +
    '\n    return false;   // 아티팩트 빌드: 서버로 나가는 길이 막혀 있다 (로컬 세이브만 쓴다)' +
    js.slice(at + mark.length);
  return patched;
}

// ─── 4. 머리말 — 제목 · 폰트 · style.css ───
// 구글 폰트는 아티팩트 CSP 가 허용하는 몇 안 되는 외부 주소다.
// 그래도 못 받는 경우를 위해 style.css 의 폰트 스택에 시스템 폰트가 뒤따른다.
const head = [
  '<title>다이어터 연금술사</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap" rel="stylesheet">',
  '<style>\n' + read('style.css') + '\n</style>',
].join('\n');

const result = head + '\n' + body + '\n';

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, result, 'utf8');

// ─── 5. 스스로 확인 ───
// 「빌드는 됐는데 안 도는」 한 장을 올려 놓고 나서 알아채면 늦다.
const left = result.match(/<script src=|<link rel="stylesheet" href="(?!https:\/\/fonts)/g);
if (left) throw new Error('아직 바깥 파일을 부르는 자리가 남았다: ' + left.join(', '));
if (/<!DOCTYPE|<html|<\/html>|<body>|<\/body>/i.test(result)) throw new Error('문서 껍데기가 남았다 — 아티팩트가 스스로 씌운다');
const MB = 16 * 1024 * 1024;
const size = Buffer.byteLength(result);
if (size > MB) throw new Error(`${(size / 1024 / 1024).toFixed(1)}MB — 아티팩트 상한 16MB 를 넘었다`);

console.log(`아티팩트 한 장을 만들었다 → ${path.relative(ROOT, out)}`);
console.log(`  접어 넣은 스크립트 ${inlined.length}개: ${inlined.join(' ')}`);
console.log(`  크기 ${(size / 1024 / 1024).toFixed(2)}MB (상한 16MB)`);
