// ═══════════════════════════════════════════════════════════════
//  세이브 저장소 — 환경에 따라 3가지 중 하나를 고른다
//
//   1) Postgres   DATABASE_URL 이 있으면 (Railway 에서 Postgres 를 붙인 경우)
//   2) 파일        DATA_DIR 이 있으면   (Railway Volume 을 붙인 경우)
//   3) 메모리      둘 다 없으면         (로컬 개발용 — 서버를 끄면 사라진다)
//
//  세이브 본체는 state(JSONB) 하나에 다 들어 있다. 그중 이름·매력 총합·플레이 시간만
//  따로 컬럼으로 빼 둔다 — 랭킹과 통계를 state 를 전부 파싱하지 않고 뽑기 위해서다.
//  이름은 유일하다. 유일성은 반드시 저장소가 보장해야 한다(아래 claimName 참고).
//
//  ⚠ Railway 의 기본 파일시스템은 재배포할 때마다 초기화된다.
//     그래서 아무것도 설정하지 않으면 '메모리' 로 동작하고,
//     서버가 다시 뜰 때 세이브가 사라진다. 실서비스에서는 1) 이나 2) 를 쓸 것.
//     (index.js 가 시작할 때 어느 모드인지 로그로 알려 준다)
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

// ─── 이름 비교 규칙 ───
// 대소문자만 다른 이름은 같은 이름으로 본다. 한글에는 대소문자가 없으므로
// 영문 닉네임에서만 의미가 있지만, 'Eva' 와 'eva' 가 둘 다 존재하면
// 서로를 사칭하기 쉬워서 막는다. 비교용 키만 접고 표시용 원본은 그대로 둔다.
const nameKey = s => String(s == null ? '' : s).trim().toLowerCase();

// state 에서 컬럼으로 뺄 값을 뽑는다.
//  · 이름·플레이 시간은 state 안에 그대로 있다
//  · 매력 총합은 크리처 보너스까지 더해야 해서 게임 규칙을 알아야 한다.
//    규칙을 서버에 복제하지 않고 클라이언트가 보낸 meta.charm 을 쓰되,
//    없거나 이상하면 state 만으로 계산 가능한 값(비주얼+아우라)으로 떨어진다.
function columnsOf(state, meta) {
  const st = state && typeof state === 'object' ? state : {};
  const stats = st.stats && typeof st.stats === 'object' ? st.stats : {};
  const record = st.record && typeof st.record === 'object' ? st.record : {};

  const rawName = typeof st.name === 'string' ? st.name.trim() : '';
  const fallback = (Number(stats.beauty) || 0) + (Number(stats.charm) || 0);
  const sent = meta && Number.isFinite(Number(meta.charm)) ? Math.floor(Number(meta.charm)) : null;

  return {
    name: rawName || null,
    charm: sent !== null && sent >= 0 ? sent : Math.max(0, fallback),
    playSec: Math.max(0, Math.floor(Number(record.playSec) || 0)),
  };
}

