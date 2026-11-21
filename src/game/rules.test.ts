import { describe, expect, it } from 'vitest';
import { getStage, STAGE_COUNT } from './config';
import { buildAttack, pickKind } from './patterns';
import { comboMultiplier, defeatScore, dodgeScore, judge } from './scoring';

describe('판정', () => {
  it('±80ms 이내는 PERFECT', () => {
    expect(judge(0)).toBe('perfect');
    expect(judge(-80)).toBe('perfect');
    expect(judge(80)).toBe('perfect');
  });
  it('±160ms 이내는 GOOD', () => {
    expect(judge(81)).toBe('good');
    expect(judge(-160)).toBe('good');
  });
  it('구간 밖은 null', () => {
    expect(judge(161)).toBeNull();
    expect(judge(-500)).toBeNull();
  });
});

describe('점수', () => {
  it('콤보 배율 구간', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(9)).toBe(1);
    expect(comboMultiplier(10)).toBe(1.5);
    expect(comboMultiplier(25)).toBe(2);
    expect(comboMultiplier(50)).toBe(3);
  });
  it('회피 점수 = 기본 × 콤보 배율 × 단계 보너스', () => {
    expect(dodgeScore('perfect', 1, 1)).toBe(100);
    expect(dodgeScore('good', 1, 1)).toBe(50);
    expect(dodgeScore('perfect', 10, 1)).toBe(150);
    expect(dodgeScore('perfect', 50, 3)).toBe(360);
  });
  it('적 처치 점수 = 1000 × 단계', () => {
    expect(defeatScore(4)).toBe(4000);
  });
});

describe('단계', () => {
  it('1~6단계는 정의된 적', () => {
    expect(getStage(1).look).toBe('bandit');
    expect(getStage(STAGE_COUNT).look).toBe('boss');
  });
  it('무한 모드는 점점 빨라지고 하한이 있다', () => {
    const s7 = getStage(7);
    const s20 = getStage(20);
    expect(s7.telegraph).toBeLessThan(getStage(6).telegraph);
    expect(s20.telegraph).toBeLessThanOrEqual(s7.telegraph);
    expect(getStage(200).telegraph).toBe(380);
  });
  it('1단계는 단발 공격만', () => {
    for (let i = 0; i < 20; i++) expect(pickKind(getStage(1), Math.random)).toBe('single');
  });
  it('연타 패턴은 첫 타격이 전조 시간 뒤', () => {
    const stage = getStage(5);
    const plan = buildAttack(stage, 1000, () => 0.5, 'triple');
    expect(plan.hits).toHaveLength(3);
    expect(plan.hits[0].time).toBe(1000 + stage.telegraph);
    expect(plan.hits[1].time).toBeGreaterThan(plan.hits[0].time);
  });
});
