// 이어하기용 로컬 저장 (브라우저 localStorage). Supabase 연동 전까지 사용.
// 런 상태와 진행 중인 전투 상태를 그대로 저장한다 (둘 다 JSON 직렬화 가능).
import type { BattleState } from "@/lib/engine/types";
import type { BattleReport, RunState } from "@/lib/engine/run";
import type { LogLine } from "@/lib/ui/labels";

const KEY = "tower-rpg-save-v2"; // v2: 주인공 없이 4인 자유 편성
const CHANGE_EVENT = "tower-rpg-save-change";

export interface SaveData {
  version: 2;
  savedAt: number;
  partyIds: string[];
  run: RunState;
  battle: BattleState | null;
  report: BattleReport | null;
  log: LogLine[];
}

export function loadSave(): SaveData | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data?.version !== 2 || !data.run || data.run.status !== "ongoing") return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data: Omit<SaveData, "version" | "savedAt">) {
  try {
    const had = window.localStorage.getItem(KEY) !== null;
    window.localStorage.setItem(KEY, JSON.stringify({ ...data, version: 2, savedAt: Date.now() }));
    if (!had) window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // 저장 실패(사생활 보호 모드 등)는 무시하고 계속 플레이
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // 무시
  }
}

/** useSyncExternalStore용 */
export function subscribeSave(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function hasSave(): boolean {
  return loadSave() !== null;
}

// ---- 시작 파티 소환 상태 (새로고침으로 재소환 횟수를 되돌리지 못하게 저장) ----

const SUMMON_KEY = "tower-rpg-summon-v1";

export interface SummonState {
  /** 이번 소환 세션의 시드 (소환할 때마다 seed-1, seed-2 ...) */
  seed: string;
  pulls: number;
  rerollsLeft: number;
  party: string[] | null;
}

export function loadSummon(): SummonState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(SUMMON_KEY);
    return raw ? (JSON.parse(raw) as SummonState) : null;
  } catch {
    return null;
  }
}

export function writeSummon(state: SummonState) {
  try {
    window.localStorage.setItem(SUMMON_KEY, JSON.stringify(state));
  } catch {
    // 무시
  }
}

export function clearSummon() {
  try {
    window.localStorage.removeItem(SUMMON_KEY);
  } catch {
    // 무시
  }
}
