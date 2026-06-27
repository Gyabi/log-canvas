import { useEffect } from "react";
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
import { commands } from "../bindings";
import { useProjectState } from "../hooks/useProjectState";
import { ProjectToolbar } from "./tool-bar/ProjectToolbar";
import { AddNodeToolbar } from "./tool-bar/AddNodeToolbar";
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

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { currentPath, isDirty, saveAs, saveOverwrite, load } = useProjectState(
    nodes,
    edges,
    setNodes,
    setEdges
  );

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

    if (isRowAnchorHandle(sh)) return targetType === "comment";
    if (isRowAnchorHandle(th)) return sourceType === "comment";

    if (sh === sourceLogViewOutputHandleId) {
      return targetType === "filter" || targetType === "marking";
    }

    if (sh === conditionBaseOutputHandleId) {
      return (
        targetType === "filter" ||
        targetType === "marking" ||
        targetType === "derivedLogView"
      );
    }

    if (sourceType === "comment") return false;

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

      {/* Status bar (top center) */}
      <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 flex items-center gap-1.5 rounded-b-lg border border-t-0 border-neutral-700 bg-neutral-800/95 px-3 py-1 backdrop-blur-sm">
        <span className="text-xs text-neutral-400">
          {fileName ?? "new project"}
        </span>
        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
      </div>

      {/* Project toolbar (top right) */}
      <div className="absolute top-4 right-4 z-10">
        <ProjectToolbar
          currentPath={currentPath}
          isDirty={isDirty}
          onSave={() => void saveOverwrite()}
          onSaveAs={() => void saveAs()}
          onLoad={() => void load()}
        />
      </div>

      {/* Add node toolbar (bottom center) */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <AddNodeToolbar onAdd={addNode} />
      </div>
    </div>
  );
}
