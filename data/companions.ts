// 영입 가능한 동료 10명. 에픽세븐식 스킬셋 "유형"을 참고한 오리지널 캐릭터.
import type { Element, UnitDef } from "@/lib/engine/types";
import { EXTRA_COMPANIONS } from "./companions2";
import { JOBS } from "./jobs";

export const BARD: UnitDef = {
  id: "bard",
  name: "바람의 음유시인",
  job: "바람의 음유시인",
  role: "속공 서포터",
  element: "ice",
  base: { hp: 950, atk: 90, def: 55, spd: 125, critRate: 0.1, critDmg: 1.5, eff: 0.2, res: 0.15 },
  growth: { hp: 75, atk: 7, def: 4 },
  skills: [
    {
      id: "bard_s1",
      name: "불협화음",
      description: "적 1명에게 피해를 주고, 25% 확률로 2턴간 속도를 감소시킨다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "debuff", status: "spdDown", turns: 2, chance: 0.25 },
      ],
    },
    {
      id: "bard_s2",
      name: "전진의 노래",
      description: "아군 전체의 속도를 2턴간 증가시키고 턴 게이지를 20% 당긴다.",
      cooldown: 4,
      target: "ally_all",
      effects: [
        { type: "buff", status: "spdUp", turns: 2 },
        { type: "gauge", amount: 0.2 },
      ],
    },
    {
      id: "bard_s3",
      name: "앙코르",
      description: "아군 1명의 턴 게이지를 100%로 만들어 즉시 행동하게 한다.",
      cooldown: 4,
      target: "ally_single",
      effects: [{ type: "gauge", amount: 1 }],
    },
  ],
  passives: [{ type: "battleStartGauge", amount: 0.15, target: "allies" }],
};

export const PRIEST: UnitDef = {
  id: "priest",
  name: "대사제",
  job: "대사제",
  role: "힐러",
  element: "light",
  base: { hp: 1000, atk: 85, def: 55, spd: 105, critRate: 0.1, critDmg: 1.5, eff: 0.1, res: 0.2 },
  growth: { hp: 80, atk: 6, def: 4 },
  skills: [
    {
      id: "priest_s1",
      name: "성광",
      description: "적 1명에게 피해를 주고, HP 비율이 가장 낮은 아군을 조금 회복시킨다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 0.8 },
        { type: "heal", percentMaxHp: 0.06, target: "lowestAlly" },
      ],
    },
    {
      id: "priest_s2",
      name: "축복의 빛",
      description: "아군 전체를 회복시키고 2턴간 지속 회복을 건다.",
      cooldown: 4,
      target: "ally_all",
      effects: [
        { type: "heal", percentMaxHp: 0.15 },
        { type: "buff", status: "regen", turns: 2 },
      ],
    },
    {
      id: "priest_s3",
      name: "부활",
      description: "쓰러진 아군 1명을 HP 40%로 되살린다. (전투당 1회)",
      cooldown: 5,
      target: "ally_dead",
      oncePerBattle: true,
      effects: [{ type: "revive", hpPercent: 0.4 }],
    },
  ],
};

export const HEXER: UnitDef = {
  id: "hexer",
  name: "흑마법사",
  job: "흑마법사",
  role: "광역 디버퍼",
  element: "dark",
  base: { hp: 900, atk: 110, def: 45, spd: 110, critRate: 0.1, critDmg: 1.5, eff: 0.4, res: 0.1 },
  growth: { hp: 70, atk: 9, def: 3 },
  skills: [
    {
      id: "hexer_s1",
      name: "저주탄",
      description: "적 1명에게 피해를 주고, 50% 확률로 2턴간 독을 건다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "debuff", status: "poison", turns: 2, chance: 0.5 },
      ],
    },
    {
      id: "hexer_s2",
      name: "쇠약의 저주",
      description: "적 전체에게 피해를 주고, 각각 60% 확률로 2턴간 공격력·방어력을 감소시킨다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.5 },
        { type: "debuff", status: "atkDown", turns: 2, chance: 0.6 },
        { type: "debuff", status: "defDown", turns: 2, chance: 0.6 },
      ],
    },
    {
      id: "hexer_s3",
      name: "침묵 결계",
      description: "적 전체에게 피해를 주고 버프를 모두 해제한 뒤, 70% 확률로 2턴간 버프 불가를 건다.",
      cooldown: 5,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.4 },
        { type: "dispel", count: 99 },
        { type: "debuff", status: "unbuffable", turns: 2, chance: 0.7 },
      ],
    },
  ],
  passives: [{ type: "debuffedEnemyActDamage", atkRatio: 0.2 }],
};

