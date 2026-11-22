// 클라우드 기능: 익명 로그인, 이메일 연결/로그인, 닉네임, 저장 동기화, 랭킹.
// Supabase 환경 변수가 없거나 연결에 실패하면 status가 "offline"/"error"가 되고 게임은 로컬로만 동작한다.
import { create } from "zustand";
import type { RunSubmission } from "@/lib/server/verify";
import { importSave, peekSave, setSaveSink, type SaveData } from "@/lib/store/save";
import { CLOUD_CONFIGURED, getSupabase } from "./client";

export type CloudStatus = "offline" | "connecting" | "guest" | "linked" | "error";

interface CloudState {
  status: CloudStatus;
  userId: string | null;
  email: string | null;
  nickname: string | null;
  message: string | null;
}

export const useCloud = create<CloudState>()(() => ({
  status: CLOUD_CONFIGURED ? "connecting" : "offline",
  userId: null,
  email: null,
  nickname: null,
  message: null,
}));

const NICK_KEY = "tower-rpg-nickname";

function setMsg(message: string | null) {
  useCloud.setState({ message });
}

// ---- 세션 ----

let started = false;

/** 앱 시작 시 한 번 호출 */
export async function initCloud() {
  if (started) return;
  started = true;
  try {
    const local = window.localStorage.getItem(NICK_KEY);
    if (local) useCloud.setState({ nickname: local });
  } catch {
    // 무시
  }
  const sb = getSupabase();
  if (!sb) return;

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
      applyUser(session?.user ?? null);
      if (event === "SIGNED_IN") void afterSignIn();
    }
  });

  const { data } = await sb.auth.getSession();
  if (data.session) {
    applyUser(data.session.user);
  } else {
    const { data: anon, error } = await sb.auth.signInAnonymously();
    if (error || !anon.user) {
      useCloud.setState({ status: "error", message: "클라우드 연결 실패: 익명 로그인이 꺼져 있거나 네트워크 오류입니다." });
      return;
    }
    applyUser(anon.user);
  }
  setSaveSink({ onWrite: queuePush, onClear: () => void deleteCloudSave() });
  await afterSignIn();
}

function applyUser(user: { id: string; email?: string | null; is_anonymous?: boolean } | null) {
  if (!user) return;
  const email = user.email || null;
  useCloud.setState({
    userId: user.id,
    email,
    status: user.is_anonymous === false || email ? "linked" : "guest",
  });
}

async function afterSignIn() {
  await Promise.all([loadNickname(), pullSave()]);
}

// ---- 저장 동기화 ----

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pending: SaveData | null = null;

function queuePush(data: SaveData) {
  pending = data;
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const d = pending;
    pending = null;
    if (d) void pushSave(d);
  }, 1500);
}

async function pushSave(data: SaveData) {
  const sb = getSupabase();
  const userId = useCloud.getState().userId;
  if (!sb || !userId) return;
  await sb.from("saves").upsert({ user_id: userId, data, saved_at: data.savedAt });
}

async function deleteCloudSave() {
  const sb = getSupabase();
  const userId = useCloud.getState().userId;
  if (!sb || !userId) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
    pending = null;
  }
  await sb.from("saves").delete().eq("user_id", userId);
}

/** 클라우드 저장이 로컬보다 새로우면 로컬로 가져온다 */
export async function pullSave() {
  const sb = getSupabase();
  const userId = useCloud.getState().userId;
  if (!sb || !userId) return;
  const { data, error } = await sb.from("saves").select("data, saved_at").eq("user_id", userId).maybeSingle();
  if (error || !data) return;
  const local = peekSave();
  if (!local || (data.saved_at as number) > local.savedAt) importSave(data.data as SaveData);
}

// ---- 계정 ----

/** 지금 게스트 계정에 이메일을 연결 (확인 메일의 링크를 누르면 완료) */
export async function linkEmail(email: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: window.location.origin });
  setMsg(error ? `연결 실패: ${error.message}` : `${email}로 확인 메일을 보냈습니다. 메일의 링크를 누르면 연결됩니다.`);
}

/** 이미 이메일이 연결된 계정으로 이 기기에서 로그인 (로그인 링크 메일 발송) */
export async function loginEmail(email: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
  });
  setMsg(
    error
      ? `로그인 실패: ${error.message}`
      : `${email}로 로그인 링크를 보냈습니다. 이 기기에서 메일의 링크를 열어 주세요.`,
  );
}

export async function logout() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  started = false;
  useCloud.setState({ userId: null, email: null, status: "connecting", message: null });
  await initCloud();
}

// ---- 닉네임 ----

async function loadNickname() {
  const sb = getSupabase();
  const userId = useCloud.getState().userId;
  if (!sb || !userId) return;
  const { data } = await sb.from("profiles").select("nickname").eq("id", userId).maybeSingle();
  if (data?.nickname) {
    useCloud.setState({ nickname: data.nickname as string });
    try {
      window.localStorage.setItem(NICK_KEY, data.nickname as string);
    } catch {
      // 무시
    }
  }
}

export async function saveNickname(raw: string): Promise<boolean> {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 16) {
    setMsg("닉네임은 1~16자로 정해 주세요.");
    return false;
  }
  useCloud.setState({ nickname: name });
  try {
    window.localStorage.setItem(NICK_KEY, name);
  } catch {
    // 무시
  }
  const sb = getSupabase();
  const userId = useCloud.getState().userId;
  if (sb && userId) {
    const { error } = await sb.from("profiles").upsert({ id: userId, nickname: name, updated_at: new Date().toISOString() });
    if (error) {
      setMsg(`닉네임 저장 실패: ${error.message}`);
      return false;
    }
  }
  setMsg(null);
  return true;
}

// ---- 랭킹 ----

export interface LeaderboardRow {
  nickname: string;
  score: number;
  floors_cleared: number;
  cleared: boolean;
  party: string[];
  total_turns: number;
  created_at: string;
}

export async function fetchLeaderboard(limit = 50): Promise<{ rows: LeaderboardRow[]; error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { rows: [], error: "클라우드가 연결되어 있지 않습니다." };
  const { data, error } = await sb
    .from("leaderboard")
    .select("nickname, score, floors_cleared, cleared, party, total_turns, created_at")
    .order("score", { ascending: false })
    .order("total_turns", { ascending: true })
    .limit(limit);
  return { rows: (data ?? []) as LeaderboardRow[], error: error ? error.message : null };
}

export async function submitRun(sub: RunSubmission): Promise<{ ok: boolean; message: string; rank?: number; score?: number }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: "클라우드가 연결되어 있지 않습니다." };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "로그인 정보가 없습니다. 새로고침 후 다시 시도해 주세요." };
  try {
    const res = await fetch("/api/runs/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(sub),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string; rank?: number; score?: number };
    if (!res.ok || !body.ok) return { ok: false, message: body.error ?? `등록 실패 (${res.status})` };
    return { ok: true, message: "랭킹에 등록되었습니다!", rank: body.rank, score: body.score };
  } catch {
    return { ok: false, message: "서버에 연결할 수 없습니다." };
  }
}
