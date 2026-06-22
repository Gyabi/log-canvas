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
import { ConditionEditor } from "./conditionEditor";

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
  const [newColor, setNewColor] = useState<MarkColor>("red");

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

      <ConditionEditor
        addLabel="＋ Add rule"
        onAdd={(field, op, value) => {
          updateNodeData(id, {
            rules: [
              ...data.rules,
              {
                field,
                op,
                value,
                color: newColor,
              },
            ],
          });
        }}
      >
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
      </ConditionEditor>
    </ConditionBase>
  );
}
