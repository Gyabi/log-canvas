import type { Node } from "@xyflow/react";
import type { MarkColor } from "../utils/constraint";

export type CommentColor = MarkColor;

export type CommentNodeData = {
  text: string;
  color: CommentColor;
  /** ID of the LogView node this comment is anchored to (set on connect). */
  anchorNodeId?: string;
  /** Row index for scroll-tracking anchor. Undefined = view-level anchor (no scroll tracking). */
  anchorRowIndex?: number;
  /** Offset from anchor handle position in flow coordinates. */
  anchorOffsetX?: number;
  anchorOffsetY?: number;
};

export type CommentNodeType = Node<CommentNodeData, "comment">;
