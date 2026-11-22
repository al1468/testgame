-- 탑 등반 RPG: 초기 스키마
-- Supabase 대시보드 → SQL Editor에 전체를 붙여 넣고 Run. (여러 번 실행해도 안전하게 작성)

-- ---------- 프로필 (랭킹 닉네임) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 16),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: 누구나 읽기" on public.profiles;
create policy "profiles: 누구나 읽기" on public.profiles for select using (true);

drop policy if exists "profiles: 본인만 생성" on public.profiles;
create policy "profiles: 본인만 생성" on public.profiles for insert with check ((select auth.uid()) = id);

drop policy if exists "profiles: 본인만 수정" on public.profiles;
create policy "profiles: 본인만 수정" on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------- 이어하기 저장 (유저당 1개) ----------
create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  saved_at bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "saves: 본인만 읽기" on public.saves;
create policy "saves: 본인만 읽기" on public.saves for select using ((select auth.uid()) = user_id);

drop policy if exists "saves: 본인만 생성" on public.saves;
create policy "saves: 본인만 생성" on public.saves for insert with check ((select auth.uid()) = user_id);

drop policy if exists "saves: 본인만 수정" on public.saves;
create policy "saves: 본인만 수정" on public.saves for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "saves: 본인만 삭제" on public.saves;
create policy "saves: 본인만 삭제" on public.saves for delete using ((select auth.uid()) = user_id);

-- ---------- 끝난 런 기록 / 랭킹 ----------
-- 쓰기 정책이 없으므로 클라이언트는 insert 불가. 서버(/api/runs/submit)가 검증 후 service_role 키로만 저장.
create table if not exists public.run_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 16),
  score integer not null check (score >= 0),
  floors_cleared integer not null check (floors_cleared between 0 and 10),
  cleared boolean not null,
  party jsonb not null,
  kills jsonb not null,
  total_turns integer not null,
  seed text not null unique, -- 같은 런은 한 번만 등록
  created_at timestamptz not null default now()
);

create index if not exists run_records_score_idx on public.run_records (score desc, total_turns asc);
create index if not exists run_records_user_idx on public.run_records (user_id);

alter table public.run_records enable row level security;

drop policy if exists "run_records: 누구나 읽기" on public.run_records;
create policy "run_records: 누구나 읽기" on public.run_records for select using (true);

-- 플레이어별 최고 기록 (동점이면 턴 수가 적은 기록)
create or replace view public.leaderboard
with (security_invoker = true) as
select distinct on (user_id)
  id, user_id, nickname, score, floors_cleared, cleared, party, total_turns, created_at
from public.run_records
order by user_id, score desc, total_turns asc, created_at asc;

grant select on public.leaderboard to anon, authenticated;
