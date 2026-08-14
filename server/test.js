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

  // ── 이름 (유일해야 한다) ──
  const A = 'p_' + 'n'.repeat(20), B = 'p_' + 'm'.repeat(20);
  const SEC_A = 'a'.repeat(32), SEC_B = 'b'.repeat(32);

  // 형식 검사 — 클라이언트를 거치지 않은 요청도 막아야 한다
  for (const [nm, why] of [['', '빈 이름'], ['가 나', '공백'], ['name!', '특수 문자'],
                           ['일이삼사오육칠', '한글 7자'], ['abcdefghijklm', '영문 13자']]) {
    r = await J('POST', '/api/name', { playerId: A, secret: SEC_A, name: nm });
    ok(r.status === 400, `이름 형식 거부(${why}) → ${r.status} (400 기대)`);
  }

  // 세이브가 아직 없어도 이름을 잡을 수 있어야 한다 (튜토리얼에서 이름이 먼저다)
  r = await J('POST', '/api/name', { playerId: A, secret: SEC_A, name: '루비' });
  ok(r.status === 200 && r.body.ok, `새 플레이어가 이름 예약 → ${r.status}`);

  // 같은 사람이 같은 이름을 다시 보내도 성공 (응답을 못 받고 재시도하는 경우)
  r = await J('POST', '/api/name', { playerId: A, secret: SEC_A, name: '루비' });
  ok(r.status === 200, '같은 사람이 같은 이름 재요청 → 성공 (멱등)');

  // 남이 같은 이름 → 409
  r = await J('POST', '/api/name', { playerId: B, secret: SEC_B, name: '루비' });
  ok(r.status === 409 && r.body.error === 'name_taken', `남이 같은 이름 → ${r.status} (409 기대)`);

  // 대소문자만 다른 이름도 같은 이름으로 본다 (사칭 방지)
  r = await J('POST', '/api/name', { playerId: A, secret: SEC_A, name: 'Eva' });
  ok(r.status === 200, 'A 가 Eva 예약');
  r = await J('POST', '/api/name', { playerId: B, secret: SEC_B, name: 'eva' });
  ok(r.status === 409, `대소문자만 다른 이름 → ${r.status} (409 기대)`);

  // 남의 세이브에 이름을 붙일 수 없다
  r = await J('POST', '/api/name', { playerId: A, secret: OTHER, name: '도둑' });
  ok(r.status === 403, `틀린 secret 으로 이름 예약 → ${r.status} (403 기대)`);

  // 사용 가능 여부 조회
  r = await J('GET', '/api/name/Eva');
  ok(r.status === 200 && r.body.available === false, '쓰이는 이름 → available:false');
  r = await J('GET', '/api/name/' + encodeURIComponent('아무도안씀'));
  ok(r.status === 200 && r.body.available === true, '안 쓰는 이름 → available:true');

  // 경합: 같은 이름을 동시에 요청하면 정확히 하나만 성공해야 한다
  {
    const C = 'p_' + 'c'.repeat(20), Dd = 'p_' + 'd'.repeat(20);
    const res = await Promise.all([
      J('POST', '/api/name', { playerId: C, secret: 'c'.repeat(32), name: '동시에' }),
      J('POST', '/api/name', { playerId: Dd, secret: 'd'.repeat(32), name: '동시에' }),
    ]);
    const won = res.filter(x => x.status === 200).length;
    ok(won === 1, `같은 이름 동시 요청 → 성공 ${won}건 (1건이어야 함)`);
  }

  // 저장하면 이름·매력·플레이 시간이 컬럼으로 남는다
  r = await J('PUT', `/api/save/${A}`, {
    secret: SEC_A, rev: 1,
    state: { name: 'Eva', stats: { beauty: 10, charm: 5 }, record: { playSec: 77 } },
    meta: { charm: 42 },
  });
  ok(r.status === 200, `이름 있는 세이브 저장 → ${r.status}`);
  {
    const row = await store.get(A);
    ok(row && row.name === 'Eva', `이름 컬럼 = ${row && row.name}`);
    ok(row && row.charm === 42, `매력 총합 컬럼 = ${row && row.charm} (meta 우선)`);
    ok(row && row.playSec === 77, `플레이 시간 컬럼 = ${row && row.playSec}`);
  }

  // meta 가 없으면 state 만으로 계산 가능한 값으로 떨어진다 (옛 클라이언트)
  r = await J('PUT', `/api/save/${A}`, {
    secret: SEC_A, rev: 2,
    state: { name: 'Eva', stats: { beauty: 10, charm: 5 }, record: { playSec: 80 } },
  });
  {
    const row = await store.get(A);
    ok(row && row.charm === 15, `meta 없으면 비주얼+아우라 = ${row && row.charm}`);
  }

  // 저장이 남의 이름을 덮어쓰지 않는다 (예약해 둔 쪽이 정본)
  r = await J('PUT', `/api/save/${B}`, {
    secret: SEC_B, rev: 1, state: { name: 'Eva', stats: {}, record: {} },
  });
  ok(r.status === 200, `남의 이름이 든 세이브도 저장은 된다 → ${r.status}`);
  {
    const rowB = await store.get(B);
    const rowA = await store.get(A);
    ok(!rowB.name || rowB.name !== 'Eva' || rowA.playerId === B,
       `B 가 A 의 이름을 뺏지 않음 (B.name = ${rowB.name})`);
    ok(rowA && rowA.name === 'Eva', 'A 의 이름은 그대로');
  }

  // 랭킹
  r = await J('GET', '/api/ranking?limit=5');
  ok(r.status === 200 && Array.isArray(r.body.top), `랭킹 조회 → ${r.status}`);
  ok(r.body.top.every(x => x.name), '랭킹에는 이름 있는 플레이어만');

  // 초기화하면 이름이 풀려 남이 쓸 수 있다
  await J('DELETE', `/api/save/${A}?secret=${SEC_A}`);
  r = await J('POST', '/api/name', { playerId: B, secret: SEC_B, name: 'Eva' });
  ok(r.status === 200, `초기화된 이름을 남이 다시 씀 → ${r.status} (200 기대)`);

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
