import { ReactNode } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Copy } from "lucide-react";
import {
  conditionBaseInputHandleId,
  conditionBaseOutputHandleId,
} from "../../utils/constraint";

export type ConditionBaseProps = {
  id: string;
  selected: boolean;
  title: string;
  liveRowCount?: number | null;
  children: ReactNode;
};
export default function ConditionBase({
  id,
  selected,
  title,
  children,
}: ConditionBaseProps) {
  const { getNodes, addNodes } = useReactFlow();

  function nodeDuplicate() {
    const selfNode = getNodes().find((n) => n.id === id);
    if (!selfNode) return;

    addNodes([
      {
        ...structuredClone(selfNode),
        id: `${selfNode.type}-${crypto.randomUUID()}`,
        position: {
          x: selfNode.position.x + 24,
          y: selfNode.position.y + 24,
        },
        selected: false,
      },
    ]);
  }
  return (
    <div
      className={`w-64 rounded-lg border bg-neutral-900 shadow-lg ${
        selected ? "border-blue-500" : "border-neutral-600"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={conditionBaseInputHandleId}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={conditionBaseOutputHandleId}
      />

      <div className="flex items-center gap-2 border-b border-neutral-700 bg-neutral-800 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-300">{title}</span>

        <button
          onClick={nodeDuplicate}
          className="nodrag ml-auto text-neutral-500 hover:text-neutral-300"
          title="Duplicate"
        >
          <Copy size={12} />
        </button>
      </div>

      <div className="nodrag space-y-2 p-3">{children}</div>
    </div>
  );
}
