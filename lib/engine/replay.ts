// 런 재생: 시드 + 시작 파티 + 행동 기록만으로 런 전체를 처음부터 다시 계산한다.
// 서버는 이걸로 클라이언트가 보낸 점수를 믿지 않고 직접 계산한다 (점수 조작 방지).
import { act, advance, chooseAutoAction, createBattle, getUnit } from "./battle";
import * as Run from "./run";
import type { Action, BattleState } from "./types";

/** 런에서 플레이어가 한 행동 (적 행동은 AI가 결정적으로 정하므로 기록하지 않음) */
export type RunAction =
  | { t: "node"; id: string }
  | { t: "battle"; actions: Action[] } // 그 전투에서 아군이 한 행동 순서대로
  | { t: "rest_heal" }
  | { t: "rest_train"; i: number }
  | { t: "buy"; i: number }
  | { t: "recruit"; id: string; replace?: number }
  | { t: "event"; i: number }
  | { t: "leave" };

const MAX_LOG = 5000;
const MAX_BATTLE_TURNS = 1000;

/** 아군 행동 목록대로 전투를 끝까지 진행. 행동이 모자라거나 남거나 규칙에 어긋나면 오류 */
export function playBattle(start: BattleState, allyActions: Action[]): BattleState {
  let s = start;
  let i = 0;
  while (s.outcome === "ongoing") {
    if (s.turnCount > MAX_BATTLE_TURNS) throw new Error("battle too long");
    s = advance(s).state;
    if (s.outcome !== "ongoing") break;
    const actor = getUnit(s, s.activeUid!);
    if (actor.side === "ally") {
      const a = allyActions[i++];
      if (!a) throw new Error("missing ally action");
      s = act(s, a).state;
    } else {
      s = act(s, chooseAutoAction(s)).state;
    }
  }
  if (i !== allyActions.length) throw new Error("extra ally actions");
  return s;
}

export function replayRun(seed: string, partyIds: string[], log: RunAction[]): Run.RunState {
  if (log.length > MAX_LOG) throw new Error("log too long");
  let run = Run.createRun(seed, partyIds);
  for (const a of log) {
    if (run.status !== "ongoing") throw new Error("actions after run ended");
    switch (a.t) {
      case "node":
        run = Run.enterNode(run, a.id);
        break;
      case "battle": {
        const node = Run.currentNode(run);
        if (!node || !Run.isBattleNode(node.kind) || run.nodeDone) throw new Error("not in a battle");
        const end = playBattle(createBattle(Run.nodeBattleSetup(run)), a.actions);
        run = Run.finishBattle(run, end).run;
        break;
      }
      case "rest_heal":
        run = Run.restHeal(run);
        break;
      case "rest_train":
        run = Run.restTrain(run, a.i);
        break;
      case "buy":
        run = Run.buyOffer(run, a.i);
        break;
      case "recruit":
        run = Run.recruit(run, a.id, a.replace);
        break;
      case "event":
        run = Run.chooseEventOption(run, a.i);
        break;
      case "leave":
        run = Run.leaveNode(run);
        break;
      default:
        throw new Error("unknown action");
    }
  }
  return run;
}
