import { describe, expect, it } from "vitest";
import { createBattle, type BattleState } from "@/lib/engine";
import { generateFloorMap, type NodeKind } from "@/lib/engine/map";
import * as Run from "@/lib/engine/run";
import type { RunState } from "@/lib/engine/run";
import { FLOORS, MAX_FLOOR } from "@/data/floors";
import { autoplayRun } from "./autoplay";

/** 지정한 종류의 노드에 서 있는 런을 만든다 (테스트용으로 위치를 직접 지정) */
function runAt(kind: NodeKind, companions: string[] = ["bard", "priest"], floor = 1): RunState {
  for (let i = 0; i < 200; i++) {
    const run = Run.createRun(`t${i}`, ["warrior", ...companions]);
    if (floor !== 1) {
      run.floor = floor;
      run.map = generateFloorMap(run.seed, floor, FLOORS[floor - 1].kind === "boss");
    }
    const node = run.map.nodes.find((n) => n.kind === kind);
    if (!node) continue;
    // 그 노드 바로 앞 노드를 끝낸 상태로 두고 enterNode로 들어간다
    if (node.row > 0) {
      run.position = run.map.nodes.find((n) => n.next.includes(node.id))!.id;
      run.nodeDone = true;
    }
    return Run.enterNode(run, node.id);
  }
  throw new Error(`no map with ${kind}`);
}

function endBattle(run: RunState, outcome: "win" | "lose", deadAllies: number[] = []): BattleState {
  const s = createBattle(Run.nodeBattleSetup(run));
  s.outcome = outcome;
  s.turnCount = 20;
  let a = 0;
  for (const u of s.units) {
    if (u.side === "enemy" && outcome === "win") {
      u.alive = false;
      u.hp = 0;
    }
    if (u.side === "ally") {
      if (deadAllies.includes(a)) {
        u.alive = false;
        u.hp = 0;
      }
      a++;
    }
  }
  return s;
}

describe("갈림길 맵", () => {
  it("단계 0~2는 노드 2~3개, 마지막은 관문 1개, 모든 노드가 연결됨", () => {
    for (let i = 0; i < 50; i++) {
      for (const f of FLOORS) {
        const map = generateFloorMap(`m${i}`, f.floor, f.kind === "boss");
        expect(map.rows).toBe(4);
        const gate = map.nodes.filter((n) => n.row === 3);
        expect(gate.map((n) => n.kind)).toEqual(["gate"]);
        for (let r = 0; r < 3; r++) {
          const row = map.nodes.filter((n) => n.row === r);
          for (const n of row) expect(n.next.length).toBeGreaterThan(0);
          if (r > 0) {
            for (const n of row) expect(map.nodes.some((p) => p.next.includes(n.id))).toBe(true);
          }
        }
        if (f.kind === "boss") expect(map.nodes.filter((n) => n.row === 2).map((n) => n.kind)).toEqual(["rest"]);
        if (f.floor === 1) expect(map.nodes.some((n) => n.kind === "elite")).toBe(false);
        expect(map.nodes.filter((n) => n.row === 0).some((n) => n.kind === "battle")).toBe(true);
      }
    }
  });

  it("같은 시드면 같은 맵", () => {
    expect(generateFloorMap("x", 3, false)).toEqual(generateFloorMap("x", 3, false));
  });

  it("입구에서는 첫 단계만, 노드를 끝내야 다음으로 이동 가능", () => {
    let run = Run.createRun("nav", ["mage"]);
    const first = Run.reachableNodeIds(run);
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(() => Run.enterNode(run, "3-0")).toThrow();
    run = Run.enterNode(run, first[0]);
    expect(Run.reachableNodeIds(run)).toEqual([]);
  });
});

describe("전투 노드", () => {
  it("승리: 경험치·골드, 쓰러진 동료는 경험치 없음, 노드 완료", () => {
    const run = runAt("battle");
    const { run: next, report } = Run.finishBattle(run, endBattle(run, "win", [1]));
    expect(report.xpGained).toBe(Run.RUN_RULES.xp.battle(1));
    expect(next.gold).toBe(Run.RUN_RULES.startGold + Run.RUN_RULES.gold.battle(1));
    expect(next.members[1].hp).toBe(0);
    expect(next.members[1].xp).toBe(0);
    expect(next.nodeDone).toBe(true);
    expect(report.floorCleared).toBe(false);
  });

  it("쓰러진 파티원은 다음 전투에서 HP 50%로 부활", () => {
    const run = runAt("battle");
    run.members[1].hp = 0;
    expect(Run.nodeBattleSetup(run).allies[1].hp).toBe(Math.round(Run.maxHpOf(run.members[1]) * 0.5));
  });

  it("엘리트 처치는 엘리트로 집계", () => {
    const run = runAt("elite", ["bard", "priest"], 3);
    const { run: next } = Run.finishBattle(run, endBattle(run, "win"));
    expect(next.kills.elite).toBe(3);
  });

  it("관문을 넘으면 다음 층 새 지도, 10층 관문이면 클리어", () => {
    const run = runAt("gate");
    const { run: next, report } = Run.finishBattle(run, endBattle(run, "win"));
    expect(report.floorCleared).toBe(true);
    expect(next.floor).toBe(2);
    expect(next.position).toBeNull();
    expect(next.map.floor).toBe(2);

    const top = runAt("gate", [], MAX_FLOOR);
    const done = Run.finishBattle(top, endBattle(top, "win")).run;
    expect(done.status).toBe("cleared");
    expect(done.kills.boss).toBe(1);
  });

  it("패배하면 런 종료", () => {
    const run = runAt("battle");
    expect(Run.finishBattle(run, endBattle(run, "lose")).run.status).toBe("failed");
  });

  it("파티 인원이 적으면 적이 약해진다", () => {
    const solo = runAt("gate", []);
    const full = runAt("gate", ["bard", "priest", "hexer"]);
    const hp = (r: RunState) => createBattle(Run.nodeBattleSetup(r)).units.filter((u) => u.side === "enemy")[0].stats.hp;
    expect(hp(solo)).toBeLessThan(hp(full));
  });
});

