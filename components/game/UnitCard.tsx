"use client";

import type { BattleUnit } from "@/lib/engine/types";
import type { ElementMod } from "@/lib/engine/elements";
import { ELEMENT_BG, ELEMENT_ICON, STATUS_LABEL, statusTone } from "@/lib/ui/labels";
import type { Popup } from "@/lib/store/game";

interface Props {
  unit: BattleUnit;
  active: boolean;
  /** 클릭해서 대상으로 고를 수 있음 */
  targetable: boolean;
  /** 선택한 스킬의 효과 범위에 포함됨 (광역 등) */
  affected: boolean;
  preview: string | null;
  matchup: ElementMod | null;
  popups: Popup[];
  onClick?: () => void;
}

const POPUP_STYLE: Record<Popup["kind"], string> = {
  damage: "text-white text-xl",
  crit: "text-yellow-300 text-2xl",
  heal: "text-emerald-300 text-xl",
  dot: "text-fuchsia-300 text-lg",
  status: "text-sky-200 text-xs",
  resist: "text-slate-300 text-xs",
};

export function UnitCard({ unit, active, targetable, affected, preview, matchup, popups, onClick }: Props) {
  const hpPct = (unit.hp / unit.stats.hp) * 100;
  const shieldPct = Math.min(100, (unit.shield / unit.stats.hp) * 100);
  const hit = popups.some((p) => p.kind === "damage" || p.kind === "crit" || p.kind === "dot");

  return (
    <button
      type="button"
      onClick={targetable ? onClick : undefined}
      disabled={!targetable}
      className={[
        "relative flex w-full items-center gap-3 rounded-lg border bg-slate-900/80 p-2 text-left transition",
        active ? "border-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.45)]" : "border-slate-700",
        targetable ? "cursor-pointer ring-2 ring-rose-400/70 hover:ring-rose-300" : "cursor-default",
        affected && !targetable ? "ring-2 ring-amber-300/60" : "",
        !unit.alive ? "opacity-40 grayscale" : "",
        hit ? "animate-hit" : "",
      ].join(" ")}
    >
      {/* 임시 초상화 */}
      <div
        className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-md bg-gradient-to-br ${ELEMENT_BG[unit.element]} text-2xl font-bold text-slate-950`}
      >
        {unit.name[0]}
        <span className="absolute -right-1 -top-1 text-sm">{ELEMENT_ICON[unit.element]}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold">
            {unit.name} <span className="text-xs text-slate-400">Lv.{unit.level}</span>
          </span>
          {matchup === "advantage" && <span className="text-[10px] font-bold text-emerald-300">▲유리</span>}
          {matchup === "disadvantage" && <span className="text-[10px] font-bold text-rose-300">▼불리</span>}
        </div>

        {/* HP + 보호막 */}
        <div className="relative mt-1 h-2.5 overflow-hidden rounded bg-slate-700">
          <div
            className={`h-full transition-all duration-300 ${hpPct > 50 ? "bg-emerald-400" : hpPct > 25 ? "bg-amber-400" : "bg-rose-500"}`}
            style={{ width: `${hpPct}%` }}
          />
          {shieldPct > 0 && (
            <div className="absolute inset-y-0 left-0 bg-white/60" style={{ width: `${shieldPct}%` }} />
          )}
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
          <span>
            {unit.hp} / {unit.stats.hp}
            {unit.shield > 0 && <span className="text-white"> (+{unit.shield})</span>}
          </span>
          <span>SPD {unit.stats.spd}</span>
        </div>

        {/* 턴 게이지 */}
        <div className="mt-1 h-1 overflow-hidden rounded bg-slate-800">
          <div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${unit.gauge * 100}%` }} />
        </div>

        {/* 상태 효과 */}
        <div className="mt-1 flex min-h-4 flex-wrap gap-1">
          {unit.statuses.map((st, i) => (
            <span
              key={`${st.id}-${i}`}
              className={`rounded px-1 text-[10px] leading-4 ${statusTone(st.id) === "buff" ? "bg-emerald-800 text-emerald-100" : "bg-rose-900 text-rose-100"}`}
            >
              {STATUS_LABEL[st.id]} {st.turns}
            </span>
          ))}
        </div>
      </div>

      {preview && (
        <span className="absolute -top-2 right-2 rounded bg-rose-600 px-1.5 text-[10px] font-bold">
          예상 {preview}
        </span>
      )}

      {/* 떠오르는 숫자 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center">
        {popups.map((p, i) => (
          <span
            key={p.id}
            className={`animate-float font-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] ${POPUP_STYLE[p.kind]}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {p.text}
          </span>
        ))}
      </div>
    </button>
  );
}
