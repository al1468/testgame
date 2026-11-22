// 전투 엔진 공용 타입. 모든 상태는 JSON 직렬화 가능해야 한다 (저장/검증용).

export type Element = "fire" | "ice" | "earth" | "light" | "dark";
export type Side = "ally" | "enemy";

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number; // 0~1
  critDmg: number; // 배율, 예: 1.5
  eff: number; // 효과 적중 0~1
  res: number; // 효과 저항 0~1
}

// ---- 상태 효과 ----

export type BuffId =
  | "atkUp"
  | "defUp"
  | "spdUp"
  | "critUp"
  | "regen"
  | "immunity"
  | "counter"
  | "protect"
  | "immortal";

export type DebuffId =
  | "atkDown"
  | "defDown"
  | "spdDown"
  | "stun"
  | "burn"
  | "poison"
  | "unhealable"
  | "unbuffable"
  | "provoke";

export type StatusId = BuffId | DebuffId;

export const BUFFS: readonly BuffId[] = [
  "atkUp",
  "defUp",
  "spdUp",
  "critUp",
  "regen",
  "immunity",
  "counter",
  "protect",
  "immortal",
];

export const STACKABLE: readonly StatusId[] = ["burn", "poison"];

export interface StatusInstance {
  id: StatusId;
  turns: number; // 남은 턴 (대상의 턴이 끝날 때 1 감소)
  sourceUid: string;
  power: number; // 지속 피해량 등 시전 시점 스냅샷
  appliedTurn: number; // 걸린 시점의 turnCount (자기 턴에 건 효과는 그 턴에 줄지 않음)
}

// ---- 스킬 ----

export type SkillTarget =
  | "enemy_single"
  | "enemy_all"
  | "enemy_random3"
  | "ally_single"
  | "ally_all"
  | "ally_dead"
  | "self";

/** 효과가 적용될 대상. 생략 시 스킬의 대상 */
export type EffectTarget = "target" | "self" | "allies" | "enemies" | "lowestAlly";

export type Effect =
  | {
      type: "damage";
      multiplier: number;
      scaling?: "atk" | "def" | "maxHp";
      hits?: number;
      ignoreDef?: number; // 0~1
      bonusVsDebuffed?: number; // 디버프 걸린 대상에게 추가 배율 (0.5 = +50%)
      bonusVsStatus?: { status: StatusId; bonus: number };
      bonusByTargetMissingHp?: number; // 대상 잃은 HP 비율 × 값 만큼 추가
      bonusBySelfMissingHp?: number;
      targetMaxHpRatio?: number; // 대상 최대 HP 비례 추가 피해
      lifesteal?: number; // 준 피해의 일정 비율만큼 자신 회복
    }
  | { type: "heal"; percentMaxHp: number; target?: EffectTarget }
  | { type: "buff"; status: BuffId; turns: number; target?: EffectTarget }
  | { type: "debuff"; status: DebuffId; turns: number; chance: number; target?: EffectTarget }
  | { type: "shield"; percentCasterMaxHp: number; target?: EffectTarget }
  | { type: "gauge"; amount: number; target?: EffectTarget } // +당기기 / -밀기 (0~1)
  | { type: "cleanse"; count: number; target?: EffectTarget }
  | { type: "dispel"; count: number; chance?: number; target?: EffectTarget }
  | { type: "revive"; hpPercent: number }
  | { type: "detonate"; status: "burn" | "poison" }
  | { type: "extraTurnOnKill" }
  | { type: "cooldown"; amount: number; target?: EffectTarget } // -1 = 쿨타임 감소, +1 = 증가
  | { type: "allyFollowUp" } // 다른 아군 1명이 기본기로 협공
  | { type: "extend"; kind: "buffs" | "debuffs"; turns: number; target?: EffectTarget }; // 지속 턴 연장

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  cooldown: number; // 0 = 기본기
  target: SkillTarget;
  effects: Effect[];
  oncePerBattle?: boolean;
}

// ---- 패시브 ----

