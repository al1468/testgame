// 런(탑 등반 1회차) 진행. 층별 갈림길 맵, 노드(전투/엘리트/영입/휴식/상점/이벤트/관문), 레벨·골드·유물을 관리한다.
// 전부 순수 함수이며 같은 시드 + 같은 선택이면 같은 결과가 나온다.
import { getUnitDef } from "@/data";
import { COMPANIONS, PARTY_SIZE } from "@/data/companions";
import { EVENTS, getEvent, type EventOutcome } from "@/data/events";
import { getFloor, MAX_FLOOR } from "@/data/floors";
import { getRelic, RELICS } from "@/data/relics";
import { statsAtLevel, type BattleSetup } from "./battle";
import { generateFloorMap, getNode, type FloorMap, type MapNode, type NodeKind } from "./map";
import { roll, seedFromString } from "./rng";
import type { AllyModifiers, BattleState, UnitDef } from "./types";

export const RUN_RULES = {
  /** 쓰러진 파티원은 다음 전투에서 이 비율로 부활 */
  reviveHpRatio: 0.5,
  /** 층을 오를 때 살아있는 파티원 회복 */
  floorHealRatio: 0.2,
  /** 휴식 노드 회복량 */
  restHealRatio: 0.4,
  /** 파티 인원(1~4)별 적 HP·공격력 배율 */
  enemyScaleByPartySize: [1, 0.5, 0.65, 0.85, 1] as readonly number[],
  startGold: 50,
  xp: {
    battle: (f: number) => 40 + 12 * f,
    elite: (f: number) => 60 + 20 * f,
    gate: (f: number) => 60 + 28 * f,
    bossMult: 1.4,
  },
  gold: {
    battle: (f: number) => 15 + 5 * f,
    elite: (f: number) => 35 + 10 * f,
    gate: (f: number) => 30 + 10 * f,
    boss: 100,
  },
  xpToNext: (level: number) => 60 + 40 * level,
  score: { floor: 1000, normal: 50, elite: 200, boss: 1000, clear: 5000 },
} as const;

export interface RunMember {
  defId: string;
  level: number;
  xp: number;
  /** 현재 HP (유물 보정 전 기준). 0이면 전투 불능 → 다음 전투에서 부활 */
  hp: number;
}

export interface RunState {
  seed: string;
  floor: number;
  members: RunMember[];
  status: "ongoing" | "cleared" | "failed";
  kills: { normal: number; elite: number; boss: number };
  totalTurns: number;
  gold: number;
  relics: string[];
  map: FloorMap;
  /** 현재 위치한 노드 (null = 층 입구) */
  position: string | null;
  /** 현재 노드를 끝냈는지 (끝내야 다음 노드로 이동 가능) */
  nodeDone: boolean;
  /** 이번 층에서 지나온 노드 */
  visited: string[];
  /** 상점 노드별 재고 (들어갈 때 고정) */
  shopStock: Record<string, ShopOffer[]>;
  /** 상점 노드별 구매한 상품 번호 */
  shopBought: Record<string, number[]>;
  /** 마지막 이벤트 결과 문구 */
  eventText: string | null;
}

export interface BattleReport {
  floor: number;
  nodeKind: NodeKind;
  won: boolean;
  xpGained: number;
  goldGained: number;
  levelUps: { defId: string; from: number; to: number }[];
  revived: string[];
  /** 관문을 넘어 다음 층으로 올라감 */
  floorCleared: boolean;
}

// ---- 기본 ----

export function maxHpOf(m: Pick<RunMember, "defId" | "level">): number {
  return statsAtLevel(getUnitDef(m.defId), m.level).hp;
}

function newMember(defId: string, level: number): RunMember {
  const m = { defId, level, xp: 0, hp: 0 };
  m.hp = maxHpOf(m);
  return m;
}

function nodeRng(run: RunState, salt: string) {
  return { rngState: seedFromString(`${run.seed}|${run.floor}|${run.position}|${salt}`) };
}

function mapFor(seed: string, floor: number): FloorMap {
  return generateFloorMap(seed, floor, getFloor(floor).kind === "boss");
}

