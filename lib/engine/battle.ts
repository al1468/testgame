// 전투 엔진 본체. 화면과 무관한 순수 로직이며, 모든 공개 함수는 입력 상태를 바꾸지 않고 새 상태를 돌려준다.
//
// 사용 흐름:
//   let s = createBattle({ seed, allies, enemies })
//   s = advance(s).state            // 다음 행동 유닛까지 시간 진행 (activeUid 설정)
//   s = act(s, { skillId, targetUid }).state   // 행동
//   ... outcome !== "ongoing" 까지 반복. 적 차례에는 chooseAutoAction(s)로 행동을 고른다.

import { ELEMENT_RULES, elementMatchup, type ElementMod } from "./elements";
import { roll, seedFromString } from "./rng";
import {
  BUFFS,
  STACKABLE,
  type Action,
  type AllyModifiers,
  type BattleEvent,
  type BattleState,
  type BattleUnit,
  type BuffId,
  type DebuffId,
  type Effect,
  type EffectTarget,
  type SkillDef,
  type StatusId,
  type Stats,
  type StepResult,
  type UnitDef,
  type UnitInit,
} from "./types";

// ---- 밸런스 상수 ----

export const RULES = {
  startGaugeMax: 0.05,
  defConstant: 300,
  statMods: {
    atkUp: 0.5,
    atkDown: -0.5,
    defUp: 0.6,
    defDown: -0.7,
    spdUp: 0.3,
    spdDown: -0.3,
    critUp: 0.3,
  },
  burnAtkRatio: 0.5,
  poisonMaxHpRatio: 0.05,
  regenMaxHpRatio: 0.1,
  maxResistChance: 0.85,
  /** 교착 방지: 이 턴 이후 행동하는 유닛은 매 턴 최대 HP의 (경과 턴 × 2%) 피해 (보호막·불사 무시) */
  pressureStartTurn: 120,
  pressurePerTurn: 0.02,
} as const;

// ---- 생성 ----

export interface BattleSetup {
  seed: string;
  allies: UnitInit[];
  enemies: UnitInit[];
  /** 아군 전체 보정 (유물). hpPct는 최대 HP와 현재 HP를 같은 비율로 늘린다 */
  allyModifiers?: Partial<AllyModifiers>;
  /** 적 HP·공격력 배율 (파티 인원 보정 등) */
  enemyScale?: number;
}

/** 레벨이 반영된 스탯 (stats.hp = 최대 HP) */
export function statsAtLevel(def: UnitDef, level: number): Stats {
  const lv = Math.max(1, level) - 1;
  return {
    ...def.base,
    hp: def.base.hp + def.growth.hp * lv,
    atk: def.base.atk + def.growth.atk * lv,
    def: def.base.def + def.growth.def * lv,
  };
}

function createUnit(init: UnitInit, side: "ally" | "enemy", index: number): BattleUnit {
  const { def, level } = init;
  const stats = statsAtLevel(def, level);
  const hp = Math.min(stats.hp, Math.max(0, Math.round(init.hp ?? stats.hp)));
  return {
    uid: `${side === "ally" ? "a" : "e"}${index}`,
    defId: def.id,
    name: def.name,
    side,
    element: def.element,
    level,
    stats,
    hp,
    shield: 0,
    gauge: 0,
    alive: hp > 0,
    skills: def.skills,
    passives: def.passives ?? [],
    aiPriority: def.aiPriority,
    cooldowns: Object.fromEntries(def.skills.map((sk) => [sk.id, 0])),
    usedSkills: {},
    statuses: [],
    hasAttacked: false,
    passiveCooldown: 0,
  };
}

