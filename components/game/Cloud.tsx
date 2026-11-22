"use client";

// 클라우드 관련 화면 조각: 계정 패널(타이틀), 랭킹 화면, 랭킹 등록 패널(결과 창)
import { useEffect, useState } from "react";
import { getUnitDef } from "@/data";
import { TIER_STYLE } from "@/data/tiers";
import { tierOf } from "@/lib/engine/gacha";
import {
  fetchLeaderboard,
  linkEmail,
  loginEmail,
  logout,
  saveNickname,
  submitRun,
  useCloud,
  type LeaderboardRow,
} from "@/lib/supabase/cloud";
import { useGame } from "@/lib/store/game";
import { Portrait } from "./common";

const STATUS_TEXT = {
  offline: "오프라인 (이 브라우저에만 저장)",
  connecting: "클라우드 연결 중…",
  guest: "게스트 계정 · 이 기기에서만 이어하기",
  linked: "계정 연결됨 · 다른 기기에서도 이어하기",
  error: "클라우드 연결 실패 (로컬 저장만 동작)",
} as const;

// ---- 타이틀: 계정 패널 ----

export function AccountPanel() {
  const { status, email, nickname, message } = useCloud();
  const [nick, setNick] = useState(nickname ?? "");
  const [mail, setMail] = useState("");
  const [open, setOpen] = useState(false);
  const online = status === "guest" || status === "linked";

  return (
    <div className="system-panel w-full max-w-sm p-3 text-left text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className={online ? "text-emerald-300" : "text-slate-400"}>☁ {STATUS_TEXT[status]}</span>
        {online && (
          <button type="button" className="btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? "닫기" : "계정"}
          </button>
        )}
      </div>
      {email && <p className="mt-1 text-slate-400">{email}</p>}
      {nickname && !open && <p className="mt-1 text-slate-300">닉네임: {nickname}</p>}

      {open && online && (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-slate-400">랭킹 닉네임 (1~16자)</span>
            <div className="mt-1 flex gap-2">
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                maxLength={16}
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                placeholder={nickname ?? "닉네임"}
              />
              <button type="button" className="btn-sm" onClick={() => void saveNickname(nick || nickname || "")}>
                저장
              </button>
            </div>
          </label>

          <div>
            <span className="text-slate-400">
              {status === "guest"
                ? "이메일을 연결하면 다른 기기에서도 이 계정으로 이어할 수 있어요."
                : "다른 이메일 계정으로 바꾸려면 로그아웃 후 로그인하세요."}
            </span>
            <div className="mt-1 flex gap-2">
              <input
                type="email"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {status === "guest" && (
                <button type="button" className="btn-sm btn-on" disabled={!mail} onClick={() => void linkEmail(mail)}>
                  이 계정에 이메일 연결
                </button>
              )}
              <button type="button" className="btn-sm" disabled={!mail} onClick={() => void loginEmail(mail)}>
                이메일 계정으로 로그인
              </button>
              {status === "linked" && (
                <button type="button" className="btn-sm" onClick={() => void logout()}>
                  로그아웃
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {message && <p className="mt-2 text-amber-300">{message}</p>}
    </div>
  );
}

// ---- 랭킹 화면 ----

export function RankingScreen() {
  const goTo = useGame((s) => s.goTo);
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchLeaderboard(50).then((r) => {
      if (!alive) return;
      setRows(r.rows);
      setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-cyan-300">[ SYSTEM ] 탑 등반 기록</p>
          <h1 className="text-2xl font-bold">랭킹</h1>
          <p className="mt-1 text-sm text-slate-400">플레이어별 최고 점수 · 동점이면 적은 턴 순 · 서버가 기록을 재생해 검증한 점수만 표시</p>
        </div>
        <button type="button" className="btn-sm" onClick={() => goTo("title")}>
          뒤로
        </button>
      </div>
      {error && <p className="text-sm text-rose-300">불러오기 실패: {error}</p>}
      {!rows && !error && <p className="text-sm text-slate-400">불러오는 중…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate-400">아직 등록된 기록이 없습니다. 첫 기록의 주인공이 되어 보세요!</p>}
      {rows && rows.length > 0 && (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={`${r.nickname}-${r.created_at}`} className="system-panel flex flex-wrap items-center gap-3 px-3 py-2">
              <span className={`w-8 text-center text-lg font-black ${i === 0 ? "text-amber-300" : i < 3 ? "text-slate-200" : "text-slate-500"}`}>
                {i + 1}
              </span>
              <div className="min-w-24 flex-1">
                <div className="font-semibold">{r.nickname}</div>
                <div className="text-xs text-slate-400">
                  {r.cleared ? "🏆 탑 정복" : `${r.floors_cleared}층 돌파`} · {r.total_turns}턴
                </div>
              </div>
              <div className="flex gap-1">
                {r.party.map((id) => {
                  let def;
                  try {
                    def = getUnitDef(id);
                  } catch {
                    return null;
                  }
                  return (
                    <div key={id} className="relative" title={`${def.name} (${tierOf(id)})`}>
                      <Portrait def={def} size="sm" />
                      <span className={`absolute -bottom-1 -left-1 rounded px-1 text-[9px] font-black ${TIER_STYLE[tierOf(id)]}`}>
                        {tierOf(id)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <span className="w-24 text-right text-lg font-bold text-cyan-200">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

// ---- 결과 창: 랭킹 등록 ----

export function SubmitRunPanel() {
  const { status, nickname } = useCloud();
  const runMeta = useGame((s) => s.runMeta);
  const runLog = useGame((s) => s.runLog);
  const goTo = useGame((s) => s.goTo);
  const [nick, setNick] = useState(nickname ?? "");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  if (status === "offline" || status === "error") {
    return <p className="mt-3 text-xs text-slate-500">클라우드에 연결되지 않아 랭킹 등록을 할 수 없습니다.</p>;
  }
  if (!runMeta) {
    return <p className="mt-3 text-xs text-slate-500">소환으로 시작한 런만 랭킹에 등록할 수 있습니다.</p>;
  }

  const submit = async () => {
    const name = (nick || nickname || "").trim();
    if (!name) {
      setMsg("닉네임을 입력해 주세요.");
      return;
    }
    setState("sending");
    if (name !== nickname) await saveNickname(name);
    const res = await submitRun({
      version: 1,
      summonSeed: runMeta.summonSeed,
      pulls: runMeta.pulls,
      party: runMeta.party,
      log: runLog,
      nickname: name,
    });
    setState(res.ok ? "done" : "error");
    setMsg(res.ok ? `등록 완료! 현재 ${res.rank}위 (검증된 점수 ${res.score?.toLocaleString()})` : res.message);
  };

  return (
    <div className="mt-4 rounded-md border border-cyan-500/30 p-3 text-left text-sm">
      <div className="font-semibold text-cyan-200">랭킹 등록</div>
      {state !== "done" && (
        <div className="mt-2 flex gap-2">
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            maxLength={16}
            placeholder="닉네임 (1~16자)"
            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1"
          />
          <button type="button" className="btn-sm btn-on" disabled={state === "sending"} onClick={() => void submit()}>
            {state === "sending" ? "검증 중…" : "등록"}
          </button>
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${state === "done" ? "text-emerald-300" : "text-amber-300"}`}>{msg}</p>}
      {state === "done" && (
        <button type="button" className="btn-sm mt-2" onClick={() => goTo("ranking")}>
          랭킹 보기
        </button>
      )}
    </div>
  );
}
