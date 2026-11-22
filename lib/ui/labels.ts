// 화면 표시용 이름·색·메시지 포맷.
import { ELEMENT_NAMES } from "@/lib/engine/elements";
import { isBuff } from "@/lib/engine/battle";
import type { BattleEvent, BattleState, Element, Passive, StatusId } from "@/lib/engine/types";

export const STATUS_LABEL: Record<StatusId, string> = {
  atkUp: "공격↑",
  defUp: "방어↑",
  spdUp: "속도↑",
  critUp: "치명↑",
  regen: "지속회복",
  immunity: "면역",
  counter: "반격",
  protect: "보호",
  immortal: "불사",
  atkDown: "공격↓",
  defDown: "방어↓",
  spdDown: "속도↓",
  stun: "기절",
  burn: "화상",
  poison: "독",
  unhealable: "회복불가",
  unbuffable: "버프불가",
  provoke: "도발",
};

export function statusTone(id: StatusId): "buff" | "debuff" {
  return isBuff(id) ? "buff" : "debuff";
}

export const ELEMENT_ICON: Record<Element, string> = {
  fire: "🔥",
  ice: "❄️",
  earth: "🪨",
  light: "✨",
  dark: "🌑",
};

/** 임시 초상화 배경 (Tailwind 클래스) */
export const ELEMENT_BG: Record<Element, string> = {
  fire: "from-red-600 to-orange-500",
  ice: "from-sky-600 to-cyan-400",
  earth: "from-amber-700 to-yellow-600",
  light: "from-yellow-300 to-amber-200",
  dark: "from-violet-800 to-fuchsia-700",
};

export const ELEMENT_TEXT: Record<Element, string> = {
  fire: "text-red-400",
  ice: "text-sky-300",
  earth: "text-amber-500",
  light: "text-yellow-200",
  dark: "text-violet-400",
};

export function elementLabel(e: Element) {
  return `${ELEMENT_ICON[e]} ${ELEMENT_NAMES[e]}`;
}

export function describePassive(p: Passive): string {
  switch (p.type) {
    case "lowHpAtkUp":
      return `HP ${p.threshold * 100}% 이하일 때 공격력 +${p.bonus * 100}%`;
    case "lowHpDamageReduction":
      return `HP ${p.threshold * 100}% 이하일 때 받는 피해 −${p.reduction * 100}%`;
    case "battleStartGauge":
      return `전투 시작 시 ${p.target === "self" ? "자신" : "아군 전체"} 턴 게이지 +${p.amount * 100}%`;
    case "counterChance":
      return `공격받을 때 ${p.chance * 100}% 확률로 반격`;
    case "debuffedEnemyActDamage":
      return `디버프가 걸린 적이 행동할 때마다 공격력의 ${p.atkRatio * 100}% 피해`;
    case "firstAttackCrit":
      return "첫 공격은 반드시 치명타";
    case "extraTurnOnKill":
      return `적 처치 시 추가 턴 (${p.cooldown}턴에 1번)`;
    case "onAllyDeath":
      return `아군이 쓰러지면 2턴간 공격력 증가, 턴 게이지 +${p.gauge * 100}%`;
    case "endure":
      return "전투당 1회, 쓰러질 피해를 받으면 HP 1로 버티고 1턴간 불사";
    case "enrage":
      return `HP ${p.threshold * 100}% 이하가 되면 광폭화 (공격력·속도 증가)`;
    case "autoProtect":
      return `아군 HP가 ${p.threshold * 100}% 이하가 되면 ${p.turns}턴간 자동으로 보호 (전투당 1회)`;
  }
}

export type LogTone = "system" | "ally" | "enemy" | "good" | "bad";

export interface LogLine {
  text: string;
  tone: LogTone;
}

