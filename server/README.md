# 세이브 서버 — Railway 배포 안내

게임 진행을 서버에 저장해서, **브라우저 데이터를 지우거나 기기를 바꿔도 이어서** 할 수 있게 한다.

이 서버 하나가 두 가지를 같이 한다.

- `alchemist-production-7583.up.railway.app` 를 열면 → **게임이 바로 뜬다**
- `.../api/save/...` 로는 → **세이브를 주고받는다**

같은 주소를 쓰기 때문에 CORS 설정이 필요 없다.

---

## 1. 배포 (10분)

### ① 코드를 Railway 에 올린다

**방법 A — GitHub 연결** (자동 배포됨)

Railway 대시보드 → **New Project** → **Deploy from GitHub repo** →
`evachristian/dieter-alchemist` 선택.

> **이 저장소는 비공개다.** Railway 에 접근 권한을 따로 줘야 목록에 보인다.
> Settings 에 **"GitHub Repo not found"** 라고 뜬다면 권한이 없는 것이다 —
> GitHub → Settings → Applications → **Railway** 에서 이 저장소 접근을 허용하거나,
> Railway 의 Source 를 다시 연결한다.

**방법 B — CLI 로 직접 올리기** (GitHub 연결 없이)

```bash
npm i -g @railway/cli
railway login
railway link          # 저장소 루트에서. 만들어 둔 프로젝트/서비스를 고른다
railway up            # 현재 폴더를 그대로 배포
```

이 방법은 GitHub 를 거치지 않으므로 저장소 권한 문제와 무관하다.
대신 자동 배포가 없어서, 고칠 때마다 `railway up` 을 다시 실행해야 한다.

### ② 서비스 설정 두 가지

Railway 의 서비스 → **Settings**:

| 항목 | 값 |
|---|---|
| **Root Directory** | **비움** (`/`) |
| **Start Command** | `npm start` |

> ⚠️ `server` 가 **아니다.** Root Directory 는 빌드에 포함되는 범위라서,
> `server` 로 잡으면 게임 파일(`index.html`, `game.js` …)이 빌드에 들어가지 않는다.
> `package.json` 을 저장소 루트에 둔 이유가 이것이다 — 게임과 서버가 한 덩어리로 올라간다.
>
> 예전에는 게임이 저장소 안의 `dieter-alchemist/` 하위 폴더였고 Root Directory 도 그 값이었다.
> **이제 그 폴더 자체가 저장소 루트라서 그 값을 그대로 두면 경로를 못 찾는다.**
> 이미 만들어 둔 서비스가 있다면 이 값부터 비울 것.

### ②-1 포트

서버는 `PORT` 환경변수를 따르고, 없으면 **8080** 으로 뜬다.
Railway 가 도메인을 만들 때 기본으로 8080 으로 라우팅하므로 그대로 두면 된다.
도메인 설정의 포트가 8080 인지만 확인할 것 (다르면 502 가 난다).

### ③ 저장소를 붙인다 (중요)

**이걸 하지 않으면 재배포할 때마다 모든 플레이어의 세이브가 사라진다.**
Railway 의 기본 파일시스템은 배포할 때마다 초기화되기 때문이다.

둘 중 하나를 고른다.

**(권장) Postgres — 두 단계다**

**③-1 데이터베이스 추가**

캔버스(서비스 패널을 닫으면 보이는 격자 배경)에서 **우클릭** → `Database` → `Add PostgreSQL`.
또는 캔버스 우측 상단 **`+ Create`**, 또는 `Cmd/Ctrl + K` → `Postgres`.

**③-2 게임 서비스에 연결 (이걸 빠뜨리기 쉽다)**

> ⚠️ **Postgres 를 추가하는 것만으로는 연결되지 않는다.**
> 접속 주소는 Postgres 서비스 안에만 생기고, 게임 서비스로 자동으로 넘어오지 않는다.

Alchemist 서비스 → **Variables** 탭에서:

- 보라색 배너 **"Trying to connect a database? Add Variable"** 을 누르고 Postgres 를 고르거나,
- **`+ New Variable`** 로 직접 만든다:

| 이름 | 값 |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

`${{ }}` 는 Railway 의 **참조 문법**이다. 값을 복사해 붙여넣지 말 것 —
비밀번호가 바뀌면 연결이 끊긴다. `Postgres` 자리에는 캔버스에 보이는 서비스 이름을 그대로 쓴다.

넣은 뒤 **Deploy** 를 눌러 재배포해야 반영된다.

서버는 `DATABASE_URL` 외에 `DATABASE_PRIVATE_URL` `POSTGRES_URL` 등도 알아서 찾는다.
테이블(`saves`)은 처음 뜰 때 스스로 만든다.

**(대안) Volume**

Alchemist 서비스 → **Settings** → **Volumes** → 마운트 경로를 `/data` 로 추가하고,
**Variables** 에 `DATA_DIR` = `/data` 를 넣는다. (이쪽은 참조 문법이 아니라 그냥 경로)

