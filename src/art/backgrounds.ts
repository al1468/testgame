import type { ThemeKey } from '../game/config';

export const BG_W = 960;
export const BG_H = 540;
export const GROUND_Y = 450;

/** 0..1 결정적 난수 (배경이 매번 같게) */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function sky(ctx: CanvasRenderingContext2D, stops: string[]) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BG_W, GROUND_Y);
}

function ground(ctx: CanvasRenderingContext2D, top: string, bottom: string, line: string) {
  const g = ctx.createLinearGradient(0, GROUND_Y, 0, BG_H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y, BG_W, BG_H - GROUND_Y);
  ctx.fillStyle = line;
  ctx.fillRect(0, GROUND_Y, BG_W, 3);
}

function ridge(ctx: CanvasRenderingContext2D, rnd: () => number, baseY: number, amp: number, step: number, color: string, sharp = false) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= BG_W + step; x += step) {
    const y = baseY - rnd() * amp;
    if (sharp) ctx.lineTo(x, y);
    else ctx.quadraticCurveTo(x - step / 2, y - amp * 0.3, x, y);
  }
  ctx.lineTo(BG_W, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

function glowCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function stars(ctx: CanvasRenderingContext2D, rnd: () => number, n: number, maxY: number) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
    const s = rnd() < 0.1 ? 2 : 1;
    ctx.fillRect(rnd() * BG_W, rnd() * maxY, s, s);
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D, theme: ThemeKey) {
  const rnd = seeded(theme.length * 977 + theme.charCodeAt(0));
  switch (theme) {
    case 'wasteland': {
      sky(ctx, ['#2b1f4a', '#a8465a', '#f19a4a', '#f7c77a']);
      glowCircle(ctx, 720, 330, 160, 'rgba(255,220,140,0.9)');
      ridge(ctx, rnd, 340, 60, 120, '#7a3a3e');
      // 메사(탁상 대지)
      ctx.fillStyle = '#5a2a30';
      [[60, 300, 180], [420, 330, 140], [760, 290, 220]].forEach(([x, y, w]) => {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x + 20, y);
        ctx.lineTo(x + w - 20, y);
        ctx.lineTo(x + w, GROUND_Y);
        ctx.fill();
      });
      ridge(ctx, rnd, 420, 30, 80, '#3d1d24');
      ground(ctx, '#c9874f', '#6e3f2a', '#e7b37a');
      break;
    }
    case 'dojo': {
      sky(ctx, ['#3a2416', '#5a3a22', '#7a5230']);
      // 창호지 벽
      for (let x = 0; x < BG_W; x += 160) {
        ctx.fillStyle = '#e8d6ad';
        ctx.fillRect(x + 14, 80, 132, 280);
        ctx.strokeStyle = '#6b4526';
        ctx.lineWidth = 3;
        for (let gx = x + 14; gx <= x + 146; gx += 33) {
          ctx.beginPath();
          ctx.moveTo(gx, 80);
          ctx.lineTo(gx, 360);
          ctx.stroke();
        }
        for (let gy = 80; gy <= 360; gy += 40) {
          ctx.beginPath();
          ctx.moveTo(x + 14, gy);
          ctx.lineTo(x + 146, gy);
          ctx.stroke();
        }
        // 기둥
        ctx.fillStyle = '#4a2c18';
        ctx.fillRect(x, 40, 14, GROUND_Y - 40);
      }
      ctx.fillStyle = '#2e1b0e';
      ctx.fillRect(0, 0, BG_W, 50);
      ctx.fillRect(0, 360, BG_W, 90);
      // 족자
      ctx.fillStyle = '#f3ead2';
      ctx.fillRect(452, 100, 56, 200);
      ctx.fillStyle = '#1c1c1c';
      ctx.font = 'bold 36px serif';
      ctx.textAlign = 'center';
      ['本', '能'].forEach((c, i) => ctx.fillText(c, 480, 160 + i * 70));
      ground(ctx, '#a8743e', '#5e3b1c', '#d1a067');
      for (let x = 0; x < BG_W; x += 120) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x, GROUND_Y, 2, BG_H - GROUND_Y);
      }
      break;
    }
    case 'peak': {
      sky(ctx, ['#2f6fb6', '#6fb0e6', '#cfe8f7']);
      // 구름
      for (let i = 0; i < 7; i++) {
        const x = rnd() * BG_W;
        const y = 60 + rnd() * 160;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.ellipse(x + j * 26, y + (j % 2) * 6, 34, 16, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ridge(ctx, rnd, 300, 140, 110, '#8fa9c7', true);
      ridge(ctx, rnd, 380, 70, 90, '#5f7c9c', true);
      ground(ctx, '#e9f0f6', '#9fb1c4', '#ffffff');
      break;
    }
    case 'ruins': {
      sky(ctx, ['#070b1c', '#141c3c', '#3a2040']);
      stars(ctx, rnd, 120, 250);
      glowCircle(ctx, 200, 110, 70, 'rgba(230,230,255,0.9)');
      // 무너진 빌딩
      for (let x = -20; x < BG_W; x += 70 + rnd() * 40) {
        const w = 50 + rnd() * 60;
        const h = 120 + rnd() * 220;
        ctx.fillStyle = '#121626';
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x, GROUND_Y - h);
        ctx.lineTo(x + w * 0.6, GROUND_Y - h + 20 + rnd() * 30);
        ctx.lineTo(x + w, GROUND_Y - h + 40);
        ctx.lineTo(x + w, GROUND_Y);
        ctx.fill();
        for (let wy = GROUND_Y - h + 60; wy < GROUND_Y - 20; wy += 22) {
          for (let wx = x + 8; wx < x + w - 8; wx += 14) {
            if (rnd() < 0.18) {
              ctx.fillStyle = rnd() < 0.5 ? '#ff6a3a' : '#ffcf6a';
              ctx.fillRect(wx, wy, 6, 9);
            }
          }
        }
      }
      glowCircle(ctx, 780, GROUND_Y, 180, 'rgba(255,80,40,0.35)');
      ground(ctx, '#3a3a48', '#15151c', '#5c5c70');
      break;
    }
    case 'demon': {
      sky(ctx, ['#1a0306', '#5a0a14', '#b8261e', '#f0602a']);
      glowCircle(ctx, 480, 140, 110, 'rgba(255,190,90,0.8)');
      ctx.fillStyle = '#2a0508';
      ctx.beginPath();
      ctx.arc(480, 140, 60, 0, Math.PI * 2);
      ctx.fill();
      ridge(ctx, rnd, 330, 120, 60, '#3a0a0e', true);
      ridge(ctx, rnd, 400, 60, 45, '#200406', true);
      ground(ctx, '#4a1410', '#140404', '#ff7a3a');
      // 용암 균열
      ctx.strokeStyle = '#ff8a3a';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        let x = rnd() * BG_W;
        let y = GROUND_Y + 10 + rnd() * 60;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          x += 20 + rnd() * 30;
          y += (rnd() - 0.5) * 16;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'void': {
      sky(ctx, ['#05020c', '#140828', '#2a0f4a']);
      stars(ctx, rnd, 260, GROUND_Y);
      glowCircle(ctx, 480, 220, 300, 'rgba(140,80,255,0.25)');
      // 떠 있는 바위
      for (let i = 0; i < 6; i++) {
        const x = 60 + rnd() * 840;
        const y = 80 + rnd() * 220;
        const w = 30 + rnd() * 60;
        ctx.fillStyle = '#1e1433';
        ctx.beginPath();
        ctx.moveTo(x - w, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w * 0.3, y + w * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#9a62ff';
        ctx.fillRect(x - w, y - 2, w * 2, 2);
      }
      ground(ctx, '#20123a', '#05020c', '#c59bff');
      // 마법진 같은 바닥 선
      ctx.strokeStyle = 'rgba(197,155,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(480, GROUND_Y + 40, 380, 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
}
