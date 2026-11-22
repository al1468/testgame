// 층별 갈림길 맵 생성. 시드가 같으면 같은 맵.
//   단계 0~2: 노드 2~3개씩 (전투/엘리트/영입/휴식/상점/이벤트)
//   단계 3  : 관문 전투 1개 (보스 층이면 보스)
// 보스 층은 관문 직전 단계가 휴식 1개로 고정된다.
import { roll, seedFromString } from "./rng";

export type NodeKind = "battle" | "elite" | "recruit" | "rest" | "shop" | "event" | "gate";

export interface MapNode {
  id: string;
  row: number;
  col: number;
  kind: NodeKind;
  next: string[];
}

export interface FloorMap {
  floor: number;
  rows: number; // 관문 포함 단계 수
  nodes: MapNode[];
}

export const MAP_RULES = {
  middleRows: 3,
  weights: { battle: 34, elite: 14, recruit: 14, rest: 12, shop: 12, event: 14 } as Record<
    Exclude<NodeKind, "gate">,
    number
  >,
};

export function generateFloorMap(seed: string, floor: number, bossFloor: boolean): FloorMap {
  const rng = { rngState: seedFromString(`${seed}|map|${floor}`) };
  const R = MAP_RULES.middleRows;
  const rows: MapNode[][] = [];

  for (let r = 0; r < R; r++) {
    const preGate = r === R - 1;
    if (bossFloor && preGate) {
      rows.push([{ id: `${r}-0`, row: r, col: 0, kind: "rest", next: [] }]);
      continue;
    }
    const count = roll(rng) < 0.5 ? 2 : 3;
    const row: MapNode[] = [];
    for (let c = 0; c < count; c++) {
      row.push({ id: `${r}-${c}`, row: r, col: c, kind: pickKind(rng, r, floor), next: [] });
    }
    // 첫 단계에는 전투를 하나는 넣어서 항상 싸울 길이 있게 함
    if (r === 0 && !row.some((n) => n.kind === "battle")) row[0].kind = "battle";
    // 한 단계가 전부 같은 종류면 하나를 바꿈
    if (row.length > 1 && row.every((n) => n.kind === row[0].kind)) {
      row[row.length - 1].kind = row[0].kind === "battle" ? "event" : "battle";
    }
    rows.push(row);
  }
  rows.push([{ id: `${R}-0`, row: R, col: 0, kind: "gate", next: [] }]);

  // 연결: 비슷한 위치끼리 잇고, 가끔 옆 칸에도 연결. 모든 노드는 들어오는 길이 최소 1개
  for (let r = 0; r < rows.length - 1; r++) {
    const cur = rows[r];
    const nxt = rows[r + 1];
    const pos = (i: number, n: number) => (n === 1 ? 0.5 : i / (n - 1));
    for (const node of cur) {
      const p = pos(node.col, cur.length);
      const nearest = nxt.reduce((a, b) => (Math.abs(pos(b.col, nxt.length) - p) < Math.abs(pos(a.col, nxt.length) - p) ? b : a));
      node.next.push(nearest.id);
      const neighbor = nxt[nearest.col + (roll(rng) < 0.5 ? -1 : 1)];
      if (neighbor && roll(rng) < 0.5) node.next.push(neighbor.id);
    }
    for (const target of nxt) {
      if (cur.some((n) => n.next.includes(target.id))) continue;
      const p = pos(target.col, nxt.length);
      const from = cur.reduce((a, b) => (Math.abs(pos(b.col, cur.length) - p) < Math.abs(pos(a.col, cur.length) - p) ? b : a));
      from.next.push(target.id);
    }
    for (const node of cur) node.next.sort();
  }

  return { floor, rows: rows.length, nodes: rows.flat() };
}

function pickKind(rng: { rngState: number }, row: number, floor: number): Exclude<NodeKind, "gate"> {
  const w = { ...MAP_RULES.weights };
  if (floor === 1) w.elite = 0; // 1층에는 엘리트 없음
  if (row === 0) {
    w.shop = 0; // 시작하자마자 상점/휴식은 의미가 적음
    w.rest = 0;
  }
  const entries = Object.entries(w) as [Exclude<NodeKind, "gate">, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let x = roll(rng) * total;
  for (const [k, v] of entries) {
    x -= v;
    if (x < 0) return k;
  }
  return "battle";
}

export function getNode(map: FloorMap, id: string): MapNode {
  const n = map.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`unknown node ${id}`);
  return n;
}
