import type { Look } from './looks';
import type { Pose } from './poses';

/** 캐릭터 텍스처 크기. 발끝은 FEET_Y에 닿는다. */
export const FIGHTER_W = 220;
export const FIGHTER_H = 250;
export const FEET_Y = 238;

type P = { x: number; y: number };

const rad = (d: number) => (d * Math.PI) / 180;
/** 팔다리 방향 벡터 (0 = 아래, +90 = 앞) */
const limbDir = (deg: number): P => ({ x: Math.sin(rad(deg)), y: Math.cos(rad(deg)) });
/** 몸통 방향 벡터 (0 = 위) */
const upDir = (deg: number): P => ({ x: Math.sin(rad(deg)), y: -Math.cos(rad(deg)) });
const add = (a: P, d: P, len: number): P => ({ x: a.x + d.x * len, y: a.y + d.y * len });

export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function limb(ctx: CanvasRenderingContext2D, a: P, b: P, w: number, color: string, outline: string) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline;
  ctx.lineWidth = w + 5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function disc(ctx: CanvasRenderingContext2D, c: P, r: number, color: string, outline: string) {
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, outline: string, lw = 2.5) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = outline;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

interface Skeleton {
  hip: P;
  neck: P;
  shoulder: P;
  head: P;
  headAngle: number;
  elbowF: P;
  handF: P;
  elbowB: P;
  handB: P;
  kneeF: P;
  footF: P;
  kneeB: P;
  footB: P;
}

function solve(pose: Pose, look: Look): Skeleton {
  const s = 1 + (look.bulk - 1) * 0.35;
  const hip = { x: FIGHTER_W / 2, y: 130 };
  const td = upDir(pose.torso);
  const neck = add(hip, td, 54 * s);
  const shoulder = add(hip, td, 47 * s);
  const headAngle = pose.torso + pose.head;
  const head = add(neck, upDir(headAngle), 22);
  const elbowF = add(shoulder, limbDir(pose.aF[0]), 32 * s);
  const handF = add(elbowF, limbDir(pose.aF[1]), 30 * s);
  const elbowB = add(shoulder, limbDir(pose.aB[0]), 32 * s);
  const handB = add(elbowB, limbDir(pose.aB[1]), 30 * s);
  const kneeF = add(hip, limbDir(pose.lF[0]), 44 * s);
  const footF = add(kneeF, limbDir(pose.lF[1]), 44 * s);
  const kneeB = add(hip, limbDir(pose.lB[0]), 44 * s);
  const footB = add(kneeB, limbDir(pose.lB[1]), 44 * s);
  return { hip, neck, shoulder, head, headAngle, elbowF, handF, elbowB, handB, kneeF, footF, kneeB, footB };
}

function drawHairBack(ctx: CanvasRenderingContext2D, look: Look) {
  const o = look.outline;
  if (look.hairType === 'long') {
    poly(ctx, [[6, -14], [-10, -18], [-20, -4], [-22, 26], [-28, 60], [-14, 58], [-10, 30], [-6, 8]], look.hair, o);
  } else if (look.hairType === 'crown') {
    poly(ctx, [[4, -16], [-12, -18], [-22, -2], [-30, 30], [-40, 64], [-22, 56], [-14, 28], [-6, 6]], look.hair, o);
  } else if (look.hairType === 'bandana') {
    // 두건 꼬리
    poly(ctx, [[-15, -8], [-34, 2], [-30, 10], [-14, -2]], look.accent ?? '#b3262e', o);
    poly(ctx, [[-15, -6], [-28, 14], [-22, 16], [-12, 0]], shade(look.accent ?? '#b3262e', 0.8), o);
  }
}