export function createBattle(setup: BattleSetup): BattleState {
  const s: BattleState = {
    rngState: seedFromString(setup.seed),
    turnCount: 0,
    units: [
      ...setup.allies.map((u, i) => createUnit(u, "ally", i)),
      ...setup.enemies.map((u, i) => createUnit(u, "enemy", i)),
    ],
    activeUid: null,
    extraTurnUid: null,
    outcome: "ongoing",
  };
  for (const u of s.units) u.gauge = roll(s) * RULES.startGaugeMax;
  if (setup.enemyScale && setup.enemyScale !== 1) {
    for (const u of s.units) {
      if (u.side !== "enemy") continue;
      u.stats.hp = Math.round(u.stats.hp * setup.enemyScale);
      u.hp = Math.round(u.hp * setup.enemyScale);
      u.stats.atk = Math.round(u.stats.atk * setup.enemyScale);
    }
  }
  const mods = setup.allyModifiers;
  if (mods) {
    for (const u of s.units) {
      if (u.side !== "ally") continue;
      u.stats.atk = Math.round(u.stats.atk * (1 + (mods.atkPct ?? 0)));
      u.stats.def = Math.round(u.stats.def * (1 + (mods.defPct ?? 0)));
      u.stats.hp = Math.round(u.stats.hp * (1 + (mods.hpPct ?? 0)));
      u.hp = Math.min(u.stats.hp, Math.round(u.hp * (1 + (mods.hpPct ?? 0))));
      u.stats.spd += mods.spd ?? 0;
      u.stats.critRate += mods.critRate ?? 0;
      u.gauge = Math.min(1, u.gauge + (mods.startGauge ?? 0));
    }
  }
  for (const u of s.units) {
    if (!u.alive) continue;
    for (const p of u.passives) {
      if (p.type !== "battleStartGauge") continue;
      const targets = p.target === "self" ? [u] : aliveOf(s, u.side);
      for (const t of targets) t.gauge = Math.min(1, t.gauge + p.amount);
    }
  }
  return s;
}

// ---- 조회 헬퍼 ----

export function getUnit(s: BattleState, uid: string): BattleUnit {
  const u = s.units.find((x) => x.uid === uid);
  if (!u) throw new Error(`unknown unit ${uid}`);
  return u;
}

function aliveOf(s: BattleState, side: "ally" | "enemy"): BattleUnit[] {
  return s.units.filter((u) => u.side === side && u.alive);
}

function opponentSide(u: BattleUnit) {
  return u.side === "ally" ? "enemy" : "ally";
}

export function hasStatus(u: BattleUnit, id: StatusId): boolean {
  return u.statuses.some((st) => st.id === id);
}

export function isBuff(id: StatusId): id is BuffId {
  return (BUFFS as readonly string[]).includes(id);
}

function hasAnyDebuff(u: BattleUnit) {
  return u.statuses.some((st) => !isBuff(st.id));
}

export function effectiveAtk(u: BattleUnit): number {
  let m = 1;
  if (hasStatus(u, "atkUp")) m += RULES.statMods.atkUp;
  if (hasStatus(u, "atkDown")) m += RULES.statMods.atkDown;
  for (const p of u.passives) {
    if (p.type === "lowHpAtkUp" && u.hp / u.stats.hp <= p.threshold) m += p.bonus;
  }
  return u.stats.atk * Math.max(0.1, m);
}

export function effectiveDef(u: BattleUnit): number {
  let m = 1;
  if (hasStatus(u, "defUp")) m += RULES.statMods.defUp;
  if (hasStatus(u, "defDown")) m += RULES.statMods.defDown;
  return u.stats.def * Math.max(0, m);
}

export function effectiveSpd(u: BattleUnit): number {
  let m = 1;
  if (hasStatus(u, "spdUp")) m += RULES.statMods.spdUp;
  if (hasStatus(u, "spdDown")) m += RULES.statMods.spdDown;
  return Math.max(1, u.stats.spd * m);
}

function effectiveCrit(u: BattleUnit): number {
  return u.stats.critRate + (hasStatus(u, "critUp") ? RULES.statMods.critUp : 0);
}

function provoker(s: BattleState, u: BattleUnit): BattleUnit | null {
  const st = u.statuses.find((x) => x.id === "provoke");
  if (!st) return null;
  const src = s.units.find((x) => x.uid === st.sourceUid);
  return src && src.alive ? src : null;
}

// ---- 턴 순서 ----

/** 앞으로 행동할 순서를 미리 계산 (UI 타임라인용). 현재 상태의 속도/게이지 기준 근사치 */
export function predictTurnOrder(s: BattleState, count = 8): string[] {
  const sim = s.units
    .filter((u) => u.alive)
    .map((u) => ({ uid: u.uid, gauge: u.gauge, spd: effectiveSpd(u) }));
  const order: string[] = [];
  if (s.activeUid) order.push(s.activeUid);
  if (s.extraTurnUid && s.extraTurnUid !== s.activeUid) order.push(s.extraTurnUid);
  const active = sim.find((x) => x.uid === s.activeUid);
  if (active) active.gauge = 0;
  while (order.length < count && sim.length > 0) {
    const next = pickNext(sim);
    const t = (1 - next.gauge) / next.spd;
    for (const x of sim) x.gauge = Math.min(1, x.gauge + x.spd * t);
    next.gauge = 0;
    order.push(next.uid);
  }
  return order;
}

