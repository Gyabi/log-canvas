import { useEffect, useMemo, useRef, useState } from "react";
import { useEdges, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { ROW_ANCHOR_HANDLE_PREFIX, isRowAnchorHandle } from "../../utils/constraint";
import type { RowAnchor } from "../../types/logView";

/**
 * Manages multiple row-anchor handles for a LogView node.
 *
 * Lifecycle:
 *  - When rows are selected, a "pending" anchor (stable UUID) appears.
 *  - When the pending anchor's handle is connected via an edge, a new pending ID
 *    is generated so the user can create another anchor while the first persists.
 *  - Anchors with no live edge are cleaned up automatically.
 *  - The anchor map is synced to node data so CommentNodes can read row positions.
 */
export function useRowHandles(
  nodeId: string,
  selectedRows: ReadonlySet<number>,
): RowAnchor[] {
  const { getNode, updateNodeData } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useEdges();

  // pendingHandleId: the current "unconnected" anchor handle ID (rotates after connect).
  const [pendingHandleId, setPendingHandleId] = useState(
    () => `${ROW_ANCHOR_HANDLE_PREFIX}${crypto.randomUUID()}`,
  );

  // anchorMap: handleId → row range.  Source of truth for all managed handles.
  // Initialized from persisted node data so anchors survive a node remount.
  const [anchorMap, setAnchorMap] = useState<Map<string, { minRow: number; maxRow: number }>>(() => {
    const stored =
      (getNode(nodeId)?.data as { rowAnchors?: RowAnchor[] } | undefined)
        ?.rowAnchors ?? [];
    return new Map(stored.map((a) => [a.handleId, { minRow: a.minRow, maxRow: a.maxRow }]));
  });

  // IDs of row-anchor handles that currently have a live edge.
  // Check both directions: user may drag from either the row handle or the comment handle.
  const connectedAnchorIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of edges) {
      if (e.source === nodeId && isRowAnchorHandle(e.sourceHandle)) {
        ids.push(e.sourceHandle!);
      } else if (e.target === nodeId && isRowAnchorHandle(e.targetHandle)) {
        ids.push(e.targetHandle!);
      }
    }
    return new Set(ids);
  }, [edges, nodeId]);

  // Update pending anchor when row selection changes.
  useEffect(() => {
    setAnchorMap((prev) => {
      const next = new Map(prev);
      if (selectedRows.size === 0) {
        next.delete(pendingHandleId);
      } else {
        next.set(pendingHandleId, {
          minRow: Math.min(...selectedRows),
          maxRow: Math.max(...selectedRows),
        });
      }
      // Return same reference if nothing changed to avoid downstream effects.
      if (next.size === prev.size && [...next.entries()].every(([k, v]) => prev.get(k) === v)) {
        return prev;
      }
      return next;
    });
  }, [selectedRows, pendingHandleId]);

  // When the pending handle becomes connected, rotate to a fresh pending ID
  // and remove any stale (disconnected, non-pending) anchors.
  useEffect(() => {
    const pendingGotConnected = connectedAnchorIds.has(pendingHandleId);
    if (pendingGotConnected) {
      setPendingHandleId(`${ROW_ANCHOR_HANDLE_PREFIX}${crypto.randomUUID()}`);
    }

    setAnchorMap((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of next.keys()) {
        if (id !== pendingHandleId && !connectedAnchorIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [connectedAnchorIds, pendingHandleId]);

  // Sync anchor map to node data (for CommentNode position tracking).
  const prevAnchorMapRef = useRef<Map<string, { minRow: number; maxRow: number }>>(anchorMap);
  useEffect(() => {
    if (prevAnchorMapRef.current === anchorMap) return;
    prevAnchorMapRef.current = anchorMap;
    const rowAnchors: RowAnchor[] = [...anchorMap.entries()].map(([handleId, { minRow, maxRow }]) => ({
      handleId,
      minRow,
      maxRow,
    }));
    updateNodeData(nodeId, { rowAnchors });
  }, [anchorMap, nodeId, updateNodeData]);

  // Tell React Flow about handle count changes so it re-registers handles.
  const handleCount = anchorMap.size;
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [handleCount, nodeId, updateNodeInternals]);

  // Build the list of handles to render.
  return useMemo((): RowAnchor[] => {
    const result: RowAnchor[] = [];
    for (const [handleId, { minRow, maxRow }] of anchorMap) {
      const isConnected = connectedAnchorIds.has(handleId);
      const isPending = handleId === pendingHandleId;
      if (isConnected || (isPending && selectedRows.size > 0)) {
        result.push({ handleId, minRow, maxRow });
      }
    }
    return result;
  }, [anchorMap, connectedAnchorIds, pendingHandleId, selectedRows]);
}
