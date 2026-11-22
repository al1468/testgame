// 이어하기: 브라우저 저장소를 흉내 내고, 전투 도중 저장 → 새로 불러와 같은 턴부터 이어지는지 확인
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as Run from "@/lib/engine/run";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const storage = new MemoryStorage();

beforeAll(() => {
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  });
  vi.stubGlobal("Event", class {
    constructor(public type: string) {}
  });
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function runUntil(cond: () => boolean, maxMs = 300_000) {
  for (let t = 0; t < maxMs && !cond(); t += 100) await vi.advanceTimersByTimeAsync(100);
}

describe("이어하기", () => {
  it("지도·전투 도중 자동 저장되고, 불러오면 같은 상태에서 이어진다", async () => {
    vi.resetModules();
    const { useGame } = await import("@/lib/store/game");
    const save = await import("@/lib/store/save");
    const g = useGame.getState;

    g().startRun(["warrior", "bard", "priest"]);
    expect(save.hasSave()).toBe(true);
    expect(save.loadSave()!.battle).toBeNull();

    // 전투 노드로 들어가서 아군 차례까지 진행
    const run = g().run!;
    const id = Run.reachableNodeIds(run).find((nid) => run.map.nodes.find((n) => n.id === nid)!.kind === "battle")!;
    g().selectNode(id);
    await runUntil(() => !g().busy);
    const enemy = g().battle!.units.find((u) => u.side === "enemy" && u.alive)!;
    g().confirmSkill(enemy.uid);
    await runUntil(() => !g().busy);

    const snapshot = g().battle!;
    const saved = save.loadSave()!;
    expect(saved.battle).toEqual(snapshot);
    expect(saved.run.position).toBe(id);

    // 새로고침을 흉내: 모듈을 새로 불러와 이어하기
    vi.resetModules();
    const fresh = await import("@/lib/store/game");
    const h = fresh.useGame.getState;
    expect(h().run).toBeNull();
    expect(h().continueRun()).toBe(true);
    expect(h().screen).toBe("battle");
    expect(h().battle).toEqual(snapshot);
    await runUntil(() => !h().busy);
    expect(h().battle!.outcome === "ongoing" ? h().battle!.activeUid : "done").toBeTruthy();
  });

  it("런을 포기하면 저장이 지워진다", async () => {
    vi.resetModules();
    const { useGame } = await import("@/lib/store/game");
    const save = await import("@/lib/store/save");
    useGame.getState().startRun(["mage"]);
    expect(save.hasSave()).toBe(true);
    useGame.getState().abandonRun();
    expect(save.hasSave()).toBe(false);
  });
});

describe("소환 상태 저장", () => {
  it("새로고침해도 소환 결과와 남은 재소환 횟수가 유지된다", async () => {
    vi.resetModules();
    const { useGame } = await import("@/lib/store/game");
    const g = useGame.getState;
    g().openSummon();
    g().pullParty();
    g().pullParty(); // 재소환 1회 사용
    const party = g().summon!.party;
    expect(g().summon!.rerollsLeft).toBe(2);

    vi.resetModules();
    const fresh = await import("@/lib/store/game");
    fresh.useGame.getState().openSummon();
    expect(fresh.useGame.getState().summon!.party).toEqual(party);
    expect(fresh.useGame.getState().summon!.rerollsLeft).toBe(2);

    // 등반을 시작하면 소환 상태는 지워져 다음 런에서 새로 소환
    fresh.useGame.getState().startRun();
    vi.resetModules();
    const next = await import("@/lib/store/game");
    next.useGame.getState().openSummon();
    expect(next.useGame.getState().summon!.party).toBeNull();
    expect(next.useGame.getState().summon!.rerollsLeft).toBe(3);
  });
});
