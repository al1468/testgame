import type { Element, SkillDef, Stats, UnitDef } from "@/lib/engine/types";

export const BASIC: SkillDef = {
  id: "basic",
  name: "기본 공격",
  description: "",
  cooldown: 0,
  target: "enemy_single",
  effects: [{ type: "damage", multiplier: 1 }],
};

/** 테스트용 유닛: 치명·저항 0이라 결과가 난수에 덜 좌우됨 */
export function makeDef(
  id: string,
  opts: {
    element?: Element;
    stats?: Partial<Stats>;
    skills?: SkillDef[];
    passives?: UnitDef["passives"];
    aiPriority?: string[];
  } = {},
): UnitDef {
  return {
    id,
    name: id,
    job: "test",
    role: "test",
    element: opts.element ?? "fire",
    base: {
      hp: 1000,
      atk: 100,
      def: 0,
      spd: 100,
      critRate: 0,
      critDmg: 1.5,
      eff: 0,
      res: 0,
      ...opts.stats,
    },
    growth: { hp: 0, atk: 0, def: 0 },
    skills: opts.skills ?? [BASIC],
    passives: opts.passives,
    aiPriority: opts.aiPriority,
  };
}
