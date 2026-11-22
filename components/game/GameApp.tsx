"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { COMPANIONS, PARTY_SIZE } from "@/data/companions";
import { ENEMIES } from "@/data/enemies";
import { getTier, TIER_ORDER, TIER_RUNS, TIER_STYLE, type Tier } from "@/data/tiers";
import { GACHA_RULES, tierOf } from "@/lib/engine/gacha";
import type { Element } from "@/lib/engine/types";
import { useGame } from "@/lib/store/game";
import { hasSave, subscribeSave } from "@/lib/store/save";
import { ELEMENT_ICON, elementLabel } from "@/lib/ui/labels";
import { BattleScreen } from "./BattleScreen";
import { MapScreen } from "./MapScreen";
import { UnitInfo } from "./common";
import { AccountPanel, RankingScreen } from "./Cloud";
import { initCloud } from "@/lib/supabase/cloud";

export function GameApp() {
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    void initCloud();
  }, []);
  if (screen === "summon") return <SummonScreen />;
  if (screen === "ranking") return <RankingScreen />;
  if (screen === "codex") return <CodexScreen />;
  if (screen === "map") return <MapScreen />;
  if (screen === "battle") return <BattleScreen />;
  return <TitleScreen />;
}

function TitleScreen() {
  const { goTo, continueRun, openSummon } = useGame.getState();
  const saved = useSyncExternalStore(subscribeSave, hasSave, () => false);
  const newRun = () => {
    if (saved && !window.confirm("저장된 런이 있습니다. 새 런을 시작하면 저장이 사라집니다. 계속할까요?")) return;
    openSummon();
  };
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <p className="text-xs tracking-[0.4em] text-cyan-300">[ SYSTEM ] 탑이 출현했습니다</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">탑 등반 RPG</h1>
        <p className="mt-3 text-sm text-slate-400">가제 · 프로토타입 · 1~10층 · 진행 상황은 자동 저장됩니다</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {saved && (
          <button type="button" className="btn" onClick={() => continueRun()}>
            이어하기
          </button>
        )}
        <button type="button" className={saved ? "btn btn-ghost" : "btn"} onClick={newRun}>
          새 런 시작 (파티 소환)
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => goTo("codex")}>
          캐릭터 도감
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => goTo("ranking")}>
          랭킹
        </button>
      </div>
      <AccountPanel />
    </main>
  );
}

// ---- 소환 (가챠) ----

const TIER_GLOW: Record<Tier, string> = {
  S: "border-amber-300 shadow-[0_0_28px_rgba(252,211,77,0.55)]",
  A: "border-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.45)]",
  B: "border-sky-500/70",
  C: "border-slate-600",
};

function SummonScreen() {
  const summon = useGame((s) => s.summon);
  const summonCount = useGame((s) => s.summonCount);
  const { pullParty, startRun, goTo } = useGame.getState();
  if (!summon) return null;
  const party = summon.party;
  const canReroll = !!party && summon.rerollsLeft > 0;
  const best = party
    ? [...party].sort((a, b) => TIER_ORDER.indexOf(tierOf(a)) - TIER_ORDER.indexOf(tierOf(b)))[0]
    : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-cyan-300">[ SYSTEM ] 각성자 소환 의식</p>
          <h1 className="text-2xl font-bold">파티 소환</h1>
          <p className="mt-1 text-sm text-slate-400">
            {COMPANIONS.length}명의 각성자 중 {PARTY_SIZE}명이 응답합니다. 4연 소환마다 A랭크 이상 1명 확정, 중복
            없음. 재소환은 {GACHA_RULES.rerolls}번까지.
          </p>
        </div>
        <button type="button" className="btn-sm" onClick={() => goTo("title")}>
          뒤로
        </button>
      </div>

      <div className="system-panel flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs">
        <span className="text-slate-400">소환 확률</span>
        {TIER_ORDER.map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className={`grid h-5 w-5 place-items-center rounded text-[11px] font-black ${TIER_STYLE[t]}`}>{t}</span>
            {Math.round(GACHA_RULES.rates[t] * 100)}%
          </span>
        ))}
        <span className="text-slate-500">
          · 1층 출현 적: {ENEMIES.map((e) => `${ELEMENT_ICON[e.element]}${e.name}`).join(" ")}
        </span>
      </div>

      {!party ? (
        <div className="grid flex-1 place-items-center py-10">
          <button type="button" onClick={pullParty} className="btn animate-shine px-10 py-5 text-xl">
            ✦ 4연 소환 ✦
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {party.map((id, i) => {
            const def = COMPANIONS.find((c) => c.id === id)!;
            const tier = tierOf(id);
            return (
              <div
                key={`${summonCount}-${id}`}
                className={`system-panel relative flex animate-reveal flex-col gap-3 border-2 p-3 ${TIER_GLOW[tier]}`}
                style={{ animationDelay: `${i * 450}ms` }}
              >
                <div
                  className={`-mx-3 -mt-3 rounded-t-md py-1 text-center text-sm font-black tracking-widest ${TIER_STYLE[tier]} ${tier === "S" ? "animate-shine" : ""}`}
                >
                  {tier} RANK
                </div>
                <UnitInfo def={def} />
              </div>
            );
          })}
        </div>
      )}

      {party && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-cyan-500/30 bg-slate-950/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            {best && (
              <span className="text-sm text-slate-300">
                최고 랭크: <span className="font-bold">{tierOf(best)}</span>{" "}
                {COMPANIONS.find((c) => c.id === best)!.name}
              </span>
            )}
            <button type="button" className="btn btn-ghost ml-auto" disabled={!canReroll} onClick={pullParty}>
              재소환 ({summon.rerollsLeft}회 남음)
            </button>
            <button type="button" className="btn" onClick={() => startRun()}>
              이 파티로 등반 시작
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ---- 도감 ----

const ELEMENTS: Element[] = ["fire", "ice", "earth", "light", "dark"];

function CodexScreen() {
  const [filter, setFilter] = useState<Element | "all">("all");
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");
  const goTo = useGame((s) => s.goTo);
  const shown = COMPANIONS.filter(
    (c) => (filter === "all" || c.element === filter) && (tierFilter === "all" || getTier(c.id)?.tier === tierFilter),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-widest text-cyan-300">[ SYSTEM ] 각성자 기록</p>
          <h1 className="text-2xl font-bold">캐릭터 도감</h1>
          <p className="mt-1 text-sm text-slate-400">
            소환될 수 있는 {COMPANIONS.length}명. 랭크는 자동 플레이 {TIER_RUNS}회 클리어율 기준입니다.
          </p>
        </div>
        <button type="button" className="btn-sm" onClick={() => goTo("title")}>
          뒤로
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", ...ELEMENTS] as const).map((e) => (
          <button key={e} type="button" onClick={() => setFilter(e)} className={`btn-sm ${filter === e ? "btn-on" : ""}`}>
            {e === "all" ? "전체" : elementLabel(e)} (
            {e === "all" ? COMPANIONS.length : COMPANIONS.filter((c) => c.element === e).length})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">랭크</span>
        {(["all", ...TIER_ORDER] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTierFilter(t)}
            className={`btn-sm ${tierFilter === t ? "btn-on" : ""}`}
          >
            {t === "all" ? "전체" : `${t} (${COMPANIONS.filter((c) => getTier(c.id)?.tier === t).length})`}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((c) => (
          <div key={c.id} className="system-panel flex flex-col gap-3 p-3">
            <UnitInfo def={c} />
          </div>
        ))}
      </div>
    </main>
  );
}
