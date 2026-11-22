// 추가 동료. 에픽세븐식 스킬셋 "유형"을 참고한 오리지널 판타지 캐릭터.
// 역할별 기본 스탯 틀(PRESET)에 개별 보정만 얹어서 정의한다.
import type { Effect, Element, Passive, SkillDef, SkillTarget, Stats, UnitDef } from "@/lib/engine/types";

type Preset = "dps" | "bruiser" | "tank" | "support" | "healer" | "debuffer";

const PRESET: Record<Preset, { base: Stats; growth: UnitDef["growth"] }> = {
  dps: {
    base: { hp: 850, atk: 128, def: 40, spd: 108, critRate: 0.2, critDmg: 1.6, eff: 0.1, res: 0.1 },
    growth: { hp: 65, atk: 11, def: 3 },
  },
  bruiser: {
    base: { hp: 1100, atk: 115, def: 60, spd: 100, critRate: 0.15, critDmg: 1.5, eff: 0.1, res: 0.15 },
    growth: { hp: 90, atk: 9, def: 5 },
  },
  tank: {
    base: { hp: 1300, atk: 85, def: 85, spd: 92, critRate: 0.05, critDmg: 1.5, eff: 0.15, res: 0.25 },
    growth: { hp: 110, atk: 6, def: 7 },
  },
  support: {
    base: { hp: 950, atk: 90, def: 50, spd: 118, critRate: 0.1, critDmg: 1.5, eff: 0.2, res: 0.2 },
    growth: { hp: 75, atk: 7, def: 4 },
  },
  healer: {
    base: { hp: 1000, atk: 85, def: 55, spd: 105, critRate: 0.1, critDmg: 1.5, eff: 0.1, res: 0.2 },
    growth: { hp: 80, atk: 6, def: 4 },
  },
  debuffer: {
    base: { hp: 900, atk: 105, def: 45, spd: 110, critRate: 0.1, critDmg: 1.5, eff: 0.4, res: 0.15 },
    growth: { hp: 70, atk: 8, def: 3 },
  },
};

interface Spec {
  id: string;
  name: string;
  role: string;
  element: Element;
  preset: Preset;
  stats?: Partial<Stats>;
  skills: [SkillSpec, SkillSpec, SkillSpec];
  passives?: Passive[];
}

type SkillSpec = [name: string, description: string, cooldown: number, target: SkillTarget, effects: Effect[], oncePerBattle?: boolean];

function make(spec: Spec): UnitDef {
  const p = PRESET[spec.preset];
  const skills: SkillDef[] = spec.skills.map(([name, description, cooldown, target, effects, once], i) => ({
    id: `${spec.id}_s${i + 1}`,
    name,
    description,
    cooldown,
    target,
    effects,
    ...(once ? { oncePerBattle: true } : {}),
  }));
  return {
    id: spec.id,
    name: spec.name,
    job: spec.name,
    role: spec.role,
    element: spec.element,
    base: { ...p.base, ...spec.stats },
    growth: p.growth,
    skills,
    passives: spec.passives,
  };
}

const dmg = (multiplier: number, extra: Omit<Extract<Effect, { type: "damage" }>, "type" | "multiplier"> = {}): Effect => ({
  type: "damage",
  multiplier,
  ...extra,
});
const debuff = (status: Extract<Effect, { type: "debuff" }>["status"], chance: number, turns = 2): Effect => ({
  type: "debuff",
  status,
  turns,
  chance,
});
const buff = (status: Extract<Effect, { type: "buff" }>["status"], turns = 2, target?: "self" | "allies"): Effect => ({
  type: "buff",
  status,
  turns,
  ...(target ? { target } : {}),
});

// ---- 🔥 화염 ----

