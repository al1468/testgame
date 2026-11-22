// 랭킹 등록 검증 (서버 전용). 클라이언트가 보낸 점수는 쓰지 않고, 기록을 재생해서 직접 계산한다.
import { isValidSummon, runSeedFor } from "@/lib/engine/gacha";
import { replayRun, type RunAction } from "@/lib/engine/replay";
import { floorsCleared, runScore } from "@/lib/engine/run";

export interface RunSubmission {
  version: 1;
  summonSeed: string;
  pulls: number;
  party: string[];
  log: RunAction[];
  nickname: string;
}

export interface VerifiedRun {
  seed: string;
  nickname: string;
  score: number;
  floors_cleared: number;
  cleared: boolean;
  party: string[];
  kills: { normal: number; elite: number; boss: number };
  total_turns: number;
}

export class SubmissionError extends Error {}

export function normalizeNickname(raw: unknown): string {
  if (typeof raw !== "string") throw new SubmissionError("닉네임이 필요합니다.");
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 16) throw new SubmissionError("닉네임은 1~16자여야 합니다.");
  return name;
}

export function verifySubmission(body: unknown): VerifiedRun {
  const sub = body as Partial<RunSubmission>;
  if (!sub || sub.version !== 1) throw new SubmissionError("지원하지 않는 기록 형식입니다.");
  if (typeof sub.summonSeed !== "string" || sub.summonSeed.length < 4 || sub.summonSeed.length > 100) {
    throw new SubmissionError("소환 기록이 올바르지 않습니다.");
  }
  if (!Array.isArray(sub.party) || !sub.party.every((x) => typeof x === "string")) {
    throw new SubmissionError("파티 기록이 올바르지 않습니다.");
  }
  if (!Array.isArray(sub.log)) throw new SubmissionError("행동 기록이 없습니다.");
  const nickname = normalizeNickname(sub.nickname);

  if (!isValidSummon(sub.summonSeed, sub.pulls ?? 0, sub.party)) {
    throw new SubmissionError("소환 결과가 기록과 일치하지 않습니다.");
  }

  const seed = runSeedFor(sub.summonSeed);
  let run;
  try {
    run = replayRun(seed, sub.party, sub.log);
  } catch {
    throw new SubmissionError("행동 기록을 재생할 수 없습니다. (규칙에 맞지 않는 기록)");
  }
  if (run.status === "ongoing") throw new SubmissionError("아직 끝나지 않은 런입니다.");

  return {
    seed,
    nickname,
    score: runScore(run),
    floors_cleared: floorsCleared(run),
    cleared: run.status === "cleared",
    party: sub.party,
    kills: run.kills,
    total_turns: run.totalTurns,
  };
}
