import { describe, expect, it } from "vitest";
import { rollParty, runSeedFor, isValidSummon } from "@/lib/engine/gacha";
import { replayRun } from "@/lib/engine/replay";
import { runScore } from "@/lib/engine/run";
import { SubmissionError, verifySubmission, type RunSubmission } from "@/lib/server/verify";
import { autoplayWithLog } from "./autoplay";

/** 진짜 소환 → 자동 플레이로 끝까지 → 제출 데이터 */
function honestSubmission(tag: string): { sub: RunSubmission; score: number } {
  const summonSeed = `summon-${tag}`;
  const pulls = 2;
  const party = rollParty(`${summonSeed}-${pulls}`);
  const { run, log } = autoplayWithLog(runSeedFor(summonSeed), party);
  return { sub: { version: 1, summonSeed, pulls, party, log, nickname: "테스터" }, score: runScore(run) };
}

describe("런 재생", () => {
  it("행동 기록을 재생하면 자동 플레이와 완전히 같은 결과", () => {
    const party = ["knight", "priest", "bard", "assassin"];
    const { run, log } = autoplayWithLog("replay-1", party);
    expect(replayRun("replay-1", party, log)).toEqual(run);
  });

  it("기록이 하나라도 틀리면 재생 실패", () => {
    const party = ["mage", "doctor", "bodyguard", "hexer"];
    const { log } = autoplayWithLog("replay-2", party);
    const battleIdx = log.findIndex((a) => a.t === "battle" && a.actions.length > 2);
    const tampered = structuredClone(log);
    const b = tampered[battleIdx];
    if (b.t !== "battle") throw new Error("setup");
    b.actions.pop(); // 행동 하나 빼기
    expect(() => replayRun("replay-2", party, tampered)).toThrow();
    expect(() => replayRun("replay-2", party, [{ t: "node", id: "3-0" }])).toThrow(); // 갈 수 없는 노드
  });
});

describe("랭킹 제출 검증", () => {
  it("정직한 기록은 통과하고 서버가 계산한 점수가 나온다", () => {
    const { sub, score } = honestSubmission("ok");
    const v = verifySubmission(sub);
    expect(v.score).toBe(score);
    expect(v.nickname).toBe("테스터");
    expect(v.seed).toBe(runSeedFor(sub.summonSeed));
  });

  it("소환 결과를 바꿔치기하면 거부", () => {
    const { sub } = honestSubmission("swap");
    const fake = { ...sub, party: ["healer_saint", ...sub.party.slice(1)] };
    expect(() => verifySubmission(fake)).toThrow(SubmissionError);
    expect(isValidSummon(sub.summonSeed, 9, sub.party)).toBe(false); // 재소환 횟수 초과
  });

  it("끝나지 않은 런, 조작된 기록, 잘못된 닉네임은 거부", () => {
    const { sub } = honestSubmission("bad");
    expect(() => verifySubmission({ ...sub, log: sub.log.slice(0, 3) })).toThrow(/끝나지 않은|재생/);
    const tampered = structuredClone(sub);
    const b = tampered.log.find((a) => a.t === "battle");
    if (b?.t === "battle") b.actions[0] = { skillId: "nonexistent" };
    expect(() => verifySubmission(tampered)).toThrow(SubmissionError);
    expect(() => verifySubmission({ ...sub, nickname: "" })).toThrow(SubmissionError);
    expect(() => verifySubmission({ ...sub, nickname: "x".repeat(17) })).toThrow(SubmissionError);
    expect(() => verifySubmission({ ...sub, version: 2 })).toThrow(SubmissionError);
  });
});
