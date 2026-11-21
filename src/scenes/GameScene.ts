import Phaser from 'phaser';
import { FEET_Y, FIGHTER_H } from '../art/fighter';
import { ENEMY_LOOKS } from '../art/looks';
import type { EnemyPose, HeroPose } from '../art/poses';
import { GAUGE, JUDGE, PLAYER_MAX_HP, SCORE, getStage, type StageDef } from '../game/config';
import { buildAttack, randomInterval, type HitPlan } from '../game/patterns';
import { comboMultiplier, defeatScore, dodgeScore, judge, type Grade } from '../game/scoring';
import type { GameResult } from '../lib/supabase';
import { sfx } from '../lib/sfx';
import { storage } from '../lib/storage';
import { COLOR, FONT_BODY, FONT_DISPLAY, GAME_H, GAME_W } from '../ui/theme';
import { bgKey, enemyKey, heroKey } from './BootScene';

const HERO_X = 320;
const ENEMY_X = 650;
const FLOOR = 478;
const CHEST_Y = FLOOR - 120;
const LUNGE_X = HERO_X + 125;
const ORIGIN_Y = FEET_Y / FIGHTER_H;

type State = 'intro' | 'fight' | 'counter' | 'transition' | 'over';

interface LiveHit extends HitPlan {
  resolved: boolean;
  /** 페이크가 깨졌는지 */
  broke: boolean;
  launched: boolean;
}

interface LiveAttack {
  start: number;
  fake: boolean;
  hits: LiveHit[];
}

interface Anim<P extends string> {
  pose: P;
  start: number;
  hold: number;
  dx: number;
  persistent?: boolean;
}

interface Projectile {
  img: Phaser.GameObjects.Image;
  hit: LiveHit;
  launch: number;
  travel: number;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** 애니메이션 위치 비율 (0 → 1 → 0) */
function animProgress(a: Anim<string>, clock: number): number {
  const t = clock - a.start;
  if (t < 0) return 0;
  if (t < 70) return easeOut(t / 70);
  if (a.persistent || t < a.hold) return 1;
  if (t < a.hold + 160) return 1 - easeOut((t - a.hold) / 160);
  return 0;
}

const animActive = (a: Anim<string> | null, clock: number) => !!a && (a.persistent || clock - a.start < a.hold + 160);

/** 적이 돌진하는 정도 (타격 시각 기준) */
function lungeCurve(dt: number): number {
  if (dt < -90) return 0;
  if (dt < 0) return easeOut((dt + 90) / 90);
  if (dt < 160) return 1;
  if (dt < 380) return 1 - (dt - 160) / 220;
  return 0;
}

export class GameScene extends Phaser.Scene {
  // 시간
  private clock = 0;
  private timeScale = 1;
  private slowLeft = 0;
  private lastFrameReal = 0;
  private playMs = 0;

  // 진행 상태
  private state: State = 'intro';
  private stage!: StageDef;
  private enemyHp = 0;
  private hp = PLAYER_MAX_HP;
  private gauge = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private defeated = 0;
  private awake = false;

  private attack: LiveAttack | null = null;
  private nextAttackAt = 0;
  private lockoutUntil = 0;
  private heroAnim: Anim<HeroPose> | null = null;
  private enemyAnim: Anim<EnemyPose> | null = null;
  private enemyRig = { baseX: ENEMY_X };
  private projectiles: Projectile[] = [];
  private popTexts = new Set<Phaser.GameObjects.Text>();

  // 그래픽
  private bg!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Image;
  private enemy!: Phaser.GameObjects.Image;
  private enemyShadow!: Phaser.GameObjects.Image;
  private rings!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Rectangle;
  private aura!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  // HUD
  private hud!: Phaser.GameObjects.Graphics;
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private enemyNameText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Container;

  constructor() {
    super('Game');
  }