function pickNext<T extends { gauge: number; spd: number }>(list: T[]): T {
  let best = list[0];
  let bestT = (1 - best.gauge) / best.spd;
  for (const x of list.slice(1)) {
    const t = (1 - x.gauge) / x.spd;
    if (t < bestT - 1e-12 || (Math.abs(t - bestT) <= 1e-12 && x.spd > best.spd)) {
      best = x;
      bestT = t;
    }
  }
  return best;
}

/** 다음으로 행동할 유닛이 나올 때까지 시간을 진행한다. 턴 시작 처리(지속 피해, 기절 등) 포함 */
export function advance(state: BattleState): StepResult {
  const s = structuredClone(state);
  const events: BattleEvent[] = [];
  if (s.outcome !== "ongoing" || s.activeUid) return { state: s, events };

  for (let guard = 0; guard < 1000; guard++) {
    let actor: BattleUnit;
    const extra = s.extraTurnUid ? s.units.find((u) => u.uid === s.extraTurnUid) : undefined;
    s.extraTurnUid = null;
    if (extra && extra.alive) {
      actor = extra;
    } else {
      const alive = s.units.filter((u) => u.alive);
      const withSpd = alive.map((u) => ({ u, gauge: u.gauge, spd: effectiveSpd(u) }));
      const next = pickNext(withSpd);
      const t = Math.max(0, (1 - next.gauge) / next.spd);
      for (const x of withSpd) x.u.gauge = Math.min(1, x.u.gauge + x.spd * t);
      actor = next.u;
      actor.gauge = 1;
    }

    s.turnCount++;
    events.push({ type: "turn_start", uid: actor.uid });
    startTurn(s, actor, events);

    if (checkOutcome(s, events)) return { state: s, events };
    if (!actor.alive) continue;
    if (hasStatus(actor, "stun")) {
      events.push({ type: "stunned", uid: actor.uid });
      endTurn(s, actor, events);
      continue;
    }
    s.activeUid = actor.uid;
    return { state: s, events };
  }
  throw new Error("advance: turn loop guard exceeded");
}

function startTurn(s: BattleState, actor: BattleUnit, events: BattleEvent[]) {
  // 탑의 압박 (교착 방지)
  if (s.turnCount > RULES.pressureStartTurn) {
    if (s.turnCount === RULES.pressureStartTurn + 1) events.push({ type: "pressure_start" });
    const ratio = Math.min(1, (s.turnCount - RULES.pressureStartTurn) * RULES.pressurePerTurn);
    const amount = Math.max(1, Math.round(actor.stats.hp * ratio));
    events.push({ type: "pressure", targetUid: actor.uid, amount });
    actor.hp = Math.max(0, actor.hp - amount);
    if (actor.hp === 0) {
      kill(s, actor, events);
      return;
    }
  }

  for (const id of Object.keys(actor.cooldowns)) {
    if (actor.cooldowns[id] > 0) actor.cooldowns[id]--;
  }
  if (actor.passiveCooldown > 0) actor.passiveCooldown--;

  // 지속 피해 (보호막 무시)
  for (const st of actor.statuses.filter((x) => x.id === "burn" || x.id === "poison")) {
    if (!actor.alive) break;
    const amount = Math.max(1, Math.round(st.power));
    events.push({ type: "dot", targetUid: actor.uid, status: st.id, amount });
    loseHp(s, actor, amount, events);
  }

  // 저주술사 패시브: 디버프 걸린 적이 행동하면 피해
  if (actor.alive && hasAnyDebuff(actor)) {
    for (const src of aliveOf(s, opponentSide(actor))) {
      for (const p of src.passives) {
        if (p.type !== "debuffedEnemyActDamage" || !actor.alive) continue;
        const amount = Math.max(1, Math.round(effectiveAtk(src) * p.atkRatio));
        events.push({
          type: "damage",
          sourceUid: src.uid,
          targetUid: actor.uid,
          amount,
          crit: false,
          elementMod: "neutral",
          absorbed: 0,
        });
        loseHp(s, actor, amount, events);
      }
    }
  }

  if (actor.alive && hasStatus(actor, "regen")) {
    heal(actor, actor.stats.hp * RULES.regenMaxHpRatio, events);
  }
}

function endTurn(s: BattleState, actor: BattleUnit, events: BattleEvent[]) {
  actor.gauge = 0;
  const kept = [];
  for (const st of actor.statuses) {
    if (st.appliedTurn !== s.turnCount) st.turns--;
    if (st.turns > 0) kept.push(st);
    else events.push({ type: "status_removed", targetUid: actor.uid, status: st.id });
  }
  actor.statuses = kept;
  s.activeUid = null;
}

