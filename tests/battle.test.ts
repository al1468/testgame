import { describe, expect, it } from "vitest";
import {
  act,
  advance,
  calcDamage,
  chooseAutoAction,
  createBattle,
  elementMatchup,
  getAvailableSkills,
  getUnit,
  getValidTargets,
  hasStatus,
  nextRandom,
  predictTurnOrder,
  simulateBattle,
  type BattleState,
  type SkillDef,
} from "@/lib/engine";
import { JOBS, KNIGHT, ROGUE, WARRIOR } from "@/data/jobs";
import { BARD, BODYGUARD, COMPANIONS, HEXER, PRIEST, PYROMANCER } from "@/data/companions";
import { ENEMIES, FLAME_IMP, RAIL_DEVOURER, SHADOW_WRAITH } from "@/data/enemies";
import { BASIC, makeDef } from "./helpers";

function start(s: BattleState) {
  return advance(s).state;
}

describe("rng", () => {
  it("같은 상태면 같은 난수", () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
    expect(nextRandom(42)[0]).not.toEqual(nextRandom(43)[0]);
  });
});

describe("속성 상성", () => {
  it("화염 → 빙결 → 대지 → 화염", () => {
    expect(elementMatchup("fire", "ice")).toBe("advantage");
    expect(elementMatchup("ice", "earth")).toBe("advantage");
    expect(elementMatchup("earth", "fire")).toBe("advantage");
    expect(elementMatchup("ice", "fire")).toBe("disadvantage");
    expect(elementMatchup("fire", "fire")).toBe("neutral");
  });
  it("빛과 어둠은 서로 유리", () => {
    expect(elementMatchup("light", "dark")).toBe("advantage");
    expect(elementMatchup("dark", "light")).toBe("advantage");
    expect(elementMatchup("light", "fire")).toBe("neutral");
  });
  it("유리 속성 피해 ×1.3, 불리 속성 ×0.8", () => {
    const s = createBattle({
      seed: "x",
      allies: [{ def: makeDef("a", { element: "fire" }), level: 1 }],
      enemies: [
        { def: makeDef("ice", { element: "ice" }), level: 1 },
        { def: makeDef("earth", { element: "earth" }), level: 1 },
        { def: makeDef("fire", { element: "fire" }), level: 1 },
      ],
    });
    const [a, ice, earth, fire] = s.units;
    const eff = { type: "damage", multiplier: 1 } as const;
    expect(calcDamage(a, fire, eff, false).amount).toBe(100);
    expect(calcDamage(a, ice, eff, false).amount).toBe(130);
    expect(calcDamage(a, earth, eff, false).amount).toBe(80);
  });
});

describe("피해 계산", () => {
  it("방어력, 치명타 반영", () => {
    const s = createBattle({
      seed: "x",
      allies: [{ def: makeDef("a", { stats: { atk: 200, critDmg: 1.5 } }), level: 1 }],
      enemies: [{ def: makeDef("b", { stats: { def: 300 } }), level: 1 }],
    });
    const [a, b] = s.units;
    const eff = { type: "damage", multiplier: 1.5 } as const;
    // 200 × 1.5 × (1 − 300/600) = 150
    expect(calcDamage(a, b, eff, false).amount).toBe(150);
    expect(calcDamage(a, b, eff, true).amount).toBe(225);
  });
});

