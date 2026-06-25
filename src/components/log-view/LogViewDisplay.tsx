import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import type { useLogView } from "./useLogView";
import type { DltRow } from "../../bindings";
import { MARK_BG } from "../../utils/constraint";
import type { MarkColor } from "../../utils/constraint";
import {
  TS_MODES,
  TS_LABELS,
  formatTs,
  levelClass,
} from "../../utils/dltFormat";
import type { TsMode } from "../../types/logView";

const ROW_HEIGHT = 28;

type Props = ReturnType<typeof useLogView> & {
  emptyMessage: string;
  marks?: ReadonlyMap<number, MarkColor>;
  onRowDoubleClick?: (rowIndex: number) => void;
  /** If provided, a selection handle appears when rows are selected or the handle is connected. */
  selectionHandleId?: string;
  hasSelectionConnection?: boolean;
  /** Node id — required when selectionHandleId is set so updateNodeInternals can re-register the dynamic handle. */
  nodeId?: string;
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
  selectionHandleId,
  hasSelectionConnection = false,
  nodeId,
}: Props) {
  const updateNodeInternals = useUpdateNodeInternals();

  const [jumpInputVisible, setJumpInputVisible] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(30);
  const [scrollContainerHeight, setScrollContainerHeight] = useState(200);
  // Distance from this wrapper to the React Flow node root (no position:relative here,
  // so Handle's position:absolute propagates to .react-flow__node via offsetParent chain).
  const [wrapperOffsetTop, setWrapperOffsetTop] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect fires synchronously after DOM mutations, before paint.
  useLayoutEffect(() => {
    if (wrapperRef.current) setWrapperOffsetTop(wrapperRef.current.offsetTop);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    obs.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() =>
      setScrollContainerHeight(el.clientHeight)
    );
    obs.observe(el);
    setScrollContainerHeight(el.clientHeight);
    return () => obs.disconnect();
  }, [scrollRef]);

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

  // Top in px from the React Flow node root, or null to hide the handle.
  const handleTopPx = useMemo((): number | null => {
    if (selectionHandleId === undefined) return null;

    const scrollAreaTop = wrapperOffsetTop + headerHeight;

    if (selectedRows.size === 0) {
      return hasSelectionConnection
        ? scrollAreaTop + scrollContainerHeight / 2
        : null;
    }

    const indices = [...selectedRows];
    const minIdx = Math.min(...indices);
    const maxIdx = Math.max(...indices);
    const midContentY = ((minIdx + maxIdx + 1) / 2) * ROW_HEIGHT;
    const midVisibleY = midContentY - scrollTop;

    if (midVisibleY < 0 || midVisibleY > scrollContainerHeight) {
      return hasSelectionConnection
        ? scrollAreaTop + scrollContainerHeight / 2
        : null;
    }

    return scrollAreaTop + midVisibleY;
  }, [
    selectionHandleId,
    selectedRows,
    scrollTop,
    headerHeight,
    scrollContainerHeight,
    wrapperOffsetTop,
    hasSelectionConnection,
  ]);

  // Re-register the dynamic handle with React Flow whenever it appears, disappears, or moves.
  // Without this, nodeLookup never learns about the handle and connections cannot start.
  useEffect(() => {
    if (nodeId && selectionHandleId !== undefined) updateNodeInternals(nodeId);
  }, [nodeId, selectionHandleId, handleTopPx, updateNodeInternals]);

  return (
    // No position:relative — keeps this wrapper static so the Handle's position:absolute
    // propagates to the React Flow node root (.react-flow__node), same as other handles.
    <div ref={wrapperRef} className="flex flex-col flex-1 min-h-0">
      {/* Column headers */}
      <div
        ref={headerRef}
        className="nodrag shrink-0 flex items-center border-b border-neutral-700 bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-500 select-none"
      >
        <span className="w-10 shrink-0">#</span>
        <button
          onClick={cycleTsMode}
          className="nodrag w-28 shrink-0 text-left hover:text-neutral-300"
        >
          {`Timestamp [${TS_LABELS[tsMode as TsMode]}]`}
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
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
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

      {/* Row selection handle — Loose connectionMode lets any node connect to/from it.
          position:absolute here propagates to the React Flow node root. */}
      {handleTopPx !== null && (
        <Handle
          type="source"
          position={Position.Right}
          id={selectionHandleId}
          className="!bg-orange-500 !border-orange-300 !w-3 !h-3"
          style={{ top: handleTopPx, transform: "translateY(-50%)" }}
        />
      )}
    </div>
  );
}
