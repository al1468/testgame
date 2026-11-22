import type { UnitDef } from "@/lib/engine/types";
import { JOBS } from "./jobs";
import { COMPANIONS } from "./companions";
import { ALL_ENEMIES } from "./enemies";

const REGISTRY = new Map<string, UnitDef>([...JOBS, ...COMPANIONS, ...ALL_ENEMIES].map((d) => [d.id, d]));

export function getUnitDef(id: string): UnitDef {
  const d = REGISTRY.get(id);
  if (!d) throw new Error(`unknown unit def ${id}`);
  return d;
}
