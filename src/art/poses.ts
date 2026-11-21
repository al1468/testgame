/**
 * 관절 각도 기반 포즈. 각도 단위는 도(deg).
 * 팔·다리: 0 = 아래, +90 = 앞(바라보는 방향), -90 = 뒤, 180 = 위
 * 몸통: 0 = 똑바로 섬, + = 앞으로 기울임
 */
export interface Pose {
  torso: number;
  head: number;
  /** 앞팔 [윗팔, 아래팔] */
  aF: [number, number];
  /** 뒷팔 */
  aB: [number, number];
  /** 앞다리 [허벅지, 정강이] */
  lF: [number, number];
  /** 뒷다리 */
  lB: [number, number];
  /** 땅에서 띄우는 높이(px), 점프 포즈용 */
  lift?: number;
  /** 손바닥을 편 자세 (기공) */
  palm?: boolean;
}

export type HeroPose =
  | 'idle'
  | 'idle2'
  | 'dodgeLean'
  | 'dodgeSide'
  | 'dodgeLow'
  | 'dodgeFlip'
  | 'hit'
  | 'punch'
  | 'awaken'
  | 'down';

export type EnemyPose = 'idle' | 'idle2' | 'windup' | 'attack' | 'cast' | 'hit' | 'down';

const idle: Pose = { torso: 8, head: 0, aF: [35, 150], aB: [15, 140], lF: [24, -4], lB: [-24, -10] };

export const HERO_POSES: Record<HeroPose, Pose> = {
  idle,
  idle2: { ...idle, torso: 10, aF: [38, 146], aB: [18, 136], lF: [28, -10], lB: [-26, -16] },
  // 상체를 크게 뒤로 젖혀 피하기
  dodgeLean: { torso: -42, head: -18, aF: [-20, 20], aB: [-70, -30], lF: [34, 12], lB: [-8, -34] },
  // 옆으로 비켜서기
  dodgeSide: { torso: -14, head: -6, aF: [20, 120], aB: [-30, 80], lF: [12, -18], lB: [-42, -40] },
  // 낮게 숙이기
  dodgeLow: { torso: 55, head: 15, aF: [60, 150], aB: [10, 120], lF: [85, -5], lB: [55, -75] },
  // 뒤로 공중제비
  dodgeFlip: { torso: -70, head: -25, aF: [-130, -160], aB: [-150, -175], lF: [110, -10], lB: [95, -25], lift: 46 },
  hit: { torso: -28, head: -32, aF: [-40, -10], aB: [-75, -45], lF: [32, 4], lB: [-22, -12] },
  // 정권 지르기
  punch: { torso: 22, head: 5, aF: [90, 92], aB: [20, 150], lF: [48, 2], lB: [-48, -30] },
  // 각성 자세
  awaken: { torso: 0, head: 0, aF: [28, 18], aB: [-28, -18], lF: [24, 0], lB: [-24, 0] },
  down: { torso: -92, head: -10, aF: [-120, -150], aB: [-100, -120], lF: [92, 92], lB: [86, 80] },
};

export const ENEMY_POSES: Record<EnemyPose, Pose> = {
  idle,
  idle2: HERO_POSES.idle2,
  windup: { torso: -16, head: 4, aF: [-70, -140], aB: [30, 150], lF: [30, 0], lB: [-30, -14] },
  attack: { torso: 30, head: 8, aF: [92, 92], aB: [-10, 120], lF: [55, 0], lB: [-50, -35] },
  cast: { torso: 12, head: 0, aF: [82, 88], aB: [76, 84], lF: [30, 0], lB: [-30, -10], palm: true },
  hit: HERO_POSES.hit,
  down: HERO_POSES.down,
};

export const HERO_POSE_KEYS = Object.keys(HERO_POSES) as HeroPose[];
export const ENEMY_POSE_KEYS = Object.keys(ENEMY_POSES) as EnemyPose[];