// ─── 1) Postgres ───
function pgStore(url) {
  const { Pool } = require('pg');
  // Railway 내부 연결은 인증서가 self-signed 라 검증을 끈다 (연결 자체는 사설망)
  const pool = new Pool({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1|\.railway\.internal/.test(url)
      ? false
      : { rejectUnauthorized: false },
    // DB 가 응답하지 않을 때 요청이 영원히 매달려 있지 않도록 한도를 둔다.
    // (한도가 없으면 게임 쪽은 '저장 중' 에서 멈춘 것처럼 보인다 —
    //  빨리 실패해야 sync.js 가 오프라인으로 판단하고 나중에 다시 시도한다)
    connectionTimeoutMillis: 8000,
    query_timeout: 10000,
    statement_timeout: 10000,
    idleTimeoutMillis: 30000,
    max: 5,
  });

  // 유휴 커넥션에서 나는 오류로 프로세스가 죽지 않게 한다
  pool.on('error', e => console.error('[store] pg 유휴 커넥션 오류:', e.message));

  // 테이블 준비는 '첫 요청 때' 한 번만 한다.
  //  · 서버가 뜰 때 바로 접속하면, DB 가 아직 안 떴을 때 처리되지 않은 거부로 죽는다
  //  · 실패하면 ready 를 비워 두어 다음 요청에서 다시 시도한다 (DB 가 늦게 떠도 회복)
  // 이미 운영 중인 테이블이 있으므로 컬럼은 '없으면 추가' 로만 붙인다.
  // 기존 행의 name 은 NULL 로 남는데, 그 플레이어가 다음에 저장할 때 채워진다.
  // 유일 인덱스는 NULL 을 세지 않으므로 아직 이름이 없는 행끼리는 충돌하지 않는다.
  let ready = null;
  const ensure = () => {
    if (!ready) {
      ready = pool.query(`
        CREATE TABLE IF NOT EXISTS saves (
          player_id TEXT PRIMARY KEY,
          secret    TEXT        NOT NULL,
          rev       BIGINT      NOT NULL DEFAULT 0,
          saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          state     JSONB       NOT NULL
        );
        ALTER TABLE saves ADD COLUMN IF NOT EXISTS name      TEXT;
        ALTER TABLE saves ADD COLUMN IF NOT EXISTS name_key  TEXT;
        ALTER TABLE saves ADD COLUMN IF NOT EXISTS charm     INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE saves ADD COLUMN IF NOT EXISTS play_sec  INTEGER NOT NULL DEFAULT 0;
        CREATE UNIQUE INDEX IF NOT EXISTS saves_name_key_uniq ON saves (name_key);
        CREATE INDEX IF NOT EXISTS saves_charm_idx ON saves (charm DESC);
      `).catch(e => { ready = null; throw e; });
    }
    return ready;
  };

  // 유일 인덱스 위반인가 (다른 플레이어가 이미 그 이름을 갖고 있다)
  const isDup = e => e && (e.code === '23505');

  const rowOf = row => ({
    playerId: row.player_id, secret: row.secret, rev: Number(row.rev),
    savedAt: row.saved_at, state: row.state,
    name: row.name || null, charm: Number(row.charm) || 0, playSec: Number(row.play_sec) || 0,
  });
  const COLS = 'player_id, secret, rev, saved_at, state, name, charm, play_sec';

  return {
    kind: 'postgres',
    async get(playerId) {
      await ensure();
      const r = await pool.query(
        `SELECT ${COLS} FROM saves WHERE player_id = $1`, [playerId]);
      return r.rows.length ? rowOf(r.rows[0]) : null;
    },
    async getByName(name) {
      await ensure();
      const r = await pool.query(
        `SELECT ${COLS} FROM saves WHERE name_key = $1`, [nameKey(name)]);
      return r.rows.length ? rowOf(r.rows[0]) : null;
    },
    // 이름을 예약한다. 유일성은 DB 의 유일 인덱스가 보장한다 —
    // 먼저 조회하고 나서 쓰면 그 사이에 남이 채 갈 수 있어서(경합) 조회로 판정하지 않는다.
    async claimName(playerId, secret, name) {
      await ensure();
      try {
        // 세이브가 아직 없는 새 플레이어도 이름을 잡을 수 있어야 한다.
        // rev 0 · 빈 state 로 자리를 만들어 두면 첫 저장(rev 1)이 정상적으로 덮어쓴다.
        const r = await pool.query(
          `INSERT INTO saves (player_id, secret, rev, saved_at, state, name, name_key)
           VALUES ($1, $2, 0, now(), '{}'::jsonb, $3, $4)
           ON CONFLICT (player_id) DO UPDATE
             SET name = EXCLUDED.name, name_key = EXCLUDED.name_key
           RETURNING player_id`,
          [playerId, secret, name, nameKey(name)]);
        return { ok: r.rows.length > 0 };
      } catch (e) {
        if (isDup(e)) return { ok: false, taken: true };
        throw e;
      }
    },
    async put(playerId, secret, rev, state, meta) {
      await ensure();
      const c = columnsOf(state, meta);
      try {
        await pool.query(
          `INSERT INTO saves (player_id, secret, rev, saved_at, state, name, name_key, charm, play_sec)
           VALUES ($1, $2, $3, now(), $4, $5, $6, $7, $8)
           ON CONFLICT (player_id) DO UPDATE
             SET rev = EXCLUDED.rev, saved_at = now(), state = EXCLUDED.state,
                 charm = EXCLUDED.charm, play_sec = EXCLUDED.play_sec,
                 -- 이름은 예약해 둔 것을 정본으로 본다. 저장이 늦게 도착해도
                 -- 남의 이름을 덮어쓰지 않도록, 아직 비어 있을 때만 채운다.
                 name     = COALESCE(saves.name, EXCLUDED.name),
                 name_key = COALESCE(saves.name_key, EXCLUDED.name_key)`,
          [playerId, secret, rev, state, c.name, c.name ? nameKey(c.name) : null, c.charm, c.playSec]);
      } catch (e) {
        // 이름이 이미 남의 것이면 이름만 빼고 저장한다 — 진행을 잃는 것보다 낫다.
        if (!isDup(e)) throw e;
        await pool.query(
          `INSERT INTO saves (player_id, secret, rev, saved_at, state, charm, play_sec)
           VALUES ($1, $2, $3, now(), $4, $5, $6)
           ON CONFLICT (player_id) DO UPDATE
             SET rev = EXCLUDED.rev, saved_at = now(), state = EXCLUDED.state,
                 charm = EXCLUDED.charm, play_sec = EXCLUDED.play_sec`,
          [playerId, secret, rev, state, c.charm, c.playSec]);
      }
    },
    async del(playerId) {
      await ensure();
      await pool.query('DELETE FROM saves WHERE player_id = $1', [playerId]);
    },
    async count() {
      await ensure();
      const r = await pool.query('SELECT count(*)::int AS n FROM saves');
      return r.rows[0].n;
    },
    // 매력 총합 랭킹 — 이름이 있는 플레이어만
    async top(limit) {
      await ensure();
      const r = await pool.query(
        `SELECT name, charm, play_sec, saved_at FROM saves
         WHERE name IS NOT NULL ORDER BY charm DESC, saved_at ASC LIMIT $1`,
        [Math.min(Math.max(1, limit | 0), 100)]);
      return r.rows.map(x => ({
        name: x.name, charm: Number(x.charm) || 0,
        playSec: Number(x.play_sec) || 0, savedAt: x.saved_at,
      }));
    },
  };
}

