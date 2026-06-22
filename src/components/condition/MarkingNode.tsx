import { useState } from "react";
import { useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import { DOT } from "../../utils/constraint";

export type MarkingRule = {
  field: string;
  op: string;
  value: string;
  color: MarkColor;
};
export type MarkingNodeData = {
  rules: MarkingRule[];
};
export type MarkingNodeType = Node<MarkingNodeData, "marking">;

import {
  FIELD_OPTIONS,
  COLOR_OPTIONS,
  MarkColor,
  OP_OPTIONS,
} from "../../utils/constraint";
import ConditionBase from "./conditionBase";

function chipLabel(r: MarkingRule): string {
  const field =
    FIELD_OPTIONS.find((o) => o.value === r.field)?.label ?? r.field;
  const op =
    OP_OPTIONS.find((o) => o.value === r.op)?.label?.split(" ")[0] ?? r.op;
  return `${field} ${op} ${r.value}`;
}

export default function MarkingNode({
  id,
  data,
  selected,
}: NodeProps<MarkingNodeType>) {
  const { updateNodeData } = useReactFlow();

  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState("level");
  const [newOp, setNewOp] = useState("eq");
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState<MarkColor>("red");

  function addRule() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    updateNodeData(id, {
      rules: [
        ...data.rules,
        { field: newField, op: newOp, value: trimmed, color: newColor },
      ],
    });
    setNewValue("");
    setShowAdd(false);
  }

  function removeRule(index: number) {
    updateNodeData(id, { rules: data.rules.filter((_, i) => i !== index) });
  }

  return (
    <ConditionBase id={id} selected={selected} title="🎨 Marking">
      {data.rules.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.rules.map((r, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-200"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${DOT[r.color]}`}
              />
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
                  newColor === c.value
                    ? "ring-2 ring-white ring-offset-1 ring-offset-neutral-800"
                    : ""
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
    </ConditionBase>
  );
}
