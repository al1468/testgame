// POST /api/runs/submit — 랭킹 등록.
// 1) 요청의 Supabase 토큰으로 사용자 확인  2) 기록을 재생해 점수를 서버가 직접 계산
// 3) service_role 키로만 run_records에 저장 (클라이언트는 이 테이블에 쓸 수 없음)
import { createClient } from "@supabase/supabase-js";
import { SubmissionError, verifySubmission } from "@/lib/server/verify";

const MAX_BODY_BYTES = 1_000_000;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ ok: false, error: "서버 설정이 아직 안 되어 있습니다. (SUPABASE_SERVICE_ROLE_KEY)" }, 503);
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "로그인이 필요합니다." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ ok: false, error: "로그인 정보가 올바르지 않습니다." }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: "기록이 너무 큽니다." }, 413);

  let verified;
  try {
    verified = verifySubmission(JSON.parse(raw));
  } catch (e) {
    const message = e instanceof SubmissionError ? e.message : "기록 형식이 올바르지 않습니다.";
    return json({ ok: false, error: message }, 400);
  }

  await admin.from("profiles").upsert({ id: user.id, nickname: verified.nickname, updated_at: new Date().toISOString() });

  const { error: insertError } = await admin.from("run_records").insert({ user_id: user.id, ...verified });
  if (insertError) {
    if (insertError.code === "23505") return json({ ok: false, error: "이미 등록된 런입니다." }, 409);
    return json({ ok: false, error: `저장 실패: ${insertError.message}` }, 500);
  }

  // 순위: 각 플레이어 최고 기록 기준으로 나보다 점수가 높은 사람 수 + 1
  const { count } = await admin
    .from("leaderboard")
    .select("user_id", { count: "exact", head: true })
    .gt("score", verified.score);

  return json({ ok: true, score: verified.score, rank: (count ?? 0) + 1 });
}
