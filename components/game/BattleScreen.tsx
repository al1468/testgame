"use client";

import { useEffect, useRef } from "react";
import {
  calcDamage,
  elementMatchup,
  getAvailableSkills,
  getUnit,
  getValidTargets,
  needsTarget,
  predictTurnOrder,
  type BattleState,
  type BattleUnit,
  type SkillDef,
} from "@/lib/engine";
import { useGame } from "@/lib/store/game";
import { getUnitDef } from "@/data";
import { getFloor, MAX_FLOOR } from "@/data/floors";
import * as Run from "@/lib/engine/run";
import { describePassive, ELEMENT_BG, elementLabel } from "@/lib/ui/labels";
import { UnitCard } from "./UnitCard";

function expectedDamage(actor: BattleUnit, target: BattleUnit, skill: SkillDef): string | null {
  let total = 0;
  for (const eff of skill.effects) {
    if (eff.type !== "damage") continue;
    total += calcDamage(actor, target, eff, false).amount * (eff.hits ?? 1);
  }
  if (total === 0) return null;
  return skill.target === "enemy_random3" ? `${total}×?` : `${total}`;
}

export function BattleScreen() {
  const battle = useGame((s) => s.battle);
  if (!battle) return null;
  return <BattleView battle={battle} />;
}

function BattleView({ battle }: { battle: BattleState }) {
  const { popups, busy, selectedSkillId, speed, auto, log } = useGame();
  const { selectSkill, confirmSkill, toggleSpeed, toggleAuto } = useGame.getState();

  const actor = battle.activeUid ? getUnit(battle, battle.activeUid) : null;
  const playerTurn = !!actor && actor.side === "ally" && !busy && battle.outcome === "ongoing" && !auto;
  const skill = playerTurn ? actor.skills.find((sk) => sk.id === selectedSkillId) ?? null : null;
  const available = playerTurn ? getAvailableSkills(battle, actor.uid).map((sk) => sk.id) : [];
  const validTargets = playerTurn && skill ? getValidTargets(battle, actor.uid, skill.id) : [];

  const affectedUids = (() => {
    if (!actor || !skill) return new Set<string>();
    const alive = (side: string) => battle.units.filter((u) => u.alive && u.side === side).map((u) => u.uid);
    const enemySide = actor.side === "ally" ? "enemy" : "ally";
    switch (skill.target) {
      case "enemy_all":
      case "enemy_random3":
        return new Set(alive(enemySide));
      case "ally_all":
        return new Set(alive(actor.side));
      case "self":
        return new Set([actor.uid]);
      default:
        return new Set<string>();
    }
  })();

  const order = predictTurnOrder(battle, 8);

  // 키보드: 1~4 스킬 선택, Enter 사용(대상 없는 스킬)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const st = useGame.getState();
      const b = st.battle;
      if (!b?.activeUid || st.busy) return;
      const a = getUnit(b, b.activeUid);
      if (a.side !== "ally") return;
      const n = Number(e.key);
      if (n >= 1 && n <= a.skills.length) st.selectSkill(a.skills[n - 1].id);
      if (e.key === "Enter" && st.selectedSkillId) {
        const sk = a.skills.find((x) => x.id === st.selectedSkillId);
        if (sk && !needsTarget(sk)) st.confirmSkill();
      }
      if (e.key === "Escape") st.selectSkill(a.skills[0].id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const renderSide = (side: "ally" | "enemy") =>
    battle.units
      .filter((u) => u.side === side)
      .map((u) => {
        const targetable = validTargets.includes(u.uid);
        const showPreview =
          skill && actor && u.alive && u.side !== actor.side && (targetable || affectedUids.has(u.uid));
        return (
          <UnitCard
            key={u.uid}
            unit={u}
            active={battle.activeUid === u.uid}
            targetable={targetable}
            affected={affectedUids.has(u.uid)}
            preview={showPreview ? expectedDamage(actor, u, skill) : null}
            matchup={playerTurn && side === "enemy" && u.alive ? elementMatchup(actor.element, u.element) : null}
            popups={popups.filter((p) => p.uid === u.uid)}
            onClick={() => confirmSkill(u.uid)}
          />
        );
      });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3 sm:p-4">
      {/* 상단: 층 정보 + 행동 순서 */}
      <header className="flex flex-wrap items-center gap-3">
        <FloorBadge />
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          <span className="mr-1 shrink-0 text-xs text-slate-400">행동 순서</span>
          {order.map((uid, i) => {
            const u = getUnit(battle, uid);
            return (
              <div
                key={`${uid}-${i}`}
                title={u.name}
                className={[
                  "grid h-8 w-8 shrink-0 place-items-center rounded bg-gradient-to-br text-xs font-bold text-slate-950",
                  ELEMENT_BG[u.element],
                  i === 0 ? "ring-2 ring-cyan-300" : "",
                  u.side === "enemy" ? "rounded-full" : "",
                ].join(" ")}
              >
                {u.name[0]}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={toggleAuto} className={`btn-sm ${auto ? "btn-on" : ""}`}>
            자동 {auto ? "ON" : "OFF"}
          </button>
          <button type="button" onClick={toggleSpeed} className="btn-sm">
            속도 {speed}x
          </button>
        </div>
      </header>

      {/* 전장 */}
      <section className="grid flex-1 grid-cols-2 gap-3 sm:gap-8">
        <div className="flex flex-col justify-center gap-2">
          <h2 className="text-xs font-semibold tracking-widest text-cyan-300">PARTY</h2>
          {renderSide("ally")}
        </div>
        <div className="flex flex-col justify-center gap-2">
          <h2 className="text-right text-xs font-semibold tracking-widest text-rose-300">ENEMY</h2>
          {renderSide("enemy")}
        </div>
      </section>

      {/* 하단: 스킬 + 로그 */}
      <section className="grid gap-3 md:grid-cols-[3fr_2fr]">
        <div className="system-panel min-h-44 p-3">
          {playerTurn && actor ? (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>
                  <span className="font-semibold text-cyan-200">{actor.name}</span>의 차례{" "}
                  <span className="text-xs text-slate-400">{elementLabel(actor.element)}</span>
                </span>
                <span className="text-xs text-slate-400">숫자키 1~{actor.skills.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {actor.skills.map((sk, i) => {
                  const cd = actor.cooldowns[sk.id];
                  const ready = available.includes(sk.id);
                  const selected = sk.id === selectedSkillId;
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      disabled={!ready}
                      onClick={() => selectSkill(sk.id)}
                      className={[
                        "relative rounded-md border px-2 py-2 text-left text-sm transition",
                        selected ? "border-cyan-300 bg-cyan-950" : "border-slate-600 bg-slate-800 hover:border-slate-400",
                        !ready ? "cursor-not-allowed opacity-40" : "",
                      ].join(" ")}
                    >
                      <div className="text-[10px] text-slate-400">S{i + 1}</div>
                      <div className="font-semibold">{sk.name}</div>
                      {cd > 0 && (
                        <span className="absolute right-1 top-1 rounded bg-slate-950 px-1 text-[10px] text-amber-300">
                          {cd}턴
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {skill && (
                <div className="mt-2 text-sm">
                  <p className="text-slate-200">{skill.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    쿨타임 {skill.cooldown}턴
                    {needsTarget(skill)
                      ? " · 대상을 클릭하세요"
                      : " · 같은 스킬을 한 번 더 누르거나 [사용] (Enter)"}
                  </p>
                  {!needsTarget(skill) && (
                    <button type="button" onClick={() => confirmSkill()} className="btn-sm btn-on mt-2">
                      사용
                    </button>
                  )}
                </div>
              )}
              {actor.passives.length > 0 && (
                <p className="mt-2 text-xs text-violet-300">
                  패시브: {actor.passives.map(describePassive).join(" / ")}
                </p>
              )}
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-400">
              {battle.outcome !== "ongoing" ? "" : auto ? "자동 전투 중..." : actor ? `${actor.name} 행동 중...` : "..."}
            </div>
          )}
        </div>
        <BattleLog log={log} />
      </section>

      {battle.outcome !== "ongoing" && <ResultOverlay battle={battle} />}
    </div>
  );
}

function BattleLog({ log }: { log: { id: number; text: string; tone: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log.length]);
  const toneClass: Record<string, string> = {
    system: "text-slate-300",
    ally: "text-cyan-200 font-semibold",
    enemy: "text-rose-200 font-semibold",
    good: "text-emerald-300",
    bad: "text-rose-400",
  };
  return (
    <div ref={ref} className="system-panel h-44 overflow-y-auto p-3 font-mono text-xs leading-5">
      {log.map((l) => (
        <div key={l.id} className={`whitespace-pre-wrap ${toneClass[l.tone]}`}>
          {l.text}
        </div>
      ))}
    </div>
  );
}

function FloorBadge() {
  const run = useGame((s) => s.run);
  if (!run) return null;
  const floor = getFloor(run.floor);
  return (
    <div className="system-panel px-3 py-1.5 text-sm">
      <span className="text-cyan-300">{floor.floor}F</span> {floor.name}
      {floor.kind === "boss" && <span className="ml-2 rounded bg-rose-700 px-1.5 text-xs font-bold">BOSS</span>}
      <span className="ml-2 text-xs text-slate-400">/ {MAX_FLOOR}F</span>
    </div>
  );
}

const NODE_TITLE = { battle: "전투", elite: "엘리트 전투", gate: "관문 전투" } as const;

function ResultOverlay({ battle }: { battle: BattleState }) {
  const { openSummon, backToMap, goTo } = useGame.getState();
  const run = useGame((s) => s.run);
  const report = useGame((s) => s.report);
  if (!run || !report) return null;
  const win = battle.outcome === "win";
  const cleared = run.status === "cleared";
  const failed = run.status === "failed";
  const kind = report.nodeKind as keyof typeof NODE_TITLE;
  const bossWin = win && report.floorCleared && getFloor(report.floor).kind === "boss";

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 p-4">
      <div className="system-panel w-full max-w-md p-6 text-center">
        <p className="text-xs tracking-widest text-cyan-300">[ SYSTEM ]</p>
        <h2 className={`mt-2 text-2xl font-bold ${win ? "text-emerald-300" : "text-rose-400"}`}>
          {cleared
            ? "탑 정복!"
            : failed
              ? `${report.floor}층에서 파티 전멸`
              : report.floorCleared
                ? `${report.floor}층 ${bossWin ? "보스 격파" : "돌파"}!`
                : `${NODE_TITLE[kind] ?? "전투"} 승리`}
        </h2>
        <p className="mt-1 text-sm text-slate-400">이번 전투 {battle.turnCount}턴</p>

        {win && (
          <div className="mt-4 space-y-1 text-left text-sm">
            <p>
              경험치 <span className="font-semibold text-cyan-200">+{report.xpGained}</span>
              <span className="text-xs text-slate-500"> (쓰러진 동료 제외)</span> · 골드{" "}
              <span className="font-semibold text-amber-300">+{report.goldGained}</span>
            </p>
            {report.levelUps.map((l) => (
              <p key={l.defId} className="text-emerald-300">
                ▲ {getUnitDef(l.defId).name} 레벨 업! Lv.{l.from} → Lv.{l.to}
              </p>
            ))}
            {report.revived.length > 0 && (
              <p className="text-amber-300">
                {report.revived.map((id) => getUnitDef(id).name).join(", ")}: 다음 전투에서 HP 50%로 복귀
              </p>
            )}
            {report.floorCleared && !cleared && (
              <p className="text-xs text-slate-400">
                {run.floor}층 &apos;{getFloor(run.floor).name}&apos;(으)로 올라갑니다. 살아있는 동료 HP{" "}
                {Run.RUN_RULES.floorHealRatio * 100}% 회복
              </p>
            )}
          </div>
        )}

        {(cleared || failed) && (
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded bg-slate-800 p-2">
              <dt className="text-xs text-slate-400">점수</dt>
              <dd className="text-lg font-bold text-cyan-200">{Run.runScore(run).toLocaleString()}</dd>
            </div>
            <div className="rounded bg-slate-800 p-2">
              <dt className="text-xs text-slate-400">돌파한 층</dt>
              <dd className="text-lg font-bold">{Run.floorsCleared(run)}</dd>
            </div>
            <div className="rounded bg-slate-800 p-2">
              <dt className="text-xs text-slate-400">총 턴</dt>
              <dd className="text-lg font-bold">{run.totalTurns}</dd>
            </div>
          </dl>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {!cleared && !failed && (
            <button type="button" className="btn" onClick={backToMap}>
              {report.floorCleared ? `${run.floor}층 지도로` : "지도로 돌아가기"}
            </button>
          )}
          {(cleared || failed) && (
            <>
              <button type="button" className="btn" onClick={openSummon}>
                새 파티 소환하기
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => goTo("title")}>
                타이틀로
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
