// 탑의 적. 1층 적 3종은 직접 정의하고, 2층부터는 역할별 틀(archetype)로 만든다.
import type { DebuffId, Element, UnitDef } from "@/lib/engine/types";

export const RAIL_DEVOURER: UnitDef = {
  id: "rail_devourer",
  name: "선로 포식자",
  job: "괴수",
  role: "브루저",
  element: "earth",
  base: { hp: 900, atk: 175, def: 55, spd: 95, critRate: 0.1, critDmg: 1.5, eff: 0.1, res: 0.1 },
  growth: { hp: 110, atk: 8, def: 5 },
  skills: [
    {
      id: "rail_devourer_s1",
      name: "물어뜯기",
      description: "적 1명에게 피해를 준다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0 }],
    },
    {
      id: "rail_devourer_s2",
      name: "몸통 박치기",
      description: "적 1명에게 큰 피해를 주고, 30% 확률로 1턴간 기절시킨다.",
      cooldown: 3,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.4 },
        { type: "debuff", status: "stun", turns: 1, chance: 0.3 },
      ],
    },
  ],
  aiPriority: ["rail_devourer_s2", "rail_devourer_s1"],
};

export const SHADOW_WRAITH: UnitDef = {
  id: "shadow_wraith",
  name: "그림자 망령",
  job: "망령",
  role: "디버퍼",
  element: "dark",
  base: { hp: 560, atk: 180, def: 35, spd: 112, critRate: 0.1, critDmg: 1.5, eff: 0.2, res: 0.1 },
  growth: { hp: 60, atk: 8, def: 3 },
  skills: [
    {
      id: "shadow_wraith_s1",
      name: "할퀴기",
      description: "적 1명에게 피해를 준다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0 }],
    },
    {
      id: "shadow_wraith_s2",
      name: "저주의 속삭임",
      description: "적 전체에게 피해를 주고, 50% 확률로 2턴간 방어력을 감소시킨다.",
      cooldown: 3,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.5 },
        { type: "debuff", status: "defDown", turns: 2, chance: 0.5 },
      ],
    },
  ],
  aiPriority: ["shadow_wraith_s2", "shadow_wraith_s1"],
};

export const FLAME_IMP: UnitDef = {
  id: "flame_imp",
  name: "불꽃 도깨비",
  job: "도깨비",
  role: "속공 딜러",
  element: "fire",
  base: { hp: 500, atk: 185, def: 30, spd: 122, critRate: 0.15, critDmg: 1.5, eff: 0.2, res: 0.1 },
  growth: { hp: 55, atk: 9, def: 3 },
  skills: [
    {
      id: "flame_imp_s1",
      name: "불씨",
      description: "적 1명에게 피해를 주고, 40% 확률로 2턴간 화상을 건다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "debuff", status: "burn", turns: 2, chance: 0.4 },
      ],
    },
    {
      id: "flame_imp_s2",
      name: "불춤",
      description: "무작위 적에게 3번 피해를 준다.",
      cooldown: 3,
      target: "enemy_random3",
      effects: [{ type: "damage", multiplier: 0.6 }],
    },
  ],
  aiPriority: ["flame_imp_s2", "flame_imp_s1"],
};

/** 1층 적 */
export const ENEMIES: UnitDef[] = [RAIL_DEVOURER, SHADOW_WRAITH, FLAME_IMP];

// ---- 역할별 틀 ----

type Archetype = "bruiser" | "debuffer" | "striker" | "tank" | "healer" | "controller" | "assassin";

interface EnemySpec {
  id: string;
  name: string;
  job: string;
  element: Element;
  archetype: Archetype;
  skillNames: [string, string];
  /** 기본기에 붙는 디버프 (속공형 등) */
  rider?: DebuffId;
}

const ARCHETYPE_ROLE: Record<Archetype, string> = {
  bruiser: "브루저",
  debuffer: "디버퍼",
  striker: "속공 딜러",
  tank: "탱커",
  healer: "힐러",
  controller: "컨트롤",
  assassin: "암살자",
};

