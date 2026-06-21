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
import type { MarkColor, DerivedLogViewData } from "../../types";

export type { DerivedLogViewData };
export type DerivedLogViewNodeType = Node<DerivedLogViewData, "derivedLogView">;

const EMPTY_MARKS: ReadonlyMap<number, MarkColor> = new Map();

export default function DerivedLogViewNode({
  id,
  data,
  selected,
}: NodeProps<DerivedLogViewNodeType>) {
  useDerivedViewSync(id, data);

  const { getNodes, updateNodeData } = useReactFlow();
  const lv = useLogView(data.viewId, data.rowCount);

  // Jump when another node sends us a jumpRequest.
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

  // Double-click: find parent log-view node and request a jump to the source row.
  const handleRowDoubleClick = useCallback(
    async (derivedRowIndex: number) => {
      if (!data.sourceViewId || !data.viewId) return;

      // If this view has no filter applied (viewId === sourceViewId), the row
      // index is already correct in the source — just forward the request.
      if (data.viewId === data.sourceViewId) {
        const sourceNode = getNodes().find(
          (n) => (n.data as { viewId?: string }).viewId === data.sourceViewId,
        );
        if (sourceNode) {
          updateNodeData(sourceNode.id, { jumpRequest: derivedRowIndex });
        }
        return;
      }

      // Derive view is filtered: ask Rust to map the filtered index to its
      // position in the source view.
      const result = await commands.getSourceRowIndex(
        data.viewId,
        derivedRowIndex,
        data.sourceViewId,
      );
      if (result.status !== "ok") return;

      const sourceNode = getNodes().find(
        (n) => (n.data as { viewId?: string }).viewId === data.sourceViewId,
      );
      if (sourceNode) {
        updateNodeData(sourceNode.id, { jumpRequest: result.data });
      }
    },
    [data.viewId, data.sourceViewId, getNodes, updateNodeData],
  );

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-violet-700 bg-neutral-900 shadow-lg"
      style={{ width: "100%", height: "100%" }}
    >
      <NodeResizer isVisible={selected} minWidth={400} minHeight={200} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="shrink-0 flex items-center gap-2 border-b border-violet-800 bg-violet-950 px-3 py-2 cursor-grab active:cursor-grabbing">
        <span className="text-xs text-violet-400">▶ derive</span>
        <span className="flex-1 truncate text-xs font-semibold text-neutral-300">
          {data.label ?? data.viewId.slice(0, 8)}
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
