import type { PatternKind, StageDef } from './config';

export interface HitPlan {
  /** 타격 시각 (게임 시계 ms) */
  time: number;
  ranged: boolean;
  fake: boolean;
}

export interface AttackPlan {
  kind: PatternKind;
  /** 전조 시작 시각 */
  start: number;
  hits: HitPlan[];
}

export type Rng = () => number;

export function pickKind(stage: StageDef, rng: Rng): PatternKind {
  const entries = Object.entries(stage.weights) as [PatternKind, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [kind, w] of entries) {
    r -= w;
    if (r < 0) return kind;
  }
  return entries[entries.length - 1][0];
}

/** 공격 패턴 하나를 만든다. start 시각부터 전조가 시작된다. */
export function buildAttack(stage: StageDef, start: number, rng: Rng, kind = pickKind(stage, rng)): AttackPlan {
  const first = start + stage.telegraph;
  const count = kind === 'double' ? 2 : kind === 'triple' ? 3 : 1;
  const hits: HitPlan[] = [];
  let t = first;
  for (let i = 0; i < count; i++) {
    hits.push({ time: Math.round(t), ranged: kind === 'ranged', fake: kind === 'fake' });
    const jitter = stage.irregular ? 0.7 + rng() * 0.6 : 1;
    t += stage.hitGap * jitter;
  }
  return { kind, start, hits };
}

export function randomInterval(stage: StageDef, rng: Rng): number {
  const [min, max] = stage.interval;
  return Math.round(min + rng() * (max - min));
}