function makeEnemy(spec: EnemySpec): UnitDef {
  const { id, archetype: a } = spec;
  const [n1, n2] = spec.skillNames;
  const s1 = `${id}_s1`;
  const s2 = `${id}_s2`;
  const common = {
    id,
    name: spec.name,
    job: spec.job,
    role: ARCHETYPE_ROLE[a],
    element: spec.element,
    rank: "normal" as const,
    aiPriority: [s2, s1],
  };
  const basic = (mult = 1): UnitDef["skills"][number] => ({
    id: s1,
    name: n1,
    description: spec.rider ? "적 1명에게 피해를 주고, 확률로 디버프를 건다." : "적 1명에게 피해를 준다.",
    cooldown: 0,
    target: "enemy_single",
    effects: [
      { type: "damage", multiplier: mult },
      ...(spec.rider ? [{ type: "debuff" as const, status: spec.rider, turns: 2, chance: 0.35 }] : []),
    ],
  });

  switch (a) {
    case "bruiser":
      return {
        ...common,
        base: { hp: 950, atk: 190, def: 55, spd: 95, critRate: 0.1, critDmg: 1.5, eff: 0.1, res: 0.1 },
        growth: { hp: 110, atk: 12, def: 5 },
        skills: [
          basic(),
          {
            id: s2,
            name: n2,
            description: "적 1명에게 큰 피해를 주고, 30% 확률로 기절시킨다.",
            cooldown: 3,
            target: "enemy_single",
            effects: [
              { type: "damage", multiplier: 1.4 },
              { type: "debuff", status: "stun", turns: 1, chance: 0.3 },
            ],
          },
        ],
      };
    case "debuffer":
      return {
        ...common,
        base: { hp: 600, atk: 195, def: 35, spd: 112, critRate: 0.1, critDmg: 1.5, eff: 0.25, res: 0.1 },
        growth: { hp: 65, atk: 12, def: 3 },
        skills: [
          basic(),
          {
            id: s2,
            name: n2,
            description: "적 전체에게 피해를 주고, 50% 확률로 방어력을 감소시킨다.",
            cooldown: 3,
            target: "enemy_all",
            effects: [
              { type: "damage", multiplier: 0.5 },
              { type: "debuff", status: "defDown", turns: 2, chance: 0.5 },
            ],
          },
        ],
      };
    case "striker":
      return {
        ...common,
        base: { hp: 520, atk: 205, def: 30, spd: 122, critRate: 0.15, critDmg: 1.5, eff: 0.2, res: 0.1 },
        growth: { hp: 55, atk: 13, def: 3 },
        skills: [
          basic(),
          {
            id: s2,
            name: n2,
            description: "무작위 적에게 3번 피해를 준다.",
            cooldown: 3,
            target: "enemy_random3",
            effects: [{ type: "damage", multiplier: 0.6 }],
          },
        ],
      };
    case "tank":
      return {
        ...common,
        base: { hp: 1300, atk: 150, def: 90, spd: 88, critRate: 0.05, critDmg: 1.5, eff: 0.15, res: 0.2 },
        growth: { hp: 150, atk: 9, def: 8 },
        skills: [
          {
            ...basic(),
            description: "적 1명에게 피해를 주고, 30% 확률로 도발한다.",
            effects: [
              { type: "damage", multiplier: 1.0 },
              { type: "debuff", status: "provoke", turns: 1, chance: 0.3 },
            ],
          },
          {
            id: s2,
            name: n2,
            description: "자신에게 보호막을 씌우고 방어력을 증가시킨다.",
            cooldown: 4,
            target: "self",
            effects: [
              { type: "shield", percentCasterMaxHp: 0.25, target: "self" },
              { type: "buff", status: "defUp", turns: 2, target: "self" },
            ],
          },
        ],
        passives: [{ type: "counterChance", chance: 0.2 }],
      };
    case "healer":
      return {
        ...common,
        base: { hp: 750, atk: 155, def: 45, spd: 105, critRate: 0.05, critDmg: 1.5, eff: 0.1, res: 0.15 },
        growth: { hp: 80, atk: 9, def: 4 },
        skills: [
          basic(),
          {
            id: s2,
            name: n2,
            description: "아군 전체를 회복시키고 디버프를 1개 해제한다.",
            cooldown: 4,
            target: "ally_all",
            effects: [
              { type: "heal", percentMaxHp: 0.2 },
              { type: "cleanse", count: 1 },
            ],
          },
        ],
      };
    case "controller":
      return {
        ...common,
        base: { hp: 700, atk: 175, def: 40, spd: 115, critRate: 0.1, critDmg: 1.5, eff: 0.3, res: 0.15 },
        growth: { hp: 75, atk: 10, def: 3 },
        skills: [
          {
            ...basic(),
            description: "적 1명에게 피해를 주고 턴 게이지를 15% 밀어낸다.",
            effects: [
              { type: "damage", multiplier: 1.0 },
              { type: "gauge", amount: -0.15 },
            ],
          },
          {
            id: s2,
            name: n2,
            description: "적 1명에게 피해를 주고, 50% 확률로 기절시킨다.",
            cooldown: 4,
            target: "enemy_single",
            effects: [
              { type: "damage", multiplier: 1.2 },
              { type: "debuff", status: "stun", turns: 1, chance: 0.5 },
            ],
          },
        ],
      };
    case "assassin":
      return {
        ...common,
        base: { hp: 600, atk: 200, def: 30, spd: 125, critRate: 0.2, critDmg: 1.5, eff: 0.1, res: 0.1 },
        growth: { hp: 60, atk: 11, def: 3 },
        skills: [
          basic(1.1),
          {
            id: s2,
            name: n2,
            description: "적 1명에게 큰 피해를 준다. 대상의 HP가 낮을수록 피해가 커진다.",
            cooldown: 3,
            target: "enemy_single",
            effects: [{ type: "damage", multiplier: 1.5, bonusByTargetMissingHp: 1.0 }],
          },
        ],
      };
  }
}

