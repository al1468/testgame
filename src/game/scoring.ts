import { COMBO_TIERS, JUDGE, SCORE } from './config';

export type Grade = 'perfect' | 'good';

/** 입력 시각과 타격 시각의 차이(ms)로 판정. 구간 밖이면 null. */
export function judge(deltaMs: number): Grade | null {
  const d = Math.abs(deltaMs);
  if (d <= JUDGE.perfectMs) return 'perfect';
  if (d <= JUDGE.goodMs) return 'good';
  return null;
}

export function comboMultiplier(combo: number): number {
  for (const tier of COMBO_TIERS) {
    if (combo >= tier.min) return tier.mult;
  }
  return 1;
}

/** 회피 점수 = 기본 점수 × 콤보 배율 × (1 + 0.1 × (단계 - 1)) */
export function dodgeScore(grade: Grade, combo: number, stage: number): number {
  const base = grade === 'perfect' ? SCORE.perfect : SCORE.good;
  return Math.round(base * comboMultiplier(combo) * (1 + 0.1 * (stage - 1)));
}

export function defeatScore(stage: number): number {
  return SCORE.defeatPerStage * stage;
}