/** 새 런. memberIds: 처음 고른 파티 (1~4명, 순서대로 배치) */
export function createRun(seed: string, memberIds: string[]): RunState {
  const ids = [...new Set(memberIds)].slice(0, PARTY_SIZE);
  if (ids.length === 0) throw new Error("party is empty");
  return {
    seed,
    floor: 1,
    members: ids.map((id) => newMember(id, 1)),
    status: "ongoing",
    kills: { normal: 0, elite: 0, boss: 0 },
    totalTurns: 0,
    gold: RUN_RULES.startGold,
    relics: [],
    map: mapFor(seed, 1),
    position: null,
    nodeDone: true,
    visited: [],
    shopStock: {},
    shopBought: {},
    eventText: null,
  };
}

export function currentNode(run: RunState): MapNode | null {
  return run.position ? getNode(run.map, run.position) : null;
}

/** 지금 이동할 수 있는 노드 id */
export function reachableNodeIds(run: RunState): string[] {
  if (run.status !== "ongoing" || !run.nodeDone) return [];
  if (!run.position) return run.map.nodes.filter((n) => n.row === 0).map((n) => n.id);
  return getNode(run.map, run.position).next;
}

export function enterNode(run: RunState, nodeId: string): RunState {
  if (!reachableNodeIds(run).includes(nodeId)) throw new Error(`node not reachable: ${nodeId}`);
  const next = structuredClone(run);
  next.position = nodeId;
  next.nodeDone = false;
  next.visited.push(nodeId);
  next.eventText = null;
  if (getNode(next.map, nodeId).kind === "shop") next.shopStock[nodeId] = generateShop(next);
  return next;
}

export function isBattleNode(kind: NodeKind) {
  return kind === "battle" || kind === "elite" || kind === "gate";
}

/** 비전투 노드를 끝내고 떠남 (건너뛰기 포함) */
export function leaveNode(run: RunState): RunState {
  const node = currentNode(run);
  if (!node || isBattleNode(node.kind)) throw new Error("not a leavable node");
  return { ...structuredClone(run), nodeDone: true };
}

// ---- 유물 ----

export function relicModifiers(run: RunState): Partial<AllyModifiers> {
  const mods: Partial<AllyModifiers> = {};
  for (const id of run.relics) {
    for (const [k, v] of Object.entries(getRelic(id).mods ?? {}) as [keyof AllyModifiers, number][]) {
      mods[k] = (mods[k] ?? 0) + v;
    }
  }
  return mods;
}

function relicSum(run: RunState, key: "goldBonus" | "victoryHeal") {
  return run.relics.reduce((s, id) => s + (getRelic(id)[key] ?? 0), 0);
}

function grantRandomRelic(run: RunState, rng: { rngState: number }): string | null {
  const pool = RELICS.filter((r) => !run.relics.includes(r.id));
  if (pool.length === 0) {
    run.gold += 50;
    return null;
  }
  const r = pool[Math.floor(roll(rng) * pool.length)];
  run.relics.push(r.id);
  return r.id;
}

// ---- 성장 ----

function gainXp(m: RunMember, xp: number): { from: number; to: number } | null {
  const from = m.level;
  m.xp += xp;
  while (m.xp >= RUN_RULES.xpToNext(m.level)) {
    m.xp -= RUN_RULES.xpToNext(m.level);
    levelUp(m);
  }
  return m.level > from ? { from, to: m.level } : null;
}

function levelUp(m: RunMember) {
  const before = maxHpOf(m);
  m.level++;
  if (m.hp > 0) m.hp += maxHpOf(m) - before;
}

function healAlive(run: RunState, ratio: number) {
  for (const m of run.members) {
    if (m.hp > 0) m.hp = Math.min(maxHpOf(m), m.hp + Math.round(maxHpOf(m) * ratio));
  }
}

// ---- 전투 노드 ----

