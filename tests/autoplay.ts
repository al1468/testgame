// 테스트·밸런스용 자동 플레이: 맵 선택부터 전투까지 런을 끝까지 진행한다.
import { act, advance, chooseAutoAction, createBattle, getUnit, type Action } from "@/lib/engine";
import type { RunAction } from "@/lib/engine/replay";
import { nextRandom } from "@/lib/engine/rng";
import {
  buyOffer,
  chooseEventOption,
  createRun,
  currentNode,
  enterNode,
  finishBattle,
  isBattleNode,
  leaveNode,
  maxHpOf,
  nodeBattleSetup,
  nodeEvent,
  reachableNodeIds,
  recruit,
  recruitCandidates,
  restHeal,
  restTrain,
  shopOffers,
  type RunState,
} from "@/lib/engine/run";
import { PARTY_SIZE } from "@/data/companions";

function hpRatio(run: RunState) {
  return run.members.reduce((s, m) => s + m.hp / maxHpOf(m), 0) / run.members.length;
}

export function autoplayRun(seed: string, partyIds: string[]): RunState {
  return autoplayWithLog(seed, partyIds).run;
}

/** 자동 플레이 + 서버 재생용 행동 기록 */
export function autoplayWithLog(seed: string, partyIds: string[]): { run: RunState; log: RunAction[] } {
  const log: RunAction[] = [];
  let run = createRun(seed, partyIds);
  let r = 1;
  const pick = () => {
    const [v, s] = nextRandom(r + run.floor * 7919 + run.visited.length * 31 + seed.length);
    r = s;
    return v;
  };
  for (let guard = 0; guard < 500 && run.status === "ongoing"; guard++) {
    const options = reachableNodeIds(run);
    if (options.length === 0) throw new Error("stuck: no reachable nodes");
    const nodeId = options[Math.floor(pick() * options.length)];
    run = enterNode(run, nodeId);
    log.push({ t: "node", id: nodeId });
    const node = currentNode(run)!;
    if (isBattleNode(node.kind)) {
      let s = createBattle(nodeBattleSetup(run));
      const actions: Action[] = [];
      while (s.outcome === "ongoing") {
        s = advance(s).state;
        if (s.outcome !== "ongoing") break;
        const a = chooseAutoAction(s);
        if (getUnit(s, s.activeUid!).side === "ally") actions.push(a);
        s = act(s, a).state;
      }
      log.push({ t: "battle", actions });
      run = finishBattle(run, s).run;
      continue;
    }
    switch (node.kind) {
      case "rest":
        if (hpRatio(run) < 0.7 || run.members.some((m) => m.hp <= 0)) {
          run = restHeal(run);
          log.push({ t: "rest_heal" });
        } else {
          run = restTrain(run, 0);
          log.push({ t: "rest_train", i: 0 });
        }
        break;
      case "shop": {
        const offers = shopOffers(run);
        offers.forEach((o, i) => {
          const want =
            (o.kind === "heal" && hpRatio(run) < 0.6) ||
            (o.kind === "revive" && run.members.some((m) => m.hp <= 0)) ||
            o.kind === "relic" ||
            o.kind === "train";
          if (want && run.gold >= o.price) {
            run = buyOffer(run, i);
            log.push({ t: "buy", i });
          }
        });
        run = leaveNode(run);
        log.push({ t: "leave" });
        break;
      }
      case "recruit": {
        const c = recruitCandidates(run)[0];
        if (c && run.members.length < PARTY_SIZE) {
          run = recruit(run, c.id);
          log.push({ t: "recruit", id: c.id });
        } else {
          run = leaveNode(run);
          log.push({ t: "leave" });
        }
        break;
      }
      case "event": {
        const ev = nodeEvent(run);
        const idx = ev.choices.findIndex((c) => !c.requiresGold || run.gold >= c.requiresGold);
        run = chooseEventOption(run, idx);
        log.push({ t: "event", i: idx });
        break;
      }
    }
  }
  return { run, log };
}
