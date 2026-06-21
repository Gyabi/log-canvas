import { useEffect } from "react";
import { useStore, useReactFlow } from "@xyflow/react";
import { commands } from "../../bindings";
import type { DerivedLogViewData, FilterNodeData, MarkingNodeData } from "../../types";

/**
 * Watches the incoming edge topology + condition node data for a DerivedLogViewNode
 * and re-applies all conditions automatically when anything changes.
 *
 * Replaces the old isFirstRender guard: "Create Output →" now only creates the
 * node + edge, so useDerivedViewSync is solely responsible for backend sync.
 *
 * Uses a useStore selector instead of useNodes() so position-only changes
 * (dragging) do not trigger re-renders.
 */
export function useDerivedViewSync(id: string, data: DerivedLogViewData): void {
  const { getNodes, getEdges, updateNodeData } = useReactFlow();

  // Selector re-renders only when:
  // 1. Incoming edge set changes (node connected / disconnected)
  // 2. A connected condition node's data changes (filter/rule added or removed)
  // 3. The upstream log view's viewId changes (file opened on SourceLogViewNode)
  const syncSignature = useStore((s) => {
    const incomingEdges = s.edges.filter((e) => e.target === id);

    // Traverse one hop upstream through condition nodes to capture the source viewId.
    let upstreamViewId = "";
    for (const condEdge of incomingEdges) {
      const condNode = s.nodes.find((n) => n.id === condEdge.source);
      const logViewEdge = s.edges.find((e) => e.target === condNode?.id);
      const logViewNode = logViewEdge
        ? s.nodes.find((n) => n.id === logViewEdge.source)
        : undefined;
      const vid = (logViewNode?.data as { viewId?: string } | undefined)?.viewId;
      if (vid) { upstreamViewId = vid; break; }
    }

    const conditionPart = incomingEdges
      .map((e) => {
        const node = s.nodes.find((n) => n.id === e.source);
        return node ? `${e.source}:${JSON.stringify(node.data)}` : e.source;
      })
      .sort()
      .join("|");

    return `${upstreamViewId}||${conditionPart}`;
  });

  useEffect(() => {
    // Snapshot reads inside the effect — stable refs, no extra subscriptions.
    const edges = getEdges();
    const nodes = getNodes();

    const incomingEdges = edges.filter((e) => e.target === id);

    // Find upstream log view by traversing through condition nodes.
    let upstreamViewId: string | undefined;
    let upstreamRowCount = 0;
    for (const condEdge of incomingEdges) {
      const condNode = nodes.find((n) => n.id === condEdge.source);
      if (!condNode) continue;
      const logViewEdge = edges.find((e) => e.target === condNode.id);
      const logViewNode = logViewEdge
        ? nodes.find((n) => n.id === logViewEdge.source)
        : undefined;
      const vid = (logViewNode?.data as { viewId?: string } | undefined)?.viewId;
      if (vid) {
        upstreamViewId = vid;
        upstreamRowCount =
          (logViewNode?.data as { rowCount?: number } | undefined)?.rowCount ?? 0;
        break;
      }
    }

    if (!upstreamViewId) return; // not connected to any log view yet

    const filterNodes = incomingEdges
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n) => n?.type === "filter");

    const markingNodes = incomingEdges
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n) => n?.type === "marking");

    const markingRules = markingNodes.flatMap(
      (n) => (n?.data as MarkingNodeData).rules ?? [],
    );
    const allFilters = filterNodes.flatMap(
      (n) => (n?.data as FilterNodeData).filters ?? [],
    );

    if (filterNodes.length === 0) {
      // No filter nodes: clean up any stale derived view and reset to upstream.
      const oldViewId = data.viewId;
      if (oldViewId && oldViewId !== upstreamViewId) {
        void commands.deleteView(oldViewId); // 5.4: free the orphaned backend view
      }
      updateNodeData(id, {
        viewId: upstreamViewId,
        rowCount: upstreamRowCount,
        markingRules,
      });
      return;
    }

    // Filter nodes present: rebuild the backend view with merged filters.
    const newViewId = crypto.randomUUID();
    const oldViewId = data.viewId;

    commands.createView(newViewId, upstreamViewId, allFilters).then((result) => {
      if (result.status !== "ok") return;
      if (oldViewId && oldViewId !== upstreamViewId) {
        void commands.deleteView(oldViewId);
      }
      updateNodeData(id, { viewId: newViewId, rowCount: result.data, markingRules });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncSignature]);
}
