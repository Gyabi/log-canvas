import { ReactFlowProvider } from "@xyflow/react";
import Canvas from "./components/Canvas";

export default function App() {
  return (
    <div className="w-screen h-screen bg-neutral-950">
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </div>
  );
}
