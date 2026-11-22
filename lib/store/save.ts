// 이어하기용 로컬 저장 (브라우저 localStorage). Supabase 연동 전까지 사용.
// 런 상태와 진행 중인 전투 상태를 그대로 저장한다 (둘 다 JSON 직렬화 가능).
import type { Action, BattleState } from "@/lib/engine/types";
import type { BattleReport, RunState } from "@/lib/engine/run";
import type { RunAction } from "@/lib/engine/replay";
import type { LogLine } from "@/lib/ui/labels";

const KEY = "tower-rpg-save-v2"; // v2: 주인공 없이 4인 자유 편성
const CHANGE_EVENT = "tower-rpg-save-change";

/** 랭킹 검증용: 이 런의 시작 파티가 어떤 소환에서 나왔는지 */
export interface RunMeta {
  summonSeed: string;
  pulls: number;
  party: string[];
}

export interface SaveData {
  version: 2;
  savedAt: number;
  partyIds: string[];
  runMeta: RunMeta | null;
  /** 지금까지의 행동 기록 (서버 재생·검증용) */
  runLog: RunAction[];
  /** 진행 중인 전투의 아군 행동 */
  battleLog: Action[];
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

/** 클라우드 동기화 연결점 (lib/supabase/cloud.ts가 등록) */
export interface SaveSink {
  onWrite: (data: SaveData) => void;
  onClear: () => void;
}
let sink: SaveSink | null = null;
export function setSaveSink(s: SaveSink | null) {
  sink = s;
}

export function writeSave(data: Omit<SaveData, "version" | "savedAt">) {
  const full: SaveData = { ...data, version: 2, savedAt: Date.now() };
  try {
    const had = window.localStorage.getItem(KEY) !== null;
    window.localStorage.setItem(KEY, JSON.stringify(full));
    if (!had) window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // 저장 실패(사생활 보호 모드 등)는 무시하고 계속 플레이
  }
  sink?.onWrite(full);
}

/** 클라우드에서 받은 저장을 로컬에 반영 (다시 업로드하지 않음) */
export function importSave(data: SaveData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // 무시
  }
}

/** 로컬 저장 원본 (savedAt 비교용, 끝난 런도 포함) */
export function peekSave(): SaveData | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // 무시
  }
  sink?.onClear();
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
