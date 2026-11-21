import Phaser from 'phaser';
import { sfx } from '../lib/sfx';
import { COLOR, FONT_BODY } from './theme';

export interface ButtonOptions {
  width?: number;
  height?: number;
  primary?: boolean;
  fontSize?: number;
}

export type Button = Phaser.GameObjects.Container & { setLabel: (s: string) => void };

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Button {
  const w = opts.width ?? 220;
  const h = opts.height ?? 52;
  const primary = opts.primary ?? false;

  const bg = scene.add.graphics();
  const draw = (hover: boolean) => {
    bg.clear();
    bg.fillStyle(primary ? COLOR.silver : 0xffffff, primary ? (hover ? 1 : 0.92) : hover ? 0.18 : 0.08);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(1.5, COLOR.silver, primary ? 1 : 0.45);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  };
  draw(false);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT_BODY,
      fontSize: `${opts.fontSize ?? 20}px`,
      fontStyle: '700',
      color: primary ? '#0b0816' : '#eef4ff',
    })
    .setOrigin(0.5);

  const c = scene.add.container(x, y, [bg, text]) as Button;
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => {
    draw(false);
    c.setScale(1);
  });
  c.on('pointerdown', () => c.setScale(0.96));
  c.on('pointerup', () => {
    c.setScale(1);
    sfx.unlock();
    sfx.click();
    onClick();
  });
  c.setLabel = (s: string) => text.setText(s);
  return c;
}
