// 서버 API 검사 — 의존성 없이 node test.js 로 실행
// (메모리 저장소 + 파일 저장소 두 가지로 같은 검사를 돌린다)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const out = [];
const ok = (c, m) => { out.push((c ? '  OK  ' : '  !!  ') + m); if (!c) process.exitCode = 1; };

const ID = 'p_' + 'a'.repeat(20);
const SEC = 's'.repeat(32);
const OTHER = 'x'.repeat(32);

async function run(label, env) {
  // 저장소를 바꿔 가며 index.js 를 새로 읽어들인다
  // (env 를 되돌릴 때 undefined 를 대입하면 문자열 "undefined" 가 되므로 반드시 delete)
  for (const k of Object.keys(require.cache)) delete require.cache[k];
  delete process.env.DATABASE_URL; delete process.env.DATA_DIR;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;

  const { app, store } = require('./index.js');
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const J = async (method, url, body) => {
    const r = await fetch(base + url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let j = null;
    try { j = await r.json(); } catch (e) {}
    return { status: r.status, body: j };
  };

  out.push(`── ${label} (${store.kind})`);

  // 1) 상태 확인
  let r = await J('GET', '/api/health');
  ok(r.status === 200 && r.body.ok === true, `health: ${JSON.stringify(r.body)}`);

  // 2) 없는 세이브는 404
  r = await J('GET', `/api/save/${ID}?secret=${SEC}`);
  ok(r.status === 404, `저장 전 조회 → ${r.status} (404 기대)`);

  // 3) 첫 저장
  r = await J('PUT', `/api/save/${ID}`, { secret: SEC, rev: 1, state: { name: '연금술사', gathered: 3 } });
  ok(r.status === 200 && r.body.ok, `첫 저장 → ${r.status}`);

  // 4) 다시 읽으면 그대로 나온다
  r = await J('GET', `/api/save/${ID}?secret=${SEC}`);
  ok(r.status === 200 && r.body.rev === 1 && r.body.state.gathered === 3,
    `조회: rev ${r.body && r.body.rev} / ${JSON.stringify(r.body && r.body.state)}`);

  // 5) rev 가 오르면 덮어쓴다
  r = await J('PUT', `/api/save/${ID}`, { secret: SEC, rev: 2, state: { name: '연금술사', gathered: 9 } });
  ok(r.status === 200, `rev 2 저장 → ${r.status}`);
  r = await J('GET', `/api/save/${ID}?secret=${SEC}`);
  ok(r.body.state.gathered === 9, `덮어쓰기 확인: gathered ${r.body.state.gathered}`);

  // 6) 오래된 rev 는 거부하고 서버 세이브를 돌려준다 (다른 기기가 더 최근에 저장한 경우)
  r = await J('PUT', `/api/save/${ID}`, { secret: SEC, rev: 2, state: { gathered: 0 } });
  ok(r.status === 409 && r.body.serverRev === 2 && r.body.state.gathered === 9,
    `오래된 rev 거부 → ${r.status}, 서버 상태 함께 반환: ${JSON.stringify(r.body.state)}`);

  // 7) 남의 세이브는 못 읽고 못 쓰고 못 지운다
  r = await J('GET', `/api/save/${ID}?secret=${OTHER}`);
  ok(r.status === 403, `틀린 secret 으로 조회 → ${r.status} (403 기대)`);
  r = await J('PUT', `/api/save/${ID}`, { secret: OTHER, rev: 99, state: { hacked: true } });
  ok(r.status === 403, `틀린 secret 으로 저장 → ${r.status} (403 기대)`);
  r = await J('DELETE', `/api/save/${ID}?secret=${OTHER}`);
  ok(r.status === 403, `틀린 secret 으로 삭제 → ${r.status} (403 기대)`);
  r = await J('GET', `/api/save/${ID}?secret=${SEC}`);
  ok(r.body.state.gathered === 9 && !r.body.state.hacked, '거부 후에도 원본이 그대로');

  // 8) 잘못된 입력
  for (const [name, res] of [
    ['아이디 형식', await J('GET', '/api/save/..%2F..%2Fetc?secret=' + SEC)],
    ['짧은 secret', await J('PUT', `/api/save/${ID}`, { secret: 'short', rev: 3, state: {} })],
    ['rev 없음', await J('PUT', `/api/save/${ID}`, { secret: SEC, state: {} })],
    ['state 없음', await J('PUT', `/api/save/${ID}`, { secret: SEC, rev: 3 })],
    ['state 가 배열', await J('PUT', `/api/save/${ID}`, { secret: SEC, rev: 3, state: [1, 2] })],
  ]) ok(res.status === 400, `${name} → ${res.status} (400 기대)`);

  // 9) 초기화(삭제) — 두 번 해도 성공
  r = await J('DELETE', `/api/save/${ID}?secret=${SEC}`);
  ok(r.status === 200 && r.body.deleted === true, `삭제 → ${r.status}`);
  r = await J('DELETE', `/api/save/${ID}?secret=${SEC}`);
  ok(r.status === 200 && r.body.deleted === false, '두 번째 삭제도 성공 (멱등)');
  r = await J('GET', `/api/save/${ID}?secret=${SEC}`);
  ok(r.status === 404, `삭제 후 조회 → ${r.status} (404 기대)`);

  // 10) 초기화 뒤에는 새 세이브를 처음부터 다시 쓸 수 있다
  r = await J('PUT', `/api/save/${ID}`, { secret: SEC, rev: 1, state: { fresh: true } });
  ok(r.status === 200, `초기화 후 새 저장 → ${r.status}`);

  // 11) 게임 파일이 같은 서버에서 서빙된다
  const html = await fetch(base + '/');
  const text = await html.text();
  ok(html.status === 200 && /다이어터 연금술사|dieter/i.test(text), `게임 페이지 서빙 → ${html.status}`);
  const js = await fetch(base + '/game.js');
  ok(js.status === 200, `game.js 서빙 → ${js.status}`);
  const sync = await fetch(base + '/sync.js');
  ok(sync.status === 200, `sync.js 서빙 → ${sync.status}`);

  // 12) 서버 소스·의존성·설정은 밖으로 내보내지 않는다
  for (const p of ['/server/index.js', '/server/store.js', '/node_modules/express/package.json',
                   '/package.json', '/package-lock.json', '/railway.json', '/.gitignore',
                   '/server/../server/store.js', '/%2Eenv']) {
    const r = await fetch(base + p);
    const body = await r.text();
    // 404 이거나, SPA 폴백으로 index.html 이 오더라도 실제 파일 내용이면 안 된다
    const leaked = r.status === 200 && !/<!DOCTYPE html>/i.test(body);
    ok(!leaked, `비공개 경로 ${p} → ${r.status}${leaked ? ' (내용 유출!)' : ''}`);
  }

  await new Promise(r => server.close(r));
  delete process.env.DATA_DIR;
}

// 어떤 환경변수를 보고 저장소를 고르는가 (Postgres 는 실제로 붙이지 않고 선택 로직만 확인)
function storeChoice() {
  for (const k of Object.keys(require.cache)) delete require.cache[k];
  const { createStore } = require('./store.js');
  return createStore;
}
function pick(env) {
  const createStore = storeChoice();
  // pg 접속은 하지 않고 kind 만 본다 (Pool 생성은 즉시 접속하지 않는다)
  try { return createStore(env).kind; } catch (e) { return 'error:' + e.message; }
}

(async () => {
  const dirTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alchpick-'));
  ok(pick({}) === 'memory(휘발성)', '변수 없음 → ' + pick({}));
  ok(pick({ DATA_DIR: dirTmp }).startsWith('file('), 'DATA_DIR → ' + pick({ DATA_DIR: dirTmp }));
  for (const k of ['DATABASE_URL', 'DATABASE_PRIVATE_URL', 'POSTGRES_URL', 'PG_URL', 'POSTGRESQL_URL']) {
    const kind = pick({ [k]: 'postgresql://u:p@postgres.railway.internal:5432/railway' });
    ok(kind === 'postgres', `${k} → ${kind}`);
  }
  // 참조 문법을 잘못 적어 문자열이 그대로 들어온 경우 — postgres 로 오인하면 안 된다
  const bad = pick({ DATABASE_URL: '${{Postgres.DATABASE_URL}}', DATA_DIR: dirTmp });
  ok(bad.startsWith('file('), '잘못된 참조 변수는 무시하고 다음 저장소로 → ' + bad);
  const bad2 = pick({ DATABASE_URL: '${{Postgres.DATABASE_URL}}' });
  ok(bad2 === 'memory(휘발성)', '잘못된 참조 변수만 있으면 메모리 → ' + bad2);
  // 우선순위: Postgres 가 파일보다 앞선다
  const both = pick({ DATABASE_URL: 'postgres://u:p@h:5432/d', DATA_DIR: dirTmp });
  ok(both === 'postgres', 'Postgres 가 파일보다 우선 → ' + both);
  fs.rmSync(dirTmp, { recursive: true, force: true });

  // PORT 를 주지 않으면 8080 (Railway 가 도메인을 8080 으로 라우팅한다)
  {
    for (const k of Object.keys(require.cache)) delete require.cache[k];
    const saved = process.env.PORT; delete process.env.PORT;
    delete process.env.DATABASE_URL; delete process.env.DATA_DIR;
    const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    ok(/process\.env\.PORT \|\| 8080/.test(src), '기본 포트 8080');
    if (saved !== undefined) process.env.PORT = saved;
  }

  await run('메모리 저장소', {});

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alch-'));
  await run('파일 저장소', { DATA_DIR: dir });

  // 파일 저장소는 서버를 껐다 켜도 남아 있어야 한다
  for (const k of Object.keys(require.cache)) delete require.cache[k];
  process.env.DATA_DIR = dir;
  const again = require('./index.js');
  const row = await again.store.get(ID);
  ok(row && row.state.fresh === true, '파일 저장소: 서버 재시작 후에도 세이브 유지');
  fs.rmSync(dir, { recursive: true, force: true });

  console.log(out.join('\n'));
  console.log(process.exitCode ? '\n실패한 검사가 있습니다.' : '\n서버 검사 전부 통과 ✅');
})();
