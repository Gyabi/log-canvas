import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import type { useLogView } from "./useLogView";
import type { DltRow } from "../../bindings";
import { MARK_BG, ROW_HEIGHT } from "../../utils/constraint";
import type { MarkColor } from "../../utils/constraint";
import {
  TS_MODES,
  TS_LABELS,
  formatTs,
  levelClass,
} from "../../utils/dltFormat";
import type { TsMode } from "../../types/logView";
import type { RowAnchor, LogViewScrollState } from "../../types/logView";
import { useRowHandles } from "./useRowHandles";

type Props = ReturnType<typeof useLogView> & {
  emptyMessage: string;
  marks?: ReadonlyMap<number, MarkColor>;
  onRowDoubleClick?: (rowIndex: number) => void;
  /** Required for row-anchor handle management. */
  nodeId: string;
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
  nodeId,
}: Props) {
  const { updateNodeData } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const [jumpInputVisible, setJumpInputVisible] = useState(false);
  const [jumpValue, setJumpValue] = useState("");

  // Scroll metrics used to position row-anchor handles and for CommentNode tracking.
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(30);
  const [scrollContainerHeight, setScrollContainerHeight] = useState(200);
  const [wrapperOffsetTop, setWrapperOffsetTop] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Measure wrapperOffsetTop synchronously to avoid a flash of wrong handle position.
  useLayoutEffect(() => {
    if (wrapperRef.current) setWrapperOffsetTop(wrapperRef.current.offsetTop);
  }, []);

  // Track column-header height.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    obs.observe(el);
    setHeaderHeight(el.offsetHeight);
    return () => obs.disconnect();
  }, []);

  // Track scroll-body height.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setScrollContainerHeight(el.clientHeight));
    obs.observe(el);
    setScrollContainerHeight(el.clientHeight);
    return () => obs.disconnect();
  }, [scrollRef]);

  // Sync scroll state to node data so connected CommentNodes can track positions.
  const prevScrollStateRef = useRef<LogViewScrollState | null>(null);
  useEffect(() => {
    const next: LogViewScrollState = { scrollTop, scrollContainerHeight, wrapperOffsetTop, headerHeight };
    const prev = prevScrollStateRef.current;
    if (
      prev &&
      prev.scrollTop === next.scrollTop &&
      prev.scrollContainerHeight === next.scrollContainerHeight &&
      prev.wrapperOffsetTop === next.wrapperOffsetTop &&
      prev.headerHeight === next.headerHeight
    ) return;
    prevScrollStateRef.current = next;
    updateNodeData(nodeId, { scrollState: next });
  }, [scrollTop, scrollContainerHeight, wrapperOffsetTop, headerHeight, nodeId, updateNodeData]);

  // Row-anchor handle management (multiple handles, pending + connected).
  const rowHandles = useRowHandles(nodeId, selectedRows);

  // Keep React Flow in sync whenever scroll moves handles.
  const rowHandleCount = rowHandles.length;
  useEffect(() => {
    if (rowHandleCount > 0) updateNodeInternals(nodeId);
  }, [scrollTop, headerHeight, rowHandleCount, nodeId, updateNodeInternals]);

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
        ].join("\t"),
      )
      .join("\n");

    navigator.clipboard.writeText(text).catch(() => undefined);
  }

  function handleJumpKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const n = parseInt(jumpValue, 10);
      if (!Number.isNaN(n)) scrollToIndex(n - 1);
      setJumpInputVisible(false);
      setJumpValue("");
    } else if (e.key === "Escape") {
      setJumpInputVisible(false);
      setJumpValue("");
    }
  }

  /**
   * Compute the handle's top position (px from the React Flow node root) for a given anchor.
   * Returns null when the anchor row is scrolled out of view and no edge is connected.
   */
  function anchorTopPx(anchor: RowAnchor): number | null {
    const scrollAreaTop = wrapperOffsetTop + headerHeight;
    const midContent = ((anchor.minRow + anchor.maxRow + 1) / 2) * ROW_HEIGHT;
    const midVisible = midContent - scrollTop;
    if (midVisible < 0 || midVisible > scrollContainerHeight) return null;
    return scrollAreaTop + midVisible;
  }

  return (
    // No position:relative — keeps this wrapper static so the Handle's position:absolute
    // propagates to the React Flow node root (.react-flow__node), same as other handles.
    <div ref={wrapperRef} className="flex flex-col flex-1 min-h-0">
      {/* Column headers — overflow-x hidden, inner content translated to mirror body scroll */}
      <div
        ref={headerRef}
        className="nodrag shrink-0 overflow-x-hidden border-b border-neutral-700 bg-neutral-800 font-mono text-xs text-neutral-500 select-none"
      >
        <div
          className="flex items-center px-2 py-1"
          style={{ transform: `translateX(${-scrollLeft}px)`, width: "max-content", minWidth: "100%" }}
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
          <span className="whitespace-nowrap pl-1">Message</span>
        </div>
      </div>

      {/* Scrollable body — overflow: auto enables both vertical and horizontal scroll */}
      <div
        ref={scrollRef}
        className="nodrag nowheel flex-1 overflow-auto"
        onClick={clearSelection}
        onScroll={(e) => {
          setScrollTop(e.currentTarget.scrollTop);
          setScrollLeft(e.currentTarget.scrollLeft);
        }}
      >
        {rowCount > 0 ? (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualItems.map((item) => {
              const row = rowCache.get(item.index);
              const isSelected = selectedRows.has(item.index);
              const markColor = marks?.get(item.index);
              const bgClass = isSelected
                ? "bg-blue-900/40"
                : markColor
                  ? MARK_BG[markColor]
                  : "";
              const isAnchored = rowHandles.some(
                (a) => item.index >= a.minRow && item.index <= a.maxRow,
              );

              return (
                <div
                  key={item.key}
                  style={{
                    position: "absolute",
                    top: item.start,
                    left: 0,
                    // width: max-content expands each row to its natural content width.
                    // minWidth: 100% ensures backgrounds (selection, mark) always fill the viewport.
                    width: "max-content",
                    minWidth: "100%",
                    height: item.size,
                  }}
                  className={`flex items-center border-b border-neutral-800 px-2 font-mono text-xs hover:bg-neutral-800 cursor-pointer ${bgClass} ${isAnchored ? "ring-1 ring-inset ring-orange-500" : ""}`}
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
                      <span className="w-10 shrink-0 text-neutral-500">{row.index}</span>
                      <span className="w-28 shrink-0 text-neutral-400">
                        {formatTs(row.timestampUs, tsMode, firstTimestampUs)}
                      </span>
                      <span className="w-12 shrink-0 text-sky-400">{row.ecuId}</span>
                      <span className="w-12 shrink-0 text-emerald-400">{row.appId}</span>
                      <span className="w-12 shrink-0 text-amber-400">{row.ctxId}</span>
                      <span className={`w-16 shrink-0 font-semibold ${levelClass(row.level)}`}>
                        {row.level}
                      </span>
                      <span className="whitespace-nowrap pl-1 text-neutral-200">{row.payload}</span>
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

      {/* Row-anchor handles — one per connected/pending anchor. position:absolute
          propagates to the React Flow node root because this wrapper is position:static. */}
      {rowHandles.map((anchor) => {
        const top = anchorTopPx(anchor);
        if (top === null) return null;
        return (
          <Handle
            key={anchor.handleId}
            type="source"
            position={Position.Right}
            id={anchor.handleId}
            className="!bg-orange-500 !border-orange-300 !w-3 !h-3"
            style={{ top, transform: "translateY(-50%)" }}
          />
        );
      })}
    </div>
  );
}
