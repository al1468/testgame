// 기본 클래스 4종 (전사·마법사·도적·기사). 파티 편성에서 다른 동료와 똑같이 고를 수 있다.
import type { UnitDef } from "@/lib/engine/types";

export const WARRIOR: UnitDef = {
  id: "warrior",
  name: "전사",
  job: "전사",
  role: "브루저",
  element: "fire",
  base: { hp: 1100, atk: 110, def: 60, spd: 100, critRate: 0.15, critDmg: 1.5, eff: 0, res: 0.1 },
  growth: { hp: 90, atk: 9, def: 5 },
  skills: [
    {
      id: "warrior_s1",
      name: "내려찍기",
      description: "적 1명에게 피해를 준다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0 }],
    },
    {
      id: "warrior_s2",
      name: "분노",
      description: "2턴간 자신의 공격력과 치명 확률이 증가한다.",
      cooldown: 3,
      target: "self",
      effects: [
        { type: "buff", status: "atkUp", turns: 2, target: "self" },
        { type: "buff", status: "critUp", turns: 2, target: "self" },
      ],
    },
    {
      id: "warrior_s3",
      name: "회전 베기",
      description: "적 전체에게 피해를 준다. 자신의 HP가 낮을수록 피해가 커진다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [{ type: "damage", multiplier: 0.8, bonusBySelfMissingHp: 1.0 }],
    },
  ],
  passives: [{ type: "lowHpAtkUp", threshold: 0.5, bonus: 0.2 }],
};

export const MAGE: UnitDef = {
  id: "mage",
  name: "마법사",
  job: "마법사",
  role: "광역 딜러 / 디버퍼",
  element: "ice",
  base: { hp: 850, atk: 125, def: 45, spd: 105, critRate: 0.15, critDmg: 1.5, eff: 0.3, res: 0.1 },
  growth: { hp: 65, atk: 11, def: 3 },
  skills: [
    {
      id: "mage_s1",
      name: "얼음 화살",
      description: "적 1명에게 피해를 주고, 30% 확률로 2턴간 속도를 감소시킨다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "debuff", status: "spdDown", turns: 2, chance: 0.3 },
      ],
    },
    {
      id: "mage_s2",
      name: "서리 폭풍",
      description: "적 전체에게 피해를 주고, 60% 확률로 2턴간 속도를 감소시킨다.",
      cooldown: 3,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.7 },
        { type: "debuff", status: "spdDown", turns: 2, chance: 0.6 },
      ],
    },
    {
      id: "mage_s3",
      name: "빙결 감옥",
      description: "적 1명에게 큰 피해를 주고, 70% 확률로 1턴간 기절시킨다.",
      cooldown: 4,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.6 },
        { type: "debuff", status: "stun", turns: 1, chance: 0.7 },
      ],
    },
  ],
};

export const ROGUE: UnitDef = {
  id: "rogue",
  name: "도적",
  job: "도적",
  role: "속공 딜러",
  element: "dark",
  base: { hp: 900, atk: 120, def: 45, spd: 120, critRate: 0.25, critDmg: 1.6, eff: 0.2, res: 0.1 },
  growth: { hp: 70, atk: 10, def: 3 },
  skills: [
    {
      id: "rogue_s1",
      name: "급소 찌르기",
      description: "적 1명에게 피해를 주고, 50% 확률로 2턴간 독을 건다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "debuff", status: "poison", turns: 2, chance: 0.5 },
      ],
    },
    {
      id: "rogue_s2",
      name: "연막",
      description: "적 전체에게 약한 피해를 주고, 턴 게이지를 20% 밀어내며 50% 확률로 속도를 감소시킨다.",
      cooldown: 3,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.3 },
        { type: "gauge", amount: -0.2 },
        { type: "debuff", status: "spdDown", turns: 2, chance: 0.5 },
      ],
    },
    {
      id: "rogue_s3",
      name: "암살",
      description: "적 1명에게 큰 피해를 준다. 독에 걸린 적에게 피해 +50%. 처치하면 한 번 더 행동한다.",
      cooldown: 3,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.5, bonusVsStatus: { status: "poison", bonus: 0.5 } },
        { type: "extraTurnOnKill" },
      ],
    },
  ],
  passives: [{ type: "battleStartGauge", amount: 0.3, target: "self" }],
};

export const KNIGHT: UnitDef = {
  id: "knight",
  name: "기사",
  job: "기사",
  role: "탱커 / 서포터",
  element: "light",
  base: { hp: 1300, atk: 80, def: 90, spd: 95, critRate: 0.1, critDmg: 1.5, eff: 0.1, res: 0.2 },
  growth: { hp: 110, atk: 6, def: 8 },
  skills: [
    {
      id: "knight_s1",
      name: "방패 강타",
      description: "적 1명에게 방어력에 비례한 피해를 준다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.3, scaling: "def" }],
    },
    {
      id: "knight_s2",
      name: "수호 맹세",
      description: "80% 확률로 적 전체를 도발하고, 자신에게 보호막을 건다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [
        { type: "debuff", status: "provoke", turns: 1, chance: 0.8 },
        { type: "shield", percentCasterMaxHp: 0.25, target: "self" },
      ],
    },
    {
      id: "knight_s3",
      name: "기사의 서약",
      description: "아군 전체의 방어력을 2턴간 증가시키고 디버프를 1개 해제한다.",
      cooldown: 4,
      target: "ally_all",
      effects: [
        { type: "buff", status: "defUp", turns: 2 },
        { type: "cleanse", count: 1 },
      ],
    },
  ],
  passives: [{ type: "counterChance", chance: 0.25 }],
};

export const JOBS: UnitDef[] = [WARRIOR, MAGE, ROGUE, KNIGHT];