export const FIREFIGHTER = make({
  id: "firefighter",
  name: "화염 파수꾼",
  role: "탱커 / 정화",
  element: "fire",
  preset: "tank",
  skills: [
    ["전투 도끼", "적 1명에게 방어력에 비례한 피해를 준다.", 0, "enemy_single", [dmg(1.2, { scaling: "def" })]],
    ["불꽃 진압", "아군 전체의 디버프를 2개 해제하고 2턴간 방어력을 증가시킨다.", 4, "ally_all", [{ type: "cleanse", count: 2 }, buff("defUp")]],
    ["역화", "적 전체에게 방어력에 비례한 피해를 주고, 50% 확률로 화상을 건다.", 4, "enemy_all", [dmg(0.8, { scaling: "def" }), debuff("burn", 0.5)]],
  ],
  passives: [{ type: "lowHpDamageReduction", threshold: 0.5, reduction: 0.25 }],
});

export const MERCENARY = make({
  id: "mercenary",
  name: "광전사",
  role: "광전사",
  element: "fire",
  preset: "bruiser",
  stats: { atk: 125, critRate: 0.2 },
  skills: [
    ["난도질", "적 1명에게 피해를 준다. 자신의 HP가 낮을수록 피해가 커진다.", 0, "enemy_single", [dmg(1.0, { bonusBySelfMissingHp: 0.8 })]],
    ["피의 맹세", "3턴간 자신의 공격력과 치명 확률이 증가한다.", 4, "self", [buff("atkUp", 3, "self"), buff("critUp", 3, "self")]],
    ["학살", "적 전체에게 피해를 준다. HP가 낮을수록 강해지고, 처치하면 한 번 더 행동한다.", 4, "enemy_all", [dmg(0.9, { bonusBySelfMissingHp: 1.0 }), { type: "extraTurnOnKill" }]],
  ],
  passives: [{ type: "enrage", threshold: 0.4 }],
});

export const CHEF = make({
  id: "chef",
  name: "화로의 무녀",
  role: "힐러 / 버퍼",
  element: "fire",
  preset: "healer",
  skills: [
    ["불꽃 손짓", "적 1명을 2번 공격한다.", 0, "enemy_single", [dmg(0.55, { hits: 2 })]],
    ["화로의 축복", "아군 전체를 회복시키고 2턴간 공격력을 증가시킨다.", 4, "ally_all", [{ type: "heal", percentMaxHp: 0.15 }, buff("atkUp")]],
    ["불꽃 연회", "아군 전체에게 3턴간 지속 회복과 치명 확률 증가를 건다.", 5, "ally_all", [buff("regen", 3), buff("critUp", 3)]],
  ],
});

export const DEMOLITIONIST = make({
  id: "demolitionist",
  name: "운석 마법사",
  role: "광역 딜러",
  element: "fire",
  preset: "dps",
  stats: { critRate: 0.15 },
  skills: [
    ["화염탄", "적 1명에게 피해를 주고, 40% 확률로 화상을 건다.", 0, "enemy_single", [dmg(0.9), debuff("burn", 0.4)]],
    ["불씨 지대", "적 전체에게 피해를 주고, 50% 확률로 속도를 감소시킨다.", 3, "enemy_all", [dmg(0.6), debuff("spdDown", 0.5)]],
    ["운석 낙하", "적 전체에게 큰 피해를 준다.", 5, "enemy_all", [dmg(1.3)]],
  ],
});

// ---- ❄️ 빙결 ----

export const WEATHER_CASTER = make({
  id: "weather_caster",
  name: "눈보라 마법사",
  role: "광역 컨트롤",
  element: "ice",
  preset: "debuffer",
  skills: [
    ["우박", "적 1명에게 피해를 주고, 30% 확률로 속도를 감소시킨다.", 0, "enemy_single", [dmg(1.0), debuff("spdDown", 0.3)]],
    ["한파", "적 전체의 턴 게이지를 25% 밀어내고, 60% 확률로 속도를 감소시킨다.", 4, "enemy_all", [{ type: "gauge", amount: -0.25 }, debuff("spdDown", 0.6)]],
    ["블리자드", "적 전체에게 피해를 주고, 25% 확률로 기절시킨다.", 5, "enemy_all", [dmg(0.9), debuff("stun", 0.25, 1)]],
  ],
});

