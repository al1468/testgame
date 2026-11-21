// 게임 규칙 상수 — PRD 5장/6장 기준

export const JUDGE = {
  perfectMs: 80,
  goodMs: 160,
  whiffLockoutMs: 300,
} as const;

export const PLAYER_MAX_HP = 5;

export const GAUGE = {
  max: 100,
  perfect: 20,
  good: 10,
} as const;

export const SCORE = {
  perfect: 100,
  good: 50,
  counter: 300,
  defeatPerStage: 1000,
} as const;

/** 콤보 배율 구간 (높은 구간부터) */
export const COMBO_TIERS = [
  { min: 50, mult: 3 },
  { min: 25, mult: 2 },
  { min: 10, mult: 1.5 },
] as const;

export type PatternKind = 'single' | 'double' | 'triple' | 'ranged' | 'fake';

export type LookKey = 'bandit' | 'master' | 'mystic' | 'robot' | 'demon' | 'boss';

export type ThemeKey = 'wasteland' | 'dojo' | 'peak' | 'ruins' | 'demon' | 'void';

export interface StageDef {
  level: number;
  name: string;
  look: LookKey;
  theme: ThemeKey;
  hp: number;
  /** 공격과 공격 사이 대기 시간 [최소, 최대] ms */
  interval: [number, number];
  /** 첫 타격 전 전조(타이밍 링) 시간 ms */
  telegraph: number;
  /** 연타 사이 간격 ms */
  hitGap: number;
  /** 연타 간격이 불규칙한지 */
  irregular: boolean;
  weights: Partial<Record<PatternKind, number>>;
}

const BASE_STAGES: Omit<StageDef, 'level'>[] = [
  {
    name: '황야의 산적 바르크',
    look: 'bandit',
    theme: 'wasteland',
    hp: 2,
    interval: [1800, 2200],
    telegraph: 1000,
    hitGap: 420,
    irregular: false,
    weights: { single: 1 },
  },
  {
    name: '철권 도장의 노사부',
    look: 'master',
    theme: 'dojo',
    hp: 3,
    interval: [1400, 1800],
    telegraph: 850,
    hitGap: 380,
    irregular: false,
    weights: { single: 3, double: 2 },
  },
  {
    name: '기공술사 세린',
    look: 'mystic',
    theme: 'peak',
    hp: 3,
    interval: [1200, 1600],
    telegraph: 650,
    hitGap: 360,
    irregular: false,
    weights: { single: 2, double: 1, ranged: 3 },
  },
  {
    name: '강철 전사 T-9',
    look: 'robot',
    theme: 'ruins',
    hp: 4,
    interval: [1000, 1400],
    telegraph: 600,
    hitGap: 330,
    irregular: false,
    weights: { single: 2, double: 2, ranged: 1, fake: 2 },
  },
  {
    name: '마인 그라돔',
    look: 'demon',
    theme: 'demon',
    hp: 4,
    interval: [800, 1200],
    telegraph: 550,
    hitGap: 300,
    irregular: true,
    weights: { single: 1, double: 2, triple: 3, ranged: 1, fake: 2 },
  },
  {
    name: '공허의 황제 네크사',
    look: 'boss',
    theme: 'void',
    hp: 5,
    interval: [750, 1100],
    telegraph: 520,
    hitGap: 290,
    irregular: true,
    weights: { single: 1, double: 2, triple: 3, ranged: 2, fake: 2 },
  },
];

export const STAGE_COUNT = BASE_STAGES.length;

/** 1부터 시작하는 단계 번호로 단계 정보를 얻는다. 6단계 이후는 무한 모드. */
export function getStage(level: number): StageDef {
  if (level <= STAGE_COUNT) {
    return { ...BASE_STAGES[level - 1], level };
  }
  const boss = BASE_STAGES[STAGE_COUNT - 1];
  const extra = level - STAGE_COUNT;
  const speed = Math.pow(0.95, extra);
  const clamp = (v: number, min: number) => Math.max(min, Math.round(v * speed));
  return {
    ...boss,
    level,
    name: `${boss.name} +${extra}`,
    hp: boss.hp + Math.floor(extra / 2),
    interval: [clamp(boss.interval[0], 420), clamp(boss.interval[1], 600)],
    telegraph: clamp(boss.telegraph, 380),
    hitGap: clamp(boss.hitGap, 220),
  };
}