describe("턴 게이지", () => {
  it("속도 2배인 유닛은 2배 자주 행동한다", () => {
    let s = createBattle({
      seed: "spd",
      allies: [{ def: makeDef("fast", { stats: { spd: 200, atk: 1 } }), level: 1 }],
      enemies: [{ def: makeDef("slow", { stats: { spd: 100, atk: 1 } }), level: 1 }],
    });
    const actors: string[] = [];
    for (let i = 0; i < 9; i++) {
      s = advance(s).state;
      actors.push(getUnit(s, s.activeUid!).defId);
      s = act(s, chooseAutoAction(s)).state;
    }
    expect(actors.filter((x) => x === "fast").length).toBe(6);
    expect(actors.filter((x) => x === "slow").length).toBe(3);
  });

  it("타임라인 예측이 실제 순서와 같다", () => {
    let s = createBattle({
      seed: "tl",
      allies: [
        { def: makeDef("a1", { stats: { spd: 130, atk: 1 } }), level: 1 },
        { def: makeDef("a2", { stats: { spd: 90, atk: 1 } }), level: 1 },
      ],
      enemies: [{ def: makeDef("e", { stats: { spd: 110, atk: 1 } }), level: 1 }],
    });
    s = start(s);
    const predicted = predictTurnOrder(s, 6);
    const actual: string[] = [];
    for (let i = 0; i < 6; i++) {
      actual.push(s.activeUid!);
      s = act(s, chooseAutoAction(s)).state;
      s = advance(s).state;
    }
    expect(actual).toEqual(predicted);
  });

  it("턴 게이지 당기기로 즉시 행동 (앙코르)", () => {
    let s = createBattle({
      seed: "enc",
      allies: [
        { def: BARD, level: 1 },
        { def: makeDef("slow", { stats: { spd: 10 } }), level: 1 },
      ],
      enemies: [{ def: makeDef("e", { stats: { spd: 50, atk: 1 } }), level: 1 }],
    });
    s = start(s);
    expect(getUnit(s, s.activeUid!).defId).toBe("bard");
    s = act(s, { skillId: "bard_s3", targetUid: "a1" }).state;
    s = advance(s).state;
    expect(s.activeUid).toBe("a1");
  });
});

