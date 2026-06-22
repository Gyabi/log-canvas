import { useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import { FIELD_OPTIONS, OP_OPTIONS } from "../../utils/constraint";
import type { DltFilter } from "../../bindings";
import ConditionBase from "./conditionBase";
import { ConditionEditor } from "./conditionEditor";

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
