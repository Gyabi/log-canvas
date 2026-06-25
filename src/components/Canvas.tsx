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
import { FileText, SlidersHorizontal, Palette, Sparkle, MessageSquare } from "lucide-react";
import { commands } from "../bindings";
import SourceLogViewNode from "./log-view/SourceLogViewNode";
import DerivedLogViewNode from "./log-view/DerivedLogViewNode";
import FilterNode from "./condition/FilterNode";
import MarkingNode from "./condition/MarkingNode";
import CommentNode from "./comment/CommentNode";
import { ToolBar } from "./tool-bar/toolBar";
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
      return targetType === "filter" || targetType === "marking" || targetType === "derivedLogView";
    }

    // Comment source handles may only target row-anchor handles (already handled above)
    if (sourceType === "comment") return false;

    // Only one connection per target handle for single-input node types
    if (SINGLE_INPUT_TYPES.has(targetType)) {
      const alreadyConnected = edges.some(
        (e) => e.target === connection.target && e.targetHandle === th,
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
      },
    ]);
  }

  const toolbarItems = [
    {
      type: "sourceLogView",
      icon: <FileText size={16} className="text-blue-300" />,
      label: "Log File",
      description: "DLT source view",
      accent: "bg-blue-900/60",
    },
    {
      type: "filter",
      icon: <SlidersHorizontal size={16} className="text-amber-300" />,
      label: "Filter",
      description: "Row filter conditions",
      accent: "bg-amber-900/60",
    },
    {
      type: "marking",
      icon: <Palette size={16} className="text-purple-300" />,
      label: "Marking",
      description: "Color highlight rules",
      accent: "bg-purple-900/60",
    },
    {
      type: "derivedLogView",
      icon: <Sparkle size={16} className="text-green-300" />,
      label: "Output",
      description: "Derived log view",
      accent: "bg-green-900/60",
    },
    {
      type: "comment",
      icon: <MessageSquare size={16} className="text-yellow-300" />,
      label: "Comment",
      description: "Add a note",
      accent: "bg-yellow-900/60",
    },
  ] as const;

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

      {/* Floating toolbar */}
      <ToolBar
        title="ADD NODE"
        items={toolbarItems.map((item) => ({
          ...item,
          onClick: () => addNode(item.type),
        }))}
      />
    </div>
  );
}
