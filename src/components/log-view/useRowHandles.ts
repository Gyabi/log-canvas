import { useEffect, useMemo, useReducer, useRef } from "react";
import { useEdges, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import {
  ROW_ANCHOR_HANDLE_PREFIX,
  isRowAnchorHandle,
} from "../../utils/constraint";
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

type AnchorState = {
  pendingHandleId: string;
  anchorMap: Map<string, { minRow: number; maxRow: number }>;
};

type UpdateAction = {
  type: "update";
  selectedRows: ReadonlySet<number>;
  connectedAnchorIds: ReadonlySet<string>;
};

function newPendingId(): string {
  return `${ROW_ANCHOR_HANDLE_PREFIX}${crypto.randomUUID()}`;
}

function anchorReducer(state: AnchorState, action: UpdateAction): AnchorState {
  const { selectedRows, connectedAnchorIds } = action;

  // Rotate pending ID atomically if it just got connected.
  const pendingHandleId = connectedAnchorIds.has(state.pendingHandleId)
    ? newPendingId()
    : state.pendingHandleId;

  const next = new Map(state.anchorMap);

  // Remove stale (disconnected, non-pending) anchors.
  for (const id of next.keys()) {
    if (id !== pendingHandleId && !connectedAnchorIds.has(id)) {
      next.delete(id);
    }
  }

  // Update pending anchor entry with current selection.
  if (selectedRows.size === 0) {
    next.delete(pendingHandleId);
  } else {
    next.set(pendingHandleId, {
      minRow: Math.min(...selectedRows),
      maxRow: Math.max(...selectedRows),
    });
  }

  // Return same reference if nothing changed to avoid downstream effects.
  if (
    pendingHandleId === state.pendingHandleId &&
    next.size === state.anchorMap.size &&
    [...next.entries()].every(([k, v]) => state.anchorMap.get(k) === v)
  ) {
    return state;
  }

  return { pendingHandleId, anchorMap: next };
}

export function useRowHandles(
  nodeId: string,
  selectedRows: ReadonlySet<number>
): RowAnchor[] {
  const { getNode, updateNodeData } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useEdges();

  const [{ pendingHandleId, anchorMap }, dispatch] = useReducer(
    anchorReducer,
    undefined,
    (): AnchorState => {
      const stored =
        (getNode(nodeId)?.data as { rowAnchors?: RowAnchor[] } | undefined)
          ?.rowAnchors ?? [];
      return {
        pendingHandleId: newPendingId(),
        anchorMap: new Map(
          stored.map((a) => [a.handleId, { minRow: a.minRow, maxRow: a.maxRow }])
        ),
      };
    }
  );

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

  // Single effect: handles selection updates, pending ID rotation, and stale cleanup atomically.
  // Using useReducer avoids the cascading setState calls that triggered the React warning.
  useEffect(() => {
    dispatch({ type: "update", selectedRows, connectedAnchorIds });
  }, [selectedRows, connectedAnchorIds]);

  // Sync anchor map to node data (for CommentNode position tracking).
  const prevAnchorMapRef =
    useRef<Map<string, { minRow: number; maxRow: number }>>(anchorMap);
  useEffect(() => {
    if (prevAnchorMapRef.current === anchorMap) return;
    prevAnchorMapRef.current = anchorMap;
    const rowAnchors: RowAnchor[] = [...anchorMap.entries()].map(
      ([handleId, { minRow, maxRow }]) => ({
        handleId,
        minRow,
        maxRow,
      })
    );
    updateNodeData(nodeId, { rowAnchors });
  }, [anchorMap, nodeId, updateNodeData]);

  // Tell React Flow about handle count changes so it re-registers handles.
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [anchorMap, nodeId, updateNodeInternals]);

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