export const GUNSLINGER: UnitDef = {
  id: "gunslinger",
  name: "마탄의 사수",
  job: "마탄의 사수",
  role: "단일 딜러",
  element: "fire",
  base: { hp: 850, atk: 130, def: 40, spd: 108, critRate: 0.25, critDmg: 1.7, eff: 0, res: 0.1 },
  growth: { hp: 65, atk: 11, def: 3 },
  skills: [
    {
      id: "gunslinger_s1",
      name: "마탄",
      description: "적 1명에게 피해를 준다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0 }],
    },
    {
      id: "gunslinger_s2",
      name: "관통 마탄",
      description: "적 1명에게 방어력을 50% 무시하는 큰 피해를 준다.",
      cooldown: 3,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.7, ignoreDef: 0.5 }],
    },
    {
      id: "gunslinger_s3",
      name: "마탄 난사",
      description: "무작위 적에게 3번 피해를 준다.",
      cooldown: 4,
      target: "enemy_random3",
      effects: [{ type: "damage", multiplier: 0.7 }],
    },
  ],
  passives: [{ type: "extraTurnOnKill", cooldown: 2 }],
};

export const PYROMANCER: UnitDef = {
  id: "pyromancer",
  name: "홍염의 마녀",
  job: "홍염의 마녀",
  role: "광역 딜러 / 디버퍼",
  element: "fire",
  base: { hp: 850, atk: 120, def: 40, spd: 105, critRate: 0.1, critDmg: 1.5, eff: 0.35, res: 0.1 },
  growth: { hp: 65, atk: 10, def: 3 },
  skills: [
    {
      id: "pyromancer_s1",
      name: "화염구",
      description: "적 1명에게 피해를 주고, 50% 확률로 2턴간 화상을 건다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 0.9 },
        { type: "debuff", status: "burn", turns: 2, chance: 0.5 },
      ],
    },
    {
      id: "pyromancer_s2",
      name: "작열의 숨결",
      description: "적 전체에게 약한 피해를 주고, 각각 70% 확률로 화상을 2번 건다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.3 },
        { type: "debuff", status: "burn", turns: 2, chance: 0.7 },
        { type: "debuff", status: "burn", turns: 2, chance: 0.7 },
      ],
    },
    {
      id: "pyromancer_s3",
      name: "연쇄 폭발",
      description: "적 전체에게 피해를 주고, 걸려 있는 화상을 즉시 터뜨려 남은 피해를 한 번에 준다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.5 },
        { type: "detonate", status: "burn" },
      ],
    },
  ],
};

export const DOCTOR: UnitDef = {
  id: "doctor",
  name: "서리 치유사",
  job: "서리 치유사",
  role: "힐러 / 정화",
  element: "ice",
  base: { hp: 950, atk: 85, def: 55, spd: 108, critRate: 0.1, critDmg: 1.5, eff: 0.2, res: 0.2 },
  growth: { hp: 75, atk: 6, def: 4 },
  skills: [
    {
      id: "doctor_s1",
      name: "서리 바늘",
      description: "적 1명에게 피해를 주고 턴 게이지를 15% 밀어낸다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 0.8 },
        { type: "gauge", amount: -0.15 },
      ],
    },
    {
      id: "doctor_s2",
      name: "치유의 손길",
      description: "아군 1명의 HP를 크게 회복시키고 디버프를 모두 해제한다.",
      cooldown: 3,
      target: "ally_single",
      effects: [
        { type: "heal", percentMaxHp: 0.3 },
        { type: "cleanse", count: 99 },
      ],
    },
    {
      id: "doctor_s3",
      name: "빙결 결계",
      description: "아군 1명에게 2턴간 면역을 걸고 보호막을 씌운다.",
      cooldown: 4,
      target: "ally_single",
      effects: [
        { type: "buff", status: "immunity", turns: 2 },
        { type: "shield", percentCasterMaxHp: 0.3 },
      ],
    },
  ],
};

