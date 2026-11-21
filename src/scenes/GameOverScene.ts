import Phaser from 'phaser';
import { FEET_Y, FIGHTER_H } from '../art/fighter';
import { fetchRank, rankingEnabled, saveScore, type GameResult } from '../lib/supabase';
import { storage } from '../lib/storage';
import { makeButton, type Button } from '../ui/button';
import { overlayOpen, showRankingPanel } from '../ui/overlay';
import { FONT_BODY, FONT_DISPLAY, GAME_H, GAME_W } from '../ui/theme';
import { bgKey, heroKey } from './BootScene';

export class GameOverScene extends Phaser.Scene {
  private result!: GameResult;
  private statusText!: Phaser.GameObjects.Text;
  private retryBtn: Button | null = null;
  private saving = false;

  constructor() {
    super('GameOver');
  }

  init(data: GameResult) {
    this.result = data;
    this.retryBtn = null;
    this.saving = false;
  }

  create() {
    const r = this.result;
    this.add.image(GAME_W / 2, GAME_H / 2, bgKey('void'));
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05020c, 0.55).setOrigin(0);
    this.add.image(810, 532, heroKey(false, 'down')).setOrigin(0.5, FEET_Y / FIGHTER_H).setAlpha(0.9);

    this.add
      .text(GAME_W / 2, 56, 'GAME OVER', { fontFamily: FONT_DISPLAY, fontSize: '56px', color: '#ff8a8a', stroke: '#2a0a14', strokeThickness: 8 })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 104, r.nickname, { fontFamily: FONT_BODY, fontSize: '18px', fontStyle: '700', color: '#9aa6c4' })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(GAME_W / 2, 150, '0', { fontFamily: FONT_DISPLAY, fontSize: '72px', color: '#ffffff', stroke: '#1a1030', strokeThickness: 8 })
      .setOrigin(0.5, 0);
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: r.score,
      duration: 900,
      ease: 'Cubic.easeOut',
      onUpdate: () => scoreText.setText(Math.round(counter.v).toLocaleString()),
    });

    const stats: [string, string][] = [
      ['처치한 적', `${r.enemiesDefeated}`],
      ['최고 콤보', `${r.maxCombo}`],
      ['도달 단계', `STAGE ${r.stageReached}`],
    ];
    stats.forEach(([k, v], i) => {
      const x = GAME_W / 2 + (i - 1) * 190;
      this.add.text(x, 252, k, { fontFamily: FONT_BODY, fontSize: '14px', color: '#9aa6c4' }).setOrigin(0.5);
      this.add.text(x, 280, v, { fontFamily: FONT_DISPLAY, fontSize: '28px', color: '#ffd24a' }).setOrigin(0.5);
    });

    this.statusText = this.add
      .text(GAME_W / 2, 314, '', { fontFamily: FONT_BODY, fontSize: '18px', fontStyle: '700', color: '#bfe6ff', align: 'center' })
      .setOrigin(0.5);

    makeButton(this, GAME_W / 2 - 230, 400, '다시 하기', () => this.go('Game'), { primary: true, width: 200 });
    makeButton(this, GAME_W / 2, 400, '랭킹 보기', () => this.openRanking(), { width: 200 });
    makeButton(this, GAME_W / 2 + 230, 400, '타이틀로', () => this.go('Title'), { width: 200 });

    this.input.keyboard?.on('keydown-SPACE', () => !overlayOpen() && this.go('Game'));
    this.input.keyboard?.on('keydown-ENTER', () => !overlayOpen() && this.go('Game'));

    this.cameras.main.fadeIn(300, 5, 2, 12);
    void this.save();
  }

  private async save() {
    if (!rankingEnabled) {
      this.statusText.setText('랭킹 서버 미설정 — 이번 기록은 저장되지 않았어요');
      this.statusText.setColor('#9aa6c4');
      return;
    }
    if (this.saving) return;
    this.saving = true;
    this.retryBtn?.destroy();
    this.retryBtn = null;
    this.statusText.setColor('#bfe6ff').setText('기록 저장 중…');
    try {
      const id = await saveScore(this.result);
      storage.setLastScoreId(id);
      const rank = await fetchRank(this.result.score);
      if (!this.scene.isActive()) return;
      this.statusText.setColor('#ffd24a').setText(`저장 완료!  전체 ${rank.toLocaleString()}위`);
    } catch (e) {
      console.error(e);
      if (!this.scene.isActive()) return;
      this.statusText.setColor('#ff8a8a').setText('기록을 저장하지 못했어요 (네트워크 확인)');
      this.retryBtn = makeButton(this, GAME_W / 2, 348, '다시 시도', () => void this.save(), { width: 160, height: 34, fontSize: 15 });
    } finally {
      this.saving = false;
    }
  }

  private openRanking() {
    if (overlayOpen()) return;
    this.input.enabled = false;
    showRankingPanel(() => {
      this.input.enabled = true;
    });
  }

  private go(scene: 'Game' | 'Title') {
    if (overlayOpen()) return;
    this.cameras.main.fadeOut(250, 5, 2, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
  }
}
