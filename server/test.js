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
  // **떠 있는 판을 알려 주는가.** 「고쳤다 / 안 고쳐졌다」가 엇갈릴 때
  // 코드가 틀린 것인지 배포가 안 된 것인지를 갈라 주는 유일한 단서다
  ok(/^\d{8}[a-z]$/.test(r.body.ver || ''), `캐시 버스터를 알려 준다 (ver=${r.body.ver})`);

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

  // ── 밭 · 약탈 (크리처 9단계) ──
  // **서버가 판정을 갖는 첫 자리다.** 그래서 여기만은 「돌아간다」로 부족하다 —
  // 남의 밭이 얼마나 줄었는지 · 약탈권이 몇 개 남았는지까지 세어 본다.
  {
    const DAY = 24 * 60 * 60 * 1000;
    const V = 'p_' + 'v'.repeat(20), SEC_V = 'v'.repeat(32);   // 털리는 쪽
    const R = 'p_' + 'r'.repeat(20), SEC_R = 'r'.repeat(32);   // 터는 쪽
    // 이삭은 이제 **칸(plot)마다** 들어 있다 — 통째로 세는 눈을 하나 둔다
    const sum = s => Object.values(s || {}).reduce((a, b) => a + b, 0);
    const ears = f => (f.plots || []).reduce((n, p) => n + sum(p.stash), 0);
    const farmOf = async id => (await store.get(id)).farm;
    const setFarm = async (id, f) => { await store.farmSet(id, f); };
    // 첫 칸에 이삭을 심어 둔다 (검사 준비용)
    const seedEars = async (id, stash) => {
      const g = await farmOf(id);
      g.plots.forEach(p => { p.stash = {}; });
      g.plots[0].stash = stash;
      await setFarm(id, g);
    };

    await J('POST', '/api/name', { playerId: V, secret: SEC_V, name: '밭주인' });
    await J('POST', '/api/name', { playerId: R, secret: SEC_R, name: '도둑고양이' });
    // 유니콘(빛·상급, 전투력 64, 반딧불이 3개)이 지키는 밭
    await J('PUT', `/api/save/${V}`, {
      secret: SEC_V, rev: 1,
      state: { name: '밭주인', creatures: ['unicorn'], petRoom: 'unicorn', pets: {} },
    });
    // 불씨 도롱뇽(불·기초, 전투력 16)을 데리고 간다
    await J('PUT', `/api/save/${R}`, {
      secret: SEC_R, rev: 1,
      state: { name: '도둑고양이', creatures: ['ember_newt'], petField: 'ember_newt', pets: {} },
    });

    // 밭은 열어야 생긴다 — **한 번도 안 연 사람은 털리지 않는다**
    let f = await J('GET', `/api/farm/${V}?secret=${SEC_V}`);
    ok(f.status === 200 && f.body.count === 0, `밭 열기 → ${f.status}, 이삭 ${f.body && f.body.count}`);
    ok(f.body.daily && f.body.daily.firefly === 3, `하루치 = ${JSON.stringify(f.body.daily)}`);
    ok(f.body.raids === 3, `약탈권 ${f.body.raids} (3 기대)`);
    // 밭은 **칸**으로 되어 있다. 처음에는 두 칸이고 둘 다 비어 있다
    ok(Array.isArray(f.body.plots) && f.body.plots.length === 2,
      `밭이 ${f.body.plots && f.body.plots.length}칸 (2 기대)`);
    ok((f.body.plots || []).every(p => p.crop === null), '처음에는 아무것도 안 심겨 있다');
    ok(f.body.def && f.body.def.id === 'unicorn' && f.body.def.power === 64,
      `지키는 크리처 = ${JSON.stringify(f.body.def)}`);

    // 사흘 지나면 사흘치
    { const g = await farmOf(V); g.grownAt = Date.now() - 3 * DAY; await setFarm(V, g); }
    f = await J('GET', `/api/farm/${V}?secret=${SEC_V}`);
    ok(f.body.count === 9, `사흘 뒤 이삭 ${f.body.count} (9 기대)`);

    // 한 달을 비워도 5일치까지만 (`FARM_DAYS`)
    { const g = await farmOf(V); g.stash = {}; g.grownAt = Date.now() - 30 * DAY; await setFarm(V, g); }
    f = await J('GET', `/api/farm/${V}?secret=${SEC_V}`);
    ok(f.body.count === 15, `한 달 비운 뒤 이삭 ${f.body.count} (5일치 15 기대)`);

    // 수확 — 밭이 비고, **같은 nonce 로 다시 오면 같은 답**
    let h = await J('POST', `/api/farm/${V}/harvest`, { secret: SEC_V, nonce: 'harv01' });
    ok(h.status === 200 && h.body.items.firefly === 15, `수확 → ${JSON.stringify(h.body.items)}`);
    h = await J('POST', `/api/farm/${V}/harvest`, { secret: SEC_V, nonce: 'harv01' });
    ok(h.status === 200 && h.body.repeat === true && h.body.items.firefly === 15,
      '같은 nonce 로 재시도 → 같은 답 (멱등)');
    h = await J('POST', `/api/farm/${V}/harvest`, { secret: SEC_V, nonce: 'harv02' });
    ok(h.status === 409 && h.body.error === 'farm_empty', `빈 밭 수확 → ${h.status} (409 기대)`);

    // 남의 밭은 못 본다
    h = await J('GET', `/api/farm/${V}?secret=${OTHER}`);
    ok(h.status === 403, `남의 밭 조회 → ${h.status} (403 기대)`);

    // **세이브를 저장해도 밭은 그대로다.** 파일·메모리 저장소는 레코드를 통째로
    // 다시 쓰기 때문에 옮겨 담는 것을 빠뜨리면 저장할 때마다 밭이 사라진다
    await seedEars(V, { firefly: 9 });
    await J('PUT', `/api/save/${V}`, {
      secret: SEC_V, rev: 2,
      state: { name: '밭주인', creatures: ['unicorn'], petRoom: 'unicorn', pets: {} },
    });
    f = await J('GET', `/api/farm/${V}?secret=${SEC_V}`);
    ok(f.body.count === 9, `세이브 저장 뒤에도 이삭 ${f.body.count} (9 기대)`);

    // **옛 모양의 밭(이삭 한 무더기)이 칸으로 옮겨지는가** — 밭은 서버에 있으므로
    // 세이브의 `SAVE_VER` 와 다른 자리에서 옮겨 적는다. **옛 이삭을 버리면 안 된다**
    {
      const O = 'p_' + 'o'.repeat(20), SEC_O = 'o'.repeat(32);
      await J('POST', '/api/name', { playerId: O, secret: SEC_O, name: '옛밭' });
      await J('PUT', `/api/save/${O}`, {
        secret: SEC_O, rev: 1,
        state: { name: '옛밭', creatures: ['unicorn'], petRoom: 'unicorn', pets: {} },
      });
      // 칸이 없던 시절의 모양 그대로 심는다
      await store.farmSet(O, {
        stash: { firefly: 7 }, grownAt: Date.now(), shieldUntil: 0,
        raids: 3, raidAt: Date.now(), log: [],
      });
      const g = await J('GET', `/api/farm/${O}?secret=${SEC_O}`);
      ok(g.status === 200 && g.body.count === 7, `옛 이삭이 살아남았다 (${g.body && g.body.count} / 7 기대)`);
      ok(Array.isArray(g.body.plots) && g.body.plots.length === 2,
        `칸으로 옮겨졌다 (${g.body.plots && g.body.plots.length}칸)`);
      ok(g.body.plots && g.body.plots[0].stash.firefly === 7, '옛 이삭은 첫 칸에 담긴다');
      const row = await store.get(O);
      ok(row.farm.stash === undefined, '옛 `stash` 칸은 지워진다');
      // 옛 모양 그대로인 밭도 상대 목록에서 빠지면 안 된다
      const t0 = await J('GET', `/api/raid/targets/${R}?secret=${SEC_R}`);
      ok((t0.body.targets || []).some(x => x.name === '옛밭'), '옛 모양 밭도 목록에 뜬다');
    }

    // 목록에 이삭 있는 밭이 뜬다
    let t = await J('GET', `/api/raid/targets/${R}?secret=${SEC_R}`);
    ok(t.status === 200 && t.body.targets.some(x => x.name === '밭주인'),
      `상대 목록 → ${JSON.stringify((t.body.targets || []).map(x => x.name))}`);
    ok(!t.body.targets.some(x => x.name === '도둑고양이'), '내 밭은 목록에 안 뜬다');

    // 약탈 — 이기든 지든 **약탈권은 하나 준다**
    const before = ears(await farmOf(V));
    let d = await J('POST', `/api/raid/${R}`, { secret: SEC_R, target: '밭주인', nonce: 'raid01' });
    ok(d.status === 200, `약탈 → ${d.status} (win=${d.body && d.body.win}, p=${d.body && d.body.chance})`);
    ok(d.body.raids === 2, `약탈권 ${d.body.raids} (2 기대)`);
    ok(d.body.chance >= 0.10 && d.body.chance <= 0.90, `확률 ${d.body.chance} 이 바닥·천장 안`);
    {
      const vf = await farmOf(V);
      const took = sum(d.body.items);
      if (d.body.win) {
        ok(took > 0 && ears(vf) === before - took,
          `이겼다: ${took}개 가져가고 밭은 ${before} → ${ears(vf)}`);
        ok(vf.shieldUntil > Date.now(), '이긴 뒤에는 그 밭에 잠시 방패가 걸린다');
      } else {
        ok(took === 0 && ears(vf) === before, `졌다: 밭은 그대로 ${ears(vf)}`);
      }
      ok(vf.log.length === 1 && vf.log[0].by === '도둑고양이' && vf.log[0].win === d.body.win,
        `털린 기록이 남는다: ${JSON.stringify(vf.log[0])}`);
    }
    // 재시도는 같은 답 — **약탈권이 두 번 깎이거나 두 번 털면 안 된다**
    {
      const vBefore = ears(await farmOf(V));
      const again = await J('POST', `/api/raid/${R}`, { secret: SEC_R, target: '밭주인', nonce: 'raid01' });
      ok(again.body.repeat === true && again.body.win === d.body.win && again.body.raids === 2,
        '같은 nonce 로 재시도 → 같은 답 (멱등)');
      ok(ears(await farmOf(V)) === vBefore, '재시도로 밭이 또 줄지 않는다');
    }

    // 방패가 걸려 있으면 못 턴다
    await seedEars(V, { firefly: 9 });
    { const g = await farmOf(V); g.shieldUntil = Date.now() + 3600e3; await setFarm(V, g); }
    d = await J('POST', `/api/raid/${R}`, { secret: SEC_R, target: '밭주인', nonce: 'raid02' });
    ok(d.status === 409 && d.body.error === 'target_shielded', `방패 걸린 밭 → ${d.status}`);
    t = await J('GET', `/api/raid/targets/${R}?secret=${SEC_R}`);
    ok(!t.body.targets.some(x => x.name === '밭주인'), '방패 걸린 밭은 목록에도 안 뜬다');

    // 약탈권이 없으면 못 턴다
    { const g = await farmOf(V); g.shieldUntil = 0; await setFarm(V, g); }
    { const g = await farmOf(R); g.raids = 0; g.raidAt = Date.now(); await setFarm(R, g); }
    d = await J('POST', `/api/raid/${R}`, { secret: SEC_R, target: '밭주인', nonce: 'raid03' });
    ok(d.status === 409 && d.body.error === 'no_raids', `약탈권 0 → ${d.status}`);
    // 여덟 시간마다 하나씩 찬다
    { const g = await farmOf(R); g.raidAt = Date.now() - 9 * 3600e3; await setFarm(R, g); }
    f = await J('GET', `/api/farm/${R}?secret=${SEC_R}`);
    ok(f.body.raids === 1, `9시간 뒤 약탈권 ${f.body.raids} (1 기대)`);

    // 동행 크리처가 없으면 못 나간다 · 내 밭은 못 턴다
    await J('PUT', `/api/save/${R}`, {
      secret: SEC_R, rev: 2, state: { name: '도둑고양이', creatures: ['ember_newt'], pets: {} },
    });
    d = await J('POST', `/api/raid/${R}`, { secret: SEC_R, target: '밭주인', nonce: 'raid04' });
    ok(d.status === 409 && d.body.error === 'no_companion', `동행 없이 약탈 → ${d.status}`);
    await J('PUT', `/api/save/${R}`, {
      secret: SEC_R, rev: 3,
      state: { name: '도둑고양이', creatures: ['ember_newt'], petField: 'ember_newt', pets: {} },
    });
    d = await J('POST', `/api/raid/${R}`, { secret: SEC_R, target: '도둑고양이', nonce: 'raid05' });
    ok(d.status === 400 && d.body.error === 'self', `내 밭을 털려고 하면 → ${d.status}`);
    d = await J('POST', `/api/raid/${R}`, { secret: SEC_R, target: '밭주인', nonce: '!' });
    ok(d.status === 400 && d.body.error === 'bad_nonce', `nonce 형식 → ${d.status}`);
  }

  // 11) 게임 파일이 같은 서버에서 서빙된다
  const html = await fetch(base + '/');
  const text = await html.text();
  ok(html.status === 200 && /다이어터 연금술사|dieter/i.test(text), `게임 페이지 서빙 → ${html.status}`);
  const js = await fetch(base + '/game.js');
  ok(js.status === 200, `game.js 서빙 → ${js.status}`);
  const sync = await fetch(base + '/sync.js');
  ok(sync.status === 200, `sync.js 서빙 → ${sync.status}`);

  // 12) 서버 소스·의존성·설정은 밖으로 내보내지 않는다
  for (const p of ['/server/index.js', '/server/store.js', '/server/battle.js',
                   '/node_modules/express/package.json',
                   '/package.json', '/package-lock.json', '/railway.json', '/.gitignore',
                   // 검사기·생성기도 게임이 안 쓴다. 예전에는 /tools/checkui.js 가 200 이었다
                   '/tools/checkui.js', '/tools/hooks/post-commit',
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

  // ── 전투 규칙 자체 (server/battle.js) ──
  // API 를 거치지 않고 규칙만 본다. **확률이 걸린 것은 roll 을 넘겨 고정한다** —
  // 무작위를 그대로 두고 「돌아간다」만 보면 순환이 뒤집혀 있어도 통과한다
  {
    for (const k of Object.keys(require.cache)) delete require.cache[k];
    const Bt = require('./battle.js');
    const C = Bt.CREATURES;
    ok(Object.keys(C).length === 30, `크리처 표를 data.js 에서 읽는다 (${Object.keys(C).length}종)`);
    ok(typeof global.window === 'undefined', 'data.js 를 읽고 나서 전역 window 를 치운다');

    // 속성 순환 — 불 ➔ 땅 ➔ 바람 ➔ 물 ➔ 불 · 빛 ↔ 암흑
    ok(Bt.attrMul('fire', 'earth') === Bt.ATTR_MUL, '불이 땅을 이긴다');
    ok(Bt.attrMul('earth', 'fire') === 1 / Bt.ATTR_MUL, '땅은 불에 진다');
    ok(Bt.attrMul('water', 'fire') === Bt.ATTR_MUL, '물이 불을 이긴다');
    ok(Bt.attrMul('light', 'dark') === Bt.ATTR_MUL && Bt.attrMul('dark', 'light') === Bt.ATTR_MUL,
      '빛과 암흑은 서로를 이긴다');
    ok(Bt.attrMul('fire', 'fire') === 1, '같은 속성끼리는 보정 없음');

    // 로열티는 **양쪽 다** 올린다 (먹이를 준 크리처는 공격이든 방어든 잘 싸운다)
    const uni = C.unicorn;
    ok(Bt.combatPower(uni) === 64, `유니콘 전투력 ${Bt.combatPower(uni)}`);
    ok(Math.abs(Bt.effPower(uni, 100) - 64 * 1.3) < 1e-9, '로열티 가득 → 전투력 +30%');
    ok(Bt.effPower(uni, 0) === 64, '로열티 0 → 그대로');

    // 판정 — 약한 쪽이 이길 확률에도 바닥이 있다
    const weak = { c: C.ember_newt, loyalty: 0 };
    const strong = { c: uni, loyalty: 0 };
    ok(Bt.resolve(weak, strong, 0).win === true, 'roll 0 이면 이긴다');
    ok(Bt.resolve(weak, strong, 0.99).win === false, 'roll 0.99 면 진다');
    ok(Bt.resolve(weak, strong, 0).chance > Bt.WIN_MIN,
      `기초 대 상급은 아직 바닥이 아니다 (${Bt.resolve(weak, strong, 0).chance.toFixed(2)}) — 붙어 볼 만하다`);
    // **바닥과 천장은 지어낸 극단으로 잰다.** 서른 마리 안에서는 아직 그만큼
    // 차이가 안 나서(기초 16 대 상급 64 → 0.20), 실제 크리처로 재면 영영 안 걸린다
    const tiny = { c: { attr: 'fire', combat: { atk: 1, matk: 0, def: 0, mdef: 0 } }, loyalty: 0 };
    const huge = { c: { attr: 'fire', combat: { atk: 9999, matk: 0, def: 0, mdef: 0 } }, loyalty: 0 };
    ok(Math.abs(Bt.resolve(tiny, huge, 0).chance - Bt.WIN_MIN) < 1e-9,
      `확률에 바닥이 있다 (${Bt.WIN_MIN})`);
    ok(Math.abs(Bt.resolve(huge, tiny, 0).chance - Bt.WIN_MAX) < 1e-9,
      `확률에 천장이 있다 (${Bt.WIN_MAX})`);
    // **밭을 안 지키면 거의 털린다** (그래도 확실하지는 않다)
    ok(Math.abs(Bt.resolve(weak, null, 0).chance - Bt.WIN_MAX) < 1e-9, '지키는 크리처가 없으면 천장');
    // 속성이 유리하면 확률이 실제로 오른다 — 계산값이 resolve 까지 닿아 있는가
    const flat = Bt.resolve({ c: C.charcoal_toad, loyalty: 0 }, { c: C.moss_deer, loyalty: 0 }, 0).chance;
    const rev = Bt.resolve({ c: C.moss_deer, loyalty: 0 }, { c: C.charcoal_toad, loyalty: 0 }, 0).chance;
    ok(flat > rev, `불(불>땅)이 땅보다 유리하다: ${flat.toFixed(3)} > ${rev.toFixed(3)}`);

    // 가져가는 양 — 3분의 1씩, 합쳐서 상한까지
    const take = Bt.loot({ firefly: 9, walnut: 3 });
    ok(take.firefly === 3 && take.walnut === 1, `이삭 9·3 에서 ${JSON.stringify(take)}`);
    ok(Bt.countOf(Bt.loot({ firefly: 999 })) === Bt.TAKE_MAX, `한 번에 ${Bt.TAKE_MAX}개까지`);

    // 칸 — **하루치가 칸 수를 타면 안 된다.** 칸이 늘었다고 이삭이 다섯 배가 되면
    // 특수 작물을 심을 이유가 사라진다. 하루치는 그대로 두고 빈 칸끼리 나눠 갖는다
    {
      const one = { plots: [Bt.emptyPlot()] };
      const five = { plots: Array.from({ length: 5 }, Bt.emptyPlot) };
      const day = { walnut: 3, wheat: 2 };
      Bt.dealToPlots(one, day);
      Bt.dealToPlots(five, day);
      ok(Bt.farmCount(one) === 5 && Bt.farmCount(five) === 5,
        `한 칸이든 다섯 칸이든 하루치는 5개 (${Bt.farmCount(one)} / ${Bt.farmCount(five)})`);
      ok(five.plots.filter(p => Bt.countOf(p.stash)).length > 1, '다섯 칸이면 나눠서 쌓인다');
      // 다 심은 밭에는 이삭이 안 쌓인다 — 밭을 다 쓰고 있다는 뜻이다
      const full = { plots: [{ crop: 'ember_chili', stash: {} }] };
      Bt.dealToPlots(full, day);
      ok(Bt.farmCount(full) === 0, '빈 칸이 없으면 이삭은 안 쌓인다');
    }

    // 옮겨 적기 — **옛 이삭을 버리지 않는다**
    {
      const oldFarm = { stash: { firefly: 4 } };
      ok(Bt.migrateFarm(oldFarm) === true, '옛 모양이면 옮겨 적는다');
      ok(oldFarm.plots.length === Bt.PLOT_START && oldFarm.plots[0].stash.firefly === 4,
        `옛 이삭이 첫 칸으로 (${JSON.stringify(oldFarm.plots[0].stash)})`);
      ok(oldFarm.stash === undefined, '옛 칸은 지운다');
      ok(Bt.migrateFarm(oldFarm) === false, '두 번째부터는 안 건드린다 (멱등)');
      // 칸이 넘치면 자르되 이삭은 앞 칸으로 옮긴다
      const big = { plots: Array.from({ length: 8 }, () => ({ crop: null, stash: { dew: 1 } })) };
      Bt.migrateFarm(big);
      ok(big.plots.length === Bt.PLOT_MAX && Bt.farmCount(big) === 8,
        `칸을 ${Bt.PLOT_MAX}개로 자르되 이삭 8개는 그대로 (${Bt.farmCount(big)})`);
    }

    // 빼 가기 — 앞 칸부터 덜어 내고, 0이 된 칸은 지운다
    {
      const f = { plots: [{ crop: null, stash: { dew: 2 } }, { crop: null, stash: { dew: 5 } }] };
      Bt.takeFrom(f, { dew: 4 });
      ok(Bt.farmCount(f) === 3 && f.plots[0].stash.dew === undefined && f.plots[1].stash.dew === 3,
        `앞 칸부터 덜어 낸다 (${JSON.stringify(f.plots.map(p => p.stash))})`);
    }

    // 없는 크리처를 장착 중이어도 안 죽는다 (재료로 녹인 뒤 · 초기화 뒤)
    ok(Bt.defender({ petRoom: 'no_such', creatures: [] }) === null, '없는 크리처를 지키개로 두면 null');
    ok(Bt.defender({ petRoom: 'unicorn', creatures: [] }) === null, '안 가진 크리처는 안 쳐 준다');
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
