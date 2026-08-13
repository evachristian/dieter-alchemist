# 다이어터 연금술사

코지 연금술 게임 + 세이브 서버.

- 게임 소스와 배포 안내: [`dieter-alchemist/`](dieter-alchemist/)
- 서버 배포(Railway): [`dieter-alchemist/server/README.md`](dieter-alchemist/server/README.md)

## 바로 실행

```bash
cd dieter-alchemist
npm install
npm start          # http://localhost:8080
```

## Railway 설정

| 항목 | 값 |
|---|---|
| Root Directory | `dieter-alchemist` |
| Start Command | `npm start` |
| 변수 | `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` |
