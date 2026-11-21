-- 본능 회피 (Instinct Dodge) 점수 테이블
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

create table if not exists public.scores (
  id               uuid primary key default gen_random_uuid(),
  nickname         text not null check (char_length(btrim(nickname)) between 2 and 12),
  score            integer not null check (score >= 0 and score <= 10000000),
  enemies_defeated integer not null check (enemies_defeated >= 0),
  max_combo        integer not null check (max_combo >= 0),
  stage_reached    integer not null check (stage_reached >= 1),
  play_duration_ms integer not null check (play_duration_ms > 0),
  created_at       timestamptz not null default now(),
  -- 치팅 완화: 플레이 1초당 5,000점을 넘을 수 없음
  constraint score_rate check (score <= play_duration_ms::bigint * 5)
);

create index if not exists scores_rank_idx
  on public.scores (score desc, enemies_defeated desc, created_at asc);

alter table public.scores enable row level security;

drop policy if exists "anyone can read scores" on public.scores;
create policy "anyone can read scores"
  on public.scores for select
  to anon, authenticated
  using (true);

drop policy if exists "anyone can insert scores" on public.scores;
create policy "anyone can insert scores"
  on public.scores for insert
  to anon, authenticated
  with check (true);

-- update / delete 정책이 없으므로 클라이언트에서 수정·삭제할 수 없습니다.
