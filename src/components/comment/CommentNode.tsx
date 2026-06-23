import {
  Handle,
  NodeResizer,
  Position,
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
} from "../../utils/constraint";
import type { CommentNodeType } from "../../types/comment";

export default function CommentNode({
  id,
  data,
  selected,
}: NodeProps<CommentNodeType>) {
  const { updateNodeData } = useReactFlow();
  const bgClass = COMMENT_BG[data.color] ?? COMMENT_BG.yellow;

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

      <Handle
        type="source"
        position={Position.Top}
        id={commentNodeTopHandleID}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id={commentNodeBottomHandleID}
      />
      <Handle
        type="source"
        position={Position.Left}
        id={commentNodeLeftHandleID}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={commentNodeRightHandleID}
      />
      {/* Source handles — drag from any side to a LogView row handle */}

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
