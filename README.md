# 탑 등반 RPG (가제)

탑을 한 층씩 오르는 로그라이크 턴제 RPG. 4인 파티를 소환하고, 속도 기반 턴 게이지 전투에서 스킬과 속성 상성을 조합해 1~10층을 돌파한다.

- 기획: [prd.md](prd.md)
- 스택: Next.js (App Router) · TypeScript · Tailwind CSS · Zustand · Vitest · Vercel

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 엔진·런·저장 테스트
npm run build    # 배포용 빌드
npm run rank     # 캐릭터 랭크 재계산 (자동 플레이 시뮬레이션, 10분 이상 걸림) → data/tiers.json
```

## 구조

| 경로 | 내용 |
|---|---|
| `lib/engine/` | 전투 엔진(턴 게이지·스킬·상태 효과·상성), 런·맵·가챠 로직. 화면과 분리된 순수 TypeScript, 시드 기반 재현 가능 |
| `lib/store/` | 화면 상태(Zustand), 자동 저장·이어하기(localStorage) |
| `data/` | 캐릭터·적·층·유물·이벤트·랭크 데이터 |
| `components/game/` | 화면 (타이틀, 소환, 도감, 지도, 전투) |
| `tests/` | Vitest 테스트, 자동 플레이 헬퍼 |
| `tools/rank.test.ts` | 캐릭터 랭크 계산 도구 |

## 배포

GitHub `main` 브랜치를 Vercel 프로젝트에 연결하면 push할 때마다 자동 배포된다.

### Supabase (클라우드 저장·랭킹)

1. SQL Editor에서 [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql) 실행
2. Authentication → Sign In / Providers → **Allow anonymous sign-ins** 켜기
3. Authentication → URL Configuration → Site URL에 배포 주소, Redirect URLs에 `http://localhost:3000` 추가
4. 환경 변수 (로컬은 `.env.local`, 배포는 Vercel → Settings → Environment Variables). 형식은 [.env.example](.env.example)

| 이름 | 공개 여부 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저에 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저에 공개 (RLS로 보호) |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** — 랭킹 등록 API(`/api/runs/submit`)만 사용. 절대 `NEXT_PUBLIC_` 붙이지 않기 |

환경 변수가 없으면 게임은 로컬 저장만으로 동작한다 (오프라인 모드).

랭킹 등록은 클라이언트가 보낸 점수를 믿지 않는다. 소환 시드 + 행동 기록을 서버가 같은 엔진으로 재생해 점수를 직접 계산한다 ([lib/server/verify.ts](lib/server/verify.ts)).
