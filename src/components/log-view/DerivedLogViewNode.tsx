import { useCallback, useEffect, useMemo } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { commands } from "../../bindings";
import { useLogView } from "./useLogView";
import LogViewDisplay from "./LogViewDisplay";
import { computeMarks } from "./markingUtils";
import { useDerivedViewSync } from "./useDerivedViewSync";
import { collectUpstreamChain } from "./graphTraversal";
import { derivedLogViewInputHandleId } from "../../utils/constraint";
import type { MarkingRule } from "../condition/MarkingNode";
import type { MarkColor } from "../../utils/constraint";

export type DerivedLogViewData = {
  /**
   * Current backend view ID.
   * - undefined until useDerivedViewSync runs for the first time
   * - equals upstream sourceViewId when no FilterNodes are in the chain
   * - a new UUID whenever filters are (re-)applied
   */
  viewId?: string;
  rowCount: number;
  label?: string;
  /** Marking rules collected from MarkingNodes in the upstream chain. */
  markingRules?: MarkingRule[];
  /** Set to a 0-based row index to request a scroll jump; cleared after handling. */
  jumpRequest?: number;
};
export type DerivedLogViewNodeType = Node<DerivedLogViewData, "derivedLogView">;

const EMPTY_MARKS: ReadonlyMap<number, MarkColor> = new Map();

export default function DerivedLogViewNode({
  id,
  data,
  selected,
}: NodeProps<DerivedLogViewNodeType>) {
  useDerivedViewSync(id, data);

  const { getNodes, getEdges, updateNodeData } = useReactFlow();
  const lv = useLogView(data.viewId, data.rowCount);

  useEffect(() => {
    if (data.jumpRequest == null) return;
    lv.scrollToIndex(data.jumpRequest);
    updateNodeData(id, { jumpRequest: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.jumpRequest]);

  const marks = useMemo<ReadonlyMap<number, MarkColor>>(() => {
    if (!data.markingRules?.length) return EMPTY_MARKS;
    return computeMarks(lv.rowCache, data.markingRules);
  }, [lv.rowCache, data.markingRules]);

  // Double-click: traverse the upstream chain to find the SourceLogView,
  // then send a jumpRequest so it scrolls to the corresponding source row.
  const handleRowDoubleClick = useCallback(
    async (derivedRowIndex: number) => {
      if (!data.viewId) return;

      const chain = collectUpstreamChain(id, getNodes(), getEdges());
      if (!chain) return;

      if (data.viewId === chain.sourceViewId) {
        // No filters active — derived row index equals source row index.
        updateNodeData(chain.sourceNodeId, { jumpRequest: derivedRowIndex });
        return;
      }

      const result = await commands.getSourceRowIndex(
        data.viewId,
        derivedRowIndex,
        chain.sourceViewId
      );
      if (result.status !== "ok") return;
      updateNodeData(chain.sourceNodeId, { jumpRequest: result.data });
    },
    [id, data.viewId, getNodes, getEdges, updateNodeData]
  );

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-violet-700 bg-neutral-900 shadow-lg"
      style={{ width: "100%", height: "100%" }}
    >
      <NodeResizer isVisible={selected} minWidth={400} minHeight={200} />
      {/* DerivedLogView is always the terminal node — target handle only */}
      <Handle
        type="target"
        position={Position.Left}
        id={derivedLogViewInputHandleId}
      />

      <div className="shrink-0 flex items-center gap-2 border-b border-violet-800 bg-violet-950 px-3 py-2 cursor-grab active:cursor-grabbing">
        <span className="text-xs text-violet-400">▶ derive</span>
        <span className="flex-1 truncate text-xs font-semibold text-neutral-300">
          {data.label ?? data.viewId?.slice(0, 8) ?? "…"}
        </span>
        <span className="shrink-0 text-xs text-neutral-500">
          {data.rowCount.toLocaleString()} rows
        </span>
      </div>

      <LogViewDisplay
        {...lv}
        emptyMessage="No rows match the criteria"
        marks={marks}
        onRowDoubleClick={handleRowDoubleClick}
      />
    </div>
  );
}