describe("스킬과 쿨타임", () => {
  it("쿨타임 3 스킬은 사용 후 3번째 자기 턴에 다시 쓸 수 있다", () => {
    let s = createBattle({
      seed: "cd",
      allies: [{ def: WARRIOR, level: 1 }],
      enemies: [{ def: makeDef("dummy", { stats: { hp: 999999, atk: 0, spd: 1 } }), level: 1 }],
    });
    s = start(s);
    s = act(s, { skillId: "warrior_s2" }).state;
    const ready: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      s = advance(s).state;
      ready.push(getAvailableSkills(s, "a0").some((sk) => sk.id === "warrior_s2"));
      s = act(s, { skillId: "warrior_s1", targetUid: "e0" }).state;
    }
    expect(ready).toEqual([false, false, true]);
  });

  it("잘못된 대상이나 쿨타임 중인 스킬은 거부", () => {
    let s = createBattle({
      seed: "v",
      allies: [{ def: WARRIOR, level: 1 }],
      enemies: [{ def: makeDef("e", { stats: { spd: 1 } }), level: 1 }],
    });
    s = start(s);
    expect(() => act(s, { skillId: "warrior_s1", targetUid: "a0" })).toThrow();
    s = act(s, { skillId: "warrior_s2" }).state;
    s = advance(s).state;
    expect(() => act(s, { skillId: "warrior_s2" })).toThrow();
  });

  it("act는 입력 상태를 바꾸지 않는다", () => {
    const s = start(
      createBattle({
        seed: "imm",
        allies: [{ def: WARRIOR, level: 1 }],
        enemies: [{ def: makeDef("e", { stats: { spd: 1 } }), level: 1 }],
      }),
    );
    const snapshot = JSON.stringify(s);
    act(s, { skillId: "warrior_s1", targetUid: "e0" });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe("상태 효과", () => {
  const stunSkill: SkillDef = {
    id: "stun",
    name: "기절",
    description: "",
    cooldown: 0,
    target: "enemy_single",
    effects: [{ type: "debuff", status: "stun", turns: 1, chance: 1 }],
  };

  it("기절하면 다음 턴을 건너뛴다", () => {
    let s = createBattle({
      seed: "stun",
      allies: [{ def: makeDef("a", { skills: [stunSkill], stats: { spd: 200 } }), level: 1 }],
      enemies: [{ def: makeDef("e", { stats: { spd: 150 } }), level: 1 }],
    });
    s = start(s);
    s = act(s, { skillId: "stun", targetUid: "e0" }).state;
    const r = advance(s);
    expect(r.events).toContainEqual({ type: "stunned", uid: "e0" });
    expect(hasStatus(getUnit(r.state, "e0"), "stun")).toBe(false);
    expect(r.state.activeUid).toBe("a0");
  });

  it("자기 턴에 건 2턴 버프는 다음 자기 턴 2번 동안 유지", () => {
    let s = createBattle({
      seed: "buff",
      allies: [{ def: WARRIOR, level: 1 }],
      enemies: [{ def: makeDef("e", { stats: { hp: 999999, atk: 0, spd: 1 } }), level: 1 }],
    });
    s = start(s);
    s = act(s, { skillId: "warrior_s2" }).state;
    const active: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      s = advance(s).state;
      active.push(hasStatus(getUnit(s, "a0"), "atkUp"));
      s = act(s, { skillId: "warrior_s1", targetUid: "e0" }).state;
    }
    expect(active).toEqual([true, true, false]);
  });

  it("독은 턴 시작 시 최대 HP의 5% 피해", () => {
    const poison: SkillDef = {
      ...stunSkill,
      id: "poison",
      effects: [{ type: "debuff", status: "poison", turns: 2, chance: 1 }],
    };
    let s = createBattle({
      seed: "p",
      allies: [{ def: makeDef("a", { skills: [poison], stats: { spd: 200 } }), level: 1 }],
      enemies: [{ def: makeDef("e", { stats: { hp: 2000, spd: 150 } }), level: 1 }],
    });
    s = start(s);
    s = act(s, { skillId: "poison", targetUid: "e0" }).state;
    const r = advance(s);
    expect(r.events).toContainEqual({ type: "dot", targetUid: "e0", status: "poison", amount: 100 });
  });

  /** 확률 디버프가 걸리는 시드를 찾아서 그 상태를 돌려준다 */
  function firstSeedWhere(make: (seed: string) => BattleState, ok: (s: BattleState) => boolean) {
    for (let i = 0; i < 50; i++) {
      const s = make(`seed-${i}`);
      if (ok(s)) return s;
    }
    throw new Error("no seed satisfied condition");
  }

  it("버프 불가 상태에서는 버프가 걸리지 않는다", () => {
    let s = firstSeedWhere(
      (seed) => {
        const b = createBattle({
          seed,
          allies: [{ def: HEXER, level: 1 }],
          enemies: [{ def: WARRIOR, level: 1 }],
        });
        b.units[0].stats.spd = 500;
        return act(start(b), { skillId: "hexer_s3" }).state;
      },
      (st) => hasStatus(getUnit(st, "e0"), "unbuffable"),
    );
    s.units[0].gauge = 0;
    s.units[1].gauge = 1;
    s = advance(s).state;
    expect(s.activeUid).toBe("e0");
    s = act(s, { skillId: "warrior_s2" }).state;
    expect(hasStatus(getUnit(s, "e0"), "atkUp")).toBe(false);
  });

  it("도발당하면 기본기로 도발한 유닛만 공격", () => {
    let s = firstSeedWhere(
      (seed) => {
        const b = createBattle({
          seed,
          allies: [
            { def: KNIGHT, level: 1 },
            { def: makeDef("ally2", { stats: { spd: 1 } }), level: 1 },
          ],
          enemies: [{ def: WARRIOR, level: 1 }],
        });
        b.units[0].stats.spd = 500;
        return act(start(b), { skillId: "knight_s2" }).state;
      },
      (st) => hasStatus(getUnit(st, "e0"), "provoke"),
    );
    s.units.find((u) => u.uid === "a0")!.gauge = 0;
    s.units.find((u) => u.uid === "e0")!.gauge = 1;
    s = advance(s).state;
    expect(s.activeUid).toBe("e0");
    expect(getAvailableSkills(s, "e0").map((sk) => sk.id)).toEqual(["warrior_s1"]);
    expect(getValidTargets(s, "e0", "warrior_s1")).toEqual(["a0"]);
  });
});

describe("특수 효과", () => {
  it("처치 시 추가 턴 (도적 암살)", () => {
    let s = createBattle({
      seed: "et",
      allies: [{ def: ROGUE, level: 1 }],
      enemies: [
        { def: makeDef("weak", { stats: { hp: 10, spd: 1 } }), level: 1 },
        { def: makeDef("other", { stats: { spd: 300 } }), level: 1 },
      ],
    });
    s.units[0].gauge = 1;
    s = start(s);
    expect(s.activeUid).toBe("a0");
    const r = act(s, { skillId: "rogue_s3", targetUid: "e0" });
    expect(r.events).toContainEqual({ type: "extra_turn", uid: "a0" });
    s = advance(r.state).state;
    expect(s.activeUid).toBe("a0");
  });

  it("부활 (사제)", () => {
    let s = createBattle({
      seed: "rv",
      allies: [
        { def: PRIEST, level: 1 },
        { def: makeDef("dead"), level: 1, hp: 0 },
      ],
      enemies: [{ def: makeDef("e", { stats: { spd: 1 } }), level: 1 }],
    });
    s = start(s);
    expect(getValidTargets(s, "a0", "priest_s3")).toEqual(["a1"]);
    s = act(s, { skillId: "priest_s3", targetUid: "a1" }).state;
    expect(getUnit(s, "a1").alive).toBe(true);
    expect(getUnit(s, "a1").hp).toBe(400);
    s = advance(s).state;
    expect(getAvailableSkills(s, "a0").some((sk) => sk.id === "priest_s3")).toBe(false);
  });

  it("반격 버프가 있으면 기본기로 되받아친다", () => {
    let s = createBattle({
      seed: "ct",
      allies: [{ def: makeDef("a", { stats: { spd: 200 } }), level: 1 }],
      enemies: [{ def: makeDef("e"), level: 1 }],
    });
    s.units[1].statuses.push({ id: "counter", turns: 2, sourceUid: "e0", power: 0, appliedTurn: 0 });
    s = start(s);
    const r = act(s, { skillId: BASIC.id, targetUid: "e0" });
    expect(r.events).toContainEqual({ type: "counter", uid: "e0", targetUid: "a0" });
    expect(getUnit(r.state, "a0").hp).toBe(900);
  });

  it("보호막이 피해를 먼저 흡수", () => {
    let s = createBattle({
      seed: "sh",
      allies: [{ def: makeDef("a", { stats: { spd: 200 } }), level: 1 }],
      enemies: [{ def: makeDef("e"), level: 1 }],
    });
    s.units[1].shield = 60;
    s = start(s);
    s = act(s, { skillId: BASIC.id, targetUid: "e0" }).state;
    expect(getUnit(s, "e0").hp).toBe(960);
    expect(getUnit(s, "e0").shield).toBe(0);
  });
});

describe("전체 전투 시뮬레이션", () => {
  const setup = {
    seed: "run-1",
    allies: [
      { def: KNIGHT, level: 3 },
      { def: BARD, level: 3 },
      { def: PRIEST, level: 3 },
      { def: HEXER, level: 3 },
    ],
    enemies: [
      { def: RAIL_DEVOURER, level: 2 },
      { def: SHADOW_WRAITH, level: 2 },
      { def: FLAME_IMP, level: 2 },
    ],
  };

  it("끝까지 진행되고 승패가 난다", () => {
    const { state } = simulateBattle(createBattle(setup));
    expect(["win", "lose"]).toContain(state.outcome);
  });

  it("같은 시드면 결과가 완전히 같다 (재현성)", () => {
    const a = simulateBattle(createBattle(setup));
    const b = simulateBattle(createBattle(setup));
    expect(a.events).toEqual(b.events);
    expect(a.state).toEqual(b.state);
  });

  it("시드가 다르면 결과가 달라진다", () => {
    const a = simulateBattle(createBattle(setup));
    const b = simulateBattle(createBattle({ ...setup, seed: "run-2" }));
    expect(a.events).not.toEqual(b.events);
  });

  it("모든 직업·동료·적 조합이 오류 없이 끝난다", () => {
    for (const job of JOBS) {
      for (let i = 0; i < 5; i++) {
        const { state } = simulateBattle(
          createBattle({
            seed: `${job.id}-${i}`,
            allies: [{ def: job, level: 2 }, { def: BARD, level: 2 }, { def: PRIEST, level: 2 }, { def: HEXER, level: 2 }],
            enemies: ENEMIES.map((def) => ({ def, level: 2 })),
          }),
        );
        expect(state.outcome).not.toBe("ongoing");
      }
    }
  });
});

describe("동료", () => {
  it("보호: 보호받는 아군 대신 경호원이 맞는다", () => {
    let s = createBattle({
      seed: "guard",
      allies: [
        { def: BODYGUARD, level: 1 },
        { def: makeDef("vip", { stats: { spd: 1 } }), level: 1 },
      ],
      enemies: [{ def: makeDef("e", { stats: { spd: 500 } }), level: 1 }],
    });
    s.units[0].gauge = 1;
    s = start(s);
    expect(s.activeUid).toBe("a0");
    s = act(s, { skillId: "bodyguard_s2", targetUid: "a1" }).state;
    expect(hasStatus(getUnit(s, "a1"), "protect")).toBe(true);
    s = advance(s).state;
    expect(s.activeUid).toBe("e0");
    const r = act(s, { skillId: BASIC.id, targetUid: "a1" });
    expect(r.events).toContainEqual({ type: "guard", uid: "a0", protectedUid: "a1" });
    expect(getUnit(r.state, "a1").hp).toBe(1000);
    expect(getUnit(r.state, "a0").hp).toBeLessThan(getUnit(r.state, "a0").stats.hp);
  });

  it("경호원 패시브: HP 30% 이하가 된 아군을 자동 보호 (전투당 1회)", () => {
    let s = createBattle({
      seed: "auto-guard",
      allies: [
        { def: BODYGUARD, level: 1 },
        { def: makeDef("vip", { stats: { spd: 1 } }), level: 1, hp: 350 },
      ],
      enemies: [{ def: makeDef("e", { stats: { spd: 500 } }), level: 1 }],
    });
    s = start(s);
    expect(s.activeUid).toBe("e0");
    const r = act(s, { skillId: BASIC.id, targetUid: "a1" });
    expect(getUnit(r.state, "a1").hp).toBe(250);
    expect(hasStatus(getUnit(r.state, "a1"), "protect")).toBe(true);
    expect(getUnit(r.state, "a0").usedSkills["passive:autoProtect"]).toBe(true);
  });

  it("연쇄 폭발: 남은 화상 피해를 한 번에 주고 화상을 없앤다", () => {
    let s = createBattle({
      seed: "boom",
      allies: [{ def: PYROMANCER, level: 1 }],
      enemies: [{ def: makeDef("e", { stats: { hp: 99999, spd: 1, atk: 0 } }), level: 1 }],
    });
    s = start(s);
    s.units[1].statuses.push(
      { id: "burn", turns: 2, sourceUid: "a0", power: 50, appliedTurn: 0 },
      { id: "burn", turns: 1, sourceUid: "a0", power: 50, appliedTurn: 0 },
    );
    const r = act(s, { skillId: "pyromancer_s3" });
    expect(r.events).toContainEqual({ type: "dot", targetUid: "e0", status: "burn", amount: 150 });
    expect(hasStatus(getUnit(r.state, "e0"), "burn")).toBe(false);
  });

  it("캐릭터 51명 모두 오류 없이 전투를 끝낸다", { timeout: 60_000 }, () => {
    expect(COMPANIONS).toHaveLength(51);
    expect(new Set(COMPANIONS.map((c) => c.job)).size).toBe(51);
    expect(new Set(COMPANIONS.map((c) => c.id)).size).toBe(51);
    expect(new Set(COMPANIONS.flatMap((c) => c.skills.map((sk) => sk.id))).size).toBe(51 * 3);
    for (let i = 0; i < COMPANIONS.length; i++) {
      for (const job of JOBS) {
        const party = [0, 1, 2].map((k) => COMPANIONS[(i + k * 3) % COMPANIONS.length]);
        const { state } = simulateBattle(
          createBattle({
            seed: `mix-${i}-${job.id}`,
            allies: [job, ...party].map((def) => ({ def, level: 2 })),
            enemies: ENEMIES.map((def) => ({ def, level: 2 })),
          }),
        );
        expect(state.outcome).not.toBe("ongoing");
      }
    }
  });
});