export const BRAWLER: UnitDef = {
  id: "brawler",
  name: "수도승",
  job: "수도승",
  role: "브루저",
  element: "earth",
  base: { hp: 1150, atk: 115, def: 65, spd: 100, critRate: 0.15, critDmg: 1.5, eff: 0.1, res: 0.15 },
  growth: { hp: 95, atk: 9, def: 5 },
  skills: [
    {
      id: "brawler_s1",
      name: "연권",
      description: "적 1명을 2번 공격하고, 다음 턴까지 자신의 공격력이 증가한다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 0.6, hits: 2 },
        { type: "buff", status: "atkUp", turns: 1, target: "self" },
      ],
    },
    {
      id: "brawler_s2",
      name: "반격의 자세",
      description: "2턴간 공격받으면 반격한다.",
      cooldown: 4,
      target: "self",
      effects: [{ type: "buff", status: "counter", turns: 2, target: "self" }],
    },
    {
      id: "brawler_s3",
      name: "산붕권",
      description: "자신의 최대 HP에 비례한 피해를 주고, 40% 확률로 1턴간 기절시킨다.",
      cooldown: 4,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 0.13, scaling: "maxHp" },
        { type: "debuff", status: "stun", turns: 1, chance: 0.4 },
      ],
    },
  ],
  passives: [{ type: "lowHpDamageReduction", threshold: 0.5, reduction: 0.2 }],
};

export const BODYGUARD: UnitDef = {
  id: "bodyguard",
  name: "방패 수호자",
  job: "방패 수호자",
  role: "탱커",
  element: "earth",
  base: { hp: 1350, atk: 85, def: 85, spd: 92, critRate: 0.1, critDmg: 1.5, eff: 0.15, res: 0.25 },
  growth: { hp: 115, atk: 6, def: 7 },
  skills: [
    {
      id: "bodyguard_s1",
      name: "견제",
      description: "적 1명에게 피해를 주고, 30% 확률로 1턴간 도발한다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "debuff", status: "provoke", turns: 1, chance: 0.3 },
      ],
    },
    {
      id: "bodyguard_s2",
      name: "수호의 맹약",
      description: "아군 1명을 2턴간 보호해 그 아군이 받을 공격을 대신 받고, 자신의 방어력이 증가한다.",
      cooldown: 4,
      target: "ally_single",
      effects: [
        { type: "buff", status: "protect", turns: 2 },
        { type: "buff", status: "defUp", turns: 2, target: "self" },
      ],
    },
    {
      id: "bodyguard_s3",
      name: "강철 방벽",
      description: "아군 전체에게 자신의 최대 HP에 비례한 보호막을 씌운다.",
      cooldown: 5,
      target: "ally_all",
      effects: [{ type: "shield", percentCasterMaxHp: 0.15 }],
    },
  ],
  passives: [{ type: "autoProtect", threshold: 0.3, turns: 2 }],
};

export const EXORCIST: UnitDef = {
  id: "exorcist",
  name: "성기사",
  job: "성기사",
  role: "디버퍼 / 정화",
  element: "light",
  base: { hp: 950, atk: 105, def: 50, spd: 106, critRate: 0.1, critDmg: 1.5, eff: 0.35, res: 0.2 },
  growth: { hp: 75, atk: 8, def: 4 },
  skills: [
    {
      id: "exorcist_s1",
      name: "심판의 일격",
      description: "적 1명에게 피해를 주고, 40% 확률로 버프를 1개 해제한다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "dispel", count: 1, chance: 0.4 },
      ],
    },
    {
      id: "exorcist_s2",
      name: "정화의 오라",
      description: "아군 전체의 디버프와 적 전체의 버프를 모두 해제한다.",
      cooldown: 4,
      target: "ally_all",
      effects: [
        { type: "cleanse", count: 99 },
        { type: "dispel", count: 99, target: "enemies" },
      ],
    },
    {
      id: "exorcist_s3",
      name: "신성 봉인",
      description: "적 1명에게 피해를 주고, 60% 확률로 1턴간 기절시키며 턴 게이지를 30% 밀어낸다.",
      cooldown: 4,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.2 },
        { type: "debuff", status: "stun", turns: 1, chance: 0.6 },
        { type: "gauge", amount: -0.3 },
      ],
    },
  ],
};

export const ASSASSIN: UnitDef = {
  id: "assassin",
  name: "그림자 암살자",
  job: "그림자 암살자",
  role: "처형 딜러",
  element: "dark",
  base: { hp: 820, atk: 135, def: 38, spd: 115, critRate: 0.3, critDmg: 1.7, eff: 0, res: 0.1 },
  growth: { hp: 62, atk: 11, def: 3 },
  skills: [
    {
      id: "assassin_s1",
      name: "그림자 단검",
      description: "적 1명에게 피해를 준다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0 }],
    },
    {
      id: "assassin_s2",
      name: "그림자 습격",
      description: "적 1명에게 큰 피해를 준다. 디버프가 걸린 적에게 피해 +50%.",
      cooldown: 3,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.4, bonusVsDebuffed: 0.5 }],
    },
    {
      id: "assassin_s3",
      name: "처형",
      description: "적 1명에게 피해를 준다. 대상의 HP가 낮을수록 피해가 커지고, 처치하면 한 번 더 행동한다.",
      cooldown: 4,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.3, bonusByTargetMissingHp: 1.5 },
        { type: "extraTurnOnKill" },
      ],
    },
  ],
  passives: [{ type: "firstAttackCrit" }],
};