export type Passive =
  | { type: "lowHpAtkUp"; threshold: number; bonus: number }
  | { type: "lowHpDamageReduction"; threshold: number; reduction: number }
  | { type: "battleStartGauge"; amount: number; target: "self" | "allies" }
  | { type: "counterChance"; chance: number }
  | { type: "debuffedEnemyActDamage"; atkRatio: number }
  | { type: "firstAttackCrit" }
  | { type: "extraTurnOnKill"; cooldown: number }
  | { type: "autoProtect"; threshold: number; turns: number }
  | { type: "onAllyDeath"; gauge: number } // 아군이 쓰러지면 공격력 증가 + 턴 게이지 (복수)
  | { type: "endure" } // 전투당 1회, 쓰러질 피해를 받으면 HP 1로 버티고 1턴 불사
  | { type: "enrage"; threshold: number }; // HP가 기준 이하가 되면 공격력·속도 증가 (보스)

// ---- 유닛 ----

export interface UnitDef {
  id: string;
  name: string;
  job: string;
  role: string;
  element: Element;
  base: Stats; // Lv.1 스탯
  growth: Pick<Stats, "hp" | "atk" | "def">; // 레벨당 증가량
  skills: SkillDef[];
  passives?: Passive[];
  /** 적 등급 (점수 계산용) */
  rank?: "normal" | "elite" | "boss";
  /** 적 전용: 스킬 사용 우선순위 (앞일수록 먼저, 쿨타임이면 다음) */
  aiPriority?: string[];
}

export interface BattleUnit {
  uid: string;
  defId: string;
  name: string;
  side: Side;
  element: Element;
  level: number;
  stats: Stats; // 레벨 반영된 기본 스탯 (stats.hp = 최대 HP)
  hp: number;
  shield: number;
  gauge: number; // 0~1
  alive: boolean;
  skills: SkillDef[];
  passives: Passive[];
  aiPriority?: string[];
  cooldowns: Record<string, number>;
  usedSkills: Record<string, boolean>; // 전투당 1회 스킬
  statuses: StatusInstance[];
  hasAttacked: boolean;
  passiveCooldown: number; // extraTurnOnKill 패시브 쿨타임
}

/** 유물 등으로 아군 전체에 거는 전투 보정 */
export interface AllyModifiers {
  atkPct: number;
  defPct: number;
  hpPct: number;
  spd: number;
  critRate: number;
  startGauge: number;
}

export interface UnitInit {
  def: UnitDef;
  level: number;
  /** 런에서 이어지는 현재 HP (없으면 최대 HP) */
  hp?: number;
}

// ---- 전투 상태 ----

export type Outcome = "ongoing" | "win" | "lose";

export interface BattleState {
  rngState: number;
  turnCount: number;
  units: BattleUnit[];
  activeUid: string | null;
  extraTurnUid: string | null;
  outcome: Outcome;
}

export interface Action {
  skillId: string;
  targetUid?: string;
}

export type BattleEvent =
  | { type: "turn_start"; uid: string }
  | { type: "skill"; uid: string; skillId: string; targetUids: string[] }
  | {
      type: "damage";
      sourceUid: string;
      targetUid: string;
      amount: number;
      crit: boolean;
      elementMod: "advantage" | "disadvantage" | "neutral";
      absorbed: number;
    }
  | { type: "dot"; targetUid: string; status: StatusId; amount: number }
  | { type: "heal"; targetUid: string; amount: number }
  | { type: "shield"; targetUid: string; amount: number }
  | { type: "status_applied"; targetUid: string; status: StatusId; turns: number }
  | { type: "status_resisted"; targetUid: string; status: StatusId }
  | { type: "status_removed"; targetUid: string; status: StatusId }
  | { type: "gauge"; targetUid: string; amount: number }
  | { type: "stunned"; uid: string }
  | { type: "counter"; uid: string; targetUid: string }
  | { type: "guard"; uid: string; protectedUid: string }
  | { type: "follow_up"; uid: string; targetUid: string }
  | { type: "extend"; targetUid: string; kind: "buffs" | "debuffs"; turns: number }
  | { type: "revenge"; uid: string }
  | { type: "cooldown"; targetUid: string; amount: number }
  | { type: "endure"; uid: string }
  | { type: "enrage"; uid: string }
  | { type: "pressure_start" }
  | { type: "pressure"; targetUid: string; amount: number }
  | { type: "death"; uid: string }
  | { type: "revive"; uid: string; hp: number }
  | { type: "extra_turn"; uid: string }
  | { type: "battle_end"; outcome: Exclude<Outcome, "ongoing"> };

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}
