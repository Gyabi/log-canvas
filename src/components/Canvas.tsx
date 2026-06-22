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
import { ToolBar } from "./tool-bar/toolBar";

const nodeTypes = {
  sourceLogView: SourceLogViewNode,
  derivedLogView: DerivedLogViewNode,
  filter: FilterNode,
  marking: MarkingNode,
};

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
      <ToolBar
        title="ADD NODE"
        items={[
          {
            icon: <FileText size={16} className="text-blue-300" />,
            label: "Log File",
            description: "DLT source view",
            onClick: addSourceLogViewNode,
            accent: "bg-blue-900/60",
          },
          {
            icon: <SlidersHorizontal size={16} className="text-amber-300" />,
            label: "Filter",
            description: "Row filter conditions",
            onClick: addFilterNode,
            accent: "bg-amber-900/60",
          },
          {
            icon: <Palette size={16} className="text-purple-300" />,
            label: "Marking",
            description: "Color highlight rules",
            onClick: addMarkingNode,
            accent: "bg-purple-900/60",
          },
        ]}
      />
    </div>
  );
}
