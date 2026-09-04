// ═══════════════════════════════════════════════════════════════
//  게임을 «파일 하나»로 묶는다 (npm run bundle)
// ═══════════════════════════════════════════════════════════════
//
// 서버 없이 열어 볼 수 있는 한 장짜리 HTML 을 만든다 —
// 아티팩트(claude.ai)에 올려 화면 옆에 띄워 두고 보기 위한 것이다.
//
// ⚠️ **원본은 그대로 둔다.** `index.html` 을 고쳐서 인라인하는 것이 아니라,
// 읽어서 치환한 사본을 따로 쓴다. 배포되는 게임은 여전히 파일 여러 개다
// (캐시 버스터·부분 갱신이 그쪽에서는 이득이다).
//
// ⚠️ **`<script>` 순서를 그대로 지킨다.** 모듈 시스템이 없어서 순서가 곧 의존성이다
// (`sync.js` 는 `game.js` 보다 먼저). 그래서 index.html 에 적힌 순서대로 치환한다.
//
// ⚠️ **아티팩트는 바깥으로 못 나간다.** 서버 동기화(`/api/...`)는 전부 실패하는데,
// 「로컬이 항상 진짜다」라 게임은 그대로 돈다 — 세이브가 그 브라우저에만 남을 뿐이다.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'dist', 'game.html');

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let html = read('index.html');

// ① 스타일시트
html = html.replace(/<link rel="stylesheet" href="style\.css[^"]*">/,
  () => '<style>\n' + read('style.css') + '\n</style>');

// ② 스크립트 — 적힌 순서 그대로
html = html.replace(/<script src="([\w.]+)\.js[^"]*"><\/script>/g, (m, name) => {
  const file = name + '.js';
  if (!fs.existsSync(path.join(ROOT, file))) return m;
  // `</script>` 가 문자열 안에 들어 있으면 인라인에서 태그가 일찍 닫힌다
  return '<script>\n' + read(file).replace(/<\/script>/g, '<\\/script>') + '\n</script>';
});

// ③ 로고 — data URI 로 (파일을 못 받아 오면 SVG 폴백으로 떨어지긴 하지만,
//    스플래시는 첫인상이라 원본 그대로 보이는 편이 낫다)
const logo = path.join(ROOT, 'logo.png');
if (fs.existsSync(logo)) {
  html = html.replace(/src="logo\.png[^"]*"/,
    'src="data:image/png;base64,' + fs.readFileSync(logo).toString('base64') + '"');
}

// ④ 아티팩트는 `<!doctype>…<head>…<body>` 를 스스로 씌운다 — 우리 것은 벗긴다.
//    `<title>` 과 폰트 `<link>` 는 남겨야 이름과 글꼴이 산다
const head = /<head>([\s\S]*?)<\/head>/.exec(html);
const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html);
if (!head || !body) throw new Error('index.html 의 head/body 를 못 찾았다');
// ⚠️ **줄 단위로 «고를» 것이 아니라 «뺄» 것만 뺀다.** 처음에 「제목·폰트·스타일 줄만
//    남긴다」로 짰더니, 인라인해 넣은 style.css 18만 자가 그 필터에 걸려
//    **선택자 몇 줄만 남고 통째로 날아갔다** (묶고 나서 열어 보고서야 알았다).
const keep = head[1].replace(/^\s*<meta\b[^>]*>\s*$/gm, '').trim();
const out = keep + '\n' + body[1];

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log(`한 장으로 묶었다 → ${path.relative(ROOT, OUT)} (${kb} KB)`);
