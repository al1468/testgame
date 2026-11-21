import Phaser from 'phaser';
import { BG_H, BG_W, drawBackground } from '../art/backgrounds';
import { drawFighter, FIGHTER_H, FIGHTER_W } from '../art/fighter';
import { ENEMY_LOOKS, KAI, KAI_AWAKE } from '../art/looks';
import { ENEMY_POSE_KEYS, ENEMY_POSES, HERO_POSE_KEYS, HERO_POSES } from '../art/poses';
import type { LookKey, ThemeKey } from '../game/config';

const THEMES: ThemeKey[] = ['wasteland', 'dojo', 'peak', 'ruins', 'demon', 'void'];

export const heroKey = (awake: boolean, pose: string) => `${awake ? 'kaiA' : 'kai'}_${pose}`;
export const enemyKey = (look: LookKey, pose: string) => `${look}_${pose}`;
export const bgKey = (theme: ThemeKey) => `bg_${theme}`;

/** 모든 그림을 코드로 그려 텍스처로 등록한다 (외부 이미지 파일 없음). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const make = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
      const tex = this.textures.createCanvas(key, w, h);
      if (!tex) return;
      draw(tex.getContext());
      tex.refresh();
    };

    for (const pose of HERO_POSE_KEYS) {
      make(heroKey(false, pose), FIGHTER_W, FIGHTER_H, (ctx) => drawFighter(ctx, HERO_POSES[pose], KAI));
      make(heroKey(true, pose), FIGHTER_W, FIGHTER_H, (ctx) => drawFighter(ctx, HERO_POSES[pose], KAI_AWAKE));
    }
    for (const look of Object.keys(ENEMY_LOOKS) as LookKey[]) {
      for (const pose of ENEMY_POSE_KEYS) {
        make(enemyKey(look, pose), FIGHTER_W, FIGHTER_H, (ctx) => drawFighter(ctx, ENEMY_POSES[pose], ENEMY_LOOKS[look]));
      }
    }
    for (const theme of THEMES) {
      make(bgKey(theme), BG_W, BG_H, (ctx) => drawBackground(ctx, theme));
    }

    // 파티클 점
    make('dot', 16, 16, (ctx) => {
      const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 16);
    });
    // 기탄
    make('orb', 48, 48, (ctx) => {
      const g = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 48, 48);
    });
    // 그림자
    make('shadow', 120, 24, (ctx) => {
      ctx.save();
      ctx.scale(1, 0.2);
      const g = ctx.createRadialGradient(60, 60, 0, 60, 60, 60);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 120, 120);
      ctx.restore();
    });

    this.scene.start('Title');
  }
}