export const HACKER: UnitDef = {
  id: "hacker",
  name: "룬 세공사",
  job: "룬 세공사",
  role: "서포터 / 컨트롤",
  element: "fire",
  base: { hp: 900, atk: 100, def: 45, spd: 118, critRate: 0.1, critDmg: 1.5, eff: 0.35, res: 0.15 },
  growth: { hp: 70, atk: 8, def: 3 },
  skills: [
    {
      id: "hacker_s1",
      name: "룬 각인",
      description: "적 1명에게 피해를 주고 턴 게이지를 10% 밀어낸다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 0.9 },
        { type: "gauge", amount: -0.1 },
      ],
    },
    {
      id: "hacker_s2",
      name: "가속의 룬",
      description: "아군 전체의 스킬 쿨타임을 1턴 줄이고, 2턴간 공격력을 증가시킨다.",
      cooldown: 5,
      target: "ally_all",
      effects: [
        { type: "cooldown", amount: -1 },
        { type: "buff", status: "atkUp", turns: 2 },
      ],
    },
    {
      id: "hacker_s3",
      name: "봉인의 룬",
      description: "적 1명에게 피해를 주고 버프를 모두 해제한 뒤, 스킬 쿨타임을 2턴 늘린다.",
      cooldown: 4,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "dispel", count: 99 },
        { type: "cooldown", amount: 2 },
      ],
    },
  ],
};

export const VAMPIRE: UnitDef = {
  id: "vampire",
  name: "흡혈 귀족",
  job: "흡혈 귀족",
  role: "생존형 브루저",
  element: "dark",
  base: { hp: 1050, atk: 120, def: 50, spd: 104, critRate: 0.15, critDmg: 1.5, eff: 0.1, res: 0.15 },
  growth: { hp: 85, atk: 10, def: 4 },
  skills: [
    {
      id: "vampire_s1",
      name: "흡혈",
      description: "적 1명에게 피해를 주고, 준 피해의 40%만큼 회복한다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0, lifesteal: 0.4 }],
    },
    {
      id: "vampire_s2",
      name: "피의 향연",
      description: "적 전체에게 피해를 주고, 준 피해의 30%만큼 회복한다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [{ type: "damage", multiplier: 0.8, lifesteal: 0.3 }],
    },
    {
      id: "vampire_s3",
      name: "밤의 군주",
      description: "2턴간 불사 상태가 되고 공격력이 증가한다. (불사: HP가 1 아래로 떨어지지 않음)",
      cooldown: 5,
      target: "self",
      effects: [
        { type: "buff", status: "immortal", turns: 2, target: "self" },
        { type: "buff", status: "atkUp", turns: 2, target: "self" },
      ],
    },
  ],
  passives: [{ type: "endure" }],
};

export const DETECTIVE: UnitDef = {
  id: "detective",
  name: "현상금 사냥꾼",
  job: "현상금 사냥꾼",
  role: "협공 딜러",
  element: "earth",
  base: { hp: 1000, atk: 115, def: 55, spd: 106, critRate: 0.2, critDmg: 1.5, eff: 0.3, res: 0.15 },
  growth: { hp: 80, atk: 9, def: 4 },
  skills: [
    {
      id: "detective_s1",
      name: "추격",
      description: "적 1명에게 피해를 준다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0 }],
    },
    {
      id: "detective_s2",
      name: "합동 사냥",
      description: "적 1명에게 피해를 주고, 다른 아군 1명이 기본기로 협공한다.",
      cooldown: 3,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.1 }, { type: "allyFollowUp" }],
    },
    {
      id: "detective_s3",
      name: "포박",
      description: "적 1명에게 피해를 주고, 각각 70% 확률로 2턴간 공격력·속도를 감소시킨다.",
      cooldown: 4,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.3 },
        { type: "debuff", status: "atkDown", turns: 2, chance: 0.7 },
        { type: "debuff", status: "spdDown", turns: 2, chance: 0.7 },
      ],
    },
  ],
};

