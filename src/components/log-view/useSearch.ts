import { useState, useCallback, useRef } from "react";
import { commands } from "../../bindings";

export type UseSearchReturn = {
  searchVisible: boolean;
  query: string;
  matchIndices: number[];
  currentMatchPos: number;
  isSearching: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (q: string) => void;
  nextMatch: () => void;
  prevMatch: () => void;
};

/**
 * Query / match state is tagged with the viewId it belongs to. When the view
 * changes, stale state is simply ignored by the derivations below — no reset
 * effect needed.
 */
type QueryState = { viewId: string | undefined; text: string };
type MatchState = { viewId: string | undefined; indices: number[]; pos: number };

const NO_MATCHES: number[] = [];

export function useSearch(
  viewId: string | undefined,
  scrollToIndex: (n: number) => void,
): UseSearchReturn {
  const [searchVisible, setSearchVisible] = useState(false);
  const [queryState, setQueryState] = useState<QueryState>({ viewId, text: "" });
  const [matchState, setMatchState] = useState<MatchState>({
    viewId,
    indices: NO_MATCHES,
    pos: -1,
  });
  const [searchingViewId, setSearchingViewId] = useState<string | null>(null);

  const query = queryState.viewId === viewId ? queryState.text : "";
  const matchesCurrent = matchState.viewId === viewId;
  const matchIndices = matchesCurrent ? matchState.indices : NO_MATCHES;
  const currentMatchPos = matchesCurrent ? matchState.pos : -1;
  const isSearching = searchingViewId !== null && searchingViewId === viewId;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchVersionRef = useRef(0);

  const runSearch = useCallback(
    async (q: string, vid: string, version: number) => {
      setSearchingViewId(vid);
      const result = await commands.searchRows(vid, q);
      if (version !== searchVersionRef.current) return;
      setSearchingViewId(null);
      if (result.status === "ok") {
        const pos = result.data.length > 0 ? 0 : -1;
        setMatchState({ viewId: vid, indices: result.data, pos });
        if (pos === 0) scrollToIndex(result.data[0]);
      }
    },
    [scrollToIndex],
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryState({ viewId, text: q });
      searchVersionRef.current += 1;
      const version = searchVersionRef.current;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!viewId || !q.trim()) {
        setMatchState({ viewId, indices: NO_MATCHES, pos: -1 });
        setSearchingViewId(null);
        return;
      }
      debounceRef.current = setTimeout(() => {
        void runSearch(q, viewId, version);
      }, 300);
    },
    [viewId, runSearch],
  );

  const nextMatch = useCallback(() => {
    if (matchIndices.length === 0) return;
    const next = (currentMatchPos + 1) % matchIndices.length;
    setMatchState({ viewId, indices: matchIndices, pos: next });
    scrollToIndex(matchIndices[next]);
  }, [matchIndices, currentMatchPos, viewId, scrollToIndex]);

  const prevMatch = useCallback(() => {
    if (matchIndices.length === 0) return;
    const prev = (currentMatchPos - 1 + matchIndices.length) % matchIndices.length;
    setMatchState({ viewId, indices: matchIndices, pos: prev });
    scrollToIndex(matchIndices[prev]);
  }, [matchIndices, currentMatchPos, viewId, scrollToIndex]);

  const openSearch = useCallback(() => {
    setSearchVisible(true);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    // Empty values are the reset state regardless of the tag, so undefined is safe.
    setQueryState({ viewId: undefined, text: "" });
    setMatchState({ viewId: undefined, indices: NO_MATCHES, pos: -1 });
    setSearchingViewId(null);
    searchVersionRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return {
    searchVisible,
    query,
    matchIndices,
    currentMatchPos,
    isSearching,
    openSearch,
    closeSearch,
    setQuery,
    nextMatch,
    prevMatch,
  };
}
