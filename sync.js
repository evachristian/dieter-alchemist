// ═══════════════════════════════════════════════════════════════
//  서버 동기화 — 세이브를 서버에도 올려 둔다
//
//  기본 원칙: 로컬(localStorage)이 항상 진짜다.
//    게임은 서버가 죽어 있어도, 비행기 모드여도 똑같이 돌아간다.
//    서버는 '기기를 바꾸거나 브라우저 데이터를 지웠을 때 되찾기 위한 사본'.
//
//  흐름
//    부팅   서버 세이브를 받아 본다 → 서버 rev 가 더 크면 그쪽을 채택
//    저장   3초 모아서 한 번 올린다 (연속 저장 때 요청 폭주 방지)
//    이탈   탭을 닫거나 숨길 때 남은 것을 즉시 올린다
//    실패   못 올렸으면 표시해 두고 다시 시도 (지수 백오프)
//
//  플레이어 식별
//    로그인이 없으므로 기기마다 무작위 아이디 + 비밀키를 만들어 쓴다.
//    이 둘을 합친 것이 '복구 코드' 이고, 다른 기기에 입력하면 이어서 할 수 있다.
// ═══════════════════════════════════════════════════════════════
(function () {
  const ID_KEY = 'dieter_alchemist_player_v1';
  const PUSH_DELAY = 3000;        // 저장을 모으는 시간
  const MAX_BACKOFF = 60_000;

  // ─── 서버 주소 ───
  // 게임을 서버가 직접 서빙하면 같은 출처를 그대로 쓴다(설정 불필요).
  // file:// 로 열었거나 다른 곳에 올렸다면 index.html 의 window.SYNC_URL 을 본다.
  function apiBase() {
    if (typeof window.SYNC_URL === 'string' && window.SYNC_URL) {
      return window.SYNC_URL.replace(/\/+$/, '');
    }
    if (location.protocol === 'http:' || location.protocol === 'https:') return '';
    return '';   // 주소를 알 수 없으면 동기화를 끈다 (아래 enabled() 참고)
  }
  function enabled() {
    return apiBase() !== '' || location.protocol === 'http:' || location.protocol === 'https:';
  }

  // ─── 플레이어 신원 ───
  function rand(n) {
    const b = new Uint8Array(n);
    (window.crypto || {}).getRandomValues
      ? crypto.getRandomValues(b)
      : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
    // URL 에 그대로 넣을 수 있는 문자만 쓴다
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  function loadId() {
    try {
      const raw = localStorage.getItem(ID_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.playerId && p.secret) return p;
      }
    } catch (e) {}
    const p = { playerId: 'p' + rand(16), secret: rand(24) };
    try { localStorage.setItem(ID_KEY, JSON.stringify(p)); } catch (e) {}
    return p;
  }
  let me = loadId();

  // ─── 상태 ───
  //  idle 저장할 것 없음 / pending 올릴 것 있음 / saving 올리는 중
  //  saved 방금 올림 / offline 실패해서 재시도 대기 / off 동기화 안 씀
  let status = enabled() ? 'idle' : 'off';
  let pending = null;         // 아직 못 올린 상태 (가장 마지막 것만 보관)
  let timer = null, backoff = 1000, sending = false;
  // 게임 초기화로 서버 세이브를 지운 뒤에는 어떤 것도 다시 올리지 않는다.
  // (지우는 순간 이미 날아가고 있던 저장 요청이 나중에 도착하면 세이브가 되살아난다)
  let wiped = false;
  const listeners = [];

  function setStatus(s) {
    if (status === s) return;
    status = s;
    listeners.forEach(fn => { try { fn(s); } catch (e) {} });
  }

  // 요청 하나에 두는 시간의 한도. **없으면 느린 회선에서 `sending` 이 영영 안 풀려**
  // 그 뒤의 저장이 전부 밀린다 (서버 쪽에도 같은 이유로 DB 한도가 있다)
  const API_TIMEOUT = 15_000;
  async function api(method, path, opts) {
    opts = opts || {};
    const ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), API_TIMEOUT) : null;
    // ⚠️ **비밀키는 헤더로 보낸다.** 예전에는 GET·DELETE 의 주소 쿼리에 실어서
    // 프록시·배포 인프라의 접근 로그에 그대로 남았다 (외부 비평 3.7).
    // 몸통에 넣는 요청(PUT·POST)은 몸통의 것을 서버가 먼저 본다 — 헤더는 겸사겸사
    const headers = { 'X-Secret': opts.secret || me.secret };   // peek 만 남의 비밀키를 쓴다
    if (opts.body) headers['Content-Type'] = 'application/json';
    try {
      const r = await fetch(apiBase() + path, {
        method, headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        keepalive: !!opts.keepalive,
        signal: ctl ? ctl.signal : undefined,
      });
      let json = null;
      try { json = await r.json(); } catch (e) {}
      return { status: r.status, body: json };
    } finally {
      if (tm) clearTimeout(tm);
    }
  }

  // ─── 올리기 ───
  // 돌려주는 값: 'ok'(올렸다) · 'adopted'(서버가 더 새로워 그쪽을 받았다) ·
  // 'retry'(못 올려서 나중에) · 'off'(올릴 것이 없거나 동기화가 꺼져 있다)
  async function flush() {
    if (!enabled() || sending || !pending || wiped) return 'off';
    sending = true;
    timer = null;
    setStatus('saving');
    const snap = pending;
    let result = 'retry';
    try {
      const r = await api('PUT', `/api/save/${me.playerId}`, {
        body: { secret: me.secret, rev: snap.rev || 0, state: snap, meta: metaOf(snap) },
      });
      if (r.status === 200) {
        if (pending === snap) pending = null;      // 그 사이 새 저장이 있었으면 남겨 둔다
        backoff = 1000;
        setStatus(pending ? 'pending' : 'saved');
        result = 'ok';
      } else if (r.status === 409) {
        // 서버에 더 큰 rev 가 있다. ⚠️ **그렇다고 로컬을 무조건 버리지 않는다.**
        // 409 는 「서버가 더 새롭다」뿐 아니라 응답을 잃은 재전송(같은 rev)에서도 온다.
        // 보내는 사이에 로컬이 더 나아갔으면(`pending` 이 스냅샷보다 새 rev) 그 진행은
        // 서버보다 새로운 것이라 **그대로 두고 다시 보낸다** — 예전에는 여기서
        // `pending = null` 로 지워 방금 한 것을 잃었다 (외부 비평 1.2 가 재현했다)
        const serverRev = (r.body && r.body.serverRev) || 0;
        const newest = pending ? (pending.rev || 0) : (snap.rev || 0);
        backoff = 1000;
        if (serverRev >= newest) {
          pending = null;
          if (r.body && r.body.state && window.adoptState) {
            window.adoptState(r.body.state);     // 덮이는 로컬은 `_prev` 에 남는다
            if (window.toast) toast(T('sync_pulled'), null, 2600);
          }
          setStatus('saved');
          result = 'adopted';
        } else {
          setStatus('pending');                  // finally 가 남은 것을 이어 보낸다
          result = 'retry';
        }
      } else if (r.status === 403) {
        // 같은 아이디에 다른 비밀키 — 정상적으로는 일어나지 않는다.
        // 덮어쓰기를 시도하지 않고 동기화를 멈춘다 (로컬 플레이는 그대로).
        pending = null;
        setStatus('off');
        console.warn('[sync] 이 아이디는 다른 기기가 쓰고 있습니다. 동기화를 멈춥니다.');
        result = 'off';
      } else {
        retryLater();
      }
    } catch (e) {
      retryLater();                                 // 네트워크 끊김 · 시간 초과 등
    } finally {
      sending = false;
      // ⚠️ **날아가는 동안 쌓인 것을 이어 보낸다.** 요청 A 가 가는 사이에 저장 B 의
      // 타이머가 울리면 `sending` 때문에 그냥 돌아왔는데, A 가 끝나도 B 를 다시
      // 예약하는 곳이 없어서 다음 자동 저장(30초)까지 밀렸다 (외부 비평 1.13).
      // 재시도가 이미 잡혀 있으면(`retryLater`) 그것을 따른다
      if (pending && !wiped && timer === null) timer = setTimeout(flush, PUSH_DELAY);
    }
    return result;
  }

  function retryLater() {
    setStatus('offline');
    clearTimeout(timer);
    timer = setTimeout(flush, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
  }

  // 세이브와 함께 보내는 요약값. 서버가 이것만 컬럼으로 빼 두면
  // 랭킹·통계를 낼 때 세이브 본문을 전부 파싱하지 않아도 된다.
  // (매력 총합은 크리처 보너스까지 더해야 해서 게임 규칙을 아는 쪽이 계산한다)
  function metaOf(state) {
    const charm = (typeof window.totalCharm === 'function') ? window.totalCharm() : null;
    return Number.isFinite(charm) ? { charm: Math.max(0, Math.floor(charm)) } : undefined;
  }

  // ─── 이름 예약 ───
  // 이름은 유일하다. 서버가 확인해 주기 전에는 이름을 정한 것으로 치지 않는다.
  //  · 같은 사람이 같은 이름으로 다시 보내면 성공이다 (응답을 못 받고 재시도하는 경우)
  //  · 오프라인이면 예약할 수 없다 — 로컬에만 정해 두면 나중에 남과 겹친다
  async function claimName(name) {
    if (!enabled()) return { ok: false, reason: 'offline' };
    try {
      const r = await api('POST', '/api/name', {
        body: { playerId: me.playerId, secret: me.secret, name },
      });
      if (r.status === 200) return { ok: true, name: (r.body && r.body.name) || name };
      if (r.status === 409) return { ok: false, reason: 'taken' };
      if (r.body && r.body.error) return { ok: false, reason: r.body.error };
      return { ok: false, reason: 'error' };
    } catch (e) {
      return { ok: false, reason: 'offline' };
    }
  }

  // game.js 의 save() 가 매번 부른다
  function push(state) {
    if (!enabled() || wiped) return;
    // 참조를 그대로 들고 있으면 나중에 바뀐 값이 섞이므로 그 시점의 사본을 만든다
    pending = JSON.parse(JSON.stringify(state));
    setStatus('pending');
    clearTimeout(timer);
    timer = setTimeout(flush, PUSH_DELAY);
  }

  // **지금 당장 올린다** (기다리지 않고).
  // 밭 5단계에서 필요해졌다 — 출정대를 바꾸고 바로 쳐들어가면, 서버는 아직 3초
  // 디바운스에 걸려 있는 **옛 부대**로 판정한다. 판정을 서버가 갖는 대가다.
  // **올라갔는지를 돌려준다** (true = 서버가 지금 이 상태를 안다). 예전에는 아무것도
  // 안 돌려줘서 `doRaid` 가 실패한 줄도 모르고 곧바로 출정했다 — 서버는 옛 부대로 판정했다
  async function pushNow(state) {
    if (!enabled() || wiped) return false;
    // 날아가고 있는 요청이 있으면 끝난 뒤에 보낸다 (`flush` 는 sending 이면 그냥 돌아온다)
    for (let i = 0; i < 60 && sending; i++) await new Promise(r => setTimeout(r, 50));
    if (sending) return false;
    pending = JSON.parse(JSON.stringify(state));
    setStatus('pending');
    clearTimeout(timer); timer = null;
    const r = await flush();
    return r === 'ok' || r === 'adopted';
  }

  // 탭을 닫거나 숨길 때 — 모아 둔 것을 지금 올린다
  function flushNow() {
    if (!enabled() || !pending || wiped) return;
    clearTimeout(timer);
    // keepalive 를 쓰면 페이지가 사라져도 요청이 끝까지 간다
    api('PUT', `/api/save/${me.playerId}`, {
      body: { secret: me.secret, rev: pending.rev || 0, state: pending, meta: metaOf(pending) },
      keepalive: true,
    }).catch(() => {});
  }

  // ─── 내려받기 (부팅 시) ───
  async function pull(localState) {
    if (!enabled()) return { action: 'off' };
    try {
      const r = await api('GET', `/api/save/${me.playerId}`);
      if (r.status === 404) {
        // 서버에 아직 없다 — 지금 로컬 세이브를 올려 둔다
        if (localState) push(localState);
        return { action: 'push' };
      }
      if (r.status !== 200 || !r.body) { setStatus('offline'); return { action: 'error' }; }

      const serverRev = r.body.rev || 0;
      const localRev = (localState && localState.rev) || 0;
      if (serverRev > localRev) {
        if (window.adoptState) window.adoptState(r.body.state);
        setStatus('saved');
        return { action: 'adopt', serverRev, localRev };
      }
      if (localRev > serverRev) { push(localState); return { action: 'push', serverRev, localRev }; }
      setStatus('saved');
      return { action: 'same', serverRev, localRev };
    } catch (e) {
      setStatus('offline');
      return { action: 'error' };
    }
  }

  // ─── 초기화 (게임 초기화 시 서버 세이브도 지운다) ───
  async function wipe() {
    wiped = true;                 // 이 시점 이후로는 아무것도 올리지 않는다
    pending = null;
    clearTimeout(timer);
    if (!enabled()) return false;
    // 이미 날아가고 있는 저장 요청이 있으면 그게 끝난 뒤에 지운다.
    // (먼저 지우면 그 요청이 나중에 도착해 세이브를 되살린다)
    for (let i = 0; i < 60 && sending; i++) await new Promise(r => setTimeout(r, 50));
    try {
      const r = await api('DELETE', `/api/save/${me.playerId}`);
      return r.status === 200;
    } catch (e) { return false; }
  }

  // ─── 복구 코드 ───
  // playerId 와 secret 을 이어 붙인 것. 다른 기기에 입력하면 그 세이브를 이어서 한다.
  //  · 구분자는 '.' — 아이디와 비밀키는 base64url 이라 '-' 와 '_' 를 포함할 수 있어서,
  //    '-' 로 나누면 아이디 한가운데서 잘려 엉뚱한 신원이 만들어진다.
  function code() { return me.playerId + '.' + me.secret; }
  function useCode(str) {
    const s = String(str || '').trim();
    const i = s.indexOf('.');
    if (i < 1) return false;
    const playerId = s.slice(0, i), secret = s.slice(i + 1);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(playerId) || !/^[A-Za-z0-9_-]{16,128}$/.test(secret)) return false;
    me = { playerId, secret };
    try { localStorage.setItem(ID_KEY, JSON.stringify(me)); } catch (e) {}
    pending = null;
    wiped = false;
    return true;
  }

  // 코드가 «진짜 있는 세이브»인지 **신원을 갈아타지 않고** 물어본다.
  //
  // ⚠️ 이것이 없으면 오타 하나로 진행이 통째로 날아간다. 예전에는 `useCode()` 가
  // **형식만 보고** 곧바로 신원을 갈아엎은 뒤 로컬 세이브를 지우고 새로고침했다 —
  // 그 코드가 서버에 없으면(오타 · 비밀키 한 글자 차이) 되돌릴 방법 없이
  // **빈손으로 새 게임이 시작된다.** 원래 신원까지 잃은 채로.
  //
  // 그래서 «먼저 받아 보고, 있으면 갈아탄다». 여기서는 `me` 를 건드리지 않는다.
  //   ok      — 200. 그 세이브가 있다
  //   'none'  — 404. 그런 아이디가 없다
  //   'wrong' — 403. 아이디는 맞는데 비밀키가 다르다 (코드가 잘린 경우가 대부분이다)
  //   'bad'   — 형식이 코드가 아니다
  //   'net'   — 서버에 못 닿았다. **이때도 갈아타면 안 된다** (있는지 모르는 것이다)
  async function peek(str) {
    const s = String(str || '').trim();
    const i = s.indexOf('.');
    if (i < 1) return { ok: false, why: 'bad' };
    const playerId = s.slice(0, i), secret = s.slice(i + 1);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(playerId) || !/^[A-Za-z0-9_-]{16,128}$/.test(secret))
      return { ok: false, why: 'bad' };
    if (!enabled()) return { ok: false, why: 'net' };
    try {
      const r = await api('GET', `/api/save/${playerId}`, { secret });
      if (r.status === 404) return { ok: false, why: 'none' };
      if (r.status === 403) return { ok: false, why: 'wrong' };
      if (r.status !== 200 || !r.body) return { ok: false, why: 'net' };
      return { ok: true, rev: r.body.rev || 0, savedAt: r.body.savedAt || 0, state: r.body.state || {} };
    } catch (e) {
      return { ok: false, why: 'net' };
    }
  }

  // ─── 밭 · 약탈 (크리처 9단계) ───
  // **세이브와 다른 길이다.** 밭은 서버가 정본을 갖고 있어서 여기서는 모아 두거나
  // 나중에 다시 보내지 않는다 — 실패하면 실패한 것으로 알리고 화면이 그렇게 말한다.
  // (세이브는 못 올려도 로컬이 진짜지만, 밭은 서버에 없으면 아예 없다)
  //
  // 수확·약탈은 **같은 요청이 두 번 가도 한 번만 일어나야 한다.** 응답을 못 받고
  // 재시도했을 때 거둔 것이 사라지거나 약탈권이 두 번 깎이면 안 된다. 그래서
  // 요청마다 nonce 를 붙이고 서버가 같은 nonce 를 기억한다.
  const nonce = () => rand(8);
  // `create` 가 참일 때만 서버가 없는 밭을 **만든다.** ⚠️ 부팅의 조회는 만들지 않는다 —
  // 예전에는 조회만으로 밭이 생겨서, 밭 화면을 한 번도 안 연 사람도 목록에 올라
  // 털릴 수 있었다 (외부 비평 1.7). 밭이 없으면 `{ ok, none: true }` 가 온다
  async function farmGet(create) {
    if (!enabled()) return { status: 0, body: null };
    try {
      return await api('GET', `/api/farm/${me.playerId}${create ? '?create=1' : ''}`);
    } catch (e) { return { status: 0, body: null }; }
  }
  async function harvest(n) {
    if (!enabled()) return { status: 0, body: null };
    try {
      return await api('POST', `/api/farm/${me.playerId}/harvest`, {
        body: { secret: me.secret, nonce: n },
      });
    } catch (e) { return { status: 0, body: null }; }
  }
  async function plant(index, crop, n) {
    if (!enabled()) return { status: 0, body: null };
    try {
      return await api('POST', `/api/farm/${me.playerId}/plant`, {
        body: { secret: me.secret, nonce: n, index, crop },
      });
    } catch (e) { return { status: 0, body: null }; }
  }
  async function addPlot(n) {
    if (!enabled()) return { status: 0, body: null };
    try {
      return await api('POST', `/api/farm/${me.playerId}/plot`, {
        body: { secret: me.secret, nonce: n },
      });
    } catch (e) { return { status: 0, body: null }; }
  }
  // ⚠️ 개발용 — 밭을 상한까지 채운다. **서버가 `DEV_TOOLS=0` 이면 404 다** (기본은 켜져
  // 있다 — `server/index.js` 의 `DEV_TOOLS` 주석). 밭은 서버가 정본이라 화면에서 흉내
  // 낼 수가 없어서 여기 있다
  async function farmDev() {
    if (!enabled()) return { status: 0, body: null };
    try {
      return await api('POST', `/api/farm/${me.playerId}/dev`, { body: { secret: me.secret } });
    } catch (e) { return { status: 0, body: null }; }
  }
  // ⚠️ 개발용 — 약탈권을 채우고 모두의 방패를 푼다 (`farmDev` 와 같은 잠금)
  async function freeRaids() {
    if (!enabled()) return { status: 0, body: null };
    try {
      return await api('POST', `/api/farm/${me.playerId}/devraid`, { body: { secret: me.secret } });
    } catch (e) { return { status: 0, body: null }; }
  }
  async function raidTargets() {
    if (!enabled()) return { status: 0, body: null };
    try {
      return await api('GET', `/api/raid/targets/${me.playerId}`);
    } catch (e) { return { status: 0, body: null }; }
  }
  async function raid(target, n) {
    if (!enabled()) return { status: 0, body: null };
    try {
      return await api('POST', `/api/raid/${me.playerId}`, {
        body: { secret: me.secret, target, nonce: n },
      });
    } catch (e) { return { status: 0, body: null }; }
  }

  const T = (k, v) => (window.I18N ? I18N.t(k, v) : k);

  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushNow();
    else if (status === 'offline') flush();       // 돌아왔을 때 밀린 것 재시도
  });
  window.addEventListener('online', () => { backoff = 1000; flush(); });

  // ─── 신원을 통째로 버린다 (게임 초기화 전용) ─────────────────
  //
  // ⚠️ **평소에는 `playerId` 를 절대 바꾸지 않는다** (복구 코드가 여기 묶여 있다).
  // 여기는 「처음 실행한 것과 똑같이」를 만들어야 하는 자리라 예외다 —
  // 신원을 남겨 두면 새 캐릭터가 **옛 아이디를 그대로 물려받아**, 아이디로 시드를
  // 잡는 것들(사람마다 다른 비법서 같은 것)이 초기화해도 그대로다.
  //
  // 서버 사본은 **이 함수를 부르기 전에** `wipe()` 로 지운다 — 여기서 신원을 버리면
  // 지울 열쇠(playerId·secret)가 사라진다.
  function forget() {
    wiped = true;                 // 이 시점 이후로는 아무것도 올리지 않는다
    pending = null;
    clearTimeout(timer);
    try { localStorage.removeItem(ID_KEY); } catch (e) {}
    return true;
  }

  window.Sync = {
    push, pushNow, pull, flushNow, wipe, forget, code, useCode, peek, claimName,
    nonce, farmGet, harvest, plant, addPlot, raidTargets, raid, farmDev, freeRaids,
    get status() { return status; },
    get playerId() { return me.playerId; },
    enabled,
    onStatus(fn) { listeners.push(fn); fn(status); },
  };
})();