export const FIGURE_SKATER = make({
  id: "figure_skater",
  name: "빙결 검무사",
  role: "속공 딜러",
  element: "ice",
  preset: "dps",
  stats: { spd: 122, hp: 820 },
  skills: [
    ["빙결 회전베기", "적 1명을 2번 공격한다.", 0, "enemy_single", [dmg(0.6, { hits: 2 })]],
    ["얼음 질주", "적 1명에게 큰 피해를 주고, 자신의 턴 게이지를 50% 당긴다.", 3, "enemy_single", [dmg(1.5), { type: "gauge", amount: 0.5, target: "self" }]],
    ["빙화난무", "무작위 적에게 3번 피해를 주고, 처치하면 한 번 더 행동한다.", 4, "enemy_random3", [dmg(0.8), { type: "extraTurnOnKill" }]],
  ],
  passives: [{ type: "battleStartGauge", amount: 0.2, target: "self" }],
});

export const CORONER = make({
  id: "coroner",
  name: "서리 심문관",
  role: "디버프 연계 딜러",
  element: "ice",
  preset: "debuffer",
  stats: { atk: 115 },
  skills: [
    ["서리 단검", "적 1명에게 피해를 주고, 35% 확률로 방어력을 감소시킨다.", 0, "enemy_single", [dmg(1.0), debuff("defDown", 0.35)]],
    ["심문", "적 1명에게 피해를 준다. 디버프가 걸린 적에게 피해 +100%.", 3, "enemy_single", [dmg(1.2, { bonusVsDebuffed: 1.0 })]],
    ["진실의 서리", "적 전체에게 피해를 주고 버프를 2개 해제하며, 60% 확률로 회복 불가를 건다.", 4, "enemy_all", [dmg(0.5), { type: "dispel", count: 2 }, debuff("unhealable", 0.6)]],
  ],
});

export const GOALIE = make({
  id: "goalie",
  name: "빙벽 수문장",
  role: "반격 탱커",
  element: "ice",
  preset: "tank",
  skills: [
    ["방패 밀치기", "적 1명에게 피해를 주고, 30% 확률로 도발한다.", 0, "enemy_single", [dmg(1.0), debuff("provoke", 0.3, 1)]],
    ["빙벽", "자신에게 보호막을 씌우고 2턴간 반격 상태가 된다.", 4, "self", [{ type: "shield", percentCasterMaxHp: 0.3, target: "self" }, buff("counter", 2, "self")]],
    ["얼음 파편", "무작위 적에게 방어력에 비례한 피해를 3번 준다.", 4, "enemy_random3", [dmg(0.6, { scaling: "def" })]],
  ],
  passives: [{ type: "counterChance", chance: 0.2 }],
});

// ---- 🪨 대지 ----

export const EXCAVATOR = make({
  id: "excavator",
  name: "바위 거인",
  role: "HP 비례 브루저",
  element: "earth",
  preset: "bruiser",
  stats: { hp: 1250 },
  skills: [
    ["바위 주먹", "자신의 최대 HP에 비례한 피해를 준다.", 0, "enemy_single", [dmg(0.08, { scaling: "maxHp" })]],
    ["대지 분쇄", "자신의 최대 HP에 비례한 큰 피해를 주고, 30% 확률로 기절시킨다.", 3, "enemy_single", [dmg(0.12, { scaling: "maxHp" }), debuff("stun", 0.3, 1)]],
    ["암석 갑주", "아군 전체에게 자신의 최대 HP에 비례한 보호막을 씌운다.", 5, "ally_all", [{ type: "shield", percentCasterMaxHp: 0.12 }]],
  ],
  passives: [{ type: "lowHpDamageReduction", threshold: 0.5, reduction: 0.2 }],
});

export const MOUNTAINEER = make({
  id: "mountaineer",
  name: "드루이드",
  role: "서포터",
  element: "earth",
  preset: "support",
  skills: [
    ["가시 덩굴", "적 1명에게 피해를 준다.", 0, "enemy_single", [dmg(1.0)]],
    ["생명의 덩굴", "아군 1명을 회복시키고 턴 게이지를 30% 당긴다.", 3, "ally_single", [{ type: "heal", percentMaxHp: 0.25 }, { type: "gauge", amount: 0.3 }]],
    ["대지의 축복", "아군 전체의 방어력과 속도를 2턴간 증가시킨다.", 4, "ally_all", [buff("defUp"), buff("spdUp")]],
  ],
});