export const SNIPER: UnitDef = {
  id: "sniper",
  name: "엘프 궁수",
  job: "엘프 궁수",
  role: "보스 킬러",
  element: "ice",
  base: { hp: 820, atk: 125, def: 38, spd: 98, critRate: 0.3, critDmg: 1.6, eff: 0, res: 0.1 },
  growth: { hp: 62, atk: 11, def: 3 },
  skills: [
    {
      id: "sniper_s1",
      name: "정밀 사격",
      description: "적 1명에게 피해를 준다. 대상 최대 HP의 3%만큼 추가 피해.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0, targetMaxHpRatio: 0.03 }],
    },
    {
      id: "sniper_s2",
      name: "거인 사냥 화살",
      description: "적 1명에게 큰 피해를 준다. 대상 최대 HP의 10%만큼 추가 피해.",
      cooldown: 4,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.5, targetMaxHpRatio: 0.1 }],
    },
    {
      id: "sniper_s3",
      name: "관통 화살",
      description: "적 1명에게 방어력을 완전히 무시하는 피해를 준다.",
      cooldown: 4,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.6, ignoreDef: 1 }],
    },
  ],
};

export const APOTHECARY: UnitDef = {
  id: "apothecary",
  name: "독술사",
  job: "독술사",
  role: "독 디버퍼",
  element: "earth",
  base: { hp: 900, atk: 105, def: 45, spd: 107, critRate: 0.1, critDmg: 1.5, eff: 0.4, res: 0.15 },
  growth: { hp: 70, atk: 8, def: 3 },
  skills: [
    {
      id: "apothecary_s1",
      name: "독침",
      description: "적 1명에게 피해를 주고, 60% 확률로 2턴간 독을 건다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 0.9 },
        { type: "debuff", status: "poison", turns: 2, chance: 0.6 },
      ],
    },
    {
      id: "apothecary_s2",
      name: "독 안개",
      description: "적 전체에게 약한 피해를 주고, 70% 확률로 독, 50% 확률로 회복 불가를 건다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.3 },
        { type: "debuff", status: "poison", turns: 2, chance: 0.7 },
        { type: "debuff", status: "unhealable", turns: 2, chance: 0.5 },
      ],
    },
    {
      id: "apothecary_s3",
      name: "극독 반응",
      description: "적 전체에게 피해를 주고, 걸려 있는 독을 즉시 터뜨려 남은 피해를 한 번에 준다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.4 },
        { type: "detonate", status: "poison" },
      ],
    },
  ],
};

export const IDOL: UnitDef = {
  id: "idol",
  name: "빛의 무희",
  job: "빛의 무희",
  role: "버프 서포터",
  element: "light",
  base: { hp: 950, atk: 85, def: 50, spd: 120, critRate: 0.1, critDmg: 1.5, eff: 0.1, res: 0.2 },
  growth: { hp: 75, atk: 6, def: 4 },
  skills: [
    {
      id: "idol_s1",
      name: "매혹의 춤",
      description: "적 1명에게 피해를 주고, 아군 전체의 턴 게이지를 5% 당긴다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 0.9 },
        { type: "gauge", amount: 0.05, target: "allies" },
      ],
    },
    {
      id: "idol_s2",
      name: "축복의 무도",
      description: "아군 전체의 공격력과 치명 확률을 2턴간 증가시킨다.",
      cooldown: 4,
      target: "ally_all",
      effects: [
        { type: "buff", status: "atkUp", turns: 2 },
        { type: "buff", status: "critUp", turns: 2 },
      ],
    },
    {
      id: "idol_s3",
      name: "불멸의 피날레",
      description: "아군 전체에게 1턴간 불사를 걸고 턴 게이지를 30% 당긴다.",
      cooldown: 5,
      target: "ally_all",
      effects: [
        { type: "buff", status: "immortal", turns: 1 },
        { type: "gauge", amount: 0.3 },
      ],
    },
  ],
};

const BASE_COMPANIONS: UnitDef[] = [
  GUNSLINGER,
  PYROMANCER,
  HACKER,
  BARD,
  DOCTOR,
  SNIPER,
  BRAWLER,
  BODYGUARD,
  DETECTIVE,
  APOTHECARY,
  PRIEST,
  EXORCIST,
  IDOL,
  ASSASSIN,
  HEXER,
  VAMPIRE,
];

const ELEMENT_ORDER: Element[] = ["fire", "ice", "earth", "light", "dark"];

/** 고를 수 있는 전체 캐릭터 (전사·마법사·도적·기사 포함, 속성 순으로 정렬) */
export const COMPANIONS: UnitDef[] = [...JOBS, ...BASE_COMPANIONS, ...EXTRA_COMPANIONS].sort(
  (a, b) => ELEMENT_ORDER.indexOf(a.element) - ELEMENT_ORDER.indexOf(b.element),
);

/** 파티 최대 인원 */
export const PARTY_SIZE = 4;
