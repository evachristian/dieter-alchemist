// ═══════════════════════════════════════════════════════════════
//  다이어터 연금술사 — 세이브 서버
//
//  이 서버 하나가 두 가지를 한다.
//   · 게임 파일(index.html, game.js …) 을 그대로 서빙   → 도메인 열면 바로 게임
//   · /api/* 로 세이브를 저장/조회/삭제                  → 같은 출처라 CORS 문제 없음
//
//  실행:  npm start              (게임 폴더에서. 기본 포트 8080)
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const path = require('path');
const { createStore } = require('./store');

const app = express();
const store = createStore();
// Railway 는 PORT 를 넣어 주지만, 넣어 주지 않는 경우를 대비해 기본값을 8080 으로 둔다.
// (Railway 가 도메인을 만들 때 기본으로 8080 포트로 라우팅하기 때문 —
//  여기가 3000 이면 도메인이 502 를 낸다)
const PORT = process.env.PORT || 8080;

// 세이브 하나의 최대 크기. 지금 세이브는 5KB 안팎이라 넉넉하다.
const MAX_BODY = '256kb';
// 아이디/시크릿 형식 — 클라이언트가 만드는 UUID + 랜덤 문자열만 허용
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{16,128}$/;

// ─── 이름 규칙 ───
// game.js 의 NAME_ALLOW / NAME_MAX_W 와 같은 규칙이다. 클라이언트 검사는 안내용이고,
// 여기서 다시 보는 이유는 클라이언트를 거치지 않은 요청도 들어올 수 있기 때문이다.
// 규칙을 바꾸면 양쪽을 같이 고쳐야 한다.
const NAME_ALLOW = /^[0-9A-Za-zᄀ-ᇿ㄰-㆏가-힣]+$/;
const NAME_KO = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const NAME_MAX_W = 12;                       // 한글 6자 / 영문 12자
const nameWidth = s => [...String(s)].reduce((w, ch) => w + (NAME_KO.test(ch) ? 2 : 1), 0);

// 통과하면 null, 아니면 오류 코드
function nameProblem(raw) {
  const s = String(raw == null ? '' : raw);
  if (!s || /\s/.test(s)) return 'bad_name_space';
  if (!NAME_ALLOW.test(s)) return 'bad_name_char';
  if (nameWidth(s) > NAME_MAX_W) return 'bad_name_len';
  return null;
}

app.disable('x-powered-by');
app.set('trust proxy', 1);          // Railway 프록시 뒤에서 클라이언트 IP 를 제대로 읽기 위해
app.use(express.json({ limit: MAX_BODY }));

// ─── CORS ───
// 같은 도메인에서 게임을 서빙하면 필요 없지만, 로컬(file:// · localhost)에서
// 열어 볼 때를 위해 열어 둔다. 세이브는 secret 으로 보호되므로 출처는 제한하지 않는다.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── 아주 단순한 속도 제한 ───
// 같은 IP 가 1분에 120번을 넘기면 잠시 막는다. 정상 플레이는 분당 몇 번 수준이라 걸릴 일이 없다.
const hits = new Map();
setInterval(() => hits.clear(), 60_000).unref();
app.use('/api/', (req, res, next) => {
  const ip = req.ip || 'unknown';
  const n = (hits.get(ip) || 0) + 1;
  hits.set(ip, n);
  if (n > 120) return res.status(429).json({ error: 'too_many_requests' });
  next();
});

// ─── 상태 확인 ───
app.get('/api/health', async (req, res) => {
  try {
    res.json({ ok: true, store: store.kind, saves: await store.count() });
  } catch (e) {
    res.status(500).json({ ok: false, store: store.kind, error: String(e.message || e) });
  }
});

// ─── 이름 ───
// 로그인이 없는 동안 이름은 '표시용'이 아니라 사람이 서로를 알아보는 유일한 단서다.
// 그래서 유일하게 잡아 둔다. 신원 자체는 여전히 playerId 가 맡는다 —
// 나중에 이메일 로그인을 붙일 때도 playerId 를 계정에 연결하기만 하면 된다.

