import type { LookKey } from '../game/config';

export type HairType = 'kai' | 'bandana' | 'bald' | 'long' | 'helmet' | 'horns' | 'crown';

export interface Look {
  skin: string;
  gi: string;
  trim: string;
  belt: string;
  pants: string;
  boots: string;
  wraps: string;
  hair: string;
  hairType: HairType;
  outline: string;
  /** 체격 배율 (팔다리 두께) */
  bulk: number;
  beard?: string;
  cape?: string;
  accent?: string;
  glowEyes?: boolean;
}

const OUTLINE = '#0d0b14';

export const KAI: Look = {
  skin: '#f1c7a0',
  gi: '#1f3a6b',
  trim: '#e9eef6',
  belt: '#e9eef6',
  pants: '#28304a',
  boots: '#14141c',
  wraps: '#e9eef6',
  hair: '#17161c',
  hairType: 'kai',
  outline: OUTLINE,
  bulk: 1,
};

/** 각성 모드: 은발 + 빛나는 눈 */
export const KAI_AWAKE: Look = {
  ...KAI,
  hair: '#e4ecf6',
  trim: '#ffffff',
  glowEyes: true,
  accent: '#bfe6ff',
};

export const ENEMY_LOOKS: Record<LookKey, Look> = {
  bandit: {
    skin: '#d39a70',
    gi: '#6e4a2a',
    trim: '#c9a46b',
    belt: '#3a2614',
    pants: '#4c3b2a',
    boots: '#2a1c10',
    wraps: '#c9a46b',
    hair: '#2a1a10',
    hairType: 'bandana',
    accent: '#b3262e',
    outline: OUTLINE,
    bulk: 1.18,
  },
  master: {
    skin: '#e3bf9b',
    gi: '#efe8d8',
    trim: '#8a2b2b',
    belt: '#2c2c2c',
    pants: '#e2dac8',
    boots: '#3a2e24',
    wraps: '#e2dac8',
    hair: '#cfcfcf',
    hairType: 'bald',
    beard: '#d9d9d9',
    outline: OUTLINE,
    bulk: 1,
  },
  mystic: {
    skin: '#ead4c2',
    gi: '#4b2a6b',
    trim: '#d9b24a',
    belt: '#d9b24a',
    pants: '#36204d',
    boots: '#1c1226',
    wraps: '#d9b24a',
    hair: '#121018',
    hairType: 'long',
    outline: OUTLINE,
    bulk: 0.92,
    glowEyes: true,
    accent: '#7ef0ff',
  },
  robot: {
    skin: '#a3adb9',
    gi: '#59636f',
    trim: '#ff5a3b',
    belt: '#2e343c',
    pants: '#48505b',
    boots: '#262b31',
    wraps: '#8c96a2',
    hair: '#59636f',
    hairType: 'helmet',
    accent: '#ff3b3b',
    outline: OUTLINE,
    bulk: 1.22,
  },
  demon: {
    skin: '#b5323a',
    gi: '#251416',
    trim: '#e0a23a',
    belt: '#e0a23a',
    pants: '#251416',
    boots: '#120808',
    wraps: '#3a1c1e',
    hair: '#1a0d0e',
    hairType: 'horns',
    accent: '#ffd24a',
    outline: OUTLINE,
    bulk: 1.25,
    glowEyes: true,
  },
  boss: {
    skin: '#cdc4d8',
    gi: '#1b1628',
    trim: '#9a62ff',
    belt: '#9a62ff',
    pants: '#1b1628',
    boots: '#0e0b16',
    wraps: '#2e2445',
    hair: '#f2f0ff',
    hairType: 'crown',
    cape: '#3b1f70',
    accent: '#c59bff',
    outline: OUTLINE,
    bulk: 1.12,
    glowEyes: true,
  },
};
