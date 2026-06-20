import { Handle, Position } from "@xyflow/react";

export default function PlaceholderNode({ data }: { data: { label: string } }) {
  return (
    <div className="rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-3 shadow-lg w-64">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Log View (placeholder)
      </div>
      <div className="text-sm text-neutral-200">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