function enemiesForNode(run: RunState, node: MapNode): { def: UnitDef; level: number }[] {
  const floor = getFloor(run.floor);
  if (node.kind === "gate") return floor.enemies.map((def) => ({ def, level: floor.enemyLevel }));
  // 일반/엘리트 전투는 그 층의 일반 적 중에서 뽑는다 (보스 제외)
  const pool = floor.enemies.filter((e) => e.rank !== "boss");
  const rng = nodeRng(run, "enemies");
  if (node.kind === "elite") {
    const lead = pool[Math.floor(roll(rng) * pool.length)];
    return [
      ...pool.filter((e) => e !== lead).map((def) => ({ def, level: floor.enemyLevel })),
      { def: lead, level: floor.enemyLevel + 2 },
    ];
  }
  const count = run.floor <= 3 || roll(rng) < 0.6 ? 2 : 3;
  return Array.from({ length: count }, () => ({
    def: pool[Math.floor(roll(rng) * pool.length)],
    level: Math.max(1, floor.enemyLevel - (node.row === 0 ? 1 : 0)),
  }));
}

/** 현재 노드의 전투 구성. 쓰러져 있던 파티원은 HP 50%로 부활해서 참가 */
export function nodeBattleSetup(run: RunState): BattleSetup {
  const node = currentNode(run);
  if (!node || !isBattleNode(node.kind)) throw new Error("current node is not a battle");
  return {
    seed: `${run.seed}|${run.floor}|${node.id}|battle`,
    allies: run.members.map((m) => ({
      def: getUnitDef(m.defId),
      level: m.level,
      hp: m.hp > 0 ? m.hp : Math.round(maxHpOf(m) * RUN_RULES.reviveHpRatio),
    })),
    enemies: enemiesForNode(run, node),
    allyModifiers: relicModifiers(run),
    enemyScale: RUN_RULES.enemyScaleByPartySize[run.members.length] ?? 1,
  };
}

/** 전투 결과를 런에 반영 */
export function finishBattle(run: RunState, battle: BattleState): { run: RunState; report: BattleReport } {
  if (battle.outcome === "ongoing") throw new Error("battle not finished");
  const node = currentNode(run);
  if (!node || !isBattleNode(node.kind)) throw new Error("current node is not a battle");
  const next: RunState = structuredClone(run);
  const floor = getFloor(run.floor);
  next.totalTurns += battle.turnCount;

  for (const u of battle.units) {
    if (u.side !== "enemy" || u.alive) continue;
    const rank = getUnitDef(u.defId).rank ?? "normal";
    next.kills[node.kind === "elite" && rank === "normal" ? "elite" : rank]++;
  }

  const report: BattleReport = {
    floor: run.floor,
    nodeKind: node.kind,
    won: battle.outcome === "win",
    xpGained: 0,
    goldGained: 0,
    levelUps: [],
    revived: [],
    floorCleared: false,
  };
  if (battle.outcome === "lose") {
    next.status = "failed";
    next.members.forEach((m) => (m.hp = 0));
    return { run: next, report };
  }

  const boss = floor.kind === "boss" && node.kind === "gate";
  const xp = Math.round(RUN_RULES.xp[node.kind as "battle" | "elite" | "gate"](run.floor) * (boss ? RUN_RULES.xp.bossMult : 1));
  const goldBase = boss ? RUN_RULES.gold.boss : RUN_RULES.gold[node.kind as "battle" | "elite" | "gate"](run.floor);
  report.xpGained = xp;
  report.goldGained = Math.round(goldBase * (1 + relicSum(run, "goldBonus")));
  next.gold += report.goldGained;

  const hpScale = 1 + (relicModifiers(run).hpPct ?? 0);
  const allies = battle.units.filter((u) => u.side === "ally");
  next.members.forEach((m, i) => {
    const u = allies[i];
    if (!u.alive) {
      m.hp = 0;
      report.revived.push(m.defId);
      return;
    }
    m.hp = Math.max(1, Math.min(maxHpOf(m), Math.round(u.hp / hpScale)));
    const up = gainXp(m, xp);
    if (up) report.levelUps.push({ defId: m.defId, ...up });
  });
  healAlive(next, relicSum(run, "victoryHeal"));
  next.nodeDone = true;

  if (node.kind === "gate") {
    report.floorCleared = true;
    if (run.floor >= MAX_FLOOR) {
      next.status = "cleared";
    } else {
      next.floor = run.floor + 1;
      next.map = mapFor(run.seed, next.floor);
      next.position = null;
      next.visited = [];
      next.shopStock = {};
      next.shopBought = {};
      healAlive(next, RUN_RULES.floorHealRatio);
    }
  }
  return { run: next, report };
}