function checkOutcome(s: BattleState, events: BattleEvent[]): boolean {
  if (s.outcome !== "ongoing") return true;
  if (aliveOf(s, "enemy").length === 0) s.outcome = "win";
  else if (aliveOf(s, "ally").length === 0) s.outcome = "lose";
  else return false;
  s.activeUid = null;
  events.push({ type: "battle_end", outcome: s.outcome });
  return true;
}

// ---- 행동 선택지 ----

export function isSkillReady(s: BattleState, u: BattleUnit, skill: SkillDef): boolean {
  if (u.cooldowns[skill.id] > 0) return false;
  if (skill.oncePerBattle && u.usedSkills[skill.id]) return false;
  if (skill.target === "ally_dead" && !s.units.some((x) => x.side === u.side && !x.alive)) {
    return false;
  }
  // 도발 상태면 기본기만 사용 가능
  if (provoker(s, u) && skill !== u.skills[0]) return false;
  return true;
}

export function getAvailableSkills(s: BattleState, uid: string): SkillDef[] {
  const u = getUnit(s, uid);
  return u.skills.filter((sk) => isSkillReady(s, u, sk));
}

/** 대상 선택이 필요한 스킬이면 선택 가능한 대상 uid 목록, 필요 없으면 [] */
export function getValidTargets(s: BattleState, uid: string, skillId: string): string[] {
  const u = getUnit(s, uid);
  const skill = u.skills.find((sk) => sk.id === skillId);
  if (!skill) return [];
  switch (skill.target) {
    case "enemy_single": {
      const p = provoker(s, u);
      if (p) return [p.uid];
      return aliveOf(s, opponentSide(u)).map((x) => x.uid);
    }
    case "ally_single":
      return aliveOf(s, u.side).map((x) => x.uid);
    case "ally_dead":
      return s.units.filter((x) => x.side === u.side && !x.alive).map((x) => x.uid);
    default:
      return [];
  }
}

export function needsTarget(skill: SkillDef): boolean {
  return ["enemy_single", "ally_single", "ally_dead"].includes(skill.target);
}

// ---- 행동 실행 ----

export function act(state: BattleState, action: Action): StepResult {
  const s = structuredClone(state);
  const events: BattleEvent[] = [];
  if (s.outcome !== "ongoing") throw new Error("battle is over");
  if (!s.activeUid) throw new Error("no active unit; call advance() first");
  const actor = getUnit(s, s.activeUid);
  const skill = actor.skills.find((sk) => sk.id === action.skillId);
  if (!skill) throw new Error(`unknown skill ${action.skillId}`);
  if (!isSkillReady(s, actor, skill)) throw new Error(`skill not ready: ${skill.id}`);

  let targets: BattleUnit[];
  if (needsTarget(skill)) {
    const valid = getValidTargets(s, actor.uid, skill.id);
    if (!action.targetUid || !valid.includes(action.targetUid)) {
      throw new Error(`invalid target ${action.targetUid} for ${skill.id}`);
    }
    targets = [getUnit(s, action.targetUid)];
  } else {
    targets = resolveAreaTargets(s, actor, skill);
  }

  if (skill.cooldown > 0) actor.cooldowns[skill.id] = skill.cooldown;
  if (skill.oncePerBattle) actor.usedSkills[skill.id] = true;

  const counters = executeSkill(s, actor, skill, targets, events, false);

  // 반격: 공격받은 유닛이 기본기로 되받아침 (반격은 반격을 부르지 않음)
  for (const c of counters) {
    if (!actor.alive || !c.alive || s.outcome !== "ongoing") break;
    events.push({ type: "counter", uid: c.uid, targetUid: actor.uid });
    executeSkill(s, c, c.skills[0], [actor], events, true);
    checkOutcome(s, events);
  }

  if (actor.alive) endTurn(s, actor, events);
  else s.activeUid = null;
  checkOutcome(s, events);
  return { state: s, events };
}

function resolveAreaTargets(s: BattleState, actor: BattleUnit, skill: SkillDef): BattleUnit[] {
  switch (skill.target) {
    case "enemy_all":
      return aliveOf(s, opponentSide(actor));
    case "ally_all":
      return aliveOf(s, actor.side);
    case "self":
      return [actor];
    case "enemy_random3": {
      const pool = aliveOf(s, opponentSide(actor));
      return [0, 1, 2].map(() => pool[Math.floor(roll(s) * pool.length)]);
    }
    default:
      return [];
  }
}

