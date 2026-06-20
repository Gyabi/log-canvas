import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
} from "@xyflow/react";
import PlaceholderNode from "./PlaceholderNode";

const nodeTypes = { placeholder: PlaceholderNode };

const initialNodes: Node[] = [
  {
    id: "1",
    type: "placeholder",
    position: { x: 80, y: 80 },
    data: { label: "system.dlt" },
  },
  {
    id: "2",
    type: "placeholder",
    position: { x: 420, y: 140 },
    data: { label: "app.dlt" },
  },
  {
    id: "3",
    type: "placeholder",
    position: { x: 200, y: 340 },
    data: { label: "network.dlt" },
  },
];

export default function Canvas() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState([]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.1}
        maxZoom={4}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#404040" />
        <Controls />
        <MiniMap
          nodeColor="#525252"
          maskColor="rgba(10,10,10,0.6)"
          style={{ background: "#1a1a1a" }}
        />
      </ReactFlow>
    </div>
  );
}