### ④ 도메인 연결

서비스 → **Settings** → **Networking** → 만들어 둔
`alchemist-production-7583.up.railway.app` 를 연결한다.

### ⑤ 확인

```
https://alchemist-production-7583.up.railway.app/          → 게임이 뜬다
https://alchemist-production-7583.up.railway.app/api/health → {"ok":true,"store":"postgres","saves":0}
```

`"store"` 값을 꼭 확인할 것.

| 값 | 뜻 |
|---|---|
| `postgres` | ✅ 제대로 저장된다 |
| `file(/data)` | ✅ 제대로 저장된다 |
| `memory(휘발성)` | ⚠️ **재배포하면 다 날아간다** — ③ 이 덜 끝난 상태. 특히 ③-2 를 빠뜨렸는지 확인할 것 |

`memory` 로 뜬다면 배포 로그(Deployments → 최신 배포)에 무엇이 빠졌는지 그대로 찍혀 있다.

---

## 2. 게임을 다른 곳에 올릴 경우

게임만 따로(예: Netlify) 올렸다면, `index.html` 의 `<head>` 안에 서버 주소를 알려 준다.

```html
<script>window.SYNC_URL = 'https://alchemist-production-7583.up.railway.app';</script>
```

같은 서버가 게임을 서빙하는 경우에는 **아무것도 안 해도 된다** (자기 주소를 그대로 쓴다).

---

## 3. 로컬에서 돌려보기

```bash
npm install
npm start          # http://localhost:8080
npm test           # 서버 API 검사
```

환경변수 없이 실행하면 메모리 저장소로 뜬다 — 개발용으로는 충분하다.
파일로 남기고 싶으면 `DATA_DIR=./data npm start`.

---

## 4. API

모든 요청은 `secret` 을 함께 보내야 한다. 아이디만으로는 남의 세이브를 읽거나 쓸 수 없다.

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| `GET` | `/api/health` | 서버 상태 · 저장소 종류 · 세이브 개수 |
| `GET` | `/api/save/:playerId?secret=…` | 세이브 조회 (없으면 404) |
| `PUT` | `/api/save/:playerId` | 세이브 저장 — 본문 `{ secret, rev, state }` |
| `DELETE` | `/api/save/:playerId?secret=…` | 세이브 삭제 (게임 초기화) |

### rev — 어느 쪽이 최신인가

`rev` 는 저장할 때마다 1씩 오르는 번호다.
서버에 **더 큰 rev** 가 있으면(= 다른 기기가 더 최근에 저장) 덮어쓰지 않고
`409` 와 함께 서버 쪽 세이브를 돌려준다. 클라이언트는 그걸 받아 자기 상태를 맞춘다.

즉 **두 기기에서 동시에 플레이하면 먼저 저장한 쪽이 이긴다.** 진행이 섞이거나
깨지지는 않지만, 나중 기기의 마지막 몇 초는 서버 쪽 내용으로 대체된다.

### 응답 코드

| 코드 | 뜻 |
|---|---|
| `200` | 성공 |
| `400` | 형식이 잘못됨 (아이디/secret/rev/state) |
| `403` | secret 이 다름 — 남의 세이브 |
| `404` | 세이브 없음 |
| `409` | 서버 쪽이 더 최신 (본문에 서버 세이브가 함께 온다) |
| `429` | 너무 잦은 요청 (같은 IP 분당 120회 초과) |

---

## 5. 플레이어를 어떻게 구분하나

로그인이 없으므로, 브라우저마다 무작위 **아이디 + 비밀키**를 만들어 `localStorage` 에 둔다.
이 둘을 이어 붙인 것이 게임 설정 화면의 **복구 코드** 다.

```
p8fK2mQ....Zx.hT9dRs....2Lp
└─ 아이디 ─┘ └─ 비밀키 ─┘
```

다른 기기의 설정 → **코드로 이어하기** 에 붙여넣으면 그 진행을 이어서 한다.

### 한계

- 복구 코드를 잃고 브라우저 데이터도 지우면 되찾을 수 없다 (연결할 이메일이 없으므로).
- 코드를 아는 사람은 그 세이브를 볼 수 있다 — 비밀번호처럼 다뤄야 한다.

나중에 이메일·소셜 로그인을 붙일 때는, 지금의 `playerId` 를 계정에 연결해 주기만 하면
기존 플레이어의 진행이 그대로 넘어간다. (세이브 형식은 그대로 두고 소유자만 바꾸면 된다)

---

## 6. 비용

Railway 무료 사용량 기준으로, 세이브는 플레이어당 5KB 안팎이고
저장 요청은 실제 플레이 중 몇 초에 한 번꼴이라 트래픽이 매우 적다.
수천 명 규모까지는 무료~최소 요금 안에서 충분하다.
