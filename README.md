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

GitHub `main` 브랜치를 Vercel 프로젝트에 연결하면 push할 때마다 자동 배포된다. 현재는 환경 변수가 필요 없다 (Supabase 연동은 다음 단계).
