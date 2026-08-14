# 새 세션 인수인계

새 작업 세션(로컬이든 클라우드든)을 열었다면 **이 파일과 `CLAUDE.md` 를 먼저 읽는다.**
여기는 "어디서부터 시작하나" 만 적는다. 규칙의 본문은 `CLAUDE.md` 에 있다.

---

## 이 프로젝트가 뭔가

빌드 도구 없는 순수 HTML/CSS/JS 코지 연금술 게임 + 세이브용 Express 서버.
채집으로 재료를 모아 물약을 만들고, 마시면 캐릭터가 날씬해진다.

| 항목 | 값 |
|---|---|
| 저장소 | `evachristian/dieter-alchemist` (**비공개**, 기본 브랜치 `main`) |
| 배포 | https://alchemist-production-7583.up.railway.app/ |
| 저장소 종류 | Postgres (`/api/health` 의 `store` 로 확인) |

**모든 코드 주석과 문서는 한국어로 쓴다.**

## 먼저 확인할 것

```bash
git config user.email                                              # 이 저장소만 따로 잡혀 있다
curl -s https://alchemist-production-7583.up.railway.app/api/health # store 가 memory 면 문제다
npm install && npm test
```

`store` 가 `memory(휘발성)` 로 뜨면 **재배포할 때마다 모든 플레이어 세이브가 날아간다.**
`server/README.md` 의 ③-2 (`DATABASE_URL` 참조 변수)를 빠뜨린 상태다.

## 반드시 지킬 것 (본문은 `CLAUDE.md`)

1. **`defaultState()` 기본값을 바꾸면 `SAVE_VER` 를 올리고 `migrate()` 도 같이 쓴다.**
   기본값만 바꾸면 이미 플레이 중인 사람에게는 반영되지 않는다. 이 프로젝트에서 두 번 겪었다
2. **화면을 손댔으면 브라우저 콘솔에서 `await checkUI()` 를 돌린다.** `await` 없이 부르면
   Promise 가 찍혀 0건으로 착각한다. `위반` 이 0건일 때만 커밋한다
3. **잠긴 콘텐츠는 `style.css` 의 공통 블록 하나만 쓴다.** 화면마다 따로 흐리게 만들지 않는다
4. **파일을 고쳤으면 `index.html` 의 `?v=` 캐시 버스터를 일괄로 올린다**
5. **`playerId` 를 다른 것으로 바꾸지 않는다.** 복구 코드가 여기 묶여 있다

정책 문서는 `TEXT_POLICY.md`(글자 색·폰트) 와 `UI_POLICY.md`(탭·가변폭·잠금 표현).
**정책을 바꾸면 `a11y.js` 의 상수도 같이 고친다** — 문서와 검증기는 짝이다.

## 세션을 옮길 때 안 따라오는 것

저장소에 없는 것은 이 셋뿐이고, 셋 다 없어도 작업에 지장이 없다.

- `.claude/settings.local.json` — 권한 허용 목록. 기기마다 달라서 `.gitignore` 에 있다
- 이전 대화 히스토리 — 이 파일과 `CLAUDE.md` 가 대신한다
- Railway 환경변수(`DATABASE_URL`) — Railway 대시보드에만 있다. 저장소에 넣지 않는다

**클라우드 세션에서 주의** — `checkUI()` 는 브라우저에서 돌려야 한다.
환경에 브라우저가 없으면 검증기를 못 돌리므로, 화면을 고치는 작업은
검증기를 돌릴 수 있는 곳에서 한다. 못 돌린 채로 커밋하지 않는다.

## 남은 작업

`CLAUDE.md` 의 **"아직 안 한 것"** 절에 있다. 요약하면:

- 아우라 중 우아함·근성·개성·행운이 수치만 오르고 효과가 연결돼 있지 않다
- 이메일·소셜 로그인 (기존 `playerId` 를 계정에 연결만 하면 진행이 그대로 넘어간다)
- 매력 총합 랭킹 — 서버는 됐고(`GET /api/ranking`) **게임 안 화면이 없다**
- 이모지 아트 → 실제 일러스트 교체
