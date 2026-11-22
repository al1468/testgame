// 테스트·밸런스용 자동 플레이: 맵 선택부터 전투까지 런을 끝까지 진행한다.
import { createBattle, simulateBattle } from "@/lib/engine";
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
    run = enterNode(run, options[Math.floor(pick() * options.length)]);
    const node = currentNode(run)!;
    if (isBattleNode(node.kind)) {
      const { state } = simulateBattle(createBattle(nodeBattleSetup(run)));
      run = finishBattle(run, state).run;
      continue;
    }
    switch (node.kind) {
      case "rest":
        run = hpRatio(run) < 0.7 || run.members.some((m) => m.hp <= 0) ? restHeal(run) : restTrain(run, 0);
        break;
      case "shop": {
        const offers = shopOffers(run);
        offers.forEach((o, i) => {
          const want =
            (o.kind === "heal" && hpRatio(run) < 0.6) ||
            (o.kind === "revive" && run.members.some((m) => m.hp <= 0)) ||
            o.kind === "relic" ||
            o.kind === "train";
          if (want && run.gold >= o.price) run = buyOffer(run, i);
        });
        run = leaveNode(run);
        break;
      }
      case "recruit": {
        const c = recruitCandidates(run)[0];
        run = c && run.members.length < PARTY_SIZE ? recruit(run, c.id) : leaveNode(run);
        break;
      }
      case "event": {
        const ev = nodeEvent(run);
        const idx = ev.choices.findIndex((c) => !c.requiresGold || run.gold >= c.requiresGold);
        run = chooseEventOption(run, idx);
        break;
      }
    }
  }
  return run;
}
