"use client";

import { useState } from "react";
import { getUnitDef } from "@/data";
import { PARTY_SIZE } from "@/data/companions";
import { getEvent } from "@/data/events";
import { getFloor, MAX_FLOOR } from "@/data/floors";
import { getRelic } from "@/data/relics";
import type { MapNode, NodeKind } from "@/lib/engine/map";
import * as Run from "@/lib/engine/run";
import type { RunState } from "@/lib/engine/run";
import { useGame } from "@/lib/store/game";
import { Portrait, UnitInfo } from "./common";

const NODE_ICON: Record<NodeKind, string> = {
  battle: "⚔️",
  elite: "💀",
  recruit: "🤝",
  rest: "🏕️",
  shop: "🛒",
  event: "❓",
  gate: "🚪",
};

const NODE_NAME: Record<NodeKind, string> = {
  battle: "전투",
  elite: "엘리트",
  recruit: "영입",
  rest: "휴식",
  shop: "상점",
  event: "이벤트",
  gate: "관문",
};

export function MapScreen() {
  const run = useGame((s) => s.run);
  if (!run) return null;
  return <MapView run={run} />;
}

function MapView({ run }: { run: RunState }) {
  const { goTo, abandonRun } = useGame.getState();
  const notice = useGame((s) => s.notice);
  const floor = getFloor(run.floor);
  const node = Run.currentNode(run);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-center gap-2">
        <div className="system-panel px-3 py-1.5 text-sm">
          <span className="text-cyan-300">{floor.floor}F</span> {floor.name}
          {floor.kind === "boss" && <span className="ml-2 rounded bg-rose-700 px-1.5 text-xs font-bold">BOSS</span>}
          <span className="ml-2 text-xs text-slate-400">/ {MAX_FLOOR}F</span>
        </div>
        <div className="system-panel px-3 py-1.5 text-sm">
          💰 <span className="font-semibold text-amber-300">{run.gold}</span> G
        </div>
        <div className="flex flex-1 flex-wrap gap-1">
          {run.relics.map((id) => {
            const r = getRelic(id);
            return (
              <span key={id} title={r.description} className="rounded border border-violet-500/50 bg-violet-950/60 px-2 py-1 text-xs">
                🔮 {r.name}
              </span>
            );
          })}
        </div>
        <button type="button" className="btn-sm" onClick={() => goTo("title")} title="자동 저장됨">
          타이틀로
        </button>
        <button
          type="button"
          className="btn-sm hover:border-rose-400"
          onClick={() => window.confirm("이번 런을 포기할까요? 저장도 삭제됩니다.") && abandonRun()}
        >
          포기
        </button>
      </header>

      <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
        <section className="system-panel p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>입구 → 관문</span>
            <span>{Object.entries(NODE_ICON).map(([k, v]) => `${v}${NODE_NAME[k as NodeKind]}`).join("  ")}</span>
          </div>
          <MapGraph run={run} />
        </section>
        <PartyPanel run={run} />
      </div>

      <section className="system-panel p-4">
        {notice && <p className="mb-2 text-sm text-rose-300">{notice}</p>}
        {node && !run.nodeDone ? (
          <NodePanel run={run} node={node} />
        ) : (
          <div className="text-sm">
            {run.eventText && <p className="mb-2 text-cyan-100">{run.eventText}</p>}
            <p className="text-slate-300">
              {run.position === null ? `[시스템] ${floor.floor}층에 들어섰습니다. ` : ""}
              다음으로 갈 곳을 지도에서 고르세요. <span className="text-slate-500">(빛나는 노드)</span>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

// ---- 지도 그래프 (SVG) ----

const W = 400;
const H = 230;

function nodePos(map: RunState["map"], n: MapNode) {
  const inRow = map.nodes.filter((x) => x.row === n.row).length;
  const x = 32 + (n.row * (W - 64)) / (map.rows - 1);
  const y = ((n.col + 1) * H) / (inRow + 1);
  return { x, y };
}

function MapGraph({ run }: { run: RunState }) {
  const selectNode = useGame((s) => s.selectNode);
  const reachable = Run.reachableNodeIds(run);
  const { map } = run;
  const bossFloor = getFloor(run.floor).kind === "boss";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="층 지도">
      {map.nodes.flatMap((n) =>
        n.next.map((id) => {
          const a = nodePos(map, n);
          const b = nodePos(map, map.nodes.find((x) => x.id === id)!);
          const walked = run.visited.includes(n.id) && run.visited.includes(id);
          return (
            <line
              key={`${n.id}-${id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={walked ? "#67e8f9" : "#334155"}
              strokeWidth={walked ? 3 : 2}
              strokeDasharray={walked ? undefined : "4 4"}
            />
          );
        }),
      )}
      {map.nodes.map((n) => {
        const { x, y } = nodePos(map, n);
        const canGo = reachable.includes(n.id);
        const current = run.position === n.id;
        const visited = run.visited.includes(n.id);
        const icon = n.kind === "gate" && bossFloor ? "👑" : NODE_ICON[n.kind];
        const r = n.kind === "gate" ? 22 : 17;
        return (
          <g
            key={n.id}
            onClick={canGo ? () => selectNode(n.id) : undefined}
            className={canGo ? "cursor-pointer" : ""}
            role={canGo ? "button" : undefined}
            aria-label={canGo ? `${NODE_NAME[n.kind]}로 이동` : undefined}
          >
            <title>{n.kind === "gate" && bossFloor ? "보스" : NODE_NAME[n.kind]}</title>
            {canGo && <circle cx={x} cy={y} r={r + 6} fill="none" stroke="#22d3ee" strokeWidth={2} className="animate-pulse" />}
            <circle
              cx={x}
              cy={y}
              r={r}
              fill={current ? "#0e7490" : visited ? "#1e293b" : "#0f172a"}
              stroke={current ? "#fde047" : canGo ? "#67e8f9" : n.kind === "gate" ? "#f43f5e" : "#475569"}
              strokeWidth={current ? 3 : 2}
              opacity={!canGo && !visited && !current && reachable.length > 0 ? 0.55 : 1}
            />
            <text x={x} y={y + 6} textAnchor="middle" fontSize={n.kind === "gate" ? 20 : 16}>
              {icon}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- 파티 ----

function PartyPanel({ run }: { run: RunState }) {
  return (
    <section className="system-panel flex flex-col gap-2 p-3">
      <h2 className="text-xs font-semibold tracking-widest text-cyan-300">
        상태창 · 파티 {run.members.length}/{PARTY_SIZE}
      </h2>
      {run.members.map((m, i) => {
        const def = getUnitDef(m.defId);
        const max = Run.maxHpOf(m);
        const down = m.hp <= 0;
        const need = Run.RUN_RULES.xpToNext(m.level);
        return (
          <div key={`${m.defId}-${i}`} className={`flex items-center gap-2 ${down ? "opacity-60" : ""}`}>
            <Portrait def={def} size="sm" />
            <div className="min-w-0 flex-1 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold">
                  {def.name}
                </span>
                <span className="text-slate-400">Lv.{m.level}</span>
              </div>
              <div className="mt-0.5 h-2 overflow-hidden rounded bg-slate-700">
                <div
                  className={`h-full ${m.hp / max > 0.5 ? "bg-emerald-400" : m.hp / max > 0.25 ? "bg-amber-400" : "bg-rose-500"}`}
                  style={{ width: `${(m.hp / max) * 100}%` }}
                />
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
                <span>{down ? "쓰러짐 · 다음 전투에서 HP 50%로 복귀" : `HP ${m.hp} / ${max}`}</span>
                <span>
                  EXP {m.xp}/{need}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---- 노드별 패널 ----

function NodePanel({ run, node }: { run: RunState; node: MapNode }) {
  switch (node.kind) {
    case "rest":
      return <RestPanel run={run} />;
    case "shop":
      return <ShopPanel run={run} />;
    case "recruit":
      return <RecruitPanel run={run} />;
    case "event":
      return <EventPanel run={run} />;
    default:
      return null;
  }
}

function RestPanel({ run }: { run: RunState }) {
  const { restHeal, restTrain } = useGame.getState();
  return (
    <div>
      <h3 className="text-lg font-bold">🏕️ 휴식처</h3>
      <p className="mt-1 text-sm text-slate-400">잠시 숨을 돌릴 수 있는 안전지대다. 하나만 고를 수 있다.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <button type="button" className="btn text-left" onClick={restHeal}>
          휴식
          <div className="text-xs font-normal text-cyan-100/80">
            살아있는 파티원 HP {Run.RUN_RULES.restHealRatio * 100}% 회복, 쓰러진 파티원은 HP 50%로 복귀
          </div>
        </button>
        <div className="rounded-md border border-slate-600 p-2">
          <div className="text-sm font-semibold">특훈 (파티원 1명 레벨 +1)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {run.members.map((m, i) => (
              <button key={`${m.defId}-${i}`} type="button" className="btn-sm" onClick={() => restTrain(i)}>
                {getUnitDef(m.defId).name} Lv.{m.level}→{m.level + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShopPanel({ run }: { run: RunState }) {
  const { buyOffer, leaveNode } = useGame.getState();
  const offers = Run.shopOffers(run);
  const bought = run.shopBought[run.position!] ?? [];
  return (
    <div>
      <h3 className="text-lg font-bold">🛒 각성자 상점</h3>
      <p className="mt-1 text-sm text-slate-400">&quot;골드만 있으면 뭐든지 팝니다.&quot;</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {offers.map((o, i) => {
          const done = bought.includes(i);
          return (
            <div key={i} className="flex flex-col justify-between rounded-md border border-slate-600 bg-slate-900 p-3">
              <div>
                <div className="font-semibold">
                  {o.kind === "relic" ? "🔮 " : ""}
                  {o.name}
                </div>
                <div className="text-xs text-slate-400">{o.description}</div>
              </div>
              <button
                type="button"
                className="btn-sm mt-2"
                disabled={done || run.gold < o.price}
                onClick={() => buyOffer(i)}
              >
                {done ? "구매 완료" : `💰 ${o.price} G`}
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-ghost mt-3" onClick={leaveNode}>
        상점 떠나기
      </button>
    </div>
  );
}

function RecruitPanel({ run }: { run: RunState }) {
  const { recruit, leaveNode } = useGame.getState();
  const [pending, setPending] = useState<string | null>(null);
  const candidates = Run.recruitCandidates(run);
  const full = run.members.length >= PARTY_SIZE;
  const level = Run.recruitLevel(run);

  return (
    <div>
      <h3 className="text-lg font-bold">🤝 각성자와의 만남</h3>
      <p className="mt-1 text-sm text-slate-400">
        동료가 되어 줄 각성자들이다. (합류 레벨 Lv.{level}){full && " 파티가 가득 차 있어 기존 동료와 교체해야 한다."}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {candidates.map((c) => (
          <div key={c.id} className={`system-panel flex flex-col gap-2 p-3 ${pending === c.id ? "border-cyan-300" : ""}`}>
            <UnitInfo def={c} />
            <button
              type="button"
              className="btn-sm btn-on mt-auto"
              onClick={() => (full ? setPending(c.id) : recruit(c.id))}
            >
              {full ? "교체할 동료 고르기" : "영입"}
            </button>
          </div>
        ))}
        {candidates.length === 0 && <p className="text-sm text-slate-400">만날 수 있는 각성자가 없다.</p>}
      </div>
      {pending && (
        <div className="mt-3 rounded-md border border-cyan-500/40 p-3 text-sm">
          <p>{getUnitDef(pending).name}와(과) 교체할 동료를 고르세요.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {run.members.map((m, i) => (
              <button key={`${m.defId}-${i}`} type="button" className="btn-sm" onClick={() => recruit(pending, i)}>
                {getUnitDef(m.defId).name} Lv.{m.level} 내보내기
              </button>
            ))}
            <button type="button" className="btn-sm" onClick={() => setPending(null)}>
              취소
            </button>
          </div>
        </div>
      )}
      <button type="button" className="btn btn-ghost mt-3" onClick={leaveNode}>
        영입하지 않고 지나가기
      </button>
    </div>
  );
}

function EventPanel({ run }: { run: RunState }) {
  const chooseEvent = useGame((s) => s.chooseEvent);
  const ev = getEvent(Run.nodeEvent(run).id);
  return (
    <div>
      <p className="text-xs tracking-widest text-cyan-300">[ EVENT ]</p>
      <h3 className="text-lg font-bold">❓ {ev.title}</h3>
      <p className="mt-2 text-sm text-slate-200">{ev.text}</p>
      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        {ev.choices.map((c, i) => (
          <button
            key={i}
            type="button"
            className="btn btn-ghost text-left text-sm"
            disabled={!!c.requiresGold && run.gold < c.requiresGold}
            onClick={() => chooseEvent(i)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
