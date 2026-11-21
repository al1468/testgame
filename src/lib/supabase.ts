import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface GameResult {
  nickname: string;
  score: number;
  enemiesDefeated: number;
  maxCombo: number;
  stageReached: number;
  durationMs: number;
}

export interface ScoreRow {
  id: string;
  nickname: string;
  score: number;
  enemies_defeated: number;
  max_combo: number;
  stage_reached: number;
  created_at: string;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const client: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

export const rankingEnabled = client !== null;

const TABLE = 'scores';

/** 점수를 저장하고 새 행의 id를 돌려준다. */
export async function saveScore(r: GameResult): Promise<string> {
  if (!client) throw new Error('랭킹 서버가 설정되지 않았습니다.');
  const { data, error } = await client
    .from(TABLE)
    .insert({
      nickname: r.nickname,
      score: r.score,
      enemies_defeated: r.enemiesDefeated,
      max_combo: r.maxCombo,
      stage_reached: r.stageReached,
      play_duration_ms: Math.max(1, Math.round(r.durationMs)),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

/** 내 점수보다 높은 기록 수 + 1 */
export async function fetchRank(score: number): Promise<number> {
  if (!client) throw new Error('랭킹 서버가 설정되지 않았습니다.');
  const { count, error } = await client
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .gt('score', score);
  if (error) throw error;
  return (count ?? 0) + 1;
}

export async function fetchTop(limit = 50): Promise<ScoreRow[]> {
  if (!client) throw new Error('랭킹 서버가 설정되지 않았습니다.');
  const { data, error } = await client
    .from(TABLE)
    .select('id,nickname,score,enemies_defeated,max_combo,stage_reached,created_at')
    .order('score', { ascending: false })
    .order('enemies_defeated', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as ScoreRow[];
}