const E = (spec: EnemySpec) => makeEnemy(spec);

// 2층: 폐쇄된 학교
export const CORRIDOR_GHOST = E({ id: "corridor_ghost", name: "복도 괴담", job: "괴담", element: "dark", archetype: "debuffer", skillNames: ["속삭임", "괴담 퍼뜨리기"] });
export const LAB_SLIME = E({ id: "lab_slime", name: "과학실 슬라임", job: "슬라임", element: "ice", archetype: "tank", skillNames: ["끈적한 몸통", "점액 장벽"] });
export const PLASTER_STATUE = E({ id: "plaster_statue", name: "미술실 석고상", job: "석상", element: "earth", archetype: "bruiser", skillNames: ["석고 주먹", "내려찍기"] });

// 3층: 침수된 하수도
export const SEWER_CROC = E({ id: "sewer_croc", name: "하수도 악어", job: "괴수", element: "earth", archetype: "bruiser", skillNames: ["물어뜯기", "죽음의 회전"] });
export const PLAGUE_RATS = E({ id: "plague_rats", name: "역병 쥐떼", job: "쥐떼", element: "dark", archetype: "striker", skillNames: ["감염된 이빨", "쥐떼 습격"], rider: "poison" });
export const FROST_JELLY = E({ id: "frost_jelly", name: "냉기 해파리", job: "해파리", element: "ice", archetype: "controller", skillNames: ["냉기 촉수", "마비 독"] });

// 4층: 무너진 쇼핑몰
export const MANNEQUIN_KNIGHT = E({ id: "mannequin_knight", name: "마네킹 기사", job: "마네킹", element: "light", archetype: "tank", skillNames: ["플라스틱 창", "진열대 방패"] });
export const RUNAWAY_CART = E({ id: "runaway_cart", name: "폭주 카트", job: "괴물 카트", element: "fire", archetype: "striker", skillNames: ["돌진", "연쇄 충돌"], rider: "burn" });
export const SECURITY_DRONE = E({ id: "security_drone", name: "경비 드론", job: "드론", element: "ice", archetype: "controller", skillNames: ["경고 사격", "전기 충격"] });

// 6층: 고층 빌딩 사무실
export const OVERTIME_WRAITH = E({ id: "overtime_wraith", name: "야근 망령", job: "망령", element: "dark", archetype: "debuffer", skillNames: ["서류 투척", "번아웃"] });
export const PAPER_GOLEM = E({ id: "paper_golem", name: "서류 골렘", job: "골렘", element: "earth", archetype: "tank", skillNames: ["서류 더미", "결재 장벽"] });
export const NEON_SPRITE = E({ id: "neon_sprite", name: "형광등 정령", job: "정령", element: "light", archetype: "healer", skillNames: ["깜빡임", "형광 치유"] });

// 7층: 옥상 정원
export const ROOFTOP_GARGOYLE = E({ id: "rooftop_gargoyle", name: "옥상 가고일", job: "가고일", element: "earth", archetype: "bruiser", skillNames: ["돌 발톱", "급강하"] });
export const FIRE_CHICK = E({ id: "fire_chick", name: "불새 새끼", job: "불새", element: "fire", archetype: "striker", skillNames: ["불꽃 쪼기", "화염 깃털"], rider: "burn" });
export const ICE_SPIRIT = E({ id: "ice_spirit", name: "서리 정령", job: "정령", element: "ice", archetype: "controller", skillNames: ["서리 입김", "얼음 결박"] });

// 8층: 붉은 하늘 다리
export const ABYSS_KNIGHT = E({ id: "abyss_knight", name: "심연 기사", job: "기사", element: "dark", archetype: "tank", skillNames: ["심연 베기", "어둠의 갑주"] });
export const FLAME_GIANT = E({ id: "flame_giant", name: "화염 거인", job: "거인", element: "fire", archetype: "bruiser", skillNames: ["용암 주먹", "분화"] });
export const LIGHT_APOSTLE = E({ id: "light_apostle", name: "빛의 사도", job: "사도", element: "light", archetype: "healer", skillNames: ["빛의 창", "축복"] });