/** 전투 이벤트 → 시스템 메시지. 표시할 필요 없는 이벤트는 null */
export function formatEvent(s: BattleState, ev: BattleEvent): LogLine | null {
  const unit = (uid: string) => s.units.find((u) => u.uid === uid);
  const name = (uid: string) => unit(uid)?.name ?? uid;
  const sideTone = (uid: string): LogTone => (unit(uid)?.side === "ally" ? "ally" : "enemy");

  switch (ev.type) {
    case "skill": {
      const u = unit(ev.uid);
      const sk = u?.skills.find((x) => x.id === ev.skillId);
      return { text: `${name(ev.uid)} ▸ 「${sk?.name ?? ev.skillId}」`, tone: sideTone(ev.uid) };
    }
    case "damage": {
      const extra = [
        ev.crit ? "치명타!" : "",
        ev.elementMod === "advantage" ? "속성 우위" : ev.elementMod === "disadvantage" ? "속성 열세" : "",
        ev.absorbed > 0 ? `보호막 ${ev.absorbed} 흡수` : "",
      ].filter(Boolean);
      return {
        text: `  ${name(ev.targetUid)}에게 ${ev.amount} 피해${extra.length ? ` (${extra.join(", ")})` : ""}`,
        tone: sideTone(ev.targetUid) === "ally" ? "bad" : "system",
      };
    }
    case "dot":
      return { text: `  ${name(ev.targetUid)} ${STATUS_LABEL[ev.status]} 피해 ${ev.amount}`, tone: "system" };
    case "heal":
      return { text: `  ${name(ev.targetUid)} HP ${ev.amount} 회복`, tone: "good" };
    case "shield":
      return { text: `  ${name(ev.targetUid)} 보호막 ${ev.amount}`, tone: "good" };
    case "status_applied":
      return { text: `  ${name(ev.targetUid)}: ${STATUS_LABEL[ev.status]} (${ev.turns}턴)`, tone: "system" };
    case "status_resisted":
      return { text: `  ${name(ev.targetUid)}: ${STATUS_LABEL[ev.status]} 저항`, tone: "system" };
    case "gauge":
      if (Math.abs(ev.amount) < 0.005) return null;
      return {
        text: `  ${name(ev.targetUid)} 턴 게이지 ${ev.amount > 0 ? "+" : ""}${Math.round(ev.amount * 100)}%`,
        tone: "system",
      };
    case "stunned":
      return { text: `${name(ev.uid)}은(는) 기절해서 움직일 수 없다.`, tone: "system" };
    case "counter":
      return { text: `${name(ev.uid)}의 반격!`, tone: sideTone(ev.uid) };
    case "extend":
      return {
        text: `  ${name(ev.targetUid)} ${ev.kind === "buffs" ? "버프" : "디버프"} 지속 +${ev.turns}턴`,
        tone: "system",
      };
    case "revenge":
      return { text: `[시스템] ${name(ev.uid)}이(가) 분노합니다!`, tone: sideTone(ev.uid) };
    case "follow_up":
      return { text: `  ${name(ev.uid)}의 협공!`, tone: sideTone(ev.uid) };
    case "cooldown":
      return {
        text: `  ${name(ev.targetUid)} 스킬 쿨타임 ${ev.amount > 0 ? "+" : ""}${ev.amount}`,
        tone: "system",
      };
    case "endure":
      return { text: `[시스템] ${name(ev.uid)}이(가) 쓰러지지 않고 버텨냈다!`, tone: "good" };
    case "pressure_start":
      return { text: "[시스템] 전투가 길어져 탑의 압박이 시작됩니다. 매 턴 피해가 커집니다!", tone: "bad" };
    case "pressure":
      return { text: `  ${name(ev.targetUid)} 탑의 압박 피해 ${ev.amount}`, tone: "system" };
    case "enrage":
      return { text: `[시스템] ${name(ev.uid)}이(가) 광폭화했습니다!`, tone: "bad" };
    case "guard":
      return { text: `  ${name(ev.uid)}이(가) ${name(ev.protectedUid)} 대신 공격을 받는다!`, tone: "good" };
    case "death":
      return sideTone(ev.uid) === "ally"
        ? { text: `[시스템] ${name(ev.uid)} 전투 불능.`, tone: "bad" }
        : { text: `[시스템] ${name(ev.uid)}을(를) 처치했습니다.`, tone: "good" };
    case "revive":
      return { text: `[시스템] ${name(ev.uid)} 부활! (HP ${ev.hp})`, tone: "good" };
    case "extra_turn":
      return { text: `[시스템] ${name(ev.uid)} 추가 턴!`, tone: "good" };
    case "battle_end":
      return ev.outcome === "win"
        ? { text: "[시스템] 전투에서 승리했습니다.", tone: "good" }
        : { text: "[시스템] 파티가 전멸했습니다.", tone: "bad" };
    default:
      return null;
  }
}
