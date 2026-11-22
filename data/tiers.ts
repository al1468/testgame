// 동료 랭크 (S/A/B/C). `npm run rank`로 자동 플레이 시뮬레이션을 돌려 data/tiers.json을 다시 만든다.
import tiers from "./tiers.json";

export type Tier = "S" | "A" | "B" | "C";

export interface TierEntry {
  id: string;
  name: string;
  tier: Tier;
  clearRate: number;
  avgFloors: number;
}

const ENTRIES = tiers.companions as TierEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

export const TIER_ORDER: Tier[] = ["S", "A", "B", "C"];
export const TIER_RUNS = tiers.runsPerCompanion;

export function getTier(id: string): TierEntry | null {
  return BY_ID.get(id) ?? null;
}

export const TIER_STYLE: Record<Tier, string> = {
  S: "bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950",
  A: "bg-violet-500 text-white",
  B: "bg-sky-600 text-white",
  C: "bg-slate-600 text-slate-100",
};
