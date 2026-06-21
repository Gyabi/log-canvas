import { useState } from "react";
import {
  Handle,
  Position,
  useReactFlow,
  useStore,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { Copy } from "lucide-react";
import type { FilterNodeData, DerivedLogViewData } from "../../types";

export type { FilterNodeData };
export type FilterNodeType = Node<FilterNodeData, "filter">;

const FIELD_OPTIONS = [
  { value: "ecuId", label: "ECU" },
  { value: "appId", label: "App" },
  { value: "ctxId", label: "Ctx" },
  { value: "level", label: "Level" },
  { value: "payload", label: "Payload" },
] as const;

const OP_OPTIONS = [
  { value: "eq", label: "= (equal)" },
  { value: "neq", label: "≠ (not equal)" },
  { value: "contains", label: "∋ (contains)" },
  { value: "regex", label: "~ (regex)" },
] as const;

function chipLabel(f: FilterNodeData["filters"][number]): string {
  const field =
    FIELD_OPTIONS.find((o) => o.value === f.field)?.label ?? f.field;
  const op =
    OP_OPTIONS.find((o) => o.value === f.op)?.label?.split(" ")[0] ?? f.op;
  return `${field} ${op} ${f.value}`;
}

export default function FilterNode({
  id,
  data,
  selected,
}: NodeProps<FilterNodeType>) {
  const { getNodes, getEdges, addNodes, addEdges, updateNodeData } =
    useReactFlow();

  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState("ecuId");
  const [newOp, setNewOp] = useState("eq");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const liveRowCount = useStore((s) => {
    const outEdge = s.edges.find((e) => e.source === id);
    if (!outEdge) return null;
    const node = s.nodes.find((n) => n.id === outEdge.target);
    return (node?.data as { rowCount?: number } | undefined)?.rowCount ?? null;
  });

  function addFilter() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    updateNodeData(id, {
      filters: [
        ...data.filters,
        { field: newField, op: newOp, value: trimmed },
      ],
    });
    setNewValue("");
    setShowAdd(false);
  }

  function removeFilter(index: number) {
    updateNodeData(id, { filters: data.filters.filter((_, i) => i !== index) });
  }

  function handleDuplicate() {
    const selfNode = getNodes().find((n) => n.id === id);
    addNodes([
      {
        id: `filter-${crypto.randomUUID()}`,
        type: "filter",
        position: {
          x: (selfNode?.position.x ?? 0) + 24,
          y: (selfNode?.position.y ?? 0) + 24,
        },
        data: { filters: data.filters.map((f) => ({ ...f })) },
      },
    ]);
  }

  function handleCreateOutput() {
    setError(null);
    const edges = getEdges();

    // If already connected to a derived node, nothing to do — useDerivedViewSync handles updates.
    if (edges.some((e) => e.source === id)) return;

    const nodes = getNodes();
    const selfNode = nodes.find((n) => n.id === id);
    const derivedId = `derived-${crypto.randomUUID()}`;
    addNodes([
      {
        id: derivedId,
        type: "derivedLogView",
        position: {
          x: (selfNode?.position.x ?? 0) + 320,
          y: selfNode?.position.y ?? 0,
        },
        data: {
          rowCount: 0,
          label: "Filtered View",
        } satisfies DerivedLogViewData,
        style: { width: 1280, height: 720 },
      },
    ]);
    addEdges([
      { id: `edge-${id}-${derivedId}`, source: id, target: derivedId },
    ]);
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
        <span className="text-xs font-semibold text-neutral-300">⚙ Filter</span>
        {liveRowCount !== null && (
          <span className="rounded bg-violet-900/60 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
            {liveRowCount.toLocaleString()} rows
          </span>
        )}
        <button
          onClick={handleDuplicate}
          className="nodrag ml-auto text-neutral-500 hover:text-neutral-300"
          title="Duplicate"
        >
          <Copy size={12} />
        </button>
      </div>

      <div className="nodrag space-y-2 p-3">
        {data.filters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.filters.map((f, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200"
              >
                {chipLabel(f)}
                <button
                  onClick={() => removeFilter(i)}
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
              className="w-full rounded bg-neutral-700 px-2 py-1 text-xs text-violet-700 font-semibold"
            >
              {FIELD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={newOp}
              onChange={(e) => setNewOp(e.target.value)}
              className="w-full rounded bg-neutral-700 px-2 py-1 text-xs text-violet-700 font-semibold"
            >
              {OP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              autoFocus
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addFilter();
                if (e.key === "Escape") setShowAdd(false);
              }}
              className="w-full rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500"
              placeholder="value..."
            />
            <div className="flex gap-1.5">
              <button
                onClick={addFilter}
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
            ＋ Add condition
          </button>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

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
