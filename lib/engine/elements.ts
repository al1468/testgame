import type { Element } from "./types";

export const ELEMENT_NAMES: Record<Element, string> = {
  fire: "화염",
  ice: "빙결",
  earth: "대지",
  light: "빛",
  dark: "어둠",
};

// 화염 → 빙결 → 대지 → 화염, 빛 ↔ 어둠
const BEATS: Record<Element, Element[]> = {
  fire: ["ice"],
  ice: ["earth"],
  earth: ["fire"],
  light: ["dark"],
  dark: ["light"],
};

export type ElementMod = "advantage" | "disadvantage" | "neutral";

export function elementMatchup(attacker: Element, defender: Element): ElementMod {
  if (BEATS[attacker].includes(defender)) return "advantage";
  if (BEATS[defender].includes(attacker) && !BEATS[attacker].includes(defender)) {
    return "disadvantage";
  }
  return "neutral";
}

export const ELEMENT_RULES = {
  advantageDamage: 1.3,
  advantageCrit: 0.15,
  disadvantageDamage: 0.8,
  disadvantageEffectPenalty: 0.2,
} as const;
