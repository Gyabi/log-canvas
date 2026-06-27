import { useReactFlow, type NodeProps } from "@xyflow/react";
import type { FilterNodeData, FilterNodeType } from "../../types/condition";
import { conditionChipLabel } from "../../utils/conditionChipLabel";
import ConditionBase from "./conditionBase";
import { ConditionEditor } from "./conditionEditor";

export type { FilterNodeData, FilterNodeType };

export default function FilterNode({
  id,
  data,
  selected,
}: NodeProps<FilterNodeType>) {
  const { updateNodeData } = useReactFlow();

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
              {conditionChipLabel(f)}
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

      <ConditionEditor
        addLabel="＋ Add condition"
        onAdd={(field, op, value) => {
          updateNodeData(id, {
            filters: [...data.filters, { field, op, value }],
          });
        }}
      />
    </ConditionBase>
  );
}
