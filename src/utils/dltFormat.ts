import type { TsMode } from "../types/logView";

export type { TsMode };

export const TS_MODES: TsMode[] = ["abs", "rel", "us"];
export const TS_LABELS: Record<TsMode, string> = { abs: "ABS", rel: "REL", us: "μs" };

export function formatTs(
  us: number | null,
  mode: TsMode,
  baseUs: number | null
): string {
  if (us == null) return "—";
  if (mode === "us") return us.toFixed(0);
  if (mode === "rel") {
    const rel = (us - (baseUs ?? us)) / 1_000_000;
    return `+${rel.toFixed(3)}s`;
  }
  const totalSec = Math.floor(us / 1_000_000);
  const ms = Math.floor((us % 1_000_000) / 1000);
  const h = Math.floor(totalSec / 3_600).toString().padStart(2, "0");
  const m = Math.floor((totalSec % 3_600) / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}.${ms.toString().padStart(3, "0")}`;
}

export function levelClass(level: string): string {
  switch (level) {
    case "FATAL":
      return "text-red-500";
    case "ERROR":
      return "text-red-400";
    case "WARN":
      return "text-amber-400";
    case "INFO":
      return "text-green-400";
    case "DEBUG":
      return "text-sky-400";
    case "VERBOSE":
      return "text-neutral-400";
    default:
      return "text-neutral-400";
  }
}