  create() {
    this.clock = 0;
    this.timeScale = 1;
    this.slowLeft = 0;
    this.playMs = 0;
    this.state = 'intro';
    this.hp = PLAYER_MAX_HP;
    this.gauge = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.defeated = 0;
    this.awake = false;
    this.attack = null;
    this.lockoutUntil = 0;
    this.heroAnim = null;
    this.enemyAnim = null;
    this.enemyRig = { baseX: ENEMY_X };
    this.projectiles = [];
    this.popTexts = new Set();
    this.lastFrameReal = performance.now();
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;

    this.bg = this.add.image(GAME_W / 2, GAME_H / 2, bgKey('wasteland'));

    this.add.image(HERO_X, FLOOR + 2, 'shadow');
    this.enemyShadow = this.add.image(ENEMY_X, FLOOR + 2, 'shadow');

    this.aura = this.add.particles(0, 0, 'dot', {
      x: { min: -45, max: 45 },
      y: { min: -150, max: 0 },
      speedY: { min: -160, max: -70 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xbfe6ff, 0xffffff, 0x9fd8ff],
      lifespan: 700,
      frequency: 14,
      blendMode: 'ADD',
      emitting: false,
    });

    this.enemy = this.add.image(ENEMY_X, FLOOR, enemyKey('bandit', 'idle')).setOrigin(0.5, ORIGIN_Y).setFlipX(true);
    this.hero = this.add.image(HERO_X, FLOOR, heroKey(false, 'idle')).setOrigin(0.5, ORIGIN_Y);
    this.aura.startFollow(this.hero, 0, -10);

    this.sparks = this.add.particles(0, 0, 'dot', {
      speed: { min: 120, max: 420 },
      scale: { start: 1.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 450,
      blendMode: 'ADD',
      emitting: false,
    });
    this.sparks.setDepth(30);

    this.rings = this.add.graphics().setDepth(20);
    this.flash = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 0).setOrigin(0).setDepth(50);

    this.createHud();
    this.bindInput();

    const onHidden = () => this.openPause();
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden));

