import { useState } from "react";
import {
  Handle,
  Position,
  useReactFlow,
  useStore,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import type { MarkColor, MarkingRule, MarkingNodeData, DerivedLogViewData } from "../../types";

export type { MarkingNodeData };
export type MarkingNodeType = Node<MarkingNodeData, "marking">;

const FIELD_OPTIONS = [
  { value: "ecuId", label: "ECU" },
  { value: "appId", label: "App" },
  { value: "ctxId", label: "Ctx" },
  { value: "level", label: "Level" },
  { value: "payload", label: "Payload" },
] as const;

const OP_OPTIONS = [
  { value: "eq", label: "= (完全一致)" },
  { value: "neq", label: "≠ (除外)" },
  { value: "contains", label: "∋ (含む)" },
  { value: "regex", label: "~ (正規表現)" },
] as const;

const COLOR_OPTIONS: { value: MarkColor; dot: string }[] = [
  { value: "red",    dot: "bg-red-500" },
  { value: "yellow", dot: "bg-amber-400" },
  { value: "green",  dot: "bg-green-500" },
  { value: "blue",   dot: "bg-blue-500" },
  { value: "purple", dot: "bg-purple-500" },
];

const DOT: Record<MarkColor, string> = {
  red:    "bg-red-500",
  yellow: "bg-amber-400",
  green:  "bg-green-500",
  blue:   "bg-blue-500",
  purple: "bg-purple-500",
};

function chipLabel(r: MarkingRule): string {
  const field = FIELD_OPTIONS.find((o) => o.value === r.field)?.label ?? r.field;
  const op = OP_OPTIONS.find((o) => o.value === r.op)?.label?.split(" ")[0] ?? r.op;
  return `${field} ${op} ${r.value}`;
}

type NodeViewData = { viewId?: string; rowCount?: number };

export default function MarkingNode({ id, data, selected }: NodeProps<MarkingNodeType>) {
  const { getNodes, getEdges, addNodes, addEdges, updateNodeData } = useReactFlow();

  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState("level");
  const [newOp, setNewOp] = useState("eq");
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState<MarkColor>("red");
  const [error, setError] = useState<string | null>(null);

  // Reactively read the connected derived node's applied rule count.
  const liveRuleCount = useStore((s) => {
    const outEdge = s.edges.find((e) => e.source === id);
    if (!outEdge) return null;
    const node = s.nodes.find((n) => n.id === outEdge.target);
    const d = node?.data as { markingRules?: unknown[] } | undefined;
    return d?.markingRules?.length ?? null;
  });

  function addRule() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    updateNodeData(id, {
      rules: [...data.rules, { field: newField, op: newOp, value: trimmed, color: newColor }],
    });
    setNewValue("");
    setShowAdd(false);
  }

  function removeRule(index: number) {
    updateNodeData(id, { rules: data.rules.filter((_, i) => i !== index) });
  }

  async function handleCreateOutput() {
    setError(null);
    const edges = getEdges();
    const nodes = getNodes();

    const incomingEdge = edges.find((e) => e.target === id);
    if (!incomingEdge) {
      setError("Connect an input node first");
      return;
    }
    const sourceNode = nodes.find((n) => n.id === incomingEdge.source);
    const sourceData = sourceNode?.data as NodeViewData | undefined;
    if (!sourceData?.viewId) {
      setError("Open a DLT file on the source node first");
      return;
    }

    const outgoingEdge = edges.find((e) => e.source === id);
    const existingDerived = outgoingEdge
      ? nodes.find((n) => n.id === outgoingEdge.target)
      : undefined;

    if (existingDerived) {
      updateNodeData(existingDerived.id, { markingRules: data.rules });
    } else {
      const derivedId = `derived-${crypto.randomUUID()}`;
      const selfNode = nodes.find((n) => n.id === id);
      const rowCount = sourceData.rowCount ?? 0;
      addNodes([
        {
          id: derivedId,
          type: "derivedLogView",
          position: {
            x: (selfNode?.position.x ?? 0) + 320,
            y: selfNode?.position.y ?? 0,
          },
          data: {
            sourceViewId: sourceData.viewId,
            viewId: sourceData.viewId,
            rowCount,
            label: "Marked View",
            markingRules: data.rules,
          } satisfies DerivedLogViewData,
          style: { width: 1280, height: 720 },
        },
      ]);
      addEdges([{ id: `edge-${id}-${derivedId}`, source: id, target: derivedId }]);
    }
  }

  return (
    <div
      className={`w-64 rounded-lg border bg-neutral-900 shadow-lg ${
        selected ? "border-blue-500" : "border-neutral-600"
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="flex items-center gap-2 border-b border-neutral-700 bg-neutral-800 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-300">🎨 Marking</span>
        {liveRuleCount !== null && (
          <span className="ml-auto rounded bg-violet-900/60 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
            {liveRuleCount} rule{liveRuleCount !== 1 ? "s" : ""} applied
          </span>
        )}
      </div>

      <div className="nodrag space-y-2 p-3">
        {data.rules.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.rules.map((r, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200"
              >
                <span className={`inline-block h-2 w-2 rounded-full ${DOT[r.color]}`} />
                {chipLabel(r)}
                <button
                  onClick={() => removeRule(i)}
                  className="text-neutral-400 hover:text-red-400"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {showAdd ? (
          <div className="space-y-1.5 rounded border border-neutral-700 p-2">
            <select
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              className="w-full rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200"
            >
              {FIELD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={newOp}
              onChange={(e) => setNewOp(e.target.value)}
              className="w-full rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200"
            >
              {OP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              autoFocus
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addRule();
                if (e.key === "Escape") setShowAdd(false);
              }}
              className="w-full rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500"
              placeholder="value..."
            />
            <div className="flex items-center gap-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setNewColor(c.value)}
                  className={`h-5 w-5 rounded-full ${c.dot} ${
                    newColor === c.value ? "ring-2 ring-white ring-offset-1 ring-offset-neutral-800" : ""
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={addRule}
                className="flex-1 rounded bg-blue-600 py-1 text-xs text-white hover:bg-blue-500"
              >
                Add
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            ＋ Add rule
          </button>
        )}

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <div className="border-t border-neutral-700 pt-2">
          <button
            onClick={handleCreateOutput}
            className="w-full rounded bg-violet-700 py-1.5 text-xs text-white hover:bg-violet-600 active:bg-violet-800"
          >
            Create Output →
          </button>
        </div>
      </div>
    </div>
  );
}
