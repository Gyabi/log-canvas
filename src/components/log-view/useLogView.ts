import { useEffect, useReducer, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { commands } from "../../bindings";
import type { DltRow } from "../../bindings";

export type TsMode = "abs" | "rel" | "us";

const FETCH_SIZE = 100;

type CacheState = {
  entries: Map<number, DltRow>;
  firstTimestampUs: number | null;
};

type CacheAction = { type: "add"; rows: DltRow[] } | { type: "reset" };

function cacheReducer(state: CacheState, action: CacheAction): CacheState {
  if (action.type === "reset") {
    return { entries: new Map(), firstTimestampUs: null };
  }
  const entries = new Map(state.entries);
  let { firstTimestampUs } = state;
  for (const row of action.rows) {
    entries.set(row.index, row);
    if (row.index === 0 && firstTimestampUs === null) {
      firstTimestampUs = row.timestampUs;
    }
  }
  return { entries, firstTimestampUs };
}

export function useLogView(viewId: string | undefined, rowCount: number) {
  const [cacheState, dispatchCache] = useReducer(cacheReducer, {
    entries: new Map<number, DltRow>(),
    firstTimestampUs: null,
  });
  const [tsMode, setTsMode] = useState<TsMode>("abs");
  const [selectedRows, setSelectedRows] = useState(new Set<number>());

  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const lastSelectedRef = useRef<number | null>(null);

  useEffect(() => {
    dispatchCache({ type: "reset" });
    fetchingRef.current = false;
    setSelectedRows(new Set());
    lastSelectedRef.current = null;
  }, [viewId]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 15,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const rangeStart = virtualItems[0]?.index ?? -1;
  const rangeEnd = virtualItems[virtualItems.length - 1]?.index ?? -1;

  useEffect(() => {
    if (!viewId || rangeStart === -1 || fetchingRef.current) return;

    const missing: number[] = [];
    for (let i = rangeStart; i <= rangeEnd; i++) {
      if (!cacheState.entries.has(i)) missing.push(i);
    }
    if (missing.length === 0) return;

    let cancelled = false;
    fetchingRef.current = true;

    commands.getLogRows(viewId, missing[0], FETCH_SIZE).then((result) => {
      fetchingRef.current = false;
      if (cancelled) return;
      if (result.status === "ok") {
        dispatchCache({ type: "add", rows: result.data });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [viewId, rangeStart, rangeEnd, cacheState.entries]);

  function toggleSelect(index: number, shiftKey: boolean, ctrlKey: boolean) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedRef.current !== null) {
        const from = Math.min(lastSelectedRef.current, index);
        const to = Math.max(lastSelectedRef.current, index);
        for (let i = from; i <= to; i++) next.add(i);
      } else if (ctrlKey) {
        if (next.has(index)) next.delete(index);
        else next.add(index);
      } else {
        next.clear();
        next.add(index);
      }
      lastSelectedRef.current = index;
      return next;
    });
  }

  function clearSelection() {
    setSelectedRows(new Set());
    lastSelectedRef.current = null;
  }

  function scrollToIndex(n: number) {
    const idx = Math.max(0, Math.min(n, rowCount - 1));
    virtualizer.scrollToIndex(idx, { align: "center" });
  }

  return {
    virtualizer,
    scrollRef,
    rowCache: cacheState.entries,
    firstTimestampUs: cacheState.firstTimestampUs,
    rowCount,
    tsMode,
    setTsMode,
    selectedRows,
    toggleSelect,
    clearSelection,
    scrollToIndex,
  };
}
