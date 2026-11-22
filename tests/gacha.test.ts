import { describe, expect, it } from "vitest";
import { GACHA_RULES, rollParty, tierOf } from "@/lib/engine/gacha";
import { COMPANIONS } from "@/data/companions";

describe("파티 소환 (가챠)", () => {
  it("4명, 중복 없음, 모두 실제 캐릭터", () => {
    for (let i = 0; i < 300; i++) {
      const p = rollParty(`g${i}`);
      expect(p).toHaveLength(4);
      expect(new Set(p).size).toBe(4);
      for (const id of p) expect(COMPANIONS.some((c) => c.id === id)).toBe(true);
    }
  });

  it("A랭크 이상 1명 확정", () => {
    for (let i = 0; i < 500; i++) {
      expect(rollParty(`guar${i}`).some((id) => tierOf(id) === "S" || tierOf(id) === "A")).toBe(true);
    }
  });

  it("같은 시드면 같은 결과", () => {
    expect(rollParty("same")).toEqual(rollParty("same"));
    expect(rollParty("a")).not.toEqual(rollParty("b"));
  });

  it("랭크별 출현 비율이 설정 확률에 가깝다 (S가 가장 드묾)", () => {
    const count = { S: 0, A: 0, B: 0, C: 0 };
    const N = 3000;
    for (let i = 0; i < N; i++) for (const id of rollParty(`rate${i}`)) count[tierOf(id)]++;
    const total = N * 4;
    // 확정 보정 때문에 A 이상은 설정보다 조금 높고, C는 조금 낮다
    expect(count.S / total).toBeGreaterThan(GACHA_RULES.rates.S * 0.7);
    expect(count.S / total).toBeLessThan(GACHA_RULES.rates.S * 2);
    expect(count.C / total).toBeGreaterThan(GACHA_RULES.rates.C * 0.7);
    expect(count.S).toBeLessThan(count.A);
    expect(count.A).toBeLessThan(count.B + count.C);
  });
});
