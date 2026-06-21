import { useEffect, useRef } from "react";
import { useEdges, useNodes, useReactFlow } from "@xyflow/react";
import { commands } from "../../bindings";
import type { DerivedLogViewData, FilterNodeData, MarkingNodeData } from "../../types";

/**
 * Watches incoming edges on a DerivedLogViewNode and re-applies all connected
 * condition nodes (FilterNode / MarkingNode) whenever the edge topology OR the
 * condition node data changes (e.g. a filter rule is added/removed).
 *
 * This hook intentionally skips the first render so that a DerivedLogViewNode
 * freshly created by "Create Output →" is not immediately re-processed.
 */
export function useDerivedViewSync(id: string, data: DerivedLogViewData): void {
  const edges = useEdges();
  const nodes = useNodes();
  const { updateNodeData } = useReactFlow();
  const isFirstRender = useRef(true);


  // Signature covers both edge topology AND the data content of each connected
  // condition node, so the effect fires on filter/rule changes too.
  const incomingEdges = edges.filter((e) => e.target === id);
  const incomingEdgeSignature = incomingEdges
    .map((e) => {
      const node = nodes.find((n) => n.id === e.source);
      if (!node) return e.source;
      return `${e.source}:${JSON.stringify(node.data)}`;
    })
    .sort()
    .join("|");

  useEffect(() => {
    // Skip the mount triggered by "Create Output →" — state is already correct.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!data.sourceViewId) return;

    const incomingEdges = edges.filter((e) => e.target === id);

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
      // No filter nodes — only marking rules changed (frontend only).
      updateNodeData(id, { markingRules });
      return;
    }

    // Filter nodes present: rebuild the backend view with merged filters.
    const newViewId = crypto.randomUUID();
    const oldViewId = data.viewId; // Captured before async so we delete the right one.

    commands.createView(newViewId, data.sourceViewId, allFilters).then((result) => {
      if (result.status !== "ok") return;
      if (oldViewId !== data.sourceViewId) {
        void commands.deleteView(oldViewId);
      }
      updateNodeData(id, { viewId: newViewId, rowCount: result.data, markingRules });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingEdgeSignature]);
}
