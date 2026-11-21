import Phaser from 'phaser';
import { FEET_Y, FIGHTER_H } from '../art/fighter';
import { sfx } from '../lib/sfx';
import { storage } from '../lib/storage';
import { makeButton } from '../ui/button';
import { overlayOpen, showHelpPanel, showNicknamePanel, showRankingPanel } from '../ui/overlay';
import { FONT_BODY, FONT_DISPLAY, GAME_H, GAME_W } from '../ui/theme';
import { bgKey, heroKey } from './BootScene';

export class TitleScene extends Phaser.Scene {
  private nickText!: Phaser.GameObjects.Text;

  constructor() {
    super('Title');
  }

  create() {
    this.add.image(GAME_W / 2, GAME_H / 2, bgKey('void'));
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05020c, 0.35).setOrigin(0);

    // 각성한 카이 + 오라
    const heroX = 700;
    const floor = 478;
    this.add.image(heroX, floor + 2, 'shadow').setScale(1.4, 1);
    const aura = this.add.particles(heroX, floor - 100, 'dot', {
      x: { min: -50, max: 50 },
      y: { min: -60, max: 110 },
      speedY: { min: -140, max: -60 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xbfe6ff, 0xffffff, 0x9fd8ff],
      lifespan: 900,
      frequency: 28,
      blendMode: 'ADD',
    });
    aura.setDepth(1);
    const hero = this.add.image(heroX, floor, heroKey(true, 'awaken')).setOrigin(0.5, FEET_Y / FIGHTER_H).setScale(1.25).setDepth(2);
    this.tweens.add({ targets: hero, y: floor - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 제목
    const title = this.add
      .text(300, 150, '본능 회피', {
        fontFamily: FONT_DISPLAY,
        fontSize: '96px',
        color: '#eef4ff',
        stroke: '#2a1a55',
        strokeThickness: 10,
        padding: { x: 40, y: 40 },
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#bfe6ff', 24, true, true);
    this.add
      .text(300, 222, 'I N S T I N C T   D O D G E', { fontFamily: FONT_BODY, fontSize: '18px', fontStyle: '700', color: '#bfe6ff' })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.03, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    makeButton(this, 300, 300, '시작하기', () => this.start(), { primary: true, width: 260, height: 60, fontSize: 24 });
    makeButton(this, 300, 372, '랭킹', () => this.openPanel((done) => showRankingPanel(done)), { width: 260 });
    makeButton(this, 300, 436, '조작법', () => this.openPanel((done) => showHelpPanel(done)), { width: 260 });

    // 닉네임
    this.nickText = this.add
      .text(300, 496, '', { fontFamily: FONT_BODY, fontSize: '15px', color: '#9aa6c4' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.openPanel((done) => showNicknamePanel(() => done(), done)));
    this.refreshNick();

    // 소리
    const sound = this.add
      .text(GAME_W - 20, 20, '', { fontFamily: FONT_BODY, fontSize: '15px', fontStyle: '700', color: '#eef4ff', backgroundColor: '#00000066', padding: { x: 10, y: 6 } })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    const label = () => sound.setText(sfx.muted ? '소리 꺼짐' : '소리 켜짐');
    label();
    sound.on('pointerup', () => {
      sfx.unlock();
      sfx.toggleMute();
      label();
    });

    this.input.keyboard?.on('keydown-ENTER', () => !overlayOpen() && this.start());
    this.input.keyboard?.on('keydown-SPACE', () => !overlayOpen() && this.start());

    this.add
      .text(GAME_W / 2, GAME_H - 14, '© Instinct Dodge — 오리지널 캐릭터 게임', { fontFamily: FONT_BODY, fontSize: '11px', color: '#6b7390' })
      .setOrigin(0.5, 1);

    this.cameras.main.fadeIn(300, 5, 2, 12);
  }

  private refreshNick() {
    const nick = storage.getNickname();
    this.nickText.setText(nick ? `닉네임: ${nick}  (변경)` : '닉네임 설정');
  }

  /** DOM 패널을 여는 동안 캔버스 입력을 막는다 */
  private openPanel(show: (done: () => void) => void) {
    if (overlayOpen()) return;
    this.input.enabled = false;
    show(() => {
      this.input.enabled = true;
      this.refreshNick();
    });
  }

  private start() {
    if (overlayOpen()) return;
    sfx.unlock();
    const go = () => {
      this.input.enabled = true;
      this.cameras.main.fadeOut(250, 5, 2, 12);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
    };
    if (storage.getNickname()) {
      go();
    } else {
      this.input.enabled = false;
      showNicknamePanel(go, () => {
        this.input.enabled = true;
      });
    }
  }
}
