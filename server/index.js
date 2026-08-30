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
const fs = require('fs');
const { createStore } = require('./store');
const B = require('./battle');

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
// 같은 요청을 두 번 받아도 한 번만 일어나게 하는 표 (수확·약탈).
// 응답을 못 받고 다시 보내는 일이 실제로 생긴다 — 이름 예약에서 겪은 것과 같다.
const NONCE_RE = /^[A-Za-z0-9_-]{6,64}$/;

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
// 지금 **어떤 판이 떠 있는지**를 같이 알려 준다.
//
// 「고쳤다」와 「안 고쳐졌다」가 엇갈릴 때 제일 먼저 갈라야 하는 것이 이것이다 —
// 코드가 틀린 것인가, 배포가 안 된 것인가. 눈으로는 절대 구분이 안 된다.
// (실제로 목 길이를 고치고도 화면이 그대로라 한참 코드만 다시 봤다)
//
//   ver    index.html 의 캐시 버스터 (?v=…). 브라우저가 받아 가는 파일 판을 정한다
//   commit 배포된 커밋 (Railway 가 넣어 주는 값. 로컬에서는 없다)
let CACHE_VER = null;
function cacheVer() {
  if (CACHE_VER !== null) return CACHE_VER;
  try {
    const html = fs.readFileSync(path.join(GAME_DIR, 'index.html'), 'utf8');
    const m = html.match(/\?v=([0-9a-z]+)/);
    CACHE_VER = m ? m[1] : '';
  } catch (e) { CACHE_VER = ''; }
  return CACHE_VER;
}
app.get('/api/health', async (req, res) => {
  const build = {
    ver: cacheVer(),
    commit: (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || null,
  };
  try {
    res.json({ ok: true, store: store.kind, saves: await store.count(), ...build });
  } catch (e) {
    res.status(500).json({ ok: false, store: store.kind, error: String(e.message || e), ...build });
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

// ═══════════════════════════════════════════════════════════════
//  밭 · 약탈 (크리처 9단계)
//
//  **서버가 판정을 갖는 첫 자리다.** 규칙은 server/battle.js 에 있고 여기서는
//  누구 것인지 확인하고 · 밭을 자라게 하고 · 두 밭을 같이 쓰는 일만 한다.
//
//  왜 밭이 서버에 있나 — 남이 내 밭에서 무언가를 가져가는 일이라, 세이브(내가
//  통째로 올리는 것) 안에 두면 내가 다음에 저장하는 순간 없던 일이 된다.
//  그래서 밭만 서버가 정본을 갖고, 세이브 저장(`PUT /api/save`)은 밭을 안 건드린다.
//
//  ⚠️ **가방에 들어가는 생산(8단계)은 그대로다.** 밭은 그것과 **별개로** 한 몫이
//  더 쌓이는 자리이고, 대신 **남이 털어 갈 수 있다.** 잃는 것은 언제나 「아직 안
//  받은 덤」이지 이미 가진 재료가 아니다 — 코지 게임에서 가진 것을 뺏기면
//  다시 안 켠다.
// ═══════════════════════════════════════════════════════════════

// 내 것인지 확인하고 행을 돌려준다. 아니면 res 에 오류를 쓰고 null
async function authRow(req, res, playerId, secret) {
  if (!ID_RE.test(String(playerId || ''))) { res.status(400).json({ error: 'bad_player_id' }); return null; }
  if (!SECRET_RE.test(String(secret || ''))) { res.status(400).json({ error: 'bad_secret' }); return null; }
  const row = await store.get(playerId);
  if (!row) { res.status(404).json({ error: 'not_found' }); return null; }
  if (row.secret !== secret) { res.status(403).json({ error: 'forbidden' }); return null; }
  return row;
}

// 밭을 꺼내 자라게 한다. 바뀌었으면 저장까지
async function freshFarm(row, now, create) {
  const had = row.farm && typeof row.farm === 'object';
  if (!had && !create) return null;
  const farm = had ? row.farm : B.emptyFarm(now);
  if (!Array.isArray(farm.log)) farm.log = [];
  // `grow()` 가 맨 앞에서 옛 모양(`stash` 하나)을 칸으로 옮긴다
  const grew = B.grow(farm, row.state || {}, now);
  if (!had || grew) await store.farmSet(row.playerId, farm);
  return farm;
}

// 화면에 보여 줄 크리처 한 마리 — **이름은 안 보낸다.** id 만 주면
// 클라이언트가 i18n 으로 제 언어에 맞게 부른다 (서버에 번역 사본을 만들지 않는다)
const brief = p => (p ? {
  id: p.id, attr: p.c.attr, grade: p.c.grade,
  power: B.combatPower(p.c), loyalty: p.loyalty,
} : null);

//  GET /api/farm/:playerId?secret=...   내 밭
//  · 밭이 없으면 여기서 만든다. **밭을 한 번도 안 연 사람은 목록에 안 뜬다** —
//    기능이 있는 줄도 모르는 채로 털리는 일이 없어야 한다
app.get('/api/farm/:playerId', async (req, res) => {
  try {
    const row = await authRow(req, res, req.params.playerId, String(req.query.secret || ''));
    if (!row) return;
    const now = Date.now();
    const farm = await freshFarm(row, now, true);
    const st = row.state || {};
    res.json({
      ok: true, now,
      // 화면은 아직 이삭을 **한 무더기로** 본다 (1단계는 그릇만 바꾼다).
      // `plots` 를 같이 보내 두어 3단계에서 화면만 바꾸면 되게 한다
      stash: B.mergedStash(farm), count: B.countOf(B.harvestable(farm, now)),
      plots: farm.plots, plotMax: B.PLOT_MAX,
      grownAt: farm.grownAt, nextGrowAt: farm.grownAt + B.GROW_MS,
      shieldUntil: farm.shieldUntil || 0,
      raids: farm.raids, raidMax: B.RAID_MAX,
      nextRaidAt: farm.raids >= B.RAID_MAX ? 0 : farm.raidAt + B.RAID_REGEN_MS,
      log: farm.log,
      daily: B.dailyYield(st), days: B.FARM_DAYS,
      def: brief(B.defender(st)), atk: brief(B.attacker(st)),
    });
  } catch (e) {
    console.error('[GET /api/farm]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

//  POST /api/farm/:playerId/harvest  { secret, nonce }
//  · 이삭을 거둔다. 밭은 비고, 가져갈 목록을 돌려준다 (가방에 넣는 것은 클라이언트)
//  · **같은 nonce 로 다시 오면 같은 답을 돌려준다.** 응답을 못 받고 재시도했을 때
//    한 번 거둔 것이 통째로 사라지면 안 된다
app.post('/api/farm/:playerId/harvest', async (req, res) => {
  const { secret, nonce } = req.body || {};
  if (!NONCE_RE.test(String(nonce || ''))) return res.status(400).json({ error: 'bad_nonce' });
  try {
    const row = await authRow(req, res, req.params.playerId, secret);
    if (!row) return;
    const now = Date.now();
    const farm = await freshFarm(row, now, true);
    if (farm.lastHarvest && farm.lastHarvest.nonce === nonce) {
      return res.json({ ok: true, items: farm.lastHarvest.items, repeat: true });
    }
    if (!B.countOf(B.harvestable(farm, now))) return res.status(409).json({ error: 'farm_empty' });
    const items = B.harvestEars(farm, now);
    farm.lastHarvest = { nonce, items, t: now };
    await store.farmSet(row.playerId, farm);
    res.json({ ok: true, items });
  } catch (e) {
    console.error('[POST /api/farm/harvest]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

//  POST /api/farm/:playerId/plant   { secret, nonce, index, crop }
//  · 칸 하나에 심는다.
//  ⚠️ **재료는 서버가 안 깎는다.** 재료는 세이브 안에 있고 세이브는 클라이언트가
//    정본이다 — 서버가 깎아도 다음 저장에 되살아난다. 서버가 판정을 갖는 기준은
//    「남의 것을 건드리는가」이고(약탈이 그렇다), 심기는 내 것만 건드린다.
//    다만 **다 자라는 시각만은 서버가 잰다** — 그것이 남이 언제 털 수 있는지를 정한다
app.post('/api/farm/:playerId/plant', async (req, res) => {
  const { secret, nonce, index, crop } = req.body || {};
  if (!NONCE_RE.test(String(nonce || ''))) return res.status(400).json({ error: 'bad_nonce' });
  try {
    const row = await authRow(req, res, req.params.playerId, secret);
    if (!row) return;
    const now = Date.now();
    const farm = await freshFarm(row, now, true);
    if (farm.lastPlant && farm.lastPlant.nonce === nonce) {
      return res.json({ ok: true, plots: farm.plots, repeat: true });
    }
    const bad = B.plant(farm, row.state || {}, index, String(crop || ''), now);
    if (bad) return res.status(409).json({ error: bad });
    farm.lastPlant = { nonce, t: now };
    await store.farmSet(row.playerId, farm);
    res.json({ ok: true, now, plots: farm.plots });
  } catch (e) {
    console.error('[POST /api/farm/plant]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

//  POST /api/farm/:playerId/plot   { secret, nonce }
//  · 칸을 하나 더 연다. **값(현자의 결정)은 클라이언트가 낸다** — 위와 같은 이유다
app.post('/api/farm/:playerId/plot', async (req, res) => {
  const { secret, nonce } = req.body || {};
  if (!NONCE_RE.test(String(nonce || ''))) return res.status(400).json({ error: 'bad_nonce' });
  try {
    const row = await authRow(req, res, req.params.playerId, secret);
    if (!row) return;
    const now = Date.now();
    const farm = await freshFarm(row, now, true);
    if (farm.lastPlot && farm.lastPlot.nonce === nonce) {
      return res.json({ ok: true, plots: farm.plots, repeat: true });
    }
    const bad = B.addPlot(farm);
    if (bad) return res.status(409).json({ error: bad });
    farm.lastPlot = { nonce, t: now };
    await store.farmSet(row.playerId, farm);
    res.json({ ok: true, now, plots: farm.plots });
  } catch (e) {
    console.error('[POST /api/farm/plot]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

//  GET /api/raid/targets/:playerId?secret=...   털러 갈 만한 남의 밭
app.get('/api/raid/targets/:playerId', async (req, res) => {
  try {
    const row = await authRow(req, res, req.params.playerId, String(req.query.secret || ''));
    if (!row) return;
    const now = Date.now();
    await freshFarm(row, now, true);          // 내 밭도 같이 정산해 둔다
    const peers = await store.peers(row.playerId, 12);
    const list = [];
    for (const p of peers) {
      const farm = p.farm;
      if (!farm || typeof farm !== 'object') continue;
      // **남의 밭은 자라게 하지 않는다.** 남이 내 밭을 보는 것만으로 내 밭이
      // 자라면, 정산 시각이 남의 접속에 좌우된다. 지금 쌓여 있는 것만 보여 준다
      // **남의 밭은 자라게 하지 않는다** — 남이 내 밭을 보는 것만으로 내 밭이
      // 자라면 정산 시각이 남의 접속에 좌우된다. 다만 **모양은 맞춰서 읽는다**
      // (옛 모양 그대로인 밭이 목록에서 통째로 빠지면 안 된다)
      const stash = Array.isArray(farm.plots) ? B.mergedStash(farm)
        : (farm.stash && typeof farm.stash === 'object' ? farm.stash : {});
      const n = B.countOf(stash);
      if (!n) continue;
      if ((farm.shieldUntil || 0) > now) continue;      // 막 털린 밭은 건너뛴다
      list.push({
        name: p.name, charm: p.charm, count: n, stash,
        def: brief(B.defender(p.state || {})),
      });
      if (list.length >= 5) break;
    }
    res.json({ ok: true, now, targets: list });
  } catch (e) {
    console.error('[GET /api/raid/targets]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

//  POST /api/raid/:playerId   { secret, target, nonce }
//  · target 은 **이름**이다. 남의 playerId 는 절대 내보내지 않는다 (그것이 곧 신원이다)
app.post('/api/raid/:playerId', async (req, res) => {
  const { secret, target, nonce } = req.body || {};
  if (!NONCE_RE.test(String(nonce || ''))) return res.status(400).json({ error: 'bad_nonce' });
  const bad = nameProblem(target);
  if (bad) return res.status(400).json({ error: bad });
  try {
    const row = await authRow(req, res, req.params.playerId, secret);
    if (!row) return;
    const now = Date.now();
    const farm = await freshFarm(row, now, true);
    // 재시도는 같은 답을 돌려준다 — 약탈권이 두 번 깎이거나 두 번 털면 안 된다
    if (farm.lastRaid && farm.lastRaid.nonce === nonce) {
      return res.json({ ok: true, ...farm.lastRaid.res, repeat: true });
    }

    const me = B.attacker(row.state || {});
    if (!me) return res.status(409).json({ error: 'no_companion' });
    if ((farm.raids || 0) < 1) {
      return res.status(409).json({ error: 'no_raids', nextRaidAt: farm.raidAt + B.RAID_REGEN_MS });
    }

    const other = await store.getByName(String(target));
    if (!other) return res.status(404).json({ error: 'target_gone' });
    if (other.playerId === row.playerId) return res.status(400).json({ error: 'self' });
    const theirFarm = other.farm && typeof other.farm === 'object' ? other.farm : null;
    if (!theirFarm) return res.status(409).json({ error: 'target_empty' });
    B.migrateFarm(theirFarm);          // 옛 모양이면 여기서 칸으로 옮긴다
    if (!B.farmCount(theirFarm)) return res.status(409).json({ error: 'target_empty' });
    if ((theirFarm.shieldUntil || 0) > now) return res.status(409).json({ error: 'target_shielded' });

    const def = B.defender(other.state || {});
    const r = B.resolve(me, def);
    const items = r.win ? B.loot(B.mergedStash(theirFarm)) : {};

    // 약탈권을 쓴다. **가득이었으면 지금부터 회복 시계를 돌린다** —
    // 안 그러면 오래 안 쓴 사람은 쓰자마자 도로 찬다
    if ((farm.raids || 0) >= B.RAID_MAX) farm.raidAt = now;
    farm.raids = (farm.raids || 0) - 1;

    if (r.win) {
      B.takeFrom(theirFarm, items);
      // **털린 뒤에는 잠시 아무도 못 턴다.** 자는 사이에 밭이 열 번 털리면 안 된다
      theirFarm.shieldUntil = now + B.SHIELD_MS;
    }
    // 진 쪽도 기록에 남는다 — 「누가 왔다 갔는데 못 털었다」도 알아야 재미가 있다
    if (!Array.isArray(theirFarm.log)) theirFarm.log = [];
    theirFarm.log.unshift({ t: now, by: row.name || null, win: r.win, items });
    theirFarm.log = theirFarm.log.slice(0, 10);
    await store.farmSet(other.playerId, theirFarm);

    const out = {
      win: r.win, chance: Math.round(r.chance * 100) / 100, items,
      target: other.name, def: brief(def), mine: brief(me),
      raids: farm.raids, nextRaidAt: farm.raidAt + B.RAID_REGEN_MS, now,
    };
    farm.lastRaid = { nonce, res: out, t: now };
    await store.farmSet(row.playerId, farm);
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error('[POST /api/raid]', e);
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
