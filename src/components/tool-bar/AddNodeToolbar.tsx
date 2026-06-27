import { useState } from "react";
import {
  FileText,
  SlidersHorizontal,
  Palette,
  Sparkle,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";
import { Collapsible } from "../ui/Collapsible";
import type { NODE_TEMPLATES } from "../../utils/constraint";

const ITEMS = [
  {
    type: "sourceLogView" as const,
    icon: <FileText size={16} className="text-blue-300" />,
    label: "Log File",
    accent: "bg-blue-900/60",
  },
  {
    type: "filter" as const,
    icon: <SlidersHorizontal size={16} className="text-amber-300" />,
    label: "Filter",
    accent: "bg-amber-900/60",
  },
  {
    type: "marking" as const,
    icon: <Palette size={16} className="text-purple-300" />,
    label: "Marking",
    accent: "bg-purple-900/60",
  },
  {
    type: "derivedLogView" as const,
    icon: <Sparkle size={16} className="text-green-300" />,
    label: "Output",
    accent: "bg-green-900/60",
  },
  {
    type: "comment" as const,
    icon: <MessageSquare size={16} className="text-yellow-300" />,
    label: "Comment",
    accent: "bg-yellow-900/60",
  },
];

type Props = {
  onAdd: (type: keyof typeof NODE_TEMPLATES) => void;
};

export function AddNodeToolbar({ onAdd }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Panel — expands upward above the toggle */}
      <Collapsible open={open}>
        <div className="flex gap-1 rounded-xl border border-neutral-700 bg-neutral-800/95 p-1.5 shadow-2xl backdrop-blur-sm">
          {ITEMS.map((item) => (
            <button
              key={item.type}
              onClick={() => onAdd(item.type)}
              className="flex flex-col items-center gap-1.5 rounded-lg px-3 py-2 transition-all hover:bg-neutral-700/60 active:scale-95"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-md ${item.accent}`}
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-semibold text-neutral-300">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </Collapsible>

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/95 px-4 py-2 shadow-2xl backdrop-blur-sm transition-all hover:bg-neutral-700/80 active:scale-95"
      >
        {open ? (
          <X size={14} className="text-neutral-400" />
        ) : (
          <Plus size={14} className="text-neutral-400" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          Add Node
        </span>
      </button>
    </div>
  );
}