describe("비전투 노드", () => {
  it("휴식: 회복 + 쓰러진 동료 복귀 / 특훈: 레벨 +1", () => {
    const run = runAt("rest", ["bard"], 2);
    run.members[0].hp = 100;
    run.members[1].hp = 0;
    const healed = Run.restHeal(run);
    expect(healed.members[0].hp).toBe(100 + Math.round(Run.maxHpOf(run.members[0]) * 0.4));
    expect(healed.members[1].hp).toBe(Math.round(Run.maxHpOf(run.members[1]) * 0.5));
    expect(healed.nodeDone).toBe(true);
    expect(() => Run.restHeal(healed)).toThrow();
    expect(Run.restTrain(run, 1).members[1].level).toBe(2);
  });

  it("상점: 골드 차감, 같은 상품 두 번 구매 불가, 유물을 사도 재고는 그대로", () => {
    let run = runAt("shop", ["bard"], 2);
    run.gold = 999;
    const offers = Run.shopOffers(run);
    const relicIdx = offers.findIndex((o) => o.kind === "relic");
    run = Run.buyOffer(run, relicIdx);
    expect(run.gold).toBe(999 - offers[relicIdx].price);
    expect(run.relics).toContain(offers[relicIdx].relicId);
    expect(Run.shopOffers(run)).toEqual(offers);
    expect(() => Run.buyOffer(run, relicIdx)).toThrow();
    const poor = { ...structuredClone(run), gold: 0 };
    expect(() => Run.buyOffer(poor, 0)).toThrow();
  });

  it("영입: 빈 자리에 추가, 꽉 차면 교체", () => {
    const run = runAt("recruit", ["bard"]);
    const c = Run.recruitCandidates(run);
    expect(c).toHaveLength(3);
    expect(c.some((x) => x.id === "bard")).toBe(false);
    expect(Run.recruit(run, c[0].id).members.map((m) => m.defId)).toEqual(["warrior", "bard", c[0].id]);

    const fullRun = runAt("recruit", ["bard", "priest", "hexer"]);
    const c2 = Run.recruitCandidates(fullRun);
    expect(() => Run.recruit(fullRun, c2[0].id)).toThrow();
    expect(Run.recruit(fullRun, c2[0].id, 2).members[2].defId).toBe(c2[0].id);
    // 첫 번째 자리(예전 주인공 자리)도 교체 가능
    expect(Run.recruit(fullRun, c2[0].id, 0).members[0].defId).toBe(c2[0].id);
  });

  it("이벤트: 같은 노드는 같은 이벤트·같은 결과", () => {
    const run = runAt("event");
    run.gold = 999;
    const ev = Run.nodeEvent(run);
    expect(Run.nodeEvent(run)).toEqual(ev);
    const a = Run.chooseEventOption(run, 0);
    expect(Run.chooseEventOption(run, 0)).toEqual(a);
    expect(a.nodeDone).toBe(true);
    expect(a.eventText).toBeTruthy();
  });

  it("유물 보정이 전투에 반영된다", () => {
    const run = runAt("battle");
    const base = createBattle(Run.nodeBattleSetup(run)).units[0].stats.atk;
    run.relics = ["awakened_ring"];
    expect(createBattle(Run.nodeBattleSetup(run)).units[0].stats.atk).toBe(Math.round(base * 1.1));
  });
});

describe("파티 구성", () => {
  it("1~4명, 중복 없이, 직업 캐릭터도 동료처럼 고른다", () => {
    expect(Run.createRun("p", ["bard", "bard", "mage"]).members.map((m) => m.defId)).toEqual(["bard", "mage"]);
    expect(Run.createRun("p", ["a", "b", "c", "d", "e"].map((_, i) => ["warrior", "mage", "rogue", "knight", "bard"][i])).members).toHaveLength(4);
    expect(() => Run.createRun("p", [])).toThrow();
  });

  it("영입 후보에 기본 클래스도 나온다", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = Run.createRun(`rc${i}`, ["bard"]);
      const node = r.map.nodes.find((n) => n.kind === "recruit" && n.row === 0);
      if (!node) continue;
      Run.recruitCandidates(Run.enterNode(r, node.id)).forEach((c) => seen.add(c.id));
    }
    expect(["warrior", "mage", "rogue", "knight"].some((id) => seen.has(id))).toBe(true);
  });
});

describe("런 전체", () => {
  it("자동 플레이로 끝까지 진행되고 재현 가능하다", () => {
    const a = autoplayRun("full", ["rogue", "bodyguard", "priest", "assassin"]);
    expect(["cleared", "failed"]).toContain(a.status);
    expect(autoplayRun("full", ["rogue", "bodyguard", "priest", "assassin"])).toEqual(a);
  });

  it("점수: 층 × 1000 + 처치 + 클리어 보너스", () => {
    const run = Run.createRun("sc", ["knight"]);
    run.status = "cleared";
    run.kills = { normal: 10, elite: 3, boss: 2 };
    expect(Run.runScore(run)).toBe(10 * 1000 + 10 * 50 + 3 * 200 + 2 * 1000 + 5000);
  });
});