    this.cameras.main.fadeIn(300, 5, 2, 12);
    // 개발 모드에서만 ?stage=N 으로 시작 단계 지정 (테스트용)
    const devStage = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('stage')) : 0;
    this.spawnEnemy(devStage > 0 ? Math.floor(devStage) : 1, true);
  }

  // ───────────────────────── 입력 ─────────────────────────

  private bindInput() {
    const kb = this.input.keyboard;
    kb?.addCapture('SPACE');
    kb?.on('keydown-SPACE', (e: KeyboardEvent) => {
      if (!e.repeat) this.onDodge(e.timeStamp);
    });
    kb?.on('keydown-ESC', () => this.openPause());
    kb?.on('keydown-P', () => this.openPause());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.includes(this.pauseBtn)) return;
      this.onDodge(p.event.timeStamp);
    });
  }

  private openPause() {
    if (this.state === 'over' || !this.scene.isActive()) return;
    this.scene.launch('Pause');
    this.scene.pause();
  }

  private onDodge(eventStamp: number) {
    sfx.unlock();
    if (this.state !== 'fight' || !this.attack) {
      if (this.state === 'fight') this.whiff(false);
      return;
    }
    if (this.clock < this.lockoutUntil) return;

    // 입력 이벤트 시각을 게임 시계로 환산 (프레임 단위 오차 제거)
    const lag = Phaser.Math.Clamp(eventStamp - this.lastFrameReal, 0, 40);
    const t = this.clock + lag * this.timeScale;

    let best: LiveHit | null = null;
    for (const h of this.attack.hits) {
      if (h.resolved || h.fake) continue;
      if (!best || Math.abs(t - h.time) < Math.abs(t - best.time)) best = h;
    }
    const grade = best ? judge(t - best.time) : null;
    if (best && grade) this.dodgeSuccess(best, grade);
    else this.whiff(this.attack.fake);
  }

  private whiff(fooled: boolean) {
    this.lockoutUntil = this.clock + JUDGE.whiffLockoutMs;
    sfx.whiff();
    if (fooled) {
      this.combo = 0;
      this.popText(HERO_X, FLOOR - 250, '속았다!', '#c59bff', 34);
      this.updateHud();
    } else {
      this.popText(HERO_X, FLOOR - 240, '너무 빨라!', '#9aa6c4', 22);
    }
  }

  // ───────────────────────── 루프 ─────────────────────────

  update(_time: number, rawDelta: number) {
    const delta = Math.min(rawDelta, 50);
    this.lastFrameReal = performance.now();

    if (this.slowLeft > 0) {
      this.slowLeft -= delta;
      if (this.slowLeft <= 0) this.setTimeScale(1);
    }
    this.clock += delta * this.timeScale;
    if (this.state !== 'over') this.playMs += delta;

    if (this.state === 'fight') this.tickFight();

    this.renderHero();
    this.renderEnemy();
    this.renderProjectiles();
    this.renderRings();
  }

  private setTimeScale(s: number) {
    this.timeScale = s;
    this.tweens.timeScale = s;
    this.time.timeScale = s;
  }

  private tickFight() {
    const a = this.attack;
    if (!a) {
      if (this.clock >= this.nextAttackAt) this.startAttack();
      return;
    }
    const lead = this.stage.telegraph;
    for (const h of a.hits) {
      if (h.resolved) continue;
      if (h.fake) {
        if (!h.broke && this.clock >= h.time - Math.min(260, lead * 0.45)) this.breakFake(h);
        continue;
      }
      if (h.ranged && !h.launched && this.clock >= h.time - this.projTravel()) this.launchProjectile(h);
      if (this.clock > h.time + JUDGE.goodMs) {
        this.playerHit(h);
        if (this.state !== 'fight') return;
      }
    }
    const last = a.hits[a.hits.length - 1].time;
    if (a.hits.every((h) => h.resolved) && this.clock > last + 260) this.endAttack();
  }

  private projTravel() {
    return Math.min(480, this.stage.telegraph * 0.8);
  }

  private startAttack() {
    const plan = buildAttack(this.stage, this.clock, Math.random);
    this.attack = {
      start: plan.start,
      fake: plan.kind === 'fake',
      hits: plan.hits.map((h) => ({ ...h, resolved: false, broke: false, launched: false })),
    };
    sfx.telegraph();
    const mark = this.popText(this.enemyRig.baseX, FLOOR - 250, plan.kind === 'ranged' ? '기탄!' : '!', '#ffd24a', 40);
    mark.setDepth(35);
  }

  private endAttack() {
    this.attack = null;
    if (this.gauge >= GAUGE.max) {
      this.startCounter();
    } else {
      this.nextAttackAt = this.clock + randomInterval(this.stage, Math.random);
    }
  }

  private breakFake(h: LiveHit) {
    h.broke = true;
    h.resolved = true;
    this.popText(this.enemyRig.baseX, FLOOR - 250, '!?', '#c59bff', 36);
    this.sparks.explode(14, HERO_X, CHEST_Y);
  }

  // ───────────────────────── 판정 결과 ─────────────────────────

  private dodgeSuccess(h: LiveHit, grade: Grade) {
    h.resolved = true;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const pts = dodgeScore(grade, this.combo, this.stage.level);
    this.score += pts;
    this.gauge = Math.min(GAUGE.max, this.gauge + GAUGE[grade]);

    const options: [HeroPose, number][] = h.ranged
      ? [['dodgeSide', -60], ['dodgeLow', -10], ['dodgeFlip', -95]]
      : [['dodgeLean', -24], ['dodgeSide', -60], ['dodgeLow', -10], ['dodgeFlip', -95]];
    const [pose, dx] = Phaser.Utils.Array.GetRandom(options);
    this.heroAnim = { pose, start: this.clock, hold: 300, dx };

    const ghosts = grade === 'perfect' ? 3 : 1;
    for (let i = 0; i < ghosts; i++) {
      this.ghost(heroKey(this.awake, i === 0 ? 'idle' : pose), HERO_X + dx * (i / ghosts), FLOOR - (i > 0 && pose === 'dodgeFlip' ? 20 : 0), 0.5 - i * 0.1);
    }

    if (grade === 'perfect') {
      sfx.perfect();
      this.setTimeScale(0.35);
      this.slowLeft = 320;
      this.flashScreen(0xbfe6ff, 0.28, 260);
      this.popText(HERO_X, FLOOR - 270, 'PERFECT', '#bfe6ff', 44, true);
    } else {
      sfx.whoosh();
      this.popText(HERO_X, FLOOR - 265, 'GOOD', '#ffd24a', 34, true);
    }
    this.popText(HERO_X + 70, FLOOR - 210, `+${pts}`, '#ffffff', 20);
    if (this.gauge >= GAUGE.max) this.popText(HERO_X, FLOOR - 310, '본능 게이지 MAX', '#bfe6ff', 20);
    this.updateHud();
  }

  private playerHit(h: LiveHit) {
    h.resolved = true;
    this.hp--;
    this.combo = 0;
    this.heroAnim = { pose: 'hit', start: this.clock, hold: 320, dx: -34 };
    this.cameras.main.shake(220, 0.012);
    this.flashScreen(COLOR.danger, 0.3, 300);
    sfx.hit();
    this.sparks.explode(18, HERO_X + 20, CHEST_Y);
    this.popText(HERO_X, FLOOR - 265, 'MISS', '#ff6b6b', 38, true);
    const p = this.projectiles.find((pr) => pr.hit === h);
    if (p) this.removeProjectile(p);
    this.updateHud();
    if (this.hp <= 0) this.gameOver();
  }

  // ───────────────────────── 반격 / 단계 ─────────────────────────

  private startCounter() {
    this.state = 'counter';
    this.setTimeScale(1);
    this.slowLeft = 0;
    this.awake = true;
    this.clearPopTexts();
    this.aura.start();
    sfx.charge();
    this.flashScreen(0xffffff, 0.6, 400);
    this.heroAnim = { pose: 'awaken', start: this.clock, hold: 650, dx: 0 };
    this.popText(GAME_W / 2, 190, '본능 각성!', '#bfe6ff', 56, true);

    this.time.delayedCall(700, () => {
      const dx = ENEMY_X - 135 - HERO_X;
      this.heroAnim = { pose: 'punch', start: this.clock, hold: 430, dx };
      for (let i = 1; i <= 3; i++) this.ghost(heroKey(true, 'punch'), HERO_X + dx * (i / 4), FLOOR, 0.45);
    });
    this.time.delayedCall(780, () => {
      sfx.counter();
      this.cameras.main.shake(320, 0.02);
      this.sparks.explode(36, ENEMY_X - 40, CHEST_Y);
      this.enemyHp--;
      this.score += SCORE.counter;
      this.enemyAnim = { pose: 'hit', start: this.clock, hold: 420, dx: 50, persistent: this.enemyHp <= 0 };
      this.popText(ENEMY_X, FLOOR - 260, `반격! +${SCORE.counter}`, '#ffffff', 30, true);
      this.updateHud();
    });
    this.time.delayedCall(1500, () => {
      this.gauge = 0;
      this.awake = false;
      this.aura.stop();
      this.updateHud();
      if (this.enemyHp <= 0) {
        this.defeatEnemy();
      } else {
        this.state = 'fight';
        this.nextAttackAt = this.clock + 900;
      }
    });
  }

  private defeatEnemy() {
    this.state = 'transition';
    this.clearPopTexts();
    this.enemyAnim = { pose: 'down', start: this.clock, hold: 0, dx: 60, persistent: true };
    const bonus = defeatScore(this.stage.level);
    this.score += bonus;
    this.defeated++;
    this.hp = Math.min(PLAYER_MAX_HP, this.hp + 1);
    sfx.defeat();
    this.popText(GAME_W / 2, 200, '격파!', '#ffd24a', 72, true);
    this.popText(GAME_W / 2, 262, `+${bonus.toLocaleString()}  ·  체력 +1`, '#ffffff', 22);
    this.tweens.add({ targets: [this.enemy, this.enemyShadow], alpha: 0, delay: 700, duration: 700 });
    this.updateHud();
    this.time.delayedCall(1900, () => this.spawnEnemy(this.stage.level + 1));
  }

  private spawnEnemy(level: number, first = false) {
    this.state = 'intro';
    this.stage = getStage(level);
    this.enemyHp = this.stage.hp;
    this.enemyAnim = null;
    this.attack = null;

    const enter = () => {
      this.bg.setTexture(bgKey(this.stage.theme));
      this.enemy.setAlpha(1);
      this.enemyShadow.setAlpha(1);
      this.enemyRig.baseX = GAME_W + 140;
      this.tweens.add({ targets: this.enemyRig, baseX: ENEMY_X, duration: 600, ease: 'Cubic.easeOut' });
      this.updateHud();
      this.showStageBanner();
      this.time.delayedCall(1500, () => {
        this.state = 'fight';
        this.nextAttackAt = this.clock + 400;
      });
    };

    if (first) {
      enter();
    } else {
      const cam = this.cameras.main;
      cam.fadeOut(260, 5, 2, 12);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        enter();
        cam.fadeIn(260, 5, 2, 12);
      });
    }
  }

  private showStageBanner() {
    const isInfinite = this.stage.level > 6;
    const top = this.add
      .text(GAME_W / 2, 200, `STAGE ${this.stage.level}${isInfinite ? '  ∞' : ''}`, {
        fontFamily: FONT_DISPLAY,
        fontSize: '64px',
        color: '#ffffff',
        stroke: '#1a1030',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(45)
      .setAlpha(0);
    const sub = this.add
      .text(GAME_W / 2, 258, this.stage.name, { fontFamily: FONT_BODY, fontSize: '22px', fontStyle: '700', color: '#ffd24a', stroke: '#1a1030', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(45)
      .setAlpha(0);
    this.tweens.add({ targets: [top, sub], alpha: 1, duration: 250, yoyo: true, hold: 900, onComplete: () => (top.destroy(), sub.destroy()) });
  }

  private gameOver() {
    this.state = 'over';
    this.setTimeScale(1);
    this.slowLeft = 0;
    this.attack = null;
    this.projectiles.slice().forEach((p) => this.removeProjectile(p));
    this.heroAnim = { pose: 'down', start: this.clock, hold: 0, dx: -40, persistent: true };
    this.popText(GAME_W / 2, 220, 'K.O.', '#ff6b6b', 88, true);

    const result: GameResult = {
      nickname: storage.getNickname() ?? '무명',
      score: this.score,
      enemiesDefeated: this.defeated,
      maxCombo: this.maxCombo,
      stageReached: this.stage.level,
      durationMs: this.playMs,
    };
    this.time.delayedCall(1600, () => {
      this.cameras.main.fadeOut(300, 5, 2, 12);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameOver', result));
    });
  }

  // ───────────────────────── 렌더링 ─────────────────────────

  private renderHero() {
    const a = this.heroAnim;
    let pose: HeroPose;
    let x = HERO_X;
    if (a && animActive(a, this.clock)) {
      x += a.dx * animProgress(a, this.clock);
      pose = a.persistent || this.clock - a.start < a.hold + 80 ? a.pose : 'idle';
    } else {
      this.heroAnim = null;
      pose = Math.floor(this.clock / 450) % 2 ? 'idle2' : 'idle';
    }
    this.hero.setTexture(heroKey(this.awake, pose));
    this.hero.x = x;
  }

  private renderEnemy() {
    const look = this.stage.look;
    let x = this.enemyRig.baseX;
    let pose: EnemyPose = Math.floor(this.clock / 520) % 2 ? 'idle2' : 'idle';
    const a = this.enemyAnim;

    if (a && animActive(a, this.clock)) {
      x += a.dx * animProgress(a, this.clock);
      pose = a.pose;
    } else {
      this.enemyAnim = null;
      const atk = this.attack;
      if (atk && this.state === 'fight') {
        pose = 'windup';
        let lunge = 0;
        for (const h of atk.hits) {
          if (h.fake) {
            if (h.broke) pose = 'idle2';
            continue;
          }
          const dt = this.clock - h.time;
          if (h.ranged) {
            const launch = h.time - this.projTravel();
            if (this.clock >= launch - 140 && this.clock <= launch + 220) pose = 'cast';
          } else {
            const c = lungeCurve(dt);
            if (c > lunge) lunge = c;
            if (dt >= -90 && dt <= 220) pose = 'attack';
          }
        }
        const lastHit = atk.hits[atk.hits.length - 1].time;
        if (this.clock > lastHit + 220 && pose === 'windup') pose = 'idle';
        x += (LUNGE_X - ENEMY_X) * lunge;
      }
    }
    this.enemy.setTexture(enemyKey(look, pose));
    this.enemy.x = x;
    this.enemyShadow.x = x;
  }

  private launchProjectile(h: LiveHit) {
    h.launched = true;
    sfx.blast();
    const accent = ENEMY_LOOKS[this.stage.look].accent ?? '#7ef0ff';
    const img = this.add
      .image(ENEMY_X - 80, CHEST_Y, 'orb')
      .setTint(Phaser.Display.Color.HexStringToColor(accent).color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(25);
    this.projectiles.push({ img, hit: h, launch: this.clock, travel: this.projTravel() });
  }

  private removeProjectile(p: Projectile) {
    this.sparks.explode(10, p.img.x, p.img.y);
    p.img.destroy();
    this.projectiles = this.projectiles.filter((q) => q !== p);
  }

  private renderProjectiles() {
    const sx = ENEMY_X - 80;
    const tx = HERO_X + 20;
    for (const p of this.projectiles.slice()) {
      const t = (this.clock - p.launch) / p.travel;
      if (t > 1.8) {
        p.img.destroy();
        this.projectiles = this.projectiles.filter((q) => q !== p);
        continue;
      }
      p.img.x = sx + (tx - sx) * t;
      p.img.setScale(1 + Math.sin(this.clock / 40) * 0.12);
      p.img.setAlpha(t > 1.2 ? Math.max(0, 1 - (t - 1.2) / 0.6) : 1);
    }
  }

  private renderRings() {
    const g = this.rings;
    g.clear();
    const atk = this.attack;
    if (!atk || this.state !== 'fight') return;
    const lead = this.stage.telegraph;
    let any = false;
    for (const h of atk.hits) {
      if (h.resolved) continue;
      const remain = h.time - this.clock;
      if (remain > lead || remain < -JUDGE.goodMs) continue;
      any = true;
      const r = 36 + 130 * Math.max(0, remain / lead);
      const color = h.ranged ? 0x7ef0ff : COLOR.gold;
      g.lineStyle(5, color, 0.95);
      g.strokeCircle(HERO_X, CHEST_Y, r);
      g.lineStyle(12, color, 0.18);
      g.strokeCircle(HERO_X, CHEST_Y, r);
    }
    if (any) {
      g.lineStyle(3, 0xffffff, 0.55);
      g.strokeCircle(HERO_X, CHEST_Y, 36);
    }
  }

  // ───────────────────────── 연출 ─────────────────────────

  private ghost(texture: string, x: number, y: number, alpha: number) {
    const img = this.add.image(x, y, texture).setOrigin(0.5, ORIGIN_Y).setTint(0x9fe8ff).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: img, alpha: 0, duration: 380, onComplete: () => img.destroy() });
  }

  private flashScreen(color: number, alpha: number, duration: number) {
    this.flash.setFillStyle(color, 1).setAlpha(alpha);
    this.tweens.killTweensOf(this.flash);
    this.tweens.add({ targets: this.flash, alpha: 0, duration });
  }

  private popText(x: number, y: number, text: string, color: string, size: number, display = false) {
    const t = this.add
      .text(x, y, text, {
        fontFamily: display ? FONT_DISPLAY : FONT_BODY,
        fontSize: `${size}px`,
        fontStyle: display ? 'normal' : '900',
        color,
        stroke: '#0b0816',
        strokeThickness: Math.max(4, size / 7),
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setScale(0.6);
    this.popTexts.add(t);
    this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      delay: 380,
      duration: 420,
      onComplete: () => {
        this.popTexts.delete(t);
        t.destroy();
      },
    });
    return t;
  }

  /** 화면에 떠 있는 판정 글자를 모두 지운다 (큰 연출 직전) */
  private clearPopTexts() {
    this.popTexts.forEach((t) => {
      this.tweens.killTweensOf(t);
      t.destroy();
    });
    this.popTexts.clear();
  }

  // ───────────────────────── HUD ─────────────────────────

  private createHud() {
    this.hud = this.add.graphics().setDepth(60);
    const label = (x: number, y: number, s: string) =>
      this.add.text(x, y, s, { fontFamily: FONT_BODY, fontSize: '14px', fontStyle: '900', color: '#eef4ff', stroke: '#0b0816', strokeThickness: 4 }).setDepth(61);
    label(20, 14, '카이');
    label(20, 50, '본능');

    this.scoreText = this.add
      .text(GAME_W / 2, 10, '0', { fontFamily: FONT_DISPLAY, fontSize: '38px', color: '#ffffff', stroke: '#0b0816', strokeThickness: 6 })
      .setOrigin(0.5, 0)
      .setDepth(61);
    this.comboText = this.add
      .text(GAME_W / 2, 56, '', { fontFamily: FONT_BODY, fontSize: '17px', fontStyle: '900', color: '#ffd24a', stroke: '#0b0816', strokeThickness: 4 })
      .setOrigin(0.5, 0)
      .setDepth(61);
    this.stageText = this.add
      .text(GAME_W - 76, 12, '', { fontFamily: FONT_DISPLAY, fontSize: '20px', color: '#ffffff', stroke: '#0b0816', strokeThickness: 5 })
      .setOrigin(1, 0)
      .setDepth(61);
    this.enemyNameText = this.add
      .text(GAME_W - 76, 38, '', { fontFamily: FONT_BODY, fontSize: '13px', fontStyle: '700', color: '#ffd24a', stroke: '#0b0816', strokeThickness: 4 })
      .setOrigin(1, 0)
      .setDepth(61);

    // 일시정지 버튼
    const pb = this.add.graphics();
    pb.fillStyle(0x000000, 0.45).fillRoundedRect(-22, -22, 44, 44, 10);
    pb.fillStyle(0xffffff, 0.9).fillRect(-8, -10, 5, 20).fillRect(3, -10, 5, 20);
    this.pauseBtn = this.add.container(GAME_W - 34, 34, [pb]).setSize(44, 44).setDepth(62);
    this.pauseBtn.setInteractive({ useHandCursor: true }).on('pointerup', () => this.openPause());

    this.hint = this.add
      .text(GAME_W / 2, GAME_H - 18, '링이 안쪽 원에 닿는 순간 SPACE 또는 화면 탭!', {
        fontFamily: FONT_BODY,
        fontSize: '16px',
        fontStyle: '700',
        color: '#eef4ff',
        stroke: '#0b0816',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(61)
      .setAlpha(0.85);
  }

  private updateHud() {
    const g = this.hud;
    g.clear();

    // 체력
    for (let i = 0; i < PLAYER_MAX_HP; i++) {
      g.fillStyle(0x000000, 0.5).fillRoundedRect(58 + i * 30, 15, 26, 16, 4);
      if (i < this.hp) g.fillStyle(0xff5a5a, 1).fillRoundedRect(60 + i * 30, 17, 22, 12, 3);
    }

    // 본능 게이지
    const gw = 220;
    g.fillStyle(0x000000, 0.5).fillRoundedRect(58, 51, gw + 4, 18, 5);
    const fill = (this.gauge / GAUGE.max) * gw;
    if (fill > 0) {
      g.fillStyle(this.gauge >= GAUGE.max ? 0xffffff : 0x7fc8ff, 1).fillRoundedRect(60, 53, fill, 14, 4);
    }

    // 적 체력
    const pips = this.stage.hp;
    const size = pips > 8 ? 12 : 18;
    for (let i = 0; i < pips; i++) {
      const x = GAME_W - 76 - (pips - i) * (size + 4);
      g.fillStyle(0x000000, 0.5).fillRoundedRect(x, 60, size, 12, 3);
      if (i < this.enemyHp) g.fillStyle(0xffa23a, 1).fillRoundedRect(x + 2, 62, size - 4, 8, 2);
    }

    this.scoreText.setText(this.score.toLocaleString());
    const mult = comboMultiplier(this.combo);
    this.comboText.setText(this.combo >= 2 ? `${this.combo} COMBO${mult > 1 ? `  ×${mult}` : ''}` : '');
    this.stageText.setText(`STAGE ${this.stage.level}`);
    this.enemyNameText.setText(this.stage.name);
    this.hint.setVisible(this.stage.level === 1);
  }
}