// ─── 2) 파일 (Railway Volume 등) ───
function fileStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  // 파일 이름으로 그대로 쓰기 때문에 경로 문자를 막는다 (../ 로 빠져나가는 것 방지)
  const fileOf = id => path.join(dir, encodeURIComponent(id) + '.json');

  const readAll = () => fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } })
    .filter(Boolean);

  const readOne = playerId => {
    try { return JSON.parse(fs.readFileSync(fileOf(playerId), 'utf8')); } catch (e) { return null; }
  };
  // 쓰는 도중 서버가 죽어도 반쪽 파일이 남지 않도록 임시 파일 → 이름 바꾸기
  const writeOne = rec => {
    const tmp = fileOf(rec.playerId) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(rec));
    fs.renameSync(tmp, fileOf(rec.playerId));
  };
  // 그 이름을 '다른' 플레이어가 이미 쓰고 있나
  const takenByOther = (name, playerId) => {
    const k = nameKey(name);
    return readAll().some(r => r.playerId !== playerId && nameKey(r.name) === k);
  };

  return {
    kind: 'file(' + dir + ')',
    async get(playerId) { return readOne(playerId); },
    async getByName(name) {
      const k = nameKey(name);
      return readAll().find(r => r.name && nameKey(r.name) === k) || null;
    },
    // 검사와 쓰기 사이에 await 가 없다 — 노드는 단일 스레드라 그 사이에 끼어들 수 없다.
    // (await 를 넣으면 두 요청이 같은 이름을 동시에 통과할 수 있다)
    async claimName(playerId, secret, name) {
      if (takenByOther(name, playerId)) return { ok: false, taken: true };
      const cur = readOne(playerId);
      writeOne(cur
        ? { ...cur, name }
        : { playerId, secret, rev: 0, savedAt: new Date().toISOString(), state: {}, name, charm: 0, playSec: 0 });
      return { ok: true };
    },
    async put(playerId, secret, rev, state, meta) {
      const c = columnsOf(state, meta);
      const cur = readOne(playerId);
      // 예약해 둔 이름이 정본. 비어 있을 때만, 그리고 남의 것이 아닐 때만 채운다.
      let name = (cur && cur.name) || null;
      if (!name && c.name && !takenByOther(c.name, playerId)) name = c.name;
      writeOne({
        playerId, secret, rev, savedAt: new Date().toISOString(), state,
        name, charm: c.charm, playSec: c.playSec,
      });
    },
    async del(playerId) {
      try { fs.unlinkSync(fileOf(playerId)); } catch (e) {}
    },
    async count() {
      return fs.readdirSync(dir).filter(f => f.endsWith('.json')).length;
    },
    async top(limit) {
      return readAll()
        .filter(r => r.name)
        .sort((a, b) => (b.charm || 0) - (a.charm || 0) || String(a.savedAt).localeCompare(String(b.savedAt)))
        .slice(0, Math.min(Math.max(1, limit | 0), 100))
        .map(r => ({ name: r.name, charm: r.charm || 0, playSec: r.playSec || 0, savedAt: r.savedAt }));
    },
  };
}