//  GET /api/name/:name  →  쓸 수 있는 이름인지 (입력 중 안내용)
app.get('/api/name/:name', async (req, res) => {
  const name = String(req.params.name || '');
  const bad = nameProblem(name);
  if (bad) return res.status(400).json({ error: bad, available: false });
  try {
    const row = await store.getByName(name);
    res.json({ ok: true, name, available: !row });
  } catch (e) {
    console.error('[GET /api/name]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

//  POST /api/name   { playerId, secret, name }
//  · 이름을 이 playerId 로 예약한다. 이미 남이 쓰고 있으면 409.
//  · 같은 playerId 가 같은 이름을 다시 보내면 성공으로 친다 (재시도해도 안전해야 한다 —
//    응답을 못 받고 다시 보내는 경우가 실제로 생긴다)
app.post('/api/name', async (req, res) => {
  const { playerId, secret, name } = req.body || {};
  if (!ID_RE.test(String(playerId || ''))) return res.status(400).json({ error: 'bad_player_id' });
  if (!SECRET_RE.test(String(secret || ''))) return res.status(400).json({ error: 'bad_secret' });
  const bad = nameProblem(name);
  if (bad) return res.status(400).json({ error: bad });

  try {
    const mine = await store.get(playerId);
    // 남의 세이브에 이름을 붙이려는 요청은 막는다
    if (mine && mine.secret !== secret) return res.status(403).json({ error: 'forbidden' });

    const r = await store.claimName(playerId, secret, String(name));
    if (!r.ok) return res.status(409).json({ error: 'name_taken', name });
    res.json({ ok: true, playerId, name: String(name) });
  } catch (e) {
    console.error('[POST /api/name]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── 매력 총합 랭킹 ───
app.get('/api/ranking', async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  try {
    res.json({ ok: true, top: await store.top(limit) });
  } catch (e) {
    console.error('[GET /api/ranking]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── 세이브 불러오기 ───
//  GET /api/save/:playerId?secret=...
//  · 없으면 404 (클라이언트는 '서버에 아직 없음' 으로 보고 로컬 세이브를 올린다)
app.get('/api/save/:playerId', async (req, res) => {
  const { playerId } = req.params;
  const secret = String(req.query.secret || '');
  if (!ID_RE.test(playerId)) return res.status(400).json({ error: 'bad_player_id' });

  try {
    const row = await store.get(playerId);
    if (!row) return res.status(404).json({ error: 'not_found' });
    // 남의 세이브를 아이디만 알고 읽어 가지 못하게 한다
    if (row.secret !== secret) return res.status(403).json({ error: 'forbidden' });
    res.json({ rev: row.rev, savedAt: row.savedAt, state: row.state });
  } catch (e) {
    console.error('[GET /api/save]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── 세이브 저장 ───
//  PUT /api/save/:playerId   { secret, rev, state }
//  · rev 는 저장할 때마다 1씩 오르는 번호.
//    서버에 더 큰 rev 가 있으면(= 다른 기기가 더 최근에 저장) 덮어쓰지 않고
//    409 와 함께 서버 쪽 세이브를 돌려준다. 어느 쪽을 쓸지는 클라이언트가 정한다.
app.put('/api/save/:playerId', async (req, res) => {
  const { playerId } = req.params;
  const { secret, rev, state, meta } = req.body || {};

  if (!ID_RE.test(playerId)) return res.status(400).json({ error: 'bad_player_id' });
  if (!SECRET_RE.test(String(secret || ''))) return res.status(400).json({ error: 'bad_secret' });
  if (!Number.isInteger(rev) || rev < 0) return res.status(400).json({ error: 'bad_rev' });
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return res.status(400).json({ error: 'bad_state' });
  }

  try {
    const row = await store.get(playerId);
    if (row) {
      if (row.secret !== secret) return res.status(403).json({ error: 'forbidden' });
      if (rev <= row.rev) {
        return res.status(409).json({
          error: 'stale_rev', serverRev: row.rev, savedAt: row.savedAt, state: row.state,
        });
      }
    }
    await store.put(playerId, secret, rev, state, meta);
    res.json({ ok: true, rev, savedAt: new Date().toISOString() });
  } catch (e) {
    console.error('[PUT /api/save]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ─── 세이브 지우기 (게임 초기화) ───
app.delete('/api/save/:playerId', async (req, res) => {
  const { playerId } = req.params;
  const secret = String(req.query.secret || '');
  if (!ID_RE.test(playerId)) return res.status(400).json({ error: 'bad_player_id' });

  try {
    const row = await store.get(playerId);
    // 이미 없으면 성공으로 친다 (초기화는 몇 번을 눌러도 같은 결과여야 한다)
    if (!row) return res.json({ ok: true, deleted: false });
    if (row.secret !== secret) return res.status(403).json({ error: 'forbidden' });
    await store.del(playerId);
    res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[DELETE /api/save]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.use('/api/', (req, res) => res.status(404).json({ error: 'not_found' }));

// ─── 게임 파일 서빙 ───
// server/ 의 한 단계 위가 게임 폴더다.
const GAME_DIR = path.join(__dirname, '..');

// 게임에 필요 없는 것은 내보내지 않는다.
// (서버 소스·의존성·설정 파일이 그대로 열려 있을 이유가 없다)
// `tools` 는 검사기·생성기가 사는 곳이다. 게임은 한 줄도 안 쓰는데 그대로 열려 있었다
// (`/tools/checkui.js` 가 200 이었다). 공개 저장소라 비밀이 새는 것은 아니지만,
// 배포에 내보낼 이유가 없다 — 이 규칙의 뜻이 그것이다.
const HIDDEN = /^\/(server|node_modules|data|tools)(\/|$)|^\/\.|^\/package(-lock)?\.json$|^\/railway\.json$/;
app.use((req, res, next) => {
  if (HIDDEN.test(decodeURIComponent(req.path))) return res.status(404).send('Not found');
  next();
});

app.use(express.static(GAME_DIR, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders(res, filePath) {
    // index.html 은 항상 최신을 받아야 한다 (파일들은 ?v= 로 캐시를 관리)
    if (filePath.endsWith('index.html')) res.set('Cache-Control', 'no-cache');
    else res.set('Cache-Control', 'public, max-age=31536000');
  },
}));
app.get('*', (req, res) => res.sendFile(path.join(GAME_DIR, 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`다이어터 연금술사 서버 — 포트 ${PORT}`);
    console.log(`  저장소: ${store.kind}`);
    if (store.kind.startsWith('memory')) {
      console.warn('  ⚠ 메모리 저장소입니다 — 서버를 다시 배포하면 세이브가 사라집니다.');
      console.warn('    Railway 에서 Postgres 를 추가하는 것만으로는 연결되지 않습니다.');
      console.warn('    이 서비스의 Variables 에 참조 변수를 직접 만들어 주세요:');
      console.warn('      DATABASE_URL = ${{Postgres.DATABASE_URL}}');
      console.warn('    (Volume 을 쓴다면 DATA_DIR 을 지정하세요)');
    }
  });
}

module.exports = { app, store };
