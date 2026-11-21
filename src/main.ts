import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { TitleScene } from './scenes/TitleScene';
import { GAME_H, GAME_W } from './ui/theme';

/** 캔버스 글꼴은 미리 불러와야 제대로 그려진다 (최대 2.5초 대기) */
async function loadFonts() {
  const fonts = ['400 32px "Black Han Sans"', '700 16px "Noto Sans KR"', '900 16px "Noto Sans KR"'];
  const timeout = new Promise((r) => setTimeout(r, 2500));
  try {
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f, '본능회피0'))), timeout]);
  } catch {
    /* 글꼴 실패 시 기본 글꼴로 진행 */
  }
}

void loadFonts().then(() => {
  const game = new Phaser.Game(config);
  // 개발 모드에서만: 브라우저 자동 테스트용
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0b0816',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, TitleScene, GameScene, PauseScene, GameOverScene],
};
