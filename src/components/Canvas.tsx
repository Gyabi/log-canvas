import { useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import {
  FileText,
  SlidersHorizontal,
  Palette,
  Sparkle,
  MessageSquare,
  Save,
  SaveAll,
  FolderOpen,
  Plus,
  X,
} from "lucide-react";
import { commands } from "../bindings";
import { useProjectState } from "../hooks/useProjectState";
import SourceLogViewNode from "./log-view/SourceLogViewNode";
import DerivedLogViewNode from "./log-view/DerivedLogViewNode";
import FilterNode from "./condition/FilterNode";
import MarkingNode from "./condition/MarkingNode";
import CommentNode from "./comment/CommentNode";
import {
  NODE_TEMPLATES,
  SINGLE_INPUT_TYPES,
  isRowAnchorHandle,
  sourceLogViewOutputHandleId,
  conditionBaseOutputHandleId,
} from "../utils/constraint";
import type { SourceLogViewData } from "../types/logView";
import type { DerivedLogViewData } from "../types/logView";

const nodeTypes = {
  sourceLogView: SourceLogViewNode,
  derivedLogView: DerivedLogViewNode,
  filter: FilterNode,
  marking: MarkingNode,
  comment: CommentNode,
};

const ADD_NODE_ITEMS = [
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

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { currentPath, isDirty, saveAs, saveOverwrite, load } = useProjectState(
    nodes,
    edges,
    setNodes,
    setEdges
  );

  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  // Ctrl+S → overwrite save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void saveOverwrite();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveOverwrite]);

  function isValidConnection(connection: Edge | Connection): boolean {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const sh = connection.sourceHandle ?? "";
    const th = connection.targetHandle ?? "";
    const sourceType = sourceNode.type ?? "";
    const targetType = targetNode.type ?? "";

    // Row-anchor handle ↔ Comment only
    if (isRowAnchorHandle(sh)) return targetType === "comment";
    if (isRowAnchorHandle(th)) return sourceType === "comment";

    // LogView data output → Filter / Marker only
    if (sh === sourceLogViewOutputHandleId) {
      return targetType === "filter" || targetType === "marking";
    }

    // Condition output → Filter / Marker / DerivedLogView
    if (sh === conditionBaseOutputHandleId) {
      return (
        targetType === "filter" ||
        targetType === "marking" ||
        targetType === "derivedLogView"
      );
    }

    // Comment source handles may only target row-anchor handles (already handled above)
    if (sourceType === "comment") return false;

    // Only one connection per target handle for single-input node types
    if (SINGLE_INPUT_TYPES.has(targetType)) {
      const alreadyConnected = edges.some(
        (e) => e.target === connection.target && e.targetHandle === th
      );
      if (alreadyConnected) return false;
    }

    return true;
  }

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

  function addNode(type: keyof typeof NODE_TEMPLATES) {
    const template = NODE_TEMPLATES[type];
    const offset = (nodes.length % 5) * 40;
    setNodes((prev) => [
      ...prev,
      {
        id: `${type}-${crypto.randomUUID()}`,
        type,
        position: {
          x: template.position.x + offset,
          y: template.position.y + offset,
        },
        data: structuredClone(template.data),
        style: template.style,
        // Comment nodes must always render above LogView nodes.
        ...(type === "comment" ? { zIndex: 1000 } : {}),
      },
    ]);
  }

  const fileName = currentPath
    ? (currentPath.split(/[\\/]/).pop() ?? currentPath)
    : null;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
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

      {/* ── Status bar (top center) ───────────────────────────────────────── */}
      <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 flex items-center gap-1.5 rounded-b-lg border border-t-0 border-neutral-700 bg-neutral-800/95 px-3 py-1 backdrop-blur-sm">
        <span className="text-xs text-neutral-400">
          {fileName ?? "new project"}
        </span>
        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
      </div>

      {/* ── PROJECT panel (top right, collapsible) ───────────────────────── */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5">
        {projectOpen && (
          <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800/95 shadow-2xl backdrop-blur-sm">
            <div className="border-b border-neutral-700 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Project
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-1.5">
              <button
                onClick={() => {
                  void saveOverwrite();
                  setProjectOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-neutral-700/60 active:scale-95"
              >
                <Save size={14} className="shrink-0 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    Save
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    Overwrite Save · Ctrl+S
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  void saveAs();
                  setProjectOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-neutral-700/60 active:scale-95"
              >
                <SaveAll size={14} className="shrink-0 text-teal-400" />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    Save As
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    Save As · Ctrl+Shift+S
                  </div>
                </div>
              </button>
              <button
                onClick={() => {
                  void load();
                  setProjectOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-neutral-700/60 active:scale-95"
              >
                <FolderOpen size={14} className="shrink-0 text-sky-400" />
                <div>
                  <div className="text-xs font-semibold text-neutral-200">
                    Load
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    Load Project · Ctrl+O
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Toggle */}
        <button
          onClick={() => setProjectOpen((o) => !o)}
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
      </div>

      {/* ── ADD NODE panel (bottom center, collapsible) ───────────────────── */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
        {addNodeOpen && (
          <div className="flex gap-1 rounded-xl border border-neutral-700 bg-neutral-800/95 p-1.5 shadow-2xl backdrop-blur-sm">
            {ADD_NODE_ITEMS.map((item) => (
              <button
                key={item.type}
                onClick={() => addNode(item.type)}
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
        )}

        {/* Toggle */}
        <button
          onClick={() => setAddNodeOpen((o) => !o)}
          className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/95 px-4 py-2 shadow-2xl backdrop-blur-sm transition-all hover:bg-neutral-700/80 active:scale-95"
        >
          {addNodeOpen ? (
            <X size={14} className="text-neutral-400" />
          ) : (
            <Plus size={14} className="text-neutral-400" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            Add Node
          </span>
        </button>
      </div>
    </div>
  );
}