// 9층: 탑의 회랑
export const MIRROR_DOUBLE = E({ id: "mirror_double", name: "거울 분신", job: "분신", element: "light", archetype: "assassin", skillNames: ["반사 일격", "거울 처형"] });
export const VOID_HUNTER = E({ id: "void_hunter", name: "공허 사냥꾼", job: "사냥꾼", element: "dark", archetype: "assassin", skillNames: ["공허 단검", "사냥"] });
export const FROST_GIANT = E({ id: "frost_giant", name: "서리 거인", job: "거인", element: "ice", archetype: "bruiser", skillNames: ["빙하 주먹", "눈사태"] });

// 10층 보스의 부하
export const OVERSEER_EYE = E({ id: "overseer_eye", name: "관리자의 눈", job: "감시자", element: "light", archetype: "controller", skillNames: ["감시 광선", "시선 고정"] });

// ---- 보스 ----

export const TOWER_GATEKEEPER: UnitDef = {
  id: "tower_gatekeeper",
  name: "탑의 문지기",
  job: "수문장",
  role: "보스",
  element: "earth",
  rank: "boss",
  base: { hp: 2500, atk: 175, def: 75, spd: 100, critRate: 0.1, critDmg: 1.5, eff: 0.3, res: 0.3 },
  growth: { hp: 300, atk: 14, def: 5 },
  skills: [
    {
      id: "tower_gatekeeper_s1",
      name: "대지 강타",
      description: "적 1명에게 피해를 준다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [{ type: "damage", multiplier: 1.0 }],
    },
    {
      id: "tower_gatekeeper_s2",
      name: "지진",
      description: "적 전체에게 피해를 주고, 20% 확률로 기절시킨다.",
      cooldown: 4,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.7 },
        { type: "debuff", status: "stun", turns: 1, chance: 0.2 },
      ],
    },
    {
      id: "tower_gatekeeper_s3",
      name: "수문장의 포효",
      description: "2턴간 자신의 공격력·방어력을 증가시킨다.",
      cooldown: 5,
      target: "self",
      effects: [
        { type: "buff", status: "atkUp", turns: 2, target: "self" },
        { type: "buff", status: "defUp", turns: 2, target: "self" },
      ],
    },
  ],
  passives: [{ type: "enrage", threshold: 0.4 }],
  aiPriority: ["tower_gatekeeper_s2", "tower_gatekeeper_s3", "tower_gatekeeper_s1"],
};

export const TOWER_OVERSEER: UnitDef = {
  id: "tower_overseer",
  name: "탑의 관리자",
  job: "관리자",
  role: "최종 보스",
  element: "dark",
  rank: "boss",
  base: { hp: 3800, atk: 185, def: 80, spd: 112, critRate: 0.15, critDmg: 1.5, eff: 0.4, res: 0.35 },
  growth: { hp: 300, atk: 10, def: 4 },
  skills: [
    {
      id: "tower_overseer_s1",
      name: "공허의 손",
      description: "적 1명에게 피해를 주고, 30% 확률로 회복 불가를 건다.",
      cooldown: 0,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.0 },
        { type: "debuff", status: "unhealable", turns: 2, chance: 0.3 },
      ],
    },
    {
      id: "tower_overseer_s2",
      name: "붕괴",
      description: "적 전체에게 피해를 주고, 50% 확률로 방어력을 감소시킨다.",
      cooldown: 3,
      target: "enemy_all",
      effects: [
        { type: "damage", multiplier: 0.8 },
        { type: "debuff", status: "defDown", turns: 2, chance: 0.5 },
      ],
    },
    {
      id: "tower_overseer_s3",
      name: "심판",
      description: "적 1명에게 큰 피해를 준다. 대상의 HP가 낮을수록 피해가 커지고, 처치하면 한 번 더 행동한다.",
      cooldown: 4,
      target: "enemy_single",
      effects: [
        { type: "damage", multiplier: 1.8, bonusByTargetMissingHp: 1.0 },
        { type: "extraTurnOnKill" },
      ],
    },
  ],
  passives: [{ type: "enrage", threshold: 0.5 }],
  aiPriority: ["tower_overseer_s3", "tower_overseer_s2", "tower_overseer_s1"],
};

export const ALL_ENEMIES: UnitDef[] = [
  ...ENEMIES,
  CORRIDOR_GHOST,
  LAB_SLIME,
  PLASTER_STATUE,
  SEWER_CROC,
  PLAGUE_RATS,
  FROST_JELLY,
  MANNEQUIN_KNIGHT,
  RUNAWAY_CART,
  SECURITY_DRONE,
  OVERTIME_WRAITH,
  PAPER_GOLEM,
  NEON_SPRITE,
  ROOFTOP_GARGOYLE,
  FIRE_CHICK,
  ICE_SPIRIT,
  ABYSS_KNIGHT,
  FLAME_GIANT,
  LIGHT_APOSTLE,
  MIRROR_DOUBLE,
  VOID_HUNTER,
  FROST_GIANT,
  OVERSEER_EYE,
  TOWER_GATEKEEPER,
  TOWER_OVERSEER,
];
