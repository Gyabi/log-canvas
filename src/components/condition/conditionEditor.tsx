import { useState } from "react";
import { FIELD_OPTIONS, OP_OPTIONS } from "../../utils/constraint";

type ConditionEditorProps = {
  onAdd: (field: string, op: string, value: string) => void;

  children?: React.ReactNode;
  addLabel: string;
};

export function ConditionEditor({
  onAdd,
  addLabel,
  children,
}: ConditionEditorProps) {
  const [showAdd, setShowAdd] = useState(false);

  const [field, setField] = useState("ecuId");
  const [op, setOp] = useState("eq");
  const [value, setValue] = useState("");

  function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed) return;

    onAdd(field, op, trimmed);

    setValue("");
    setShowAdd(false);
  }

  if (!showAdd) {
    return (
      <button
        onClick={() => setShowAdd(true)}
        className="text-xs text-neutral-500 hover:text-neutral-300"
      >
        {addLabel}
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded border border-neutral-700 p-2">
      <select
        value={field}
        onChange={(e) => setField(e.target.value)}
        className="w-full rounded bg-neutral-700 px-2 py-1 text-xs text-violet-700 font-semibold"
      >
        {FIELD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={op}
        onChange={(e) => setOp(e.target.value)}
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") setShowAdd(false);
        }}
        className="w-full rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500"
        placeholder="value..."
      />

      {children}

      <div className="flex gap-1.5">
        <button
          onClick={handleAdd}
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
  );
}
