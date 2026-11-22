import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUnit } from "@/lib/engine";
import * as Run from "@/lib/engine/run";
import { useGame } from "@/lib/store/game";

const g = useGame.getState;

async function runUntil(cond: () => boolean, maxMs = 600_000) {
  for (let t = 0; t < maxMs && !cond(); t += 100) await vi.advanceTimersByTimeAsync(100);
}

/** 지도에서 전투 노드로 들어간다 */
function enterFirstBattle() {
  const run = g().run!;
  const id = Run.reachableNodeIds(run).find((nid) => run.map.nodes.find((n) => n.id === nid)!.kind === "battle")!;
  g().selectNode(id);
}

describe("게임 화면 흐름 (store)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    if (g().auto) g().toggleAuto();
    vi.useRealTimers();
  });

  it("소환: 첫 소환은 무료, 재소환은 3번까지, 소환한 파티로 등반 시작", () => {
    g().openSummon();
    expect(g().screen).toBe("summon");
    expect(g().summon!.party).toBeNull();
    g().pullParty();
    const first = g().summon!.party!;
    expect(first).toHaveLength(4);
    expect(g().summon!.rerollsLeft).toBe(3);
    for (let i = 0; i < 5; i++) g().pullParty();
    expect(g().summon!.rerollsLeft).toBe(0);
    expect(g().summon!.pulls).toBe(4); // 첫 소환 + 재소환 3번, 그 뒤로는 무시
    const final = g().summon!.party!;
    g().startRun();
    expect(g().screen).toBe("map");
    expect(g().run!.members.map((m) => m.defId)).toEqual(final);
    expect(g().summon).toBeNull();
  });

  it("전투 노드 → 아군 차례에서 멈추고 기본기가 선택돼 있다", async () => {
    g().startRun(["warrior", "bard", "priest", "hexer"]);
    enterFirstBattle();
    expect(g().screen).toBe("battle");
    await runUntil(() => !g().busy);
    const { battle, selectedSkillId } = g();
    const actor = getUnit(battle!, battle!.activeUid!);
    expect(actor.side).toBe("ally");
    expect(selectedSkillId).toBe(actor.skills[0].id);
  });

  it("수동으로 몇 턴 진행할 수 있다", async () => {
    g().startRun(["mage", "gunslinger", "doctor", "bodyguard"]);
    enterFirstBattle();
    for (let i = 0; i < 5; i++) {
      await runUntil(() => !g().busy);
      const st = g();
      if (st.battle!.outcome !== "ongoing") break;
      const enemy = st.battle!.units.find((u) => u.side === "enemy" && u.alive)!;
      st.confirmSkill(enemy.uid);
    }
    expect(g().log.length).toBeGreaterThan(3);
  });

  it("전투가 끝나면 결과가 기록되고 지도로 돌아가 다음 노드를 고를 수 있다", async () => {
    g().startRun(["knight", "priest", "gunslinger", "bard"]);
    enterFirstBattle();
    await runUntil(() => !g().busy);
    g().toggleAuto();
    await runUntil(() => g().report !== null);
    g().toggleAuto();
    const { report, run } = g();
    if (!report!.won) {
      expect(run!.status).toBe("failed");
      return;
    }
    expect(run!.nodeDone).toBe(true);
    g().backToMap();
    expect(g().screen).toBe("map");
    expect(Run.reachableNodeIds(g().run!).length).toBeGreaterThan(0);
  });

  it("노드 행동 실패는 안내 문구로 표시", () => {
    g().startRun(["rogue"]);
    const run = g().run!;
    // 첫 단계에는 휴식 노드가 나오지 않으므로, 첫 노드에서 휴식을 시도하면 실패해야 한다
    const first = run.map.nodes.find((n) => n.row === 0)!;
    expect(first.kind).not.toBe("rest");
    useGame.setState({ run: { ...run, position: first.id, nodeDone: false } });
    g().restHeal();
    expect(g().notice).toBe("지금은 할 수 없습니다.");
  });
});
