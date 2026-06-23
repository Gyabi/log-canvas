import { useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { DOT, COLOR_OPTIONS } from "../../utils/constraint";
import type { MarkColor } from "../../utils/constraint";
import type { MarkingNodeData, MarkingNodeType } from "../../types/condition";
import { conditionChipLabel } from "../../utils/conditionChipLabel";
import ConditionBase from "./conditionBase";
import { ConditionEditor } from "./conditionEditor";

export type { MarkingNodeData, MarkingNodeType };

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
              {conditionChipLabel(r)}
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
              { field, op, value, color: newColor },
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