export const ARCHAEOLOGIST = make({
  id: "archaeologist",
  name: "시간술사",
  role: "쿨타임 조작",
  element: "earth",
  preset: "debuffer",
  skills: [
    ["시간 균열", "적 1명에게 피해를 주고, 30% 확률로 버프를 1개 해제한다.", 0, "enemy_single", [dmg(1.0), { type: "dispel", count: 1, chance: 0.3 }]],
    ["시간 가속", "아군 전체의 스킬 쿨타임을 1턴 줄이고 디버프를 1개 해제한다.", 5, "ally_all", [{ type: "cooldown", amount: -1 }, { type: "cleanse", count: 1 }]],
    ["시간 정지", "적 전체의 스킬 쿨타임을 1턴 늘리고, 50% 확률로 공격력을 감소시킨다.", 4, "enemy_all", [{ type: "cooldown", amount: 1 }, debuff("atkDown", 0.5)]],
  ],
});

export const FIXER = make({
  id: "fixer",
  name: "용병단장",
  role: "협공 리더",
  element: "earth",
  preset: "bruiser",
  skills: [
    ["대검 내려치기", "적 1명에게 피해를 준다.", 0, "enemy_single", [dmg(1.0)]],
    ["돌격 명령", "적 1명에게 피해를 주고, 다른 아군 1명이 기본기로 협공한다.", 3, "enemy_single", [dmg(1.2), { type: "allyFollowUp" }]],
    ["전우의 맹세", "아군 전체의 공격력을 2턴간 증가시키고 턴 게이지를 15% 당긴다.", 4, "ally_all", [buff("atkUp"), { type: "gauge", amount: 0.15 }]],
  ],
});

// ---- ✨ 빛 ----

export const PARAMEDIC = make({
  id: "paramedic",
  name: "성녀",
  role: "힐러 / 부활",
  element: "light",
  preset: "healer",
  skills: [
    ["성스러운 빛", "적 1명에게 피해를 주고 턴 게이지를 10% 밀어낸다.", 0, "enemy_single", [dmg(0.8), { type: "gauge", amount: -0.1 }]],
    ["치유의 기도", "아군 1명을 크게 회복시키고 2턴간 지속 회복을 건다.", 3, "ally_single", [{ type: "heal", percentMaxHp: 0.35 }, buff("regen")]],
    ["기적", "쓰러진 아군 1명을 HP 50%로 되살린다. (전투당 1회)", 5, "ally_dead", [{ type: "revive", hpPercent: 0.5 }], true],
  ],
});

export const LAWYER = make({
  id: "lawyer",
  name: "이단심문관",
  role: "봉쇄 디버퍼",
  element: "light",
  preset: "debuffer",
  skills: [
    ["단죄", "적 1명에게 피해를 주고, 50% 확률로 버프를 1개 해제한다.", 0, "enemy_single", [dmg(1.0), { type: "dispel", count: 1, chance: 0.5 }]],
    ["금제", "적 1명의 버프를 모두 해제하고 스킬 쿨타임을 2턴 늘린다.", 4, "enemy_single", [{ type: "dispel", count: 99 }, { type: "cooldown", amount: 2 }]],
    ["이단 선고", "적 전체에게 피해를 주고, 각각 50% 확률로 공격력·방어력을 감소시킨다.", 4, "enemy_all", [dmg(0.6), debuff("atkDown", 0.5), debuff("defDown", 0.5)]],
  ],
});

