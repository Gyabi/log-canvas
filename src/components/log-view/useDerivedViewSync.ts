import { useEffect } from "react";
import { useStore, useReactFlow } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { commands } from "../../bindings";
import type { DerivedLogViewData } from "../../types/logView";
import {
  collectUpstreamChain,
  buildSyncSignature,
  chainFilters,
  chainMarkingRules,
} from "../../utils/graphTraversal";

/**
 * Watches the upstream chain for a DerivedLogViewNode and keeps the backend
 * view in sync whenever the chain topology or condition data changes.
 *
 * Chain topology: SourceLogView → [condition]* → DerivedLogView
 * Each node in the chain accepts exactly one incoming edge (enforced in Canvas).
 * Condition nodes may fan-out to multiple downstream nodes.
 */
export function useDerivedViewSync(id: string, data: DerivedLogViewData): void {
  const { getNodes, getEdges, updateNodeData } = useReactFlow();

  // Re-render only when the chain structure or content changes.
  // Position-only changes (dragging) are excluded because we read node.data, not position.
  const syncSignature = useStore((s) =>
    buildSyncSignature(
      collectUpstreamChain(id, s.nodes as Node[], s.edges as Edge[])
    )
  );

  useEffect(() => {
    const chain = collectUpstreamChain(id, getNodes(), getEdges());
    if (!chain) return;

    const allFilters = chainFilters(chain);
    const markingRules = chainMarkingRules(chain);

    if (allFilters.length === 0) {
      // No filter nodes in the chain — show the source view directly.
      const oldViewId = data.viewId;
      if (oldViewId && oldViewId !== chain.sourceViewId) {
        void commands.deleteView(oldViewId);
      }
      updateNodeData(id, {
        viewId: chain.sourceViewId,
        rowCount: chain.sourceRowCount,
        markingRules,
      });
      return;
    }

    // Apply all collected filter conditions against the source view.
    const newViewId = crypto.randomUUID();
    const oldViewId = data.viewId;
    let cancelled = false;

    void commands.createView(newViewId, chain.sourceViewId, allFilters).then(
      (result) => {
        if (cancelled) {
          // This call was superseded by a newer effect — discard the created view.
          void commands.deleteView(newViewId);
          return;
        }
        if (result.status !== "ok") return;
        if (oldViewId && oldViewId !== chain.sourceViewId) {
          void commands.deleteView(oldViewId);
        }
        updateNodeData(id, {
          viewId: newViewId,
          rowCount: result.data,
          markingRules,
        });
      }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncSignature]);
}