// ─── 3) 메모리 (개발용) ───
function memStore() {
  const m = new Map();
  const takenByOther = (name, playerId) => {
    const k = nameKey(name);
    for (const r of m.values()) if (r.playerId !== playerId && nameKey(r.name) === k) return true;
    return false;
  };

  return {
    kind: 'memory(휘발성)',
    async get(playerId) { return m.get(playerId) || null; },
    async getByName(name) {
      const k = nameKey(name);
      for (const r of m.values()) if (r.name && nameKey(r.name) === k) return r;
      return null;
    },
    async claimName(playerId, secret, name) {
      if (takenByOther(name, playerId)) return { ok: false, taken: true };
      const cur = m.get(playerId);
      m.set(playerId, cur
        ? { ...cur, name }
        : { playerId, secret, rev: 0, savedAt: new Date().toISOString(), state: {}, name, charm: 0, playSec: 0 });
      return { ok: true };
    },
    async put(playerId, secret, rev, state, meta) {
      const c = columnsOf(state, meta);
      const cur = m.get(playerId);
      let name = (cur && cur.name) || null;
      if (!name && c.name && !takenByOther(c.name, playerId)) name = c.name;
      m.set(playerId, {
        playerId, secret, rev, savedAt: new Date().toISOString(), state,
        name, charm: c.charm, playSec: c.playSec,
      });
    },
    async del(playerId) { m.delete(playerId); },
    async count() { return m.size; },
    async top(limit) {
      return [...m.values()]
        .filter(r => r.name)
        .sort((a, b) => (b.charm || 0) - (a.charm || 0) || String(a.savedAt).localeCompare(String(b.savedAt)))
        .slice(0, Math.min(Math.max(1, limit | 0), 100))
        .map(r => ({ name: r.name, charm: r.charm || 0, playSec: r.playSec || 0, savedAt: r.savedAt }));
    },
  };
}

// Railway 는 Postgres 를 붙여도 접속 주소를 다른 서비스에 자동으로 넣어 주지 않는다.
// 직접 참조 변수를 만들어야 하는데(예: DATABASE_URL = ${{Postgres.DATABASE_URL}}),
// 이름을 무엇으로 지었든 걸리도록 흔히 쓰는 이름을 모두 살펴본다.
const PG_ENV_KEYS = ['DATABASE_URL', 'DATABASE_PRIVATE_URL', 'POSTGRES_URL', 'PG_URL', 'POSTGRESQL_URL'];

function pgUrlFrom(env) {
  for (const k of PG_ENV_KEYS) {
    const v = (env[k] || '').trim();
    // 참조 변수를 잘못 적으면 '${{Postgres.DATABASE_URL}}' 문자열이 그대로 들어온다
    if (v && /^postgres(ql)?:\/\//.test(v)) return { key: k, url: v };
    if (v) console.warn(`[store] ${k} 값이 접속 주소 형식이 아닙니다: ${v.slice(0, 40)}`);
  }
  return null;
}

function createStore(env) {
  env = env || process.env;
  const pg = pgUrlFrom(env);
  if (pg) return pgStore(pg.url);
  if (env.DATA_DIR) return fileStore(env.DATA_DIR);
  return memStore();
}

module.exports = { createStore, pgStore, fileStore, memStore, nameKey, columnsOf };