// ---- 휴식 ----

function assertNode(run: RunState, kind: NodeKind) {
  const node = currentNode(run);
  if (!node || node.kind !== kind || run.nodeDone) throw new Error(`not at an open ${kind} node`);
}

/** 휴식: 살아있는 파티원 HP 40% 회복, 쓰러진 파티원은 HP 50%로 복귀 */
export function restHeal(run: RunState): RunState {
  assertNode(run, "rest");
  const next = structuredClone(run);
  for (const m of next.members) {
    m.hp = m.hp > 0 ? Math.min(maxHpOf(m), m.hp + Math.round(maxHpOf(m) * RUN_RULES.restHealRatio)) : Math.round(maxHpOf(m) * RUN_RULES.reviveHpRatio);
  }
  next.nodeDone = true;
  return next;
}

/** 특훈: 파티원 1명 레벨 +1 */
export function restTrain(run: RunState, memberIndex: number): RunState {
  assertNode(run, "rest");
  const next = structuredClone(run);
  const m = next.members[memberIndex];
  if (!m) throw new Error("invalid member");
  levelUp(m);
  next.nodeDone = true;
  return next;
}

// ---- 상점 ----

export interface ShopOffer {
  kind: "heal" | "revive" | "train" | "relic";
  name: string;
  description: string;
  price: number;
  relicId?: string;
}

export function shopOffers(run: RunState): ShopOffer[] {
  const node = currentNode(run);
  if (!node || node.kind !== "shop") throw new Error("not at a shop");
  return run.shopStock[node.id] ?? [];
}

function generateShop(run: RunState): ShopOffer[] {
  const rng = nodeRng(run, "shop");
  const f = run.floor;
  const offers: ShopOffer[] = [
    { kind: "heal", name: "구급상자", description: "살아있는 아군 HP 40% 회복", price: 35 + 3 * f },
  ];
  const pool = RELICS.filter((r) => !run.relics.includes(r.id));
  if (pool.length > 0) {
    const r = pool[Math.floor(roll(rng) * pool.length)];
    offers.push({ kind: "relic", name: r.name, description: r.description, price: 90 + 8 * f, relicId: r.id });
  }
  offers.push(
    roll(rng) < 0.5
      ? { kind: "revive", name: "각성제", description: "쓰러진 아군을 HP 70%로 즉시 복귀", price: 40 + 3 * f }
      : { kind: "train", name: "훈련 교본", description: "파티 전원 경험치 +60", price: 55 + 4 * f },
  );
  return offers;
}

export function buyOffer(run: RunState, index: number): RunState {
  assertNode(run, "shop");
  const offer = shopOffers(run)[index];
  if (!offer) throw new Error("invalid offer");
  const pos = run.position!;
  if ((run.shopBought[pos] ?? []).includes(index)) throw new Error("already bought");
  if (run.gold < offer.price) throw new Error("not enough gold");
  const next = structuredClone(run);
  next.gold -= offer.price;
  next.shopBought[pos] = [...(next.shopBought[pos] ?? []), index];
  switch (offer.kind) {
    case "heal":
      healAlive(next, 0.4);
      break;
    case "revive":
      for (const m of next.members) if (m.hp <= 0) m.hp = Math.round(maxHpOf(m) * 0.7);
      break;
    case "train":
      for (const m of next.members) gainXp(m, 60);
      break;
    case "relic":
      next.relics.push(offer.relicId!);
      break;
  }
  return next;
}

// ---- 영입 ----

