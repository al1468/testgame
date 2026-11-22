// 게임 화면 상태 (Zustand). 규칙은 전부 lib/engine에 있고, 여기서는 화면 전환·연출 타이밍·저장만 관리한다.
import { create } from "zustand";
import {
  act,
  advance,
  chooseAutoAction,
  createBattle,
  getUnit,
  needsTarget,
  type Action,
  type BattleState,
  type StepResult,
} from "@/lib/engine";
import { COMPANIONS, PARTY_SIZE } from "@/data/companions";
import { getFloor } from "@/data/floors";
import * as Run from "@/lib/engine/run";
import type { BattleReport, RunState } from "@/lib/engine/run";
import { formatEvent, STATUS_LABEL, type LogLine } from "@/lib/ui/labels";
import { rollParty, runSeedFor, GACHA_RULES } from "@/lib/engine/gacha";
import type { RunAction } from "@/lib/engine/replay";
import {
  clearSave,
  clearSummon,
  loadSave,
  loadSummon,
  writeSave,
  writeSummon,
  type RunMeta,
  type SummonState,
} from "./save";

export type Screen = "title" | "summon" | "codex" | "ranking" | "map" | "battle";

export type PopupKind = "damage" | "crit" | "heal" | "dot" | "status" | "resist";

export interface Popup {
  id: number;
  uid: string;
  text: string;
  kind: PopupKind;
}

export interface LogEntry extends LogLine {
  id: number;
}

interface GameStore {
  screen: Screen;
  /** 시작 파티 (소환 결과, 최대 4명) */
  partyIds: string[];
  /** 시작 파티 소환 상태 */
  summon: SummonState | null;
  /** 소환할 때마다 1씩 증가 (카드 공개 연출 다시 재생용) */
  summonCount: number;
  run: RunState | null;
  /** 이 런이 어떤 소환에서 시작됐는지 (랭킹 검증용, 소환 없이 시작하면 null) */
  runMeta: RunMeta | null;
  /** 이 런의 행동 기록 (랭킹 검증 시 서버가 재생) */
  runLog: RunAction[];
  /** 진행 중인 전투의 아군 행동 */
  battleLog: Action[];
  /** 방금 끝난 전투 결과 (결과 창 표시용) */
  report: BattleReport | null;
  battle: BattleState | null;
  log: LogEntry[];
  popups: Popup[];
  busy: boolean;
  selectedSkillId: string | null;
  speed: 1 | 2;
  auto: boolean;
  /** 지도 행동 실패 안내 (골드 부족 등) */
  notice: string | null;

  goTo: (screen: Screen) => void;
  /** 소환 화면 열기 (이전 소환 결과·남은 재소환 횟수는 이어짐) */
  openSummon: () => void;
  /** 4연 소환. 첫 소환은 무료, 이후는 재소환 횟수 차감 */
  pullParty: () => void;
  /** 새 런 시작 → 1층 지도. 인자를 생략하면 소환 결과 */
  startRun: (partyIds?: string[]) => void;
  /** 저장된 런 이어하기 (전투 중이었으면 그 전투의 그 턴부터) */
  continueRun: () => boolean;
  abandonRun: () => void;

  // 지도
  selectNode: (nodeId: string) => void;
  restHeal: () => void;
  restTrain: (memberIndex: number) => void;
  buyOffer: (index: number) => void;
  recruit: (defId: string, replaceIndex?: number) => void;
  chooseEvent: (index: number) => void;
  leaveNode: () => void;
  /** 전투 결과 창을 닫고 지도로 */
  backToMap: () => void;

  // 전투
  selectSkill: (skillId: string) => void;
  confirmSkill: (targetUid?: string) => void;
  toggleSpeed: () => void;
  toggleAuto: () => void;
}

let nextId = 1;
let runToken = 0;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const line = (text: string, tone: LogLine["tone"] = "system"): LogEntry => ({ id: nextId++, text, tone });

