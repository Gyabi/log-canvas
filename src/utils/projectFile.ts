import type { Node, Edge } from "@xyflow/react";
import type { SourceLogViewData } from "../types/logView";
import type { DerivedLogViewData } from "../types/logView";
import type { FilterNodeData } from "../types/condition";
import type { MarkingNodeData } from "../types/condition";
import type { CommentNodeData } from "../types/comment";

export interface ProjectFile {
  version: 1;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface SerializedNodeBase {
  id: string;
  type: string;
  position: { x: number; y: number };
  style?: Record<string, unknown>;
  zIndex?: number;
}

interface SerializedSourceLogView extends SerializedNodeBase {
  type: "sourceLogView";
  data: Pick<SourceLogViewData, "filePath" | "rowAnchors">;
}

interface SerializedDerivedLogView extends SerializedNodeBase {
  type: "derivedLogView";
  data: Pick<DerivedLogViewData, "label" | "rowAnchors">;
}

interface SerializedFilterNode extends SerializedNodeBase {
  type: "filter";
  data: FilterNodeData;
}

interface SerializedMarkingNode extends SerializedNodeBase {
  type: "marking";
  data: MarkingNodeData;
}

interface SerializedCommentNode extends SerializedNodeBase {
  type: "comment";
  data: CommentNodeData;
}

type SerializedNode =
  | SerializedSourceLogView
  | SerializedDerivedLogView
  | SerializedFilterNode
  | SerializedMarkingNode
  | SerializedCommentNode;

function serializeNode(node: Node): SerializedNode {
  const base: SerializedNodeBase = {
    id: node.id,
    type: node.type ?? "",
    position: node.position,
    ...(node.style ? { style: node.style as Record<string, unknown> } : {}),
    ...(node.zIndex != null ? { zIndex: node.zIndex } : {}),
  };

  switch (node.type) {
    case "sourceLogView": {
      const d = node.data as SourceLogViewData;
      return {
        ...base,
        type: "sourceLogView",
        data: { filePath: d.filePath, rowAnchors: d.rowAnchors },
      };
    }
    case "derivedLogView": {
      const d = node.data as DerivedLogViewData;
      return {
        ...base,
        type: "derivedLogView",
        data: { label: d.label, rowAnchors: d.rowAnchors },
      };
    }
    case "filter":
      return { ...base, type: "filter", data: node.data as FilterNodeData };
    case "marking":
      return { ...base, type: "marking", data: node.data as MarkingNodeData };
    case "comment":
      return { ...base, type: "comment", data: node.data as CommentNodeData };
    default:
      return { ...base, type: node.type ?? "", data: {} } as SerializedNode;
  }
}

function serializeEdge(edge: Edge): SerializedEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  };
}

export function serializeProject(nodes: Node[], edges: Edge[]): ProjectFile {
  return {
    version: 1,
    nodes: nodes.map(serializeNode),
    edges: edges.map(serializeEdge),
  };
}

/**
 * Deserialize nodes from a project file.
 * SourceLogViewNode has its viewId/rowCount left empty — the caller must call
 * open_dlt_file for each filePath and fill them in before rendering.
 */
export function deserializeNodes(serialized: SerializedNode[]): Node[] {
  return serialized.map((s) => {
    const node: Node = {
      id: s.id,
      type: s.type,
      position: s.position,
      data: { ...s.data },
      ...(s.style ? { style: s.style } : {}),
      ...(s.zIndex != null ? { zIndex: s.zIndex } : {}),
    };

    if (s.type === "sourceLogView") {
      node.data = {
        filePath: (s.data as SerializedSourceLogView["data"]).filePath,
        rowAnchors: (s.data as SerializedSourceLogView["data"]).rowAnchors,
      } satisfies SourceLogViewData;
    } else if (s.type === "derivedLogView") {
      node.data = {
        rowCount: 0,
        label: (s.data as SerializedDerivedLogView["data"]).label,
        rowAnchors: (s.data as SerializedDerivedLogView["data"]).rowAnchors,
      } satisfies DerivedLogViewData;
    } else if (s.type === "comment") {
      node.data = { ...(s.data as CommentNodeData) };
      node.zIndex = s.zIndex ?? 1000;
    }

    return node;
  });
}

export function deserializeEdges(serialized: SerializedEdge[]): Edge[] {
  return serialized.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
  }));
}
