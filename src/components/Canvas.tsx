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
import LogViewNode from "./LogViewNode";

const nodeTypes = { logView: LogViewNode };

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, , onEdgesChange] = useEdgesState([]);

  function addLogViewNode() {
    const id = `logview-${crypto.randomUUID()}`;

    const offset = (nodes.length % 5) * 40;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "logView",
        position: { x: 80 + offset, y: 80 + offset },
        data: {},
        style: { width: 1280, height: 720 },
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
      <button
        onClick={addLogViewNode}
        className="absolute left-4 top-4 z-10 rounded bg-neutral-700 px-3 py-2 text-sm text-neutral-200 shadow hover:bg-neutral-600"
      >
        + add log file
      </button>
    </div>
  );
}
