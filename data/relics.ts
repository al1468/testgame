// 유물: 런 동안 유지되는 패시브 아이템.
import type { AllyModifiers } from "@/lib/engine/types";

export interface RelicDef {
  id: string;
  name: string;
  description: string;
  /** 전투 시작 시 아군 전체에 적용되는 보정 */
  mods?: Partial<AllyModifiers>;
  /** 전투 골드 보너스 비율 */
  goldBonus?: number;
  /** 전투 승리 후 살아있는 아군 HP 회복 비율 */
  victoryHeal?: number;
}

export const RELICS: RelicDef[] = [
  { id: "pocket_watch", name: "녹슨 회중시계", description: "전투 시작 시 아군 전체 턴 게이지 +15%", mods: { startGauge: 0.15 } },
  { id: "awakened_ring", name: "각성자의 반지", description: "아군 전체 공격력 +10%", mods: { atkPct: 0.1 } },
  { id: "kevlar_vest", name: "강화 방탄복", description: "아군 전체 방어력 +15%", mods: { defPct: 0.15 } },
  { id: "life_charm", name: "생명의 부적", description: "아군 전체 최대 HP +10%", mods: { hpPct: 0.1 } },
  { id: "light_sneakers", name: "날렵한 운동화", description: "아군 전체 속도 +8", mods: { spd: 8 } },
  { id: "sharp_eye", name: "매의 눈 렌즈", description: "아군 전체 치명 확률 +10%", mods: { critRate: 0.1 } },
  { id: "golden_coin", name: "황금 동전", description: "전투에서 얻는 골드 +30%", goldBonus: 0.3 },
  { id: "first_aid_kit", name: "응급 키트", description: "전투 승리 후 살아있는 아군 HP 10% 회복", victoryHeal: 0.1 },
];

export function getRelic(id: string): RelicDef {
  const r = RELICS.find((x) => x.id === id);
  if (!r) throw new Error(`unknown relic ${id}`);
  return r;
}
