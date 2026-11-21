# 본능 회피 (Instinct Dodge)

적의 공격 타이밍에 맞춰 회피하는 웹 액션 게임입니다. 회피로 본능 게이지를 채우면 주인공 카이가 각성해 자동으로 반격하고, 적을 쓰러뜨릴수록 더 강한 적이 등장합니다. 자세한 요구사항은 [prd.md](prd.md)를 참고하세요.

- 엔진: Phaser 3 + TypeScript + Vite
- 랭킹: Supabase
- 배포: Vercel
- 캐릭터와 배경은 모두 코드로 그립니다 (`src/art/`). 외부 이미지·음원 파일이 없습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env   # Supabase 값 입력 (없어도 게임은 실행됨, 랭킹만 꺼짐)
npm run dev            # http://localhost:5173
npm test               # 판정·점수·단계 규칙 테스트
npm run build          # 배포용 빌드 (dist/)
```

개발 모드에서는 `http://localhost:5173/?stage=4` 처럼 시작 단계를 지정할 수 있습니다.

## Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. **SQL Editor**에 [supabase/schema.sql](supabase/schema.sql) 내용을 붙여넣고 실행합니다.
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사해 `.env`에 넣습니다.

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> anon 키는 브라우저에 공개되는 키이며, 테이블은 RLS로 "읽기 + 추가"만 허용됩니다. `service_role` 키는 절대 넣지 마세요.

## Vercel 배포

1. [vercel.com/new](https://vercel.com/new)에서 이 GitHub 저장소를 Import 합니다.
2. Framework Preset은 **Vite**로 자동 인식됩니다 (Build: `npm run build`, Output: `dist`).
3. **Environment Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 추가하고 Deploy.
4. 이후 `main` 브랜치에 푸시하면 자동 배포되고, PR마다 미리보기 URL이 생성됩니다.

## 폴더 구조

```
src/
  art/       캐릭터(관절 포즈)·배경 그리기
  game/      규칙 상수, 판정/점수, 공격 패턴 (+ 테스트)
  lib/       Supabase, 효과음(WebAudio), localStorage
  scenes/    Boot → Title → Game (+Pause) → GameOver
  ui/        버튼, HTML 오버레이(닉네임·랭킹·조작법)
supabase/    DB 스키마
```