function drawHead(ctx: CanvasRenderingContext2D, look: Look) {
  const o = look.outline;
  const r = 17;

  if (look.hairType === 'helmet') {
    ctx.beginPath();
    ctx.roundRect(-17, -19, 34, 36, 9);
    ctx.fillStyle = look.skin;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = o;
    ctx.stroke();
    // 턱 장갑
    poly(ctx, [[-10, 10], [16, 8], [12, 18], [-8, 18]], shade(look.skin, 0.75), o, 2);
    // 바이저
    ctx.fillStyle = look.accent ?? '#ff3b3b';
    ctx.shadowColor = look.accent ?? '#ff3b3b';
    ctx.shadowBlur = 10;
    ctx.fillRect(0, -7, 17, 6);
    ctx.shadowBlur = 0;
    // 안테나
    limb(ctx, { x: -8, y: -19 }, { x: -14, y: -32 }, 2, shade(look.skin, 0.7), o);
    disc(ctx, { x: -14, y: -33 }, 3, look.accent ?? '#ff3b3b', o);
    return;
  }

  // 얼굴
  disc(ctx, { x: 0, y: 0 }, r, look.skin, o);
  // 귀
  disc(ctx, { x: -3, y: 2 }, 4, shade(look.skin, 0.9), o);

  // 눈
  if (look.glowEyes) {
    ctx.shadowColor = look.accent ?? '#bfe6ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = look.accent ?? '#bfe6ff';
    ctx.beginPath();
    ctx.ellipse(9, -2, 3.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(9, -2, 3.4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o;
    ctx.beginPath();
    ctx.arc(10.5, -2, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // 눈썹 (날카롭게)
  ctx.strokeStyle = o;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(5, -8);
  ctx.lineTo(14, -6);
  ctx.stroke();
  // 입
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(9, 9);
  ctx.lineTo(14, 8);
  ctx.stroke();

  if (look.beard) {
    poly(ctx, [[14, 4], [16, 20], [6, 32], [-2, 18], [2, 8]], look.beard, o);
  }

  switch (look.hairType) {
    case 'kai':
      // 뒤로 뻗친 머리
      poly(
        ctx,
        [
          [16, -5], [11, -20], [3, -16], [-1, -34], [-8, -19], [-19, -32], [-18, -15],
          [-33, -19], [-22, -5], [-32, 4], [-19, 6], [-17, 15], [-10, 7], [-6, -4], [5, -8], [11, -2],
        ],
        look.hair,
        o,
      );
      // 앞머리
      poly(ctx, [[12, -12], [20, 0], [13, -4]], look.hair, o, 2);
      break;
    case 'bandana':
      poly(ctx, [[15, -8], [8, -17], [-6, -18], [-16, -10], [-17, 0], [-10, -6], [6, -9]], look.hair, o);
      limb(ctx, { x: -16, y: -8 }, { x: 16, y: -9 }, 6, look.accent ?? '#b3262e', o);
      break;
    case 'bald':
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-2, -11, 6, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'long':
      poly(ctx, [[16, -7], [8, -17], [-8, -19], [-18, -8], [-17, 6], [-10, -4], [4, -9]], look.hair, o);
      break;
    case 'horns':
      poly(ctx, [[2, -14], [10, -38], [8, -14]], '#efe2c4', o);
      poly(ctx, [[-10, -12], [-16, -36], [-15, -10]], '#efe2c4', o);
      poly(ctx, [[15, -8], [6, -16], [-8, -16], [-17, -6], [-16, 4], [-8, -6], [6, -9]], look.hair, o);
      break;
    case 'crown':
      poly(ctx, [[16, -7], [8, -17], [-8, -19], [-18, -8], [-17, 6], [-10, -4], [4, -9]], look.hair, o);
      poly(ctx, [[-14, -14], [-12, -30], [-6, -20], [0, -34], [5, -20], [11, -30], [12, -14]], look.belt, o);
      break;
  }
}

/** 포즈 하나를 캔버스에 그린다 (오른쪽을 바라보는 방향). */
export function drawFighter(ctx: CanvasRenderingContext2D, pose: Pose, look: Look) {
  const k = solve(pose, look);
  const o = look.outline;
  const b = look.bulk;

  // 가장 낮은 점이 땅에 닿도록 높이 보정
  const lows = [k.footF.y + 7, k.footB.y + 7, k.kneeF.y + 8, k.kneeB.y + 8, k.hip.y + 14, k.head.y + 18, k.handF.y + 7, k.handB.y + 7];
  const dy = FEET_Y - Math.max(...lows) - (pose.lift ?? 0);

  ctx.save();
  ctx.translate(0, dy);

  const back = 0.78;

  // 망토
  if (look.cape) {
    const td = upDir(pose.torso);
    const sh = k.shoulder;
    const low = add(k.hip, { x: -td.x, y: -td.y }, 30);
    poly(ctx, [[sh.x + 2, sh.y - 2], [sh.x - 12, sh.y], [low.x - 40, low.y + 50], [low.x - 4, low.y + 58], [k.hip.x + 4, k.hip.y]], look.cape, o);
  }

  // 뒷다리
  limb(ctx, k.hip, k.kneeB, 17 * b, shade(look.pants, back), o);
  limb(ctx, k.kneeB, k.footB, 14.5 * b, shade(look.pants, back), o);
  drawBoot(ctx, k.kneeB, k.footB, pose.lB[1], look, back);

  // 뒷팔
  limb(ctx, k.shoulder, k.elbowB, 14 * b, shade(look.gi, back), o);
  limb(ctx, k.elbowB, k.handB, 12 * b, shade(look.skin, back), o);
  drawHand(ctx, k.handB, look, back, pose.palm);

  // 몸통
  limb(ctx, k.hip, k.neck, 36 * b, look.gi, o);
  // 안쪽 옷깃 (V)
  const td = upDir(pose.torso);
  const chest = add(k.hip, td, 40);
  limb(ctx, chest, k.neck, 6, look.trim, o);
  // 띠
  const perp = { x: Math.cos(rad(pose.torso)), y: Math.sin(rad(pose.torso)) };
  const beltC = add(k.hip, td, 8);
  limb(ctx, add(beltC, perp, -18 * b), add(beltC, perp, 18 * b), 7, look.belt, o);
  limb(ctx, add(beltC, perp, -12 * b), { x: beltC.x - 22, y: beltC.y + 20 }, 4.5, look.belt, o);

  // 앞다리
  limb(ctx, k.hip, k.kneeF, 17 * b, look.pants, o);
  limb(ctx, k.kneeF, k.footF, 14.5 * b, look.pants, o);
  drawBoot(ctx, k.kneeF, k.footF, pose.lF[1], look, 1);

  // 목 + 머리
  limb(ctx, k.neck, add(k.neck, upDir(k.headAngle), 8), 10, look.skin, o);
  ctx.save();
  ctx.translate(k.head.x, k.head.y);
  ctx.rotate(rad(k.headAngle));
  drawHairBack(ctx, look);
  drawHead(ctx, look);
  ctx.restore();

  // 앞팔
  limb(ctx, k.shoulder, k.elbowF, 14 * b, look.gi, o);
  limb(ctx, k.elbowF, k.handF, 12 * b, look.skin, o);
  drawHand(ctx, k.handF, look, 1, pose.palm);

  ctx.restore();
}

function drawBoot(ctx: CanvasRenderingContext2D, knee: P, foot: P, shinDeg: number, look: Look, f: number) {
  const dir = { x: foot.x - knee.x, y: foot.y - knee.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const top = { x: foot.x - (dir.x / len) * 12, y: foot.y - (dir.y / len) * 12 };
  limb(ctx, top, foot, 13 * look.bulk, shade(look.boots, f), look.outline);
  // 발끝은 정강이에 수직, 앞쪽으로
  const toe = limbDir(shinDeg + 90);
  limb(ctx, foot, add(foot, toe, 9), 9 * look.bulk, shade(look.boots, f), look.outline);
}

function drawHand(ctx: CanvasRenderingContext2D, hand: P, look: Look, f: number, palm?: boolean) {
  disc(ctx, hand, (palm ? 6 : 7) * look.bulk, shade(look.skin, f), look.outline);
  // 손목 붕대
  ctx.strokeStyle = shade(look.wraps, f);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, 7.5 * look.bulk, Math.PI * 0.9, Math.PI * 1.6);
  ctx.stroke();
}
