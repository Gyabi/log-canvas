import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Node, Edge } from "@xyflow/react";
import { open, save, ask, confirm } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commands } from "../bindings";
import {
  serializeProject,
  deserializeNodes,
  deserializeEdges,
  type ProjectFile,
} from "../utils/projectFile";
import type { SourceLogViewData } from "../types/logView";
import type { DerivedLogViewData } from "../types/logView";

const PROJECT_FILTER = { name: "Log Canvas Project", extensions: ["lcproj"] };

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

async function closeAllBackendResources(nodes: Node[]): Promise<void> {
  for (const node of nodes) {
    if (node.type === "sourceLogView") {
      const viewId = (node.data as SourceLogViewData).viewId;
      if (viewId) void commands.closeDltFile(viewId);
    } else if (node.type === "derivedLogView") {
      const viewId = (node.data as DerivedLogViewData).viewId;
      if (viewId) void commands.deleteView(viewId);
    }
  }
}

async function reopenSourceFiles(nodes: Node[]): Promise<Node[]> {
  const result = [...nodes];
  for (const node of result) {
    if (node.type !== "sourceLogView") continue;
    const filePath = (node.data as SourceLogViewData).filePath;
    if (!filePath) continue;
    const fileId = crypto.randomUUID();
    const openResult = await commands.openDltFile(filePath, fileId);
    if (openResult.status === "ok") {
      node.data = {
        ...(node.data as SourceLogViewData),
        viewId: openResult.data.id,
        rowCount: openResult.data.rowCount,
      };
    }
  }
  return result;
}

export type ProjectState = {
  currentPath: string | null;
  isDirty: boolean;
  saveAs: () => Promise<void>;
  saveOverwrite: () => Promise<void>;
  load: () => Promise<void>;
};

export function useProjectState(
  nodes: Node[],
  edges: Edge[],
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>
): ProjectState {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Refs for mutable values accessed inside stable event handlers.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const currentPathRef = useRef(currentPath);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Dirty tracking.
  // Reference-equality check guards against React StrictMode's double-fire of effects:
  // StrictMode re-runs effects without changing the dependency values, so the old and
  // new references are identical — we skip those phantom fires safely.
  const prevNodesRef = useRef(nodes);
  const prevEdgesRef = useRef(edges);
  const suppressDirtyRef = useRef(false);

  useEffect(() => {
    const prevNodes = prevNodesRef.current;
    const prevEdges = prevEdgesRef.current;
    prevNodesRef.current = nodes;
    prevEdgesRef.current = edges;

    if (prevNodes === nodes && prevEdges === edges) return; // StrictMode re-fire, skip

    if (suppressDirtyRef.current) {
      suppressDirtyRef.current = false;
      return;
    }
    setIsDirty(true);
  }, [nodes, edges]);

  // Window title: "filename.lcproj * — Log Canvas"
  useEffect(() => {
    const name = currentPath ? basename(currentPath) : null;
    const dirty = isDirty ? " *" : "";
    void getCurrentWindow().setTitle(
      name ? `${name}${dirty} — Log Canvas` : `Log Canvas${dirty}`
    );
  }, [currentPath, isDirty]);

  // Core save: write project JSON to `path`, opening a save dialog if null.
  const saveToPath = async (path: string | null): Promise<boolean> => {
    const targetPath = path ?? (await save({ filters: [PROJECT_FILTER] }));
    if (!targetPath) return false;
    const result = await commands.saveProject(
      targetPath,
      JSON.stringify(serializeProject(nodesRef.current, edgesRef.current))
    );
    if (result.status === "error") {
      console.error("Save failed:", result.error);
      return false;
    }
    setCurrentPath(targetPath);
    setIsDirty(false);
    return true;
  };

  // Stable ref so the close handler (registered once) always calls the latest implementation.
  const saveToPathRef = useRef(saveToPath);
  useEffect(() => {
    saveToPathRef.current = saveToPath;
  });

  // Window close interception.
  // When no unsaved changes: return without preventDefault → Tauri's wrapper calls destroy().
  // When user confirms close: call destroy() explicitly after preventing default.
  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    void appWindow
      .onCloseRequested(async (event) => {
        if (!isDirtyRef.current) return; // no changes → allow Tauri to auto-destroy

        event.preventDefault();

        const wantSave = await ask(
          "There is an unsaved change. Do you want to save before exiting?",
          {
            title: "Confirm Exit",
            okLabel: "Save and Exit",
            cancelLabel: "Don't Save",
          }
        );

        if (wantSave) {
          const saved = await saveToPathRef.current(currentPathRef.current);
          if (saved) void appWindow.destroy();
        } else {
          const confirmClose = await confirm(
            "Are you sure you want to discard the changes and exit?",
            { title: "Discard Changes", okLabel: "Exit", cancelLabel: "Cancel" }
          );
          if (confirmClose) void appWindow.destroy();
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  const saveAs = async () => {
    await saveToPath(null);
  };
  const saveOverwrite = async () => {
    await saveToPath(currentPathRef.current);
  };

  const load = async () => {
    const path = await open({ filters: [PROJECT_FILTER] });
    if (!path) return;
    const result = await commands.loadProject(path);
    if (result.status === "error") {
      console.error("Load failed:", result.error);
      return;
    }
    const project = JSON.parse(result.data) as ProjectFile;
    await closeAllBackendResources(nodesRef.current);
    const restoredNodes = await reopenSourceFiles(
      deserializeNodes(project.nodes)
    );
    suppressDirtyRef.current = true;
    setNodes(restoredNodes);
    setEdges(deserializeEdges(project.edges));
    setCurrentPath(path);
    setIsDirty(false);
  };

  return { currentPath, isDirty, saveAs, saveOverwrite, load };
}
