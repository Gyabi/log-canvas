import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { commands, type DltFileInfo } from "../../bindings";
import { useLogView } from "./useLogView";
import LogViewDisplay from "./LogViewDisplay";
import type { SourceLogViewData } from "../../types";

export type SourceLogViewNodeType = Node<SourceLogViewData, "sourceLogView">;

export default function SourceLogViewNode({
  id,
  data,
  selected,
}: NodeProps<SourceLogViewNodeType>) {
  const { updateNodeData } = useReactFlow();
  const lv = useLogView(data.viewId, data.rowCount ?? 0);

  useEffect(() => {
    if (data.jumpRequest == null) return;
    lv.scrollToIndex(data.jumpRequest);
    updateNodeData(id, { jumpRequest: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.jumpRequest]);

  async function handleOpenFile() {
    const path = await open({ filters: [{ name: "DLT", extensions: ["dlt"] }] });
    if (!path) return;
    const result = await commands.openDltFile(path);
    if (result.status === "ok") {
      const info: DltFileInfo = result.data;
      updateNodeData(id, { viewId: info.id, rowCount: info.rowCount });
    }
  }

  const fileName = data.viewId
    ? (data.viewId.split("/").pop() ?? data.viewId)
    : "file is not selected";

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-neutral-600 bg-neutral-900 shadow-lg"
      style={{ width: "100%", height: "100%" }}
    >
      <NodeResizer isVisible={selected} minWidth={400} minHeight={200} />
      <Handle type="source" position={Position.Right} />

      <div className="shrink-0 flex items-center gap-2 border-b border-neutral-700 bg-neutral-800 px-3 py-2 cursor-grab active:cursor-grabbing">
        <span className="flex-1 truncate text-xs font-semibold text-neutral-300">
          {fileName}
        </span>
        <button
          onClick={handleOpenFile}
          className="nodrag shrink-0 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 active:bg-blue-700"
        >
          open
        </button>
      </div>

      <LogViewDisplay {...lv} emptyMessage="Please open a DLT file" />
    </div>
  );
}
