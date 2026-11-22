// 탑 1~10층 구성. 지금은 층마다 전투 1번 (갈림길 맵은 다음 단계에서 이 위에 얹는다).
import * as E from "./enemies";
import type { UnitDef } from "@/lib/engine/types";

export interface FloorDef {
  floor: number;
  name: string;
  kind: "normal" | "boss";
  enemyLevel: number;
  enemies: UnitDef[];
  intro: string;
}

export const FLOORS: FloorDef[] = [
  {
    floor: 1,
    name: "버려진 지하철역",
    kind: "normal",
    enemyLevel: 1,
    enemies: [E.RAIL_DEVOURER, E.SHADOW_WRAITH, E.FLAME_IMP],
    intro: "끊긴 선로 너머에서 무언가가 기어 나온다.",
  },
  {
    floor: 2,
    name: "폐쇄된 학교",
    kind: "normal",
    enemyLevel: 1,
    enemies: [E.LAB_SLIME, E.CORRIDOR_GHOST, E.PLASTER_STATUE],
    intro: "아무도 없는 복도에 종소리가 울린다.",
  },
  {
    floor: 3,
    name: "침수된 하수도",
    kind: "normal",
    enemyLevel: 2,
    enemies: [E.SEWER_CROC, E.PLAGUE_RATS, E.FROST_JELLY],
    intro: "발목까지 차오른 물 아래로 그림자가 지나간다.",
  },
  {
    floor: 4,
    name: "무너진 쇼핑몰",
    kind: "normal",
    enemyLevel: 3,
    enemies: [E.MANNEQUIN_KNIGHT, E.RUNAWAY_CART, E.SECURITY_DRONE],
    intro: "꺼진 진열대 사이로 마네킹들이 고개를 돌린다.",
  },
  {
    floor: 5,
    name: "첫 번째 관문",
    kind: "boss",
    enemyLevel: 4,
    enemies: [E.LAB_SLIME, E.TOWER_GATEKEEPER, E.CORRIDOR_GHOST],
    intro: "거대한 문 앞을 지키는 자가 눈을 뜬다.",
  },
  {
    floor: 6,
    name: "고층 빌딩 사무실",
    kind: "normal",
    enemyLevel: 7,
    enemies: [E.PAPER_GOLEM, E.OVERTIME_WRAITH, E.NEON_SPRITE],
    intro: "모니터 불빛만 남은 사무실, 아직 퇴근하지 못한 것들이 있다.",
  },
  {
    floor: 7,
    name: "옥상 정원",
    kind: "normal",
    enemyLevel: 8,
    enemies: [E.ROOFTOP_GARGOYLE, E.FIRE_CHICK, E.ICE_SPIRIT],
    intro: "도시가 내려다보이는 옥상, 석상의 눈이 붉게 빛난다.",
  },
  {
    floor: 8,
    name: "붉은 하늘 다리",
    kind: "normal",
    enemyLevel: 9,
    enemies: [E.ABYSS_KNIGHT, E.FLAME_GIANT, E.LIGHT_APOSTLE],
    intro: "하늘이 붉게 갈라진 다리 위, 거인의 발소리가 가까워진다.",
  },
  {
    floor: 9,
    name: "탑의 회랑",
    kind: "normal",
    enemyLevel: 10,
    enemies: [E.FROST_GIANT, E.MIRROR_DOUBLE, E.VOID_HUNTER],
    intro: "끝없이 이어진 거울 회랑에 내 모습이 아닌 무언가가 비친다.",
  },
  {
    floor: 10,
    name: "탑의 정상",
    kind: "boss",
    enemyLevel: 11,
    enemies: [E.OVERSEER_EYE, E.TOWER_OVERSEER, E.OVERSEER_EYE],
    intro: "[시스템] 탑의 관리자가 당신을 내려다봅니다.",
  },
];

export const MAX_FLOOR = FLOORS.length;

export function getFloor(floor: number): FloorDef {
  const f = FLOORS[floor - 1];
  if (!f) throw new Error(`unknown floor ${floor}`);
  return f;
}