export const useGame = create<GameStore>()((set, get) => {
  /** 전투 한 걸음 반영. allyAction이 있으면 전투 기록에도 추가 (같은 set에서 저장되도록) */
  function applyStep(res: StepResult, allyAction?: Action) {
    const lines: LogEntry[] = [];
    const popups: Popup[] = [];
    for (const ev of res.events) {
      const l = formatEvent(res.state, ev);
      if (l) lines.push({ ...l, id: nextId++ });
      if (ev.type === "damage") {
        popups.push({ id: nextId++, uid: ev.targetUid, text: `${ev.amount}`, kind: ev.crit ? "crit" : "damage" });
      } else if (ev.type === "dot" || ev.type === "pressure") {
        popups.push({ id: nextId++, uid: ev.targetUid, text: `${ev.amount}`, kind: "dot" });
      } else if (ev.type === "heal") {
        popups.push({ id: nextId++, uid: ev.targetUid, text: `+${ev.amount}`, kind: "heal" });
      } else if (ev.type === "status_applied") {
        popups.push({ id: nextId++, uid: ev.targetUid, text: STATUS_LABEL[ev.status], kind: "status" });
      } else if (ev.type === "status_resisted") {
        popups.push({ id: nextId++, uid: ev.targetUid, text: "저항", kind: "resist" });
      }
    }
    set((st) => ({
      battle: res.state,
      battleLog: allyAction ? [...st.battleLog, allyAction] : st.battleLog,
      log: [...st.log, ...lines].slice(-80),
      popups: [...st.popups, ...popups],
    }));
    if (popups.length) {
      const ids = new Set(popups.map((p) => p.id));
      setTimeout(() => set((st) => ({ popups: st.popups.filter((p) => !ids.has(p.id)) })), 1100);
    }
  }

  /** 아군(수동) 차례가 올 때까지 시간 진행 + 적 행동을 연출과 함께 처리 */
  async function proceed(token: number) {
    set({ busy: true, selectedSkillId: null });
    const wait = (ms: number) => delay(ms / get().speed);
    for (;;) {
      if (token !== runToken) return;
      let s = get().battle;
      if (!s || s.outcome !== "ongoing") break;

      if (!s.activeUid) {
        const res = advance(s);
        applyStep(res);
        if (res.events.some((e) => e.type === "dot" || e.type === "stunned" || e.type === "damage")) {
          await wait(500);
          if (token !== runToken) return;
        }
        s = get().battle!;
        if (s.outcome !== "ongoing") break;
      }

      const actor = getUnit(s, s.activeUid!);
      if (actor.side === "ally" && !get().auto) {
        set({ busy: false, selectedSkillId: actor.skills[0].id });
        return;
      }
      await wait(550);
      if (token !== runToken) return;
      const cur = get().battle!;
      const autoAction = chooseAutoAction(cur);
      applyStep(act(cur, autoAction), actor.side === "ally" ? autoAction : undefined);
      await wait(650);
    }
    if (token !== runToken) return;
    settle();
    set({ busy: false, selectedSkillId: null });
  }

  /** 전투가 끝나면 결과를 런에 한 번만 반영 */
  function settle() {
    const { battle, run, report } = get();
    if (!battle || !run || battle.outcome === "ongoing" || report) return;
    const res = Run.finishBattle(run, battle);
    set((st) => ({
      run: res.run,
      report: res.report,
      runLog: [...st.runLog, { t: "battle", actions: st.battleLog }],
      battleLog: [],
    }));
  }

  async function perform(action: Action) {
    const s = get().battle;
    if (!s || get().busy) return;
    const token = runToken;
    set({ busy: true, selectedSkillId: null });
    applyStep(act(s, action), action);
    await delay(650 / get().speed);
    await proceed(token);
  }

  function startNodeBattle(run: RunState) {
    runToken++;
    const token = runToken;
    const node = Run.currentNode(run)!;
    const floor = getFloor(run.floor);
    const battle = createBattle(Run.nodeBattleSetup(run));
    const log: LogEntry[] = [];
    if (node.kind === "gate") {
      log.push(line(`[시스템] ${floor.floor}층 관문에 도착했습니다.`), line(floor.intro));
      if (floor.kind === "boss") log.push(line("[시스템] 보스가 출현했습니다!", "bad"));
    } else if (node.kind === "elite") {
      log.push(line("[시스템] 강력한 적이 길을 막습니다!", "bad"));
    } else {
      log.push(line("[시스템] 적과 조우했습니다."));
    }
    const revived = run.members.filter((m) => m.hp <= 0).length;
    if (revived > 0) log.push(line(`[시스템] 쓰러졌던 동료 ${revived}명이 HP 50%로 복귀했습니다.`, "good"));
    set((st) => ({
      screen: "battle",
      run,
      runLog: [...st.runLog, { t: "node", id: node.id }],
      battleLog: [],
      report: null,
      battle,
      log,
      popups: [],
      selectedSkillId: null,
    }));
    void proceed(token);
  }

  /** 지도 행동 공통 처리 (실패하면 안내 문구) */
  function runAction(fn: (run: RunState) => RunState, record: RunAction) {
    const { run } = get();
    if (!run) return;
    try {
      const next = fn(run);
      set((st) => ({ run: next, runLog: [...st.runLog, record], notice: null }));
    } catch (e) {
      set({ notice: friendlyError(e instanceof Error ? e.message : "") });
    }
  }

  return {
    screen: "title",
    partyIds: [],
    summon: null,
    summonCount: 0,
    run: null,
    runMeta: null,
    runLog: [],
    battleLog: [],
    report: null,
    battle: null,
    log: [],
    popups: [],
    busy: false,
    selectedSkillId: null,
    speed: 1,
    auto: false,
    notice: null,

    goTo: (screen) => {
      runToken++;
      set({ screen, busy: false, selectedSkillId: null, notice: null });
    },

    openSummon: () => {
      runToken++;
      const saved = loadSummon();
      const summon: SummonState = saved ?? {
        seed: `${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
        pulls: 0,
        rerollsLeft: GACHA_RULES.rerolls,
        party: null,
      };
      writeSummon(summon);
      set({ screen: "summon", summon, partyIds: summon.party ?? [], busy: false });
    },

    pullParty: () => {
      const cur = get().summon;
      if (!cur) return;
      if (cur.party && cur.rerollsLeft <= 0) return;
      const pulls = cur.pulls + 1;
      const party = rollParty(`${cur.seed}-${pulls}`);
      const summon: SummonState = {
        ...cur,
        pulls,
        party,
        rerollsLeft: cur.party ? cur.rerollsLeft - 1 : cur.rerollsLeft,
      };
      writeSummon(summon);
      set((st) => ({ summon, partyIds: party, summonCount: st.summonCount + 1 }));
    },

    startRun: (partyArg) => {
      const valid = (partyArg ?? get().partyIds).filter((id) => COMPANIONS.some((c) => c.id === id)).slice(0, PARTY_SIZE);
      if (valid.length === 0) return;
      // 소환 결과로 시작하면 런 시드를 소환 시드에서 만든다 → 서버가 소환·런을 함께 검증 가능
      const summon = get().summon;
      const fromSummon = !partyArg && summon?.party ? summon : null;
      const runMeta: RunMeta | null = fromSummon
        ? { summonSeed: fromSummon.seed, pulls: fromSummon.pulls, party: valid }
        : null;
      const seed = fromSummon ? runSeedFor(fromSummon.seed) : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      runToken++;
      clearSummon();
      set({
        partyIds: valid,
        summon: null,
        runMeta,
        runLog: [],
        battleLog: [],
        run: Run.createRun(seed, valid),
        battle: null,
        report: null,
        log: [],
        notice: null,
        busy: false,
        screen: "map",
      });
    },

    continueRun: () => {
      const save = loadSave();
      if (!save) return false;
      runToken++;
      const token = runToken;
      const inBattle = !!save.battle;
      set({
        partyIds: save.partyIds,
        runMeta: save.runMeta ?? null,
        runLog: save.runLog ?? [],
        battleLog: save.battleLog ?? [],
        run: save.run,
        battle: save.battle,
        report: save.report,
        log: [...save.log.map((l) => ({ ...l, id: nextId++ })), line("[시스템] 저장된 지점부터 이어서 진행합니다.")],
        popups: [],
        busy: false,
        selectedSkillId: null,
        notice: null,
        screen: inBattle ? "battle" : "map",
      });
      if (save.battle) {
        if (save.battle.outcome === "ongoing") void proceed(token);
        else settle();
      }
      return true;
    },

    abandonRun: () => {
      runToken++;
      clearSave();
      set({ run: null, runMeta: null, runLog: [], battleLog: [], battle: null, report: null, screen: "title", busy: false });
    },

    selectNode: (nodeId) => {
      const { run } = get();
      if (!run) return;
      const next = Run.enterNode(run, nodeId);
      const node = Run.currentNode(next)!;
      if (Run.isBattleNode(node.kind)) startNodeBattle(next);
      else set((st) => ({ run: next, runLog: [...st.runLog, { t: "node", id: nodeId }], notice: null }));
    },
    restHeal: () => runAction(Run.restHeal, { t: "rest_heal" }),
    restTrain: (i) => runAction((r) => Run.restTrain(r, i), { t: "rest_train", i }),
    buyOffer: (i) => runAction((r) => Run.buyOffer(r, i), { t: "buy", i }),
    recruit: (defId, replaceIndex) =>
      runAction((r) => Run.recruit(r, defId, replaceIndex), { t: "recruit", id: defId, replace: replaceIndex }),
    chooseEvent: (i) => runAction((r) => Run.chooseEventOption(r, i), { t: "event", i }),
    leaveNode: () => runAction(Run.leaveNode, { t: "leave" }),

    backToMap: () => {
      runToken++;
      set({ screen: "map", battle: null, report: null, busy: false, selectedSkillId: null });
    },

    selectSkill: (skillId) => {
      const { battle, busy, selectedSkillId } = get();
      if (!battle?.activeUid || busy) return;
      const actor = getUnit(battle, battle.activeUid);
      const skill = actor.skills.find((sk) => sk.id === skillId);
      if (!skill) return;
      if (selectedSkillId === skillId && !needsTarget(skill)) {
        void perform({ skillId });
        return;
      }
      set({ selectedSkillId: skillId });
    },

    confirmSkill: (targetUid) => {
      const { selectedSkillId } = get();
      if (!selectedSkillId) return;
      void perform({ skillId: selectedSkillId, targetUid });
    },

    toggleSpeed: () => set((st) => ({ speed: st.speed === 1 ? 2 : 1 })),

    toggleAuto: () => {
      const auto = !get().auto;
      set({ auto });
      const { battle, busy } = get();
      if (auto && battle && !busy && battle.outcome === "ongoing") void proceed(runToken);
    },
  };
});

function friendlyError(msg: string): string {
  if (msg.includes("gold")) return "골드가 부족합니다.";
  if (msg.includes("already bought")) return "이미 구매했습니다.";
  if (msg.includes("party full")) return "파티가 가득 찼습니다. 교체할 동료를 고르세요.";
  return "지금은 할 수 없습니다.";
}

// ---- 자동 저장 ----
// 런·전투·결과가 바뀔 때마다 저장. 런이 끝나면(클리어/전멸) 저장을 지워 이어하기 대상에서 뺀다.
if (typeof window !== "undefined") {
  useGame.subscribe((st, prev) => {
    if (st.run === prev.run && st.battle === prev.battle && st.report === prev.report) return;
    if (!st.run) return;
    if (st.run.status !== "ongoing") {
      clearSave();
      return;
    }
    const inBattle = st.screen === "battle";
    writeSave({
      partyIds: st.partyIds,
      runMeta: st.runMeta,
      runLog: st.runLog,
      battleLog: inBattle ? st.battleLog : [],
      run: st.run,
      battle: inBattle ? st.battle : null,
      report: inBattle ? st.report : null,
      log: st.log.slice(-30).map(({ text, tone }) => ({ text, tone })),
    });
  });
}
