import { useState } from "react";
import { FolderOpen, Save, SaveAll } from "lucide-react";
import { Collapsible } from "../ui/Collapsible";
import { ToolButton } from "./toolButton";

type Props = {
  currentPath: string | null;
  isDirty: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
};

export function ProjectToolbar({
  currentPath,
  isDirty,
  onSave,
  onSaveAs,
  onLoad,
}: Props) {
  const [open, setOpen] = useState(false);
  const fileName = currentPath
    ? (currentPath.split(/[\\/]/).pop() ?? currentPath)
    : null;

  function close() {
    setOpen(false);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/95 px-3 py-2 shadow-2xl backdrop-blur-sm transition-all hover:bg-neutral-700/80 active:scale-95"
      >
        <FolderOpen
          size={14}
          className={isDirty ? "text-amber-400" : "text-neutral-400"}
        />
        <span className="max-w-32 truncate text-xs font-semibold text-neutral-300">
          {fileName ?? "Project"}
        </span>
        {isDirty && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
        )}
      </button>

      {/* Panel — expands downward */}
      <Collapsible open={open} direction="down" className="w-full">
        <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800/95 shadow-2xl backdrop-blur-sm">
          <div className="border-b border-neutral-700 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Project
            </span>
          </div>
          <div className="flex flex-col gap-0.5 p-1.5">
            <ToolButton
              icon={<Save size={14} className="text-emerald-400" />}
              label="Save"
              description="Overwrite · Ctrl+S"
              accent="bg-emerald-900/60"
              onClick={() => {
                onSave();
                close();
              }}
            />
            <ToolButton
              icon={<SaveAll size={14} className="text-teal-400" />}
              label="Save As"
              description="Ctrl+Shift+S"
              accent="bg-teal-900/60"
              onClick={() => {
                onSaveAs();
                close();
              }}
            />
            <ToolButton
              icon={<FolderOpen size={14} className="text-sky-400" />}
              label="Load"
              description="Ctrl+O"
              accent="bg-sky-900/60"
              onClick={() => {
                onLoad();
                close();
              }}
            />
          </div>
        </div>
      </Collapsible>
    </div>
  );
}
