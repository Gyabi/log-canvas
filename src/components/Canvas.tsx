import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Connection,
} from "@xyflow/react";
import { FileText, SlidersHorizontal, Palette } from "lucide-react";
import { commands } from "../bindings";
import SourceLogViewNode from "./log-view/SourceLogViewNode";
import DerivedLogViewNode from "./log-view/DerivedLogViewNode";
import FilterNode from "./condition/FilterNode";
import MarkingNode from "./condition/MarkingNode";
import type { SourceLogViewData, DerivedLogViewData } from "../types";

const nodeTypes = {
  sourceLogView: SourceLogViewNode,
  derivedLogView: DerivedLogViewNode,
  filter: FilterNode,
  marking: MarkingNode,
};

type ToolButtonProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  accent: string;
};

function ToolButton({
  icon,
  label,
  description,
  onClick,
  accent,
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-neutral-700/60 active:scale-95 active:bg-neutral-700`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${accent}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-neutral-200">
          {label}
        </span>
        <span className="block text-[10px] text-neutral-500">
          {description}
        </span>
      </span>
    </button>
  );
}

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  function onConnect(params: Connection) {
    setEdges((eds) => addEdge(params, eds));
  }

  function onNodesDelete(deleted: Node[]) {
    for (const node of deleted) {
      if (node.type === "sourceLogView") {
        const viewId = (node.data as SourceLogViewData).viewId;
        if (viewId) void commands.closeDltFile(viewId);
      } else if (node.type === "derivedLogView") {
        const viewId = (node.data as DerivedLogViewData).viewId;
        if (viewId) void commands.deleteView(viewId);
      }
    }
  }

  function addSourceLogViewNode() {
    const id = `source-${crypto.randomUUID()}`;
    const offset = (nodes.length % 5) * 40;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "sourceLogView",
        position: { x: 80 + offset, y: 80 + offset },
        data: {},
        style: { width: 1280, height: 720 },
      },
    ]);
  }

  function addFilterNode() {
    const id = `filter-${crypto.randomUUID()}`;
    const offset = (nodes.length % 5) * 40;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "filter",
        position: { x: 200 + offset, y: 200 + offset },
        data: { filters: [] },
      },
    ]);
  }

  function addMarkingNode() {
    const id = `marking-${crypto.randomUUID()}`;
    const offset = (nodes.length % 5) * 40;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "marking",
        position: { x: 200 + offset, y: 300 + offset },
        data: { rules: [] },
      },
    ]);
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        nodeTypes={nodeTypes}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.1}
        maxZoom={4}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#404040"
        />
        <Controls />
        <MiniMap
          nodeColor="#525252"
          maskColor="rgba(10,10,10,0.6)"
          style={{ background: "#1a1a1a" }}
        />
      </ReactFlow>

      {/* Floating toolbar */}
      <div className="absolute left-4 top-4 z-10 flex flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800/95 shadow-2xl backdrop-blur-sm">
        <div className="border-b border-neutral-700 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            ADD NODE
          </span>
        </div>
        <div className="flex gap-0.5 p-1.5">
          <ToolButton
            icon={<FileText size={16} className="text-blue-300" />}
            label="Log File"
            description="DLT source view"
            onClick={addSourceLogViewNode}
            accent="bg-blue-900/60"
          />
          <ToolButton
            icon={<SlidersHorizontal size={16} className="text-amber-300" />}
            label="Filter"
            description="Row filter conditions"
            onClick={addFilterNode}
            accent="bg-amber-900/60"
          />
          <ToolButton
            icon={<Palette size={16} className="text-purple-300" />}
            label="Marking"
            description="Color highlight rules"
            onClick={addMarkingNode}
            accent="bg-purple-900/60"
          />
        </div>
      </div>
    </div>
  );
}