/** 스킬 효과를 순서대로 적용. 반격할 유닛 목록을 돌려준다 */
function executeSkill(
  s: BattleState,
  actor: BattleUnit,
  skill: SkillDef,
  targets: BattleUnit[],
  events: BattleEvent[],
  isCounter: boolean,
): BattleUnit[] {
  events.push({
    type: "skill",
    uid: actor.uid,
    skillId: skill.id,
    targetUids: targets.map((t) => t.uid),
  });

  let killed = false;
  const hitUnits = new Set<BattleUnit>();

  for (const eff of skill.effects) {
    if (eff.type === "damage") {
      for (const t of targets) {
        for (let h = 0; h < (eff.hits ?? 1); h++) {
          if (!t.alive || !actor.alive) break;
          if (dealDamage(s, actor, t, eff, events)) killed = true;
          hitUnits.add(t);
        }
      }
      continue;
    }
    if (eff.type === "extraTurnOnKill") {
      if (killed && !isCounter) {
        s.extraTurnUid = actor.uid;
        events.push({ type: "extra_turn", uid: actor.uid });
      }
      continue;
    }
    if (eff.type === "detonate") {
      for (const t of uniq(targets)) {
        if (!t.alive) continue;
        const parts = t.statuses.filter((st) => st.id === eff.status);
        if (parts.length === 0) continue;
        const amount = Math.round(parts.reduce((sum, st) => sum + st.power * st.turns, 0));
        t.statuses = t.statuses.filter((st) => st.id !== eff.status);
        events.push({ type: "dot", targetUid: t.uid, status: eff.status, amount });
        if (loseHp(s, t, amount, events)) killed = true;
      }
      continue;
    }
    if (eff.type === "allyFollowUp") {
      if (isCounter) continue;
      const target = targets.find((t) => t.alive && t.side !== actor.side);
      const helpers = aliveOf(s, actor.side).filter((u) => u !== actor && !hasStatus(u, "stun"));
      if (!target || helpers.length === 0) continue;
      const helper = helpers[Math.floor(roll(s) * helpers.length)];
      events.push({ type: "follow_up", uid: helper.uid, targetUid: target.uid });
      const before = target.alive;
      executeSkill(s, helper, helper.skills[0], [target], events, true);
      if (before && !target.alive) killed = true;
      continue;
    }
    if (eff.type === "revive") {
      for (const t of targets) {
        if (t.alive) continue;
        t.alive = true;
        t.hp = Math.max(1, Math.round(t.stats.hp * eff.hpPercent));
        t.gauge = 0;
        events.push({ type: "revive", uid: t.uid, hp: t.hp });
      }
      continue;
    }

    for (const t of resolveEffectTargets(s, actor, targets, eff.target)) {
      applyEffect(s, actor, t, eff, events);
    }
  }

  if (killed && !isCounter && !s.extraTurnUid) {
    const p = actor.passives.find((x) => x.type === "extraTurnOnKill");
    if (p && p.type === "extraTurnOnKill" && actor.passiveCooldown === 0 && actor.alive) {
      actor.passiveCooldown = p.cooldown;
      s.extraTurnUid = actor.uid;
      events.push({ type: "extra_turn", uid: actor.uid });
    }
  }

  if (isCounter || skill.target !== "enemy_single") return [];
  const counters: BattleUnit[] = [];
  for (const t of hitUnits) {
    if (!t.alive || t.side === actor.side) continue;
    if (hasStatus(t, "counter")) {
      counters.push(t);
      continue;
    }
    const p = t.passives.find((x) => x.type === "counterChance");
    if (p && p.type === "counterChance" && roll(s) < p.chance) counters.push(t);
  }
  return counters;
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function resolveEffectTargets(
  s: BattleState,
  actor: BattleUnit,
  skillTargets: BattleUnit[],
  target: EffectTarget | undefined,
): BattleUnit[] {
  switch (target ?? "target") {
    case "target":
      return uniq(skillTargets).filter((t) => t.alive);
    case "self":
      return actor.alive ? [actor] : [];
    case "allies":
      return aliveOf(s, actor.side);
    case "enemies":
      return aliveOf(s, opponentSide(actor));
    case "lowestAlly": {
      const allies = aliveOf(s, actor.side);
      if (allies.length === 0) return [];
      return [allies.reduce((a, b) => (b.hp / b.stats.hp < a.hp / a.stats.hp ? b : a))];
    }
  }
}

function applyEffect(
  s: BattleState,
  src: BattleUnit,
  t: BattleUnit,
  eff: Effect,
  events: BattleEvent[],
) {
  switch (eff.type) {
    case "heal":
      heal(t, t.stats.hp * eff.percentMaxHp, events);
      break;
    case "buff":
      applyStatus(s, src, t, eff.status, eff.turns, 1, events);
      break;
    case "debuff":
      applyStatus(s, src, t, eff.status, eff.turns, eff.chance, events);
      break;
    case "shield": {
      const amount = Math.round(src.stats.hp * eff.percentCasterMaxHp);
      t.shield = Math.max(t.shield, amount);
      events.push({ type: "shield", targetUid: t.uid, amount });
      break;
    }
    case "gauge": {
      const before = t.gauge;
      t.gauge = Math.min(1, Math.max(0, t.gauge + eff.amount));
      events.push({ type: "gauge", targetUid: t.uid, amount: t.gauge - before });
      break;
    }
    case "cleanse":
      removeStatuses(t, (id) => !isBuff(id), eff.count, events);
      break;
    case "dispel":
      if (eff.chance === undefined || roll(s) < eff.chance) {
        removeStatuses(t, isBuff, eff.count, events);
      }
      break;
    case "extend": {
      const pick = eff.kind === "buffs" ? isBuff : (id: StatusId) => !isBuff(id);
      const list = t.statuses.filter((st) => pick(st.id));
      if (list.length === 0) break;
      for (const st of list) st.turns += eff.turns;
      events.push({ type: "extend", targetUid: t.uid, kind: eff.kind, turns: eff.turns });
      break;
    }
    case "cooldown": {
      let changed = false;
      for (const sk of t.skills) {
        if (sk.cooldown === 0) continue;
        const before = t.cooldowns[sk.id];
        t.cooldowns[sk.id] = Math.min(sk.cooldown + 1, Math.max(0, before + eff.amount));
        if (t.cooldowns[sk.id] !== before) changed = true;
      }
      if (changed) events.push({ type: "cooldown", targetUid: t.uid, amount: eff.amount });
      break;
    }
  }
}

function removeStatuses(
  t: BattleUnit,
  pred: (id: StatusId) => boolean,
  count: number,
  events: BattleEvent[],
) {
  let removed = 0;
  for (let i = t.statuses.length - 1; i >= 0 && removed < count; i--) {
    const id = t.statuses[i].id;
    if (!pred(id)) continue;
    t.statuses.splice(i, 1);
    removed++;
    events.push({ type: "status_removed", targetUid: t.uid, status: id });
  }
}

export function applyStatus(
  s: BattleState,
  src: BattleUnit,
  t: BattleUnit,
  id: BuffId | DebuffId,
  turns: number,
  chance: number,
  events: BattleEvent[],
): boolean {
  if (isBuff(id)) {
    if (hasStatus(t, "unbuffable")) {
      events.push({ type: "status_resisted", targetUid: t.uid, status: id });
      return false;
    }
  } else {
    const mod = elementMatchup(src.element, t.element);
    const penalty = mod === "disadvantage" ? ELEMENT_RULES.disadvantageEffectPenalty : 0;
    if (roll(s) >= chance - penalty) return false; // 발동 실패 (표시 없음)
    const resist = Math.min(RULES.maxResistChance, Math.max(0, t.stats.res - src.stats.eff));
    if (hasStatus(t, "immunity") || roll(s) < resist) {
      events.push({ type: "status_resisted", targetUid: t.uid, status: id });
      return false;
    }
  }

  let power = 0;
  if (id === "burn") power = effectiveAtk(src) * RULES.burnAtkRatio;
  if (id === "poison") power = t.stats.hp * RULES.poisonMaxHpRatio;

  const existing = t.statuses.find((st) => st.id === id);
  if (existing && !STACKABLE.includes(id)) {
    existing.turns = Math.max(existing.turns, turns);
    existing.sourceUid = src.uid;
    existing.appliedTurn = s.turnCount;
  } else {
    t.statuses.push({ id, turns, sourceUid: src.uid, power, appliedTurn: s.turnCount });
  }
  events.push({ type: "status_applied", targetUid: t.uid, status: id, turns });
  return true;
}

function heal(t: BattleUnit, raw: number, events: BattleEvent[]) {
  if (!t.alive || hasStatus(t, "unhealable")) return;
  const amount = Math.min(t.stats.hp - t.hp, Math.round(raw));
  if (amount <= 0) return;
  t.hp += amount;
  events.push({ type: "heal", targetUid: t.uid, amount });
}

/** HP 직접 감소 (보호막 무시). 쓰러뜨렸으면 true */
function loseHp(s: BattleState, t: BattleUnit, amount: number, events: BattleEvent[]): boolean {
  if (!t.alive) return false;
  t.hp = Math.max(0, t.hp - amount);
  if (t.hp <= 0) {
    if (hasStatus(t, "immortal")) {
      t.hp = 1;
    } else if (t.passives.some((p) => p.type === "endure") && !t.usedSkills["passive:endure"]) {
      t.usedSkills["passive:endure"] = true;
      t.hp = 1;
      t.statuses.push({ id: "immortal", turns: 1, sourceUid: t.uid, power: 0, appliedTurn: s.turnCount });
      events.push({ type: "endure", uid: t.uid });
    } else {
      kill(s, t, events);
      return true;
    }
  }
  // 보스 광폭화
  const rage = t.passives.find((p) => p.type === "enrage");
  if (rage && rage.type === "enrage" && !t.usedSkills["passive:enrage"] && t.hp / t.stats.hp <= rage.threshold) {
    t.usedSkills["passive:enrage"] = true;
    for (const id of ["atkUp", "spdUp"] as const) {
      t.statuses.push({ id, turns: 99, sourceUid: t.uid, power: 0, appliedTurn: s.turnCount });
    }
    events.push({ type: "enrage", uid: t.uid });
  }
  return false;
}

function kill(s: BattleState, t: BattleUnit, events: BattleEvent[]) {
  t.alive = false;
  t.hp = 0;
  t.shield = 0;
  t.gauge = 0;
  t.statuses = [];
  if (s.extraTurnUid === t.uid) s.extraTurnUid = null;
  events.push({ type: "death", uid: t.uid });
  // 복수 패시브: 같은 편이 쓰러지면 공격력 증가 + 턴 게이지
  for (const u of aliveOf(s, t.side)) {
    const p = u.passives.find((x) => x.type === "onAllyDeath");
    if (!p || p.type !== "onAllyDeath") continue;
    events.push({ type: "revenge", uid: u.uid });
    applyStatus(s, u, u, "atkUp", 2, 1, events);
    u.gauge = Math.min(1, u.gauge + p.gauge);
  }
}

export interface DamageCalc {
  amount: number;
  crit: boolean;
  elementMod: ElementMod;
}

/** 피해량 계산 (치명 여부는 외부에서 결정). UI 예상 피해 표시에도 사용 */
export function calcDamage(
  src: BattleUnit,
  t: BattleUnit,
  eff: Extract<Effect, { type: "damage" }>,
  crit: boolean,
): DamageCalc {
  const base =
    eff.scaling === "def"
      ? effectiveDef(src)
      : eff.scaling === "maxHp"
        ? src.stats.hp
        : effectiveAtk(src);
  let bonus = 1;
  if (eff.bonusVsDebuffed && hasAnyDebuff(t)) bonus += eff.bonusVsDebuffed;
  if (eff.bonusVsStatus && hasStatus(t, eff.bonusVsStatus.status)) bonus += eff.bonusVsStatus.bonus;
  if (eff.bonusByTargetMissingHp) bonus += eff.bonusByTargetMissingHp * (1 - t.hp / t.stats.hp);
  if (eff.bonusBySelfMissingHp) bonus += eff.bonusBySelfMissingHp * (1 - src.hp / src.stats.hp);

  const def = effectiveDef(t) * (1 - (eff.ignoreDef ?? 0));
  const elementMod = elementMatchup(src.element, t.element);
  const elementMult =
    elementMod === "advantage"
      ? ELEMENT_RULES.advantageDamage
      : elementMod === "disadvantage"
        ? ELEMENT_RULES.disadvantageDamage
        : 1;

  let dmg = (base * eff.multiplier + t.stats.hp * (eff.targetMaxHpRatio ?? 0)) * bonus;
  dmg *= 1 - def / (def + RULES.defConstant);
  if (crit) dmg *= src.stats.critDmg;
  dmg *= elementMult;
  for (const p of t.passives) {
    if (p.type === "lowHpDamageReduction" && t.hp / t.stats.hp <= p.threshold) {
      dmg *= 1 - p.reduction;
    }
  }
  return { amount: Math.max(1, Math.round(dmg)), crit, elementMod };
}

/** 피해를 주고 쓰러뜨렸으면 true */
function dealDamage(
  s: BattleState,
  src: BattleUnit,
  t: BattleUnit,
  eff: Extract<Effect, { type: "damage" }>,
  events: BattleEvent[],
): boolean {
  // 보호: 보호해 주는 아군이 살아 있으면 그 아군이 대신 맞는다
  const protect = t.statuses.find((st) => st.id === "protect");
  if (protect && src.side !== t.side) {
    const guard = s.units.find((u) => u.uid === protect.sourceUid);
    if (guard && guard.alive && guard !== t) {
      events.push({ type: "guard", uid: guard.uid, protectedUid: t.uid });
      t = guard;
    }
  }

  const mod = elementMatchup(src.element, t.element);
  const critChance = effectiveCrit(src) + (mod === "advantage" ? ELEMENT_RULES.advantageCrit : 0);
  const guaranteed = !src.hasAttacked && src.passives.some((p) => p.type === "firstAttackCrit");
  const crit = guaranteed || roll(s) < critChance;
  src.hasAttacked = true;

  const { amount, elementMod } = calcDamage(src, t, eff, crit);
  const absorbed = Math.min(t.shield, amount);
  t.shield -= absorbed;
  const hpLoss = amount - absorbed;
  events.push({
    type: "damage",
    sourceUid: src.uid,
    targetUid: t.uid,
    amount,
    crit,
    elementMod,
    absorbed,
  });
  const killed = loseHp(s, t, hpLoss, events);
  if (!killed) triggerAutoProtect(s, t, events);
  if (eff.lifesteal && src.alive) heal(src, amount * eff.lifesteal, events);
  return killed;
}

/** 경호원 패시브: 아군 HP가 기준 이하로 떨어지면 자동으로 보호 (전투당 1회) */
function triggerAutoProtect(s: BattleState, t: BattleUnit, events: BattleEvent[]) {
  if (hasStatus(t, "protect")) return;
  for (const g of aliveOf(s, t.side)) {
    if (g === t) continue;
    const p = g.passives.find((x) => x.type === "autoProtect");
    if (!p || p.type !== "autoProtect" || g.usedSkills["passive:autoProtect"]) continue;
    if (t.hp / t.stats.hp > p.threshold) continue;
    g.usedSkills["passive:autoProtect"] = true;
    applyStatus(s, g, t, "protect", p.turns, 1, events);
    return;
  }
}

// ---- 자동 행동 (적 AI / 자동 전투) ----

export function chooseAutoAction(s: BattleState): Action {
  if (!s.activeUid) throw new Error("no active unit");
  const u = getUnit(s, s.activeUid);
  const ready = getAvailableSkills(s, u.uid);
  const order = u.aiPriority ?? [...u.skills].reverse().map((sk) => sk.id);
  const skill =
    order.map((id) => ready.find((sk) => sk.id === id)).find((sk) => sk !== undefined) ??
    ready[0];
  if (!needsTarget(skill)) return { skillId: skill.id };

  const targets = getValidTargets(s, u.uid, skill.id).map((id) => getUnit(s, id));
  let pick: BattleUnit;
  if (skill.target === "enemy_single") {
    // HP가 가장 낮은 적
    pick = targets.reduce((a, b) => (b.hp < a.hp ? b : a));
  } else if (skill.target === "ally_single") {
    pick = targets.reduce((a, b) => (b.hp / b.stats.hp < a.hp / a.stats.hp ? b : a));
  } else {
    pick = targets[0];
  }
  return { skillId: skill.id, targetUid: pick.uid };
}

export type Policy = (s: BattleState) => Action;

/** 전투를 끝까지 진행 (테스트·점수 검증용). 아군 행동은 policy, 적은 chooseAutoAction */
export function simulateBattle(
  start: BattleState,
  allyPolicy: Policy = chooseAutoAction,
  maxTurns = 500,
): { state: BattleState; events: BattleEvent[] } {
  let s = start;
  const events: BattleEvent[] = [];
  while (s.outcome === "ongoing") {
    if (s.turnCount > maxTurns) throw new Error("simulateBattle: too many turns");
    const adv = advance(s);
    s = adv.state;
    events.push(...adv.events);
    if (s.outcome !== "ongoing") break;
    const actor = getUnit(s, s.activeUid!);
    const action = actor.side === "ally" ? allyPolicy(s) : chooseAutoAction(s);
    const res = act(s, action);
    s = res.state;
    events.push(...res.events);
  }
  return { state: s, events };
}
