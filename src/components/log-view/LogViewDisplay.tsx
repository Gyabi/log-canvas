import { useState } from "react";
import type { useLogView } from "./useLogView";
import type { TsMode } from "./useLogView";
import type { DltRow } from "../../bindings";
import type { MarkColor } from "../../types";

// Re-export for consumers that import display types from this file.
export type { MarkColor };

const MARK_BG: Record<MarkColor, string> = {
  red: "bg-red-900/50",
  yellow: "bg-amber-900/50",
  green: "bg-green-900/50",
  blue: "bg-blue-900/50",
  purple: "bg-purple-900/50",
};

const TS_MODES: TsMode[] = ["abs", "rel", "us"];
const TS_LABELS: Record<TsMode, string> = { abs: "ABS", rel: "REL", us: "μs" };

type Props = ReturnType<typeof useLogView> & {
  emptyMessage: string;
  marks?: ReadonlyMap<number, MarkColor>;
  onRowDoubleClick?: (rowIndex: number) => void;
};

export default function LogViewDisplay({
  virtualizer,
  scrollRef,
  rowCache,
  firstTimestampUs,
  rowCount,
  tsMode,
  setTsMode,
  selectedRows,
  toggleSelect,
  clearSelection,
  scrollToIndex,
  emptyMessage,
  marks,
  onRowDoubleClick,
}: Props) {
  const [jumpInputVisible, setJumpInputVisible] = useState(false);
  const [jumpValue, setJumpValue] = useState("");

  const virtualItems = virtualizer.getVirtualItems();

  function cycleTsMode() {
    const idx = TS_MODES.indexOf(tsMode);
    setTsMode(TS_MODES[(idx + 1) % TS_MODES.length]);
  }

  function handleRowClick(e: React.MouseEvent, index: number) {
    toggleSelect(index, e.shiftKey, e.ctrlKey || e.metaKey);
  }

  function copySelected() {
    const rows = [...selectedRows]
      .sort((a, b) => a - b)
      .map((i) => rowCache.get(i))
      .filter((r): r is DltRow => r !== undefined);

    const text = rows
      .map((r) =>
        [
          r.index,
          formatTs(r.timestampUs, tsMode, firstTimestampUs),
          r.ecuId,
          r.appId,
          r.ctxId,
          r.level,
          r.payload,
        ].join("\t")
      )
      .join("\n");

    navigator.clipboard.writeText(text).catch(() => undefined);
  }

  function handleJumpKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const n = parseInt(jumpValue, 10);
      // User enters 1-based row number; scrollToIndex is 0-based.
      if (!Number.isNaN(n)) scrollToIndex(n - 1);
      setJumpInputVisible(false);
      setJumpValue("");
    } else if (e.key === "Escape") {
      setJumpInputVisible(false);
      setJumpValue("");
    }
  }

  return (
    <>
      {/* Column headers */}
      <div className="nodrag shrink-0 flex items-center border-b border-neutral-700 bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-500 select-none">
        <span className="w-10 shrink-0">#</span>
        <button
          onClick={cycleTsMode}
          className="nodrag w-28 shrink-0 text-left hover:text-neutral-300"
        >
          {`Timestamp [${TS_LABELS[tsMode]}]`}
        </button>
        <span className="w-12 shrink-0">ECU</span>
        <span className="w-12 shrink-0">App</span>
        <span className="w-12 shrink-0">Ctx</span>
        <span className="w-16 shrink-0">Level</span>
        <span className="flex-1">Message</span>
      </div>

      {/* Scrollable body */}
      <div
        ref={scrollRef}
        className="nodrag nowheel flex-1 overflow-y-auto"
        onClick={clearSelection}
      >
        {rowCount > 0 ? (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualItems.map((item) => {
              const row = rowCache.get(item.index);
              const isSelected = selectedRows.has(item.index);
              const markColor = marks?.get(item.index);
              const bgClass = isSelected
                ? "bg-blue-900/40"
                : markColor
                  ? MARK_BG[markColor]
                  : "";

              return (
                <div
                  key={item.key}
                  style={{
                    position: "absolute",
                    top: item.start,
                    left: 0,
                    right: 0,
                    height: item.size,
                  }}
                  className={`flex items-center border-b border-neutral-800 px-2 font-mono text-xs hover:bg-neutral-800 cursor-pointer ${bgClass}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRowClick(e, item.index);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onRowDoubleClick?.(item.index);
                  }}
                >
                  {row ? (
                    <>
                      <span className="w-10 shrink-0 text-neutral-500">
                        {row.index}
                      </span>
                      <span className="w-28 shrink-0 text-neutral-400">
                        {formatTs(row.timestampUs, tsMode, firstTimestampUs)}
                      </span>
                      <span className="w-12 shrink-0 text-sky-400">
                        {row.ecuId}
                      </span>
                      <span className="w-12 shrink-0 text-emerald-400">
                        {row.appId}
                      </span>
                      <span className="w-12 shrink-0 text-amber-400">
                        {row.ctxId}
                      </span>
                      <span
                        className={`w-16 shrink-0 font-semibold ${levelClass(row.level)}`}
                      >
                        {row.level}
                      </span>
                      <span className="flex-1 truncate text-neutral-200">
                        {row.payload}
                      </span>
                    </>
                  ) : (
                    <span className="italic text-neutral-600">…</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="nodrag shrink-0 flex items-center justify-between border-t border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-500">
        <span>
          {selectedRows.size > 0 && (
            <button
              onClick={copySelected}
              className="rounded bg-neutral-600 px-2 py-0.5 text-neutral-200 hover:bg-neutral-500"
            >
              {`copy (${selectedRows.size})`}
            </button>
          )}
        </span>
        {jumpInputVisible ? (
          <input
            autoFocus
            type="number"
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            onKeyDown={handleJumpKeyDown}
            onBlur={() => {
              setJumpInputVisible(false);
              setJumpValue("");
            }}
            className="w-24 rounded bg-neutral-700 px-1 text-right text-neutral-200"
            placeholder="row index"
          />
        ) : (
          <button
            onClick={() => setJumpInputVisible(true)}
            className="hover:text-neutral-300"
          >
            {rowCount.toLocaleString()} rows
          </button>
        )}
      </div>
    </>
  );
}

function formatTs(
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
  const h = Math.floor(totalSec / 3_600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSec % 3_600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}.${ms.toString().padStart(3, "0")}`;
}

function levelClass(level: string): string {
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
