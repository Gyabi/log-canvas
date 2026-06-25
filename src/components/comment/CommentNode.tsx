import { useEffect, useMemo, useRef } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useEdges,
  useNodes,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";
import {
  COLOR_OPTIONS,
  COMMENT_BG,
  commentNodeBottomHandleID,
  commentNodeLeftHandleID,
  commentNodeRightHandleID,
  commentNodeTopHandleID,
  isRowAnchorHandle,
  ROW_HEIGHT,
} from "../../utils/constraint";
import type { CommentNodeType } from "../../types/comment";
import type { LogViewScrollState, RowAnchor } from "../../types/logView";

export default function CommentNode({
  id,
  data,
  selected,
}: NodeProps<CommentNodeType>) {
  const { updateNodeData, setNodes } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const bgClass = COMMENT_BG[data.color] ?? COMMENT_BG.yellow;

  // Find the row-anchor edge connected to this comment (either direction).
  const rowEdge = useMemo(
    () =>
      edges.find(
        (e) =>
          (e.target === id && isRowAnchorHandle(e.sourceHandle)) ||
          (e.source === id && isRowAnchorHandle(e.targetHandle)),
      ),
    [edges, id],
  );

  const logViewNodeId = rowEdge
    ? rowEdge.target === id
      ? rowEdge.source
      : rowEdge.target
    : undefined;
  const anchorHandleId = rowEdge
    ? rowEdge.target === id
      ? rowEdge.sourceHandle
      : rowEdge.targetHandle
    : undefined;

  // Read the connected LogView node's data.
  const logViewNode = useMemo(
    () => (logViewNodeId ? nodes.find((n) => n.id === logViewNodeId) : undefined),
    [nodes, logViewNodeId],
  );

  const logViewData = logViewNode?.data as
    | { scrollState?: LogViewScrollState; rowAnchors?: RowAnchor[] }
    | undefined;

  const anchor = useMemo(
    () => logViewData?.rowAnchors?.find((a) => a.handleId === anchorHandleId),
    [logViewData?.rowAnchors, anchorHandleId],
  );

  const scrollState = logViewData?.scrollState;

  // Compute target canvas position + visibility for this comment.
  const targetState = useMemo(() => {
    if (!rowEdge || !logViewNode || !anchor || !scrollState) return null;

    const midContent = ((anchor.minRow + anchor.maxRow + 1) / 2) * ROW_HEIGHT;
    const visibleY = midContent - scrollState.scrollTop;
    const isVisible =
      visibleY >= 0 && visibleY <= scrollState.scrollContainerHeight;

    return {
      isVisible,
      y: isVisible
        ? logViewNode.position.y +
          scrollState.wrapperOffsetTop +
          scrollState.headerHeight +
          visibleY
        : null,
    };
  }, [rowEdge, logViewNode, anchor, scrollState]);

  // Apply position / visibility changes to this node.
  // We use style.visibility (not node.hidden) so the component stays mounted and
  // its useEffect continues to run — hidden:true unmounts the component in React Flow.
  const prevTargetRef = useRef<typeof targetState>(null);
  useEffect(() => {
    if (!targetState) {
      // Disconnected — restore visibility.
      if (prevTargetRef.current !== null) {
        prevTargetRef.current = null;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id
              ? { ...n, style: { ...n.style, visibility: undefined, pointerEvents: undefined } }
              : n,
          ),
        );
      }
      return;
    }

    const prev = prevTargetRef.current;
    if (
      prev &&
      prev.isVisible === targetState.isVisible &&
      prev.y === targetState.y
    ) {
      return;
    }
    prevTargetRef.current = targetState;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        return {
          ...n,
          style: {
            ...n.style,
            visibility: targetState.isVisible ? undefined : "hidden",
            pointerEvents: targetState.isVisible ? undefined : "none",
          },
          ...(targetState.isVisible && targetState.y !== null
            ? { position: { ...n.position, y: targetState.y } }
            : {}),
        };
      }),
    );
  }, [targetState, id, setNodes]);

  return (
    <div
      className={`flex flex-col rounded-lg border ${bgClass} overflow-hidden`}
      style={{ width: "100%", height: "100%", minWidth: 160, minHeight: 80 }}
    >
      <div className="flex items-center gap-2 border-b border-neutral-700 bg-neutral-800 rounded-t-lg px-3 py-2">
        <span className="text-xs font-semibold text-neutral-300">
          💬Comment
        </span>
      </div>

      <NodeResizer isVisible={selected} minWidth={160} minHeight={80} />

      <Handle type="source" position={Position.Top} id={commentNodeTopHandleID} />
      <Handle type="source" position={Position.Bottom} id={commentNodeBottomHandleID} />
      <Handle type="source" position={Position.Left} id={commentNodeLeftHandleID} />
      <Handle type="source" position={Position.Right} id={commentNodeRightHandleID} />

      <textarea
        className="nodrag nowheel flex-1 resize-none bg-transparent px-2 pt-2 text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
        value={data.text}
        placeholder="Write comment…"
        onChange={(e) => updateNodeData(id, { text: e.target.value })}
      />

      {/* Color picker */}
      <div className="nodrag flex items-center gap-1.5 px-2 py-1">
        {COLOR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            title={opt.value}
            className={`h-3 w-3 rounded-full ${opt.dot} transition-transform ${
              data.color === opt.value
                ? "scale-125 ring-1 ring-white/60"
                : "opacity-60 hover:opacity-100"
            }`}
            onClick={() => updateNodeData(id, { color: opt.value })}
          />
        ))}
      </div>
    </div>
  );
}