export const STREAMER = make({
  id: "streamer",
  name: "빛의 전령",
  role: "속공 서포터",
  element: "light",
  preset: "support",
  stats: { spd: 124 },
  skills: [
    ["빛의 화살", "적 1명에게 피해를 준다.", 0, "enemy_single", [dmg(1.0)]],
    ["찬란한 나팔", "아군 전체의 치명 확률을 2턴간 증가시키고 턴 게이지를 20% 당긴다.", 4, "ally_all", [buff("critUp"), { type: "gauge", amount: 0.2 }]],
    ["신속의 계시", "아군 1명을 즉시 행동하게 하고 2턴간 공격력을 증가시킨다.", 4, "ally_single", [{ type: "gauge", amount: 1 }, buff("atkUp")]],
  ],
  passives: [{ type: "battleStartGauge", amount: 0.1, target: "allies" }],
});

export const ANGEL_CONTRACTOR = make({
  id: "angel_contractor",
  name: "천사 계약자",
  role: "수호 서포터",
  element: "light",
  preset: "healer",
  stats: { atk: 100 },
  skills: [
    ["성흔", "적 1명에게 피해를 준다.", 0, "enemy_single", [dmg(1.0)]],
    ["수호의 날개", "아군 전체에게 1턴간 불사를 걸고 보호막을 씌운다.", 5, "ally_all", [buff("immortal", 1), { type: "shield", percentCasterMaxHp: 0.1 }]],
    ["심판의 빛", "적 전체에게 피해를 준다. 디버프가 걸린 적에게 피해 +50%.", 4, "enemy_all", [dmg(0.9, { bonusVsDebuffed: 0.5 })]],
  ],
});

// ---- 🌑 어둠 ----

export const LOAN_SHARK = make({
  id: "loan_shark",
  name: "탐욕의 악마",
  role: "흡혈 처형자",
  element: "dark",
  preset: "dps",
  stats: { hp: 950 },
  skills: [
    ["탐욕의 손", "적 1명에게 피해를 주고, 준 피해의 30%만큼 회복한다.", 0, "enemy_single", [dmg(1.0, { lifesteal: 0.3 })]],
    ["강탈", "적 1명의 버프를 2개 해제하고, 70% 확률로 공격력을 감소시킨다.", 3, "enemy_single", [dmg(0.8), { type: "dispel", count: 2 }, debuff("atkDown", 0.7)]],
    ["영혼 징수", "적 1명에게 피해를 준다. 대상의 HP가 낮을수록 강해지고, 처치하면 한 번 더 행동한다.", 4, "enemy_single", [dmg(1.2, { bonusByTargetMissingHp: 1.5 }), { type: "extraTurnOnKill" }]],
  ],
});

export const SHAMAN = make({
  id: "shaman",
  name: "주술사",
  role: "컨트롤 / 정화",
  element: "dark",
  preset: "debuffer",
  skills: [
    ["저주 인형", "적 1명에게 피해를 주고, 50% 확률로 독을 건다.", 0, "enemy_single", [dmg(0.9), debuff("poison", 0.5)]],
    ["빙의", "적 1명을 60% 확률로 기절시키고 턴 게이지를 30% 밀어낸다.", 4, "enemy_single", [debuff("stun", 0.6, 1), { type: "gauge", amount: -0.3 }]],
    ["정화 의식", "아군 전체의 디버프를 모두 해제하고 조금 회복시킨다.", 4, "ally_all", [{ type: "cleanse", count: 99 }, { type: "heal", percentMaxHp: 0.1 }]],
  ],
});

export const INFO_BROKER = make({
  id: "info_broker",
  name: "밤의 첩자",
  role: "속공 디버퍼",
  element: "dark",
  preset: "debuffer",
  stats: { spd: 120 },
  skills: [
    ["약점 찌르기", "적 1명에게 피해를 주고, 35% 확률로 방어력을 감소시킨다.", 0, "enemy_single", [dmg(1.0), debuff("defDown", 0.35)]],
    ["약점 간파", "적 전체에게 70% 확률로 방어력 감소, 50% 확률로 속도 감소를 건다.", 4, "enemy_all", [debuff("defDown", 0.7), debuff("spdDown", 0.5)]],
    ["그림자 속박", "적 1명의 턴 게이지를 50% 밀어내고, 40% 확률로 기절시킨다.", 4, "enemy_single", [{ type: "gauge", amount: -0.5 }, debuff("stun", 0.4, 1)]],
  ],
  passives: [{ type: "battleStartGauge", amount: 0.25, target: "self" }],
});