export function recruitCandidates(run: RunState): UnitDef[] {
  assertNode(run, "recruit");
  const rng = nodeRng(run, "recruit");
  const pool = COMPANIONS.filter((c) => !run.members.some((m) => m.defId === c.id));
  const picks: UnitDef[] = [];
  while (picks.length < 3 && pool.length > 0) picks.push(pool.splice(Math.floor(roll(rng) * pool.length), 1)[0]);
  return picks;
}

export function recruitLevel(run: RunState): number {
  const avg = run.members.reduce((s, m) => s + m.level, 0) / run.members.length;
  return Math.max(1, Math.round(avg) - 1);
}

/** 동료 영입. 파티가 꽉 찼으면 replaceIndex(0~3)의 동료와 교체 */
export function recruit(run: RunState, defId: string, replaceIndex?: number): RunState {
  if (!recruitCandidates(run).some((c) => c.id === defId)) throw new Error("not a candidate");
  const next = structuredClone(run);
  const member = newMember(defId, recruitLevel(run));
  if (next.members.length < PARTY_SIZE) {
    next.members.push(member);
  } else {
    if (replaceIndex === undefined || replaceIndex < 0 || replaceIndex >= next.members.length) throw new Error("party full");
    next.members[replaceIndex] = member;
  }
  next.nodeDone = true;
  return next;
}

// ---- 이벤트 ----

export function nodeEvent(run: RunState) {
  assertNode(run, "event");
  const rng = nodeRng(run, "event");
  return EVENTS[Math.floor(roll(rng) * EVENTS.length)];
}

export function chooseEventOption(run: RunState, choiceIndex: number): RunState {
  const ev = nodeEvent(run);
  const choice = ev.choices[choiceIndex];
  if (!choice) throw new Error("invalid choice");
  if (choice.requiresGold && run.gold < choice.requiresGold) throw new Error("not enough gold");
  const next = structuredClone(run);
  const rng = nodeRng(run, `event-choice-${choiceIndex}`);
  let x = roll(rng);
  let outcome: EventOutcome = choice.outcomes[choice.outcomes.length - 1].outcome;
  for (const o of choice.outcomes) {
    x -= o.chance;
    if (x < 0) {
      outcome = o.outcome;
      break;
    }
  }
  const extra: string[] = [];
  if (outcome.gold) next.gold = Math.max(0, next.gold + outcome.gold);
  if (outcome.hpPct) {
    for (const m of next.members) {
      if (m.hp <= 0) continue;
      m.hp = Math.max(1, Math.min(maxHpOf(m), m.hp + Math.round(maxHpOf(m) * outcome.hpPct)));
    }
  }
  if (outcome.xp) for (const m of next.members) gainXp(m, outcome.xp);
  if (outcome.relic) {
    const id = grantRandomRelic(next, rng);
    extra.push(id ? `유물 「${getRelic(id).name}」 획득!` : "유물이 더 없어 골드 50을 얻었다.");
  }
  if (outcome.recruit) {
    const pool = COMPANIONS.filter((c) => !next.members.some((m) => m.defId === c.id));
    if (next.members.length < PARTY_SIZE && pool.length > 0) {
      const c = pool[Math.floor(roll(rng) * pool.length)];
      next.members.push(newMember(c.id, recruitLevel(next)));
      extra.push(`${c.name}이(가) 동료가 되었다!`);
    } else {
      for (const m of next.members) gainXp(m, 60);
      extra.push("파티에 자리가 없어 대신 경험치 +60을 얻었다.");
    }
  }
  next.eventText = [outcome.text, ...extra].join(" ");
  next.nodeDone = true;
  return next;
}

export { getEvent };

// ---- 점수 ----

export function floorsCleared(run: RunState): number {
  return run.status === "cleared" ? MAX_FLOOR : run.floor - 1;
}

export function runScore(run: RunState): number {
  const sc = RUN_RULES.score;
  return (
    floorsCleared(run) * sc.floor +
    run.kills.normal * sc.normal +
    run.kills.elite * sc.elite +
    run.kills.boss * sc.boss +
    (run.status === "cleared" ? sc.clear : 0)
  );
}
