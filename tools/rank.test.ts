// 동료 랭크 계산: `npm run rank`
// 캐릭터마다 같은 시드·같은 동반 파티(무작위 3명)로 자동 플레이를 돌려 클리어율을 구하고
// S/A/B/C 랭크를 매겨 data/tiers.json에 저장한다.
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { COMPANIONS } from "@/data/companions";
import { nextRandom } from "@/lib/engine/rng";
import { autoplayRun } from "../tests/autoplay";

const RUNS = Number(process.env.RANK_RUNS ?? 60);
/** 클리어율 기준 (이상) */
export const TIER_CUTS = { S: 0.4, A: 0.16, B: 0.1 } as const;

it("rank companions", { timeout: 3_600_000 }, () => {
  // 모든 동료가 같은 동반 파티 후보 순서를 쓰도록 미리 섞어 둔다
  let r = 20261122;
  const pick = () => {
    const [v, s] = nextRandom(r);
    r = s;
    return v;
  };
  const partnerOrder = Array.from({ length: RUNS }, () => [...COMPANIONS].sort(() => pick() - 0.5).map((c) => c.id));

  const rows = COMPANIONS.map((c) => {
    let clears = 0;
    let floors = 0;
    for (let i = 0; i < RUNS; i++) {
      const partners = partnerOrder[i].filter((id) => id !== c.id).slice(0, 3);
      const run = autoplayRun(`rank-${i}`, [c.id, ...partners]);
      if (run.status === "cleared") clears++;
      floors += run.status === "cleared" ? 10 : run.floor - 1;
    }
    const clearRate = clears / RUNS;
    const tier = clearRate >= TIER_CUTS.S ? "S" : clearRate >= TIER_CUTS.A ? "A" : clearRate >= TIER_CUTS.B ? "B" : "C";
    return { id: c.id, name: c.name, tier, clearRate: Math.round(clearRate * 1000) / 1000, avgFloors: Math.round((floors / RUNS) * 10) / 10 };
  }).sort((a, b) => b.clearRate - a.clearRate || b.avgFloors - a.avgFloors);

  writeFileSync(
    "data/tiers.json",
    JSON.stringify({ runsPerCompanion: RUNS, cuts: TIER_CUTS, companions: rows }, null, 2) + "\n",
    "utf-8",
  );
  console.log(rows.map((x) => `${x.tier}  ${x.name.padEnd(10)} ${(x.clearRate * 100).toFixed(0).padStart(3)}%  ${x.avgFloors}층`).join("\n"));
});