export const NECROMANCER = make({
  id: "necromancer",
  name: "강령술사",
  role: "흡수 / 부활",
  element: "dark",
  preset: "debuffer",
  stats: { hp: 950 },
  skills: [
    ["영혼 흡수", "적 1명에게 피해를 주고, 준 피해의 50%만큼 회복한다.", 0, "enemy_single", [dmg(1.0, { lifesteal: 0.5 })]],
    ["망자의 군단", "무작위 적에게 3번 피해를 준다.", 4, "enemy_random3", [dmg(0.7)]],
    ["사령 부활", "쓰러진 아군 1명을 HP 30%로 되살린다. (전투당 1회)", 5, "ally_dead", [{ type: "revive", hpPercent: 0.3 }], true],
  ],
  passives: [{ type: "debuffedEnemyActDamage", atkRatio: 0.15 }],
});

// ---- 추가 11명 (에픽세븐 스킬셋 유형 참고) ----

// 🔥 불사조형: 쓰러져도 한 번 버티는 브루저
export const PHOENIX_KNIGHT = make({
  id: "phoenix_knight",
  name: "불사조 기사",
  role: "불굴의 브루저",
  element: "fire",
  preset: "bruiser",
  skills: [
    ["화염창", "적 1명에게 피해를 주고, 30% 확률로 화상을 건다.", 0, "enemy_single", [dmg(1.0), debuff("burn", 0.3)]],
    ["불사조의 날개", "아군 전체의 공격력을 2턴간 증가시키고 디버프를 1개 해제한다.", 4, "ally_all", [buff("atkUp"), { type: "cleanse", count: 1 }]],
    ["재의 부활", "적 전체에게 피해를 준다. 자신의 HP가 낮을수록 피해가 커진다.", 4, "enemy_all", [dmg(0.9, { bonusBySelfMissingHp: 0.8 })]],
  ],
  passives: [{ type: "endure" }],
});

// 🔥 복수형: 아군이 쓰러지면 분노하는 딜러
export const DRAGONBLOOD = make({
  id: "dragonblood",
  name: "용혈 전사",
  role: "복수의 딜러",
  element: "fire",
  preset: "dps",
  stats: { hp: 950 },
  skills: [
    ["용조", "적 1명에게 피해를 준다.", 0, "enemy_single", [dmg(1.05)]],
    ["용의 포효", "적 전체에게 피해를 주고, 50% 확률로 공격력을 감소시킨다.", 3, "enemy_all", [dmg(0.6), debuff("atkDown", 0.5)]],
    ["드래곤 브레스", "적 전체에게 큰 피해를 주고, 50% 확률로 화상을 건다.", 5, "enemy_all", [dmg(1.1), debuff("burn", 0.5)]],
  ],
  passives: [{ type: "onAllyDeath", gauge: 0.5 }],
});

// 🔥 도트 딜러: 화상을 쌓고 지속 시간을 늘린다
export const EMBER_WITCH = make({
  id: "ember_witch",
  name: "잿불의 마녀",
  role: "도트 딜러",
  element: "fire",
  preset: "debuffer",
  stats: { atk: 115, eff: 0.45 },
  skills: [
    ["불티", "적 1명에게 피해를 주고, 70% 확률로 화상을 건다.", 0, "enemy_single", [dmg(0.8), debuff("burn", 0.7)]],
    ["잿불 폭풍", "적 전체에게 약한 피해를 주고, 각각 화상을 2번(60%) 건다.", 4, "enemy_all", [dmg(0.25), debuff("burn", 0.6), debuff("burn", 0.6)]],
    ["꺼지지 않는 불", "적 전체의 디버프 지속 시간을 2턴 늘리고, 화상에 걸린 적에게 추가 피해를 준다.", 4, "enemy_all", [dmg(0.4, { bonusVsStatus: { status: "burn", bonus: 1.0 } }), { type: "extend", kind: "debuffs", turns: 2 }]],
  ],
  passives: [{ type: "debuffedEnemyActDamage", atkRatio: 0.12 }],
});

