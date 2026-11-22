"use client";

import type { UnitDef } from "@/lib/engine/types";
import { getTier, TIER_RUNS, TIER_STYLE } from "@/data/tiers";
import { describePassive, ELEMENT_BG, ELEMENT_ICON, elementLabel } from "@/lib/ui/labels";

/** 동료 랭크 배지 (랭크 정보가 없으면 표시 안 함) */
export function TierBadge({ id }: { id: string }) {
  const t = getTier(id);
  if (!t) return null;
  return (
    <span
      title={`자동 플레이 ${TIER_RUNS}회 클리어율 ${Math.round(t.clearRate * 100)}% · 평균 ${t.avgFloors}층`}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm font-black ${TIER_STYLE[t.tier]}`}
    >
      {t.tier}
    </span>
  );
}

export function Portrait({ def, size = "md" }: { def: UnitDef; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-10 w-10 text-lg" : "h-14 w-14 text-2xl";
  return (
    <div
      className={`relative grid shrink-0 place-items-center rounded-md bg-gradient-to-br ${ELEMENT_BG[def.element]} ${cls} font-black text-slate-950`}
    >
      {def.name[0]}
      <span className="absolute -right-1 -top-1 text-xs">{ELEMENT_ICON[def.element]}</span>
    </div>
  );
}

/** 직업·동료 공용 정보 카드 */
export function UnitInfo({ def }: { def: UnitDef }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Portrait def={def} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold">{def.name}</div>
          <div className="text-xs text-slate-400">
            {elementLabel(def.element)} · {def.role}
          </div>
        </div>
        <TierBadge id={def.id} />
      </div>
      <dl className="grid grid-cols-4 gap-1 text-center text-[11px]">
        {(
          [
            ["HP", def.base.hp],
            ["공격", def.base.atk],
            ["방어", def.base.def],
            ["속도", def.base.spd],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded bg-slate-800 py-1">
            <dt className="text-slate-400">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-col gap-1.5 text-xs">
        {def.skills.map((sk, i) => (
          <li key={sk.id}>
            <span className="font-semibold text-cyan-200">
              S{i + 1} {sk.name}
            </span>
            {sk.cooldown > 0 && <span className="text-slate-500"> · 쿨 {sk.cooldown}</span>}
            <div className="text-slate-400">{sk.description}</div>
          </li>
        ))}
        {def.passives?.map((p, i) => (
          <li key={i} className="text-violet-300">
            패시브 · {describePassive(p)}
          </li>
        ))}
      </ul>
    </>
  );
}
