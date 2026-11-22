// 시드 기반 난수 (mulberry32). 상태가 숫자 하나라 BattleState에 그대로 저장할 수 있다.

export function seedFromString(seed: string): number {
  // FNV-1a 32bit
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 다음 난수 [0, 1)와 갱신된 상태를 반환 */
export function nextRandom(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, s];
}

/** BattleState 같은 객체의 rngState를 갱신하며 난수를 뽑는 헬퍼 */
export function roll(holder: { rngState: number }): number {
  const [v, s] = nextRandom(holder.rngState);
  holder.rngState = s;
  return v;
}
