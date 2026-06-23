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
import type { DerivedLogViewData } from "../../types";
import { derivedLogViewInputHandleId, MarkColor } from "../../utils/constraint";

export type { DerivedLogViewData };
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

  // Double-click: find the upstream SourceLogViewNode through condition nodes
  // and send a jumpRequest so it scrolls to the same source row.
  const handleRowDoubleClick = useCallback(
    async (derivedRowIndex: number) => {
      if (!data.viewId) return;

      const nodes = getNodes();
      const edges = getEdges();
      const incomingEdges = edges.filter((e) => e.target === id);

      // Traverse condition node → upstream log view
      let upstreamViewId: string | undefined;
      let upstreamNodeId: string | undefined;
      for (const condEdge of incomingEdges) {
        const condNode = nodes.find((n) => n.id === condEdge.source);
        if (!condNode) continue;
        const logViewEdge = edges.find((e) => e.target === condNode.id);
        const logViewNode = logViewEdge
          ? nodes.find((n) => n.id === logViewEdge.source)
          : undefined;
        const vid = (logViewNode?.data as { viewId?: string } | undefined)
          ?.viewId;
        if (vid && logViewNode) {
          upstreamViewId = vid;
          upstreamNodeId = logViewNode.id;
          break;
        }
      }
      if (!upstreamViewId || !upstreamNodeId) return;

      if (data.viewId === upstreamViewId) {
        // No filtering active — row index is the same in the upstream view.
        updateNodeData(upstreamNodeId, { jumpRequest: derivedRowIndex });
        return;
      }

      // Filtered view: ask Rust to map the derived row index to the source row index.
      const result = await commands.getSourceRowIndex(
        data.viewId,
        derivedRowIndex,
        upstreamViewId
      );
      if (result.status !== "ok") return;
      updateNodeData(upstreamNodeId, { jumpRequest: result.data });
    },
    [id, data.viewId, getNodes, getEdges, updateNodeData]
  );

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-violet-700 bg-neutral-900 shadow-lg"
      style={{ width: "100%", height: "100%" }}
    >
      <NodeResizer isVisible={selected} minWidth={400} minHeight={200} />
      {/* target only: DerivedLogViewNode is always the terminal node in the graph */}
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