// ❄️ 디버프 연장 컨트롤러
export const GLACIER_QUEEN = make({
  id: "glacier_queen",
  name: "빙하의 여왕",
  role: "디버프 연장 컨트롤",
  element: "ice",
  preset: "debuffer",
  skills: [
    ["서리창", "적 1명에게 피해를 주고, 40% 확률로 속도를 감소시킨다.", 0, "enemy_single", [dmg(1.0), debuff("spdDown", 0.4)]],
    ["영원한 겨울", "적 전체의 디버프 지속 시간을 1턴 늘리고, 턴 게이지를 15% 밀어낸다.", 4, "enemy_all", [{ type: "extend", kind: "debuffs", turns: 1 }, { type: "gauge", amount: -0.15 }]],
    ["빙결의 왕좌", "적 전체에게 피해를 주고, 35% 확률로 기절시킨다.", 5, "enemy_all", [dmg(0.8), debuff("stun", 0.35, 1)]],
  ],
});

// ❄️ 협공 + 아군 가속
export const FROST_WOLF_RIDER = make({
  id: "frost_wolf_rider",
  name: "서리늑대 기수",
  role: "협공 / 가속",
  element: "ice",
  preset: "dps",
  stats: { spd: 116 },
  skills: [
    ["늑대 발톱", "적 1명을 2번 공격한다.", 0, "enemy_single", [dmg(0.55, { hits: 2 })]],
    ["무리 사냥", "적 1명에게 피해를 주고, 다른 아군 1명이 기본기로 협공한다.", 3, "enemy_single", [dmg(1.2), { type: "allyFollowUp" }]],
    ["설원 질주", "아군 전체의 속도를 2턴간 증가시키고 턴 게이지를 25% 당긴다.", 5, "ally_all", [buff("spdUp"), { type: "gauge", amount: 0.25 }]],
  ],
});

// 🪨 방어력 비례 광역 탱커
export const GOLEM_MASTER = make({
  id: "golem_master",
  name: "골렘술사",
  role: "방어형 광역 탱커",
  element: "earth",
  preset: "tank",
  skills: [
    ["바위 투척", "적 1명에게 방어력에 비례한 피해를 준다.", 0, "enemy_single", [dmg(1.2, { scaling: "def" })]],
    ["골렘의 가호", "아군 전체에게 보호막을 씌우고 2턴간 방어력을 증가시킨다.", 4, "ally_all", [{ type: "shield", percentCasterMaxHp: 0.1 }, buff("defUp")]],
    ["대지 진동", "적 전체에게 방어력에 비례한 피해를 주고, 20% 확률로 기절시킨다.", 4, "enemy_all", [dmg(0.8, { scaling: "def" }), debuff("stun", 0.2, 1)]],
  ],
});

// 🪨 반격 검객
export const DESERT_BLADE = make({
  id: "desert_blade",
  name: "사막의 검객",
  role: "반격 딜러",
  element: "earth",
  preset: "dps",
  stats: { hp: 950, def: 50 },
  skills: [
    ["곡도 베기", "적 1명에게 피해를 준다.", 0, "enemy_single", [dmg(1.0)]],
    ["모래바람", "적 전체에게 피해를 주고, 50% 확률로 공격력을 감소시킨다.", 3, "enemy_all", [dmg(0.5), debuff("atkDown", 0.5)]],
    ["일섬", "적 1명에게 방어력을 30% 무시하는 매우 큰 피해를 준다.", 4, "enemy_single", [dmg(2.0, { ignoreDef: 0.3 })]],
  ],
  passives: [{ type: "counterChance", chance: 0.3 }],
});

