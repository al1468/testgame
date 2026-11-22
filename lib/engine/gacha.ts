// 시작 파티 소환 (가챠). 랭크별 확률로 뽑고, 4연 소환마다 A랭크 이상 1명 확정. 중복 없음.
import { COMPANIONS, PARTY_SIZE } from "@/data/companions";
import { getTier, type Tier } from "@/data/tiers";
import { roll, seedFromString } from "./rng";

export const GACHA_RULES = {
  rates: { S: 0.06, A: 0.22, B: 0.34, C: 0.38 } as Record<Tier, number>,
  /** 4연 소환마다 A 이상 최소 1명 */
  guaranteeAtLeast: "A" as Tier,
  /** 런 시작 전 재소환 가능 횟수 */
  rerolls: 3,
};

const TIERS: Tier[] = ["S", "A", "B", "C"];

export function tierOf(id: string): Tier {
  return getTier(id)?.tier ?? "C";
}

function pool(tier: Tier, exclude: Set<string>) {
  return COMPANIONS.filter((c) => tierOf(c.id) === tier && !exclude.has(c.id));
}

/** 랭크를 확률로 고르고 그 랭크에서 무작위 1명. 그 랭크가 비었으면 가까운 랭크로 */
function pullOne(rng: { rngState: number }, exclude: Set<string>, minTier?: Tier): string {
  const allowed = minTier ? TIERS.slice(0, TIERS.indexOf(minTier) + 1) : TIERS;
  const total = allowed.reduce((s, t) => s + GACHA_RULES.rates[t], 0);
  let x = roll(rng) * total;
  let tier = allowed[allowed.length - 1];
  for (const t of allowed) {
    x -= GACHA_RULES.rates[t];
    if (x < 0) {
      tier = t;
      break;
    }
  }
  const order = [tier, ...TIERS.filter((t) => t !== tier)];
  for (const t of order) {
    const p = pool(t, exclude);
    if (p.length > 0) return p[Math.floor(roll(rng) * p.length)].id;
  }
  throw new Error("no characters left to pull");
}

export function rollParty(seed: string, count = PARTY_SIZE): string[] {
  const rng = { rngState: seedFromString(`gacha|${seed}`) };
  const picked: string[] = [];
  for (let i = 0; i < count; i++) picked.push(pullOne(rng, new Set(picked)));
  const guarantee = TIERS.indexOf(GACHA_RULES.guaranteeAtLeast);
  if (!picked.some((id) => TIERS.indexOf(tierOf(id)) <= guarantee)) {
    // 확정 보정: 마지막 칸을 A 이상에서 다시 뽑는다
    picked[count - 1] = pullOne(rng, new Set(picked.slice(0, -1)), GACHA_RULES.guaranteeAtLeast);
  }
  return picked;
}
