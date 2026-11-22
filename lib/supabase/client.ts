// 브라우저용 Supabase 클라이언트. 환경 변수가 없으면 null (오프라인 모드로 동작).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const CLOUD_CONFIGURED = !!(URL && ANON_KEY);

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client === undefined) {
    client = CLOUD_CONFIGURED
      ? createClient(URL!, ANON_KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
      : null;
  }
  return client;
}
