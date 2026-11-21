import Phaser from 'phaser';
import { makeButton } from '../ui/button';
import { FONT_DISPLAY, GAME_H, GAME_W } from '../ui/theme';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05020c, 0.72).setOrigin(0).setInteractive();
    this.add
      .text(GAME_W / 2, 150, '일시정지', { fontFamily: FONT_DISPLAY, fontSize: '60px', color: '#eef4ff', stroke: '#2a1a55', strokeThickness: 8 })
      .setOrigin(0.5);

    const resume = () => {
      this.scene.resume('Game');
      this.scene.stop();
    };
    makeButton(this, GAME_W / 2, 260, '계속하기', resume, { primary: true, width: 260 });
    makeButton(this, GAME_W / 2, 326, '다시 시작', () => {
      this.scene.stop('Game');
      this.scene.start('Game');
    }, { width: 260 });
    makeButton(this, GAME_W / 2, 392, '타이틀로', () => {
      this.scene.stop('Game');
      this.scene.start('Title');
    }, { width: 260 });

    this.input.keyboard?.on('keydown-ESC', resume);
    this.input.keyboard?.on('keydown-P', resume);
  }
}