// ✨ 버프 연장 서포터
export const SUN_APOSTLE = make({
  id: "sun_apostle",
  name: "태양의 사도",
  role: "버프 연장 서포터",
  element: "light",
  preset: "support",
  skills: [
    ["태양창", "적 1명에게 피해를 준다.", 0, "enemy_single", [dmg(1.0)]],
    ["태양의 가호", "아군 전체의 버프 지속 시간을 1턴 늘리고 조금 회복시킨다.", 3, "ally_all", [{ type: "extend", kind: "buffs", turns: 1 }, { type: "heal", percentMaxHp: 0.1 }]],
    ["정오의 빛", "아군 전체의 공격력과 치명 확률을 2턴간 증가시킨다.", 5, "ally_all", [buff("atkUp"), buff("critUp")]],
  ],
});

// ✨ 대상 최대 HP 비례 딜러 (보스 킬러)
export const SCALES_OF_JUDGMENT = make({
  id: "scales_of_judgment",
  name: "심판의 천칭",
  role: "보스 킬러",
  element: "light",
  preset: "dps",
  skills: [
    ["천칭의 일격", "적 1명에게 피해를 준다. 대상 최대 HP의 4%만큼 추가 피해.", 0, "enemy_single", [dmg(1.0, { targetMaxHpRatio: 0.04 })]],
    ["공정한 심판", "적 1명에게 피해를 준다. 대상 최대 HP의 12%만큼 추가 피해.", 4, "enemy_single", [dmg(1.0, { targetMaxHpRatio: 0.12 })]],
    ["정의 집행", "적 전체에게 피해를 주고 버프를 1개 해제한다.", 4, "enemy_all", [dmg(0.7), { type: "dispel", count: 1 }]],
  ],
});

// 🌑 흡혈 도발 탱커
export const ABYSS_LORD = make({
  id: "abyss_lord",
  name: "나락의 기사",
  role: "흡혈 탱커",
  element: "dark",
  preset: "tank",
  stats: { atk: 95 },
  skills: [
    ["흑검", "적 1명에게 피해를 주고, 준 피해의 30%만큼 회복한다.", 0, "enemy_single", [dmg(1.0, { lifesteal: 0.3 })]],
    ["절망의 도발", "70% 확률로 적 전체를 도발하고, 2턴간 자신의 방어력을 증가시킨다.", 4, "enemy_all", [debuff("provoke", 0.7, 1), buff("defUp", 2, "self")]],
    ["나락의 계약", "2턴간 불사 상태가 되고 반격한다.", 5, "self", [buff("immortal", 2, "self"), buff("counter", 2, "self")]],
  ],
});

// 🌑 수면(기절) + 디버프 연계
export const DREAM_WITCH = make({
  id: "dream_witch",
  name: "악몽의 마녀",
  role: "수면 컨트롤",
  element: "dark",
  preset: "debuffer",
  skills: [
    ["악몽", "적 1명에게 피해를 주고, 30% 확률로 공격력을 감소시킨다.", 0, "enemy_single", [dmg(1.0), debuff("atkDown", 0.3)]],
    ["깊은 잠", "적 1명을 70% 확률로 2턴간 기절시킨다.", 4, "enemy_single", [debuff("stun", 0.7, 2)]],
    ["악몽 폭발", "적 전체에게 피해를 준다. 디버프가 걸린 적에게 피해 +60%.", 4, "enemy_all", [dmg(0.8, { bonusVsDebuffed: 0.6 })]],
  ],
});

export const EXTRA_COMPANIONS: UnitDef[] = [
  FIREFIGHTER,
  MERCENARY,
  CHEF,
  DEMOLITIONIST,
  WEATHER_CASTER,
  FIGURE_SKATER,
  CORONER,
  GOALIE,
  EXCAVATOR,
  MOUNTAINEER,
  ARCHAEOLOGIST,
  FIXER,
  PARAMEDIC,
  LAWYER,
  STREAMER,
  ANGEL_CONTRACTOR,
  LOAN_SHARK,
  SHAMAN,
  INFO_BROKER,
  NECROMANCER,
  PHOENIX_KNIGHT,
  DRAGONBLOOD,
  EMBER_WITCH,
  GLACIER_QUEEN,
  FROST_WOLF_RIDER,
  GOLEM_MASTER,
  DESERT_BLADE,
  SUN_APOSTLE,
  SCALES_OF_JUDGMENT,
  ABYSS_LORD,
  DREAM_WITCH,
];
