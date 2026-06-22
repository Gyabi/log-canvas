import { useState } from "react";
import { useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import { FIELD_OPTIONS, OP_OPTIONS } from "../../utils/constraint";
import type { DltFilter } from "../../bindings";
import ConditionBase from "./conditionBase";

export type FilterNodeData = {
  filters: DltFilter[];
};
export type FilterNodeType = Node<FilterNodeData, "filter">;

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
  const { updateNodeData } = useReactFlow();

  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState("ecuId");
  const [newOp, setNewOp] = useState("eq");
  const [newValue, setNewValue] = useState("");

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

  return (
    <ConditionBase id={id} selected={selected} title="⚙ Filter">
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
    </ConditionBase>
  );
}
