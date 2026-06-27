import { useCallback, useEffect, useMemo } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import { commands } from "../../bindings";
import { useLogView } from "./useLogView";
import LogViewDisplay from "./LogViewDisplay";
import { useDerivedViewSync } from "./useDerivedViewSync";
import { collectUpstreamChain } from "../../utils/graphTraversal";
import { computeMarks, EMPTY_MARKS } from "../../utils";
import { derivedLogViewInputHandleId } from "../../utils/constraint";
import type { DerivedLogViewData, DerivedLogViewNodeType } from "../../types/logView";
import type { MarkColor } from "../../utils/constraint";

export type { DerivedLogViewData, DerivedLogViewNodeType };

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

  const handleRowDoubleClick = useCallback(
    async (derivedRowIndex: number) => {
      if (!data.viewId) return;

      const chain = collectUpstreamChain(id, getNodes(), getEdges());
      if (!chain) return;

      if (data.viewId === chain.sourceViewId) {
        updateNodeData(chain.sourceNodeId, { jumpRequest: derivedRowIndex });
        return;
      }

      const result = await commands.getSourceRowIndex(
        data.viewId,
        derivedRowIndex,
        chain.sourceViewId,
      );
      if (result.status !== "ok") return;
      updateNodeData(chain.sourceNodeId, { jumpRequest: result.data });
    },
    [id, data.viewId, getNodes, getEdges, updateNodeData],
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
        nodeId={id}
      />
    </div>
  );
}
