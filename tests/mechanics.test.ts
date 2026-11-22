import { describe, expect, it } from "vitest";
import {
  act,
  advance,
  createBattle,
  getUnit,
  hasStatus,
  simulateBattle,
  type BattleState,
  type SkillDef,
} from "@/lib/engine";
import { WARRIOR } from "@/data/jobs";
import { DETECTIVE, HACKER, VAMPIRE } from "@/data/companions";
import { TOWER_GATEKEEPER } from "@/data/enemies";
import { BASIC, makeDef } from "./helpers";

const start = (s: BattleState) => advance(s).state;

describe("새 메커니즘", () => {
  it("생명력 흡수: 준 피해의 40% 회복 (흡혈귀)", () => {
    let s = createBattle({
      seed: "ls",
      allies: [{ def: VAMPIRE, level: 1, hp: 500 }],
      enemies: [{ def: makeDef("e", { stats: { spd: 1 } }), level: 1 }],
    });
    s = start(s);
    const r = act(s, { skillId: "vampire_s1", targetUid: "e0" });
    const dmg = r.events.find((e) => e.type === "damage");
    const heal = r.events.find((e) => e.type === "heal");
    if (dmg?.type !== "damage" || heal?.type !== "heal") throw new Error("missing events");
    expect(heal.amount).toBe(Math.round(dmg.amount * 0.4));
  });

  it("협공: 다른 아군이 기본기로 같은 대상을 공격 (형사)", () => {
    let s = createBattle({
      seed: "fu",
      allies: [
        { def: DETECTIVE, level: 1 },
        { def: makeDef("buddy", { stats: { spd: 1 } }), level: 1 },
      ],
      enemies: [{ def: makeDef("e", { stats: { spd: 1, hp: 99999 } }), level: 1 }],
    });
    s.units[0].gauge = 1;
    s = start(s);
    const r = act(s, { skillId: "detective_s2", targetUid: "e0" });
    expect(r.events).toContainEqual({ type: "follow_up", uid: "a1", targetUid: "e0" });
    expect(r.events.filter((e) => e.type === "damage").length).toBe(2);
  });

  it("쿨타임 조작: 아군 쿨타임 감소, 적 쿨타임 증가 (해커)", () => {
    let s = createBattle({
      seed: "cd2",
      allies: [
        { def: HACKER, level: 1 },
        { def: WARRIOR, level: 1 },
      ],
      enemies: [{ def: TOWER_GATEKEEPER, level: 1 }],
    });
    s.units[0].stats.spd = 999;
    s = start(s);
    expect(s.activeUid).toBe("a0");
    s.units[1].cooldowns["warrior_s3"] = 3;
    s = act(s, { skillId: "hacker_s2" }).state;
    expect(getUnit(s, "a1").cooldowns["warrior_s3"]).toBe(2);

    s.units[0].gauge = 1;
    s.units[0].cooldowns["hacker_s3"] = 1; // 턴 시작 시 1 감소 → 0
    s = advance(s).state;
    expect(s.activeUid).toBe("a0");
    s = act(s, { skillId: "hacker_s3", targetUid: "e0" }).state;
    expect(getUnit(s, "e0").cooldowns["tower_gatekeeper_s2"]).toBe(2);
  });

  it("불굴(패시브): 전투당 1회 HP 1로 버틴다", () => {
    let s = createBattle({
      seed: "en",
      allies: [{ def: VAMPIRE, level: 1, hp: 10 }],
      enemies: [{ def: makeDef("e", { stats: { spd: 999, atk: 500 } }), level: 1 }],
    });
    s = start(s);
    expect(s.activeUid).toBe("e0");
    const r = act(s, { skillId: BASIC.id, targetUid: "a0" });
    expect(r.events).toContainEqual({ type: "endure", uid: "a0" });
    expect(getUnit(r.state, "a0").hp).toBe(1);
    expect(getUnit(r.state, "a0").alive).toBe(true);
  });

  it("보스 광폭화: HP 40% 이하가 되면 공격력·속도 증가", () => {
    let s = createBattle({
      seed: "rage",
      allies: [{ def: makeDef("a", { stats: { spd: 999, atk: 3000 } }), level: 1 }],
      enemies: [{ def: TOWER_GATEKEEPER, level: 1 }],
    });
    s = start(s);
    const r = act(s, { skillId: BASIC.id, targetUid: "e0" });
    expect(r.events).toContainEqual({ type: "enrage", uid: "e0" });
    expect(hasStatus(getUnit(r.state, "e0"), "atkUp")).toBe(true);
  });

  it("탑의 압박: 120턴이 넘으면 교착 상태도 결국 끝난다", () => {
    const selfHeal: SkillDef = {
      id: "selfheal",
      name: "자가 회복",
      description: "",
      cooldown: 0,
      target: "self",
      effects: [{ type: "heal", percentMaxHp: 1, target: "self" }],
    };
    const { state, events } = simulateBattle(
      createBattle({
        seed: "stall",
        allies: [{ def: makeDef("a", { skills: [selfHeal] }), level: 1 }],
        enemies: [{ def: makeDef("e", { skills: [selfHeal] }), level: 1 }],
      }),
    );
    expect(state.outcome).not.toBe("ongoing");
    expect(events.some((e) => e.type === "pressure_start")).toBe(true);
  });
});

describe("지속 연장 · 복수", () => {
  it("디버프 연장: 적 디버프 지속 턴이 늘어난다 (빙하의 여왕)", async () => {
    const { GLACIER_QUEEN } = await import("@/data/companions2");
    let s = createBattle({
      seed: "ext",
      allies: [{ def: GLACIER_QUEEN, level: 1 }],
      enemies: [{ def: makeDef("e", { stats: { spd: 1, hp: 99999 } }), level: 1 }],
    });
    s.units[0].stats.spd = 999;
    s = start(s);
    s.units[1].statuses.push({ id: "defDown", turns: 2, sourceUid: "a0", power: 0, appliedTurn: 0 });
    const r = act(s, { skillId: "glacier_queen_s2" });
    expect(getUnit(r.state, "e0").statuses.find((x) => x.id === "defDown")!.turns).toBe(3);
  });

  it("복수: 아군이 쓰러지면 공격력 증가 + 턴 게이지 (용혈 전사)", async () => {
    const { DRAGONBLOOD } = await import("@/data/companions2");
    let s = createBattle({
      seed: "rev",
      allies: [
        { def: DRAGONBLOOD, level: 1 },
        { def: makeDef("weak", { stats: { spd: 1 } }), level: 1, hp: 5 },
      ],
      enemies: [{ def: makeDef("e", { stats: { spd: 999, atk: 500 } }), level: 1 }],
    });
    s = start(s);
    expect(s.activeUid).toBe("e0");
    const before = getUnit(s, "a0").gauge;
    const r = act(s, { skillId: BASIC.id, targetUid: "a1" });
    expect(r.events).toContainEqual({ type: "revenge", uid: "a0" });
    expect(hasStatus(getUnit(r.state, "a0"), "atkUp")).toBe(true);
    expect(getUnit(r.state, "a0").gauge).toBeGreaterThan(before);
  });
});
