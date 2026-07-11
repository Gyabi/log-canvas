import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import type { useLogView } from "./useLogView";
import { useSearch } from "./useSearch";
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

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const qLower = query.toLowerCase();
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let pos = 0;
  let key = 0;
  while (pos < text.length) {
    const idx = lower.indexOf(qLower, pos);
    if (idx === -1) {
      parts.push(text.slice(pos));
      break;
    }
    if (idx > pos) parts.push(text.slice(pos, idx));
    parts.push(
      <span key={key++} className="bg-yellow-400/80 text-neutral-900 rounded-[2px]">
        {text.slice(idx, idx + query.length)}
      </span>
    );
    pos = idx + query.length;
  }
  return <>{parts}</>;
}

export default function LogViewDisplay({
  viewId,
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

  const search = useSearch(viewId, scrollToIndex);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [jumpInputVisible, setJumpInputVisible] = useState(false);
  const [jumpValue, setJumpValue] = useState("");

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  // Distance from the node root to the top of the scroll body. Measured directly
  // from the scroll element so anything rendered above it (column header, search
  // bar) is accounted for automatically.
  const [scrollAreaTop, setScrollAreaTop] = useState(0);
  const [scrollContainerHeight, setScrollContainerHeight] = useState(200);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // offsetParent of the scroll body is the React Flow node root (every ancestor
  // in between is position:static), so offsetTop is relative to the node root.
  const measureScrollAreaTop = () => {
    if (scrollRef.current) setScrollAreaTop(scrollRef.current.offsetTop);
  };

  // Re-measure synchronously when the search bar mounts/unmounts to avoid a
  // one-frame flash of wrong handle position.
  useLayoutEffect(() => {
    measureScrollAreaTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.searchVisible]);

  // Header height changes (e.g. wrapping) shift the scroll body down.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(measureScrollAreaTop);
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setScrollContainerHeight(el.clientHeight);
      measureScrollAreaTop();
    });
    obs.observe(el);
    setScrollContainerHeight(el.clientHeight);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef]);

  const prevScrollStateRef = useRef<LogViewScrollState | null>(null);
  useEffect(() => {
    const next: LogViewScrollState = { scrollTop, scrollContainerHeight, scrollAreaTop };
    const prev = prevScrollStateRef.current;
    if (
      prev &&
      prev.scrollTop === next.scrollTop &&
      prev.scrollContainerHeight === next.scrollContainerHeight &&
      prev.scrollAreaTop === next.scrollAreaTop
    ) return;
    prevScrollStateRef.current = next;
    updateNodeData(nodeId, { scrollState: next });
  }, [scrollTop, scrollContainerHeight, scrollAreaTop, nodeId, updateNodeData]);

  const rowHandles = useRowHandles(nodeId, selectedRows);

  const rowHandleCount = rowHandles.length;
  useEffect(() => {
    if (rowHandleCount > 0) updateNodeInternals(nodeId);
  }, [scrollTop, scrollAreaTop, rowHandleCount, nodeId, updateNodeInternals]);

  // Focus search input when search bar opens.
  useEffect(() => {
    if (search.searchVisible) {
      searchInputRef.current?.focus();
    }
  }, [search.searchVisible]);

  // Ctrl+F opens search when focus is within this node.
  const { openSearch } = search;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        if (wrapperRef.current?.contains(e.target as Node)) {
          e.preventDefault();
          e.stopPropagation();
          openSearch();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [openSearch]);

  const matchSet = useMemo(() => new Set(search.matchIndices), [search.matchIndices]);
  const currentMatchRow =
    search.currentMatchPos >= 0 ? search.matchIndices[search.currentMatchPos] : -1;

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

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) search.prevMatch();
      else search.nextMatch();
    } else if (e.key === "Escape") {
      search.closeSearch();
    }
  }

  function anchorTopPx(anchor: RowAnchor): number | null {
    const midContent = ((anchor.minRow + anchor.maxRow + 1) / 2) * ROW_HEIGHT;
    const midVisible = midContent - scrollTop;
    if (midVisible < 0 || midVisible > scrollContainerHeight) return null;
    return scrollAreaTop + midVisible;
  }

  const matchLabel =
    search.isSearching
      ? "..."
      : search.query && search.matchIndices.length === 0
        ? "no match"
        : search.matchIndices.length > 0
          ? `${search.currentMatchPos + 1} / ${search.matchIndices.length}`
          : "";

  return (
    <div ref={wrapperRef} className="flex flex-col flex-1 min-h-0">
      {/* Column headers */}
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

      {/* Search bar */}
      {search.searchVisible && (
        <div className="nodrag shrink-0 flex items-center gap-1.5 border-b border-neutral-700 bg-neutral-850 bg-neutral-900 px-2 py-1">
          <input
            ref={searchInputRef}
            type="text"
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="search..."
            className="min-w-0 flex-1 rounded bg-neutral-700 px-2 py-0.5 font-mono text-xs text-neutral-200 outline-none placeholder:text-neutral-500 focus:ring-1 focus:ring-neutral-500"
          />
          <span className="shrink-0 w-16 text-right font-mono text-xs text-neutral-400">
            {matchLabel}
          </span>
          <button
            onClick={search.prevMatch}
            disabled={search.matchIndices.length === 0}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30"
          >
            ▲
          </button>
          <button
            onClick={search.nextMatch}
            disabled={search.matchIndices.length === 0}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-30"
          >
            ▼
          </button>
          <button
            onClick={search.closeSearch}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
          >
            ×
          </button>
        </div>
      )}

      {/* Scrollable body */}
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
              const isCurrentMatch = item.index === currentMatchRow;
              const isMatch = matchSet.has(item.index);
              const bgClass = isSelected
                ? "bg-blue-900/40"
                : isCurrentMatch
                  ? "bg-yellow-700/40"
                  : isMatch
                    ? "bg-yellow-900/20"
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
                      <span className="w-12 shrink-0 text-sky-400">
                        <HighlightedText text={row.ecuId} query={search.query} />
                      </span>
                      <span className="w-12 shrink-0 text-emerald-400">
                        <HighlightedText text={row.appId} query={search.query} />
                      </span>
                      <span className="w-12 shrink-0 text-amber-400">
                        <HighlightedText text={row.ctxId} query={search.query} />
                      </span>
                      <span className={`w-16 shrink-0 font-semibold ${levelClass(row.level)}`}>
                        {row.level}
                      </span>
                      <span className="whitespace-nowrap pl-1 text-neutral-200">
                        <HighlightedText text={row.payload} query={search.query} />
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
        <span className="flex items-center gap-2">
          {selectedRows.size > 0 && (
            <button
              onClick={copySelected}
              className="rounded bg-neutral-600 px-2 py-0.5 text-neutral-200 hover:bg-neutral-500"
            >
              {`copy (${selectedRows.size})`}
            </button>
          )}
          <button
            onClick={search.openSearch}
            className="hover:text-neutral-300"
            title="Search (Ctrl+F)"
          >
            search
          </button>
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

      {/* Row-anchor handles */}
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
