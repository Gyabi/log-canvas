import type { Node } from "@xyflow/react";
import type { MarkingRule } from "./condition";

export type TsMode = "abs" | "rel" | "us";

/** A persisted row-range anchor associated with a unique handle on a LogView node. */
export type RowAnchor = {
  handleId: string;
  minRow: number;
  maxRow: number;
};

/** Scroll metrics written to node data so CommentNodes can track row positions. */
export type LogViewScrollState = {
  scrollTop: number;
  scrollContainerHeight: number;
  wrapperOffsetTop: number;
  headerHeight: number;
};

export type SourceLogViewData = {
  /** UUID assigned at open_dlt_file time. Not the file path. */
  viewId?: string;
  /** Full file path — used only for display. */
  filePath?: string;
  rowCount?: number;
  /** Set to a 0-based row index to request a scroll jump; cleared after handling. */
  jumpRequest?: number;
  /** Persisted row-anchor handles (connected comments). Managed by useRowHandles. */
  rowAnchors?: RowAnchor[];
  /** Current scroll metrics for connected CommentNodes. Updated by LogViewDisplay. */
  scrollState?: LogViewScrollState;
};
export type SourceLogViewNodeType = Node<SourceLogViewData, "sourceLogView">;

export type DerivedLogViewData = {
  /**
   * Current backend view ID.
   * - undefined until useDerivedViewSync runs for the first time
   * - equals upstream sourceViewId when no FilterNodes are in the chain
   * - a new UUID whenever filters are (re-)applied
   */
  viewId?: string;
  rowCount: number;
  label?: string;
  /** Marking rules collected from MarkingNodes in the upstream chain. */
  markingRules?: MarkingRule[];
  /** Set to a 0-based row index to request a scroll jump; cleared after handling. */
  jumpRequest?: number;
  /** Persisted row-anchor handles (connected comments). Managed by useRowHandles. */
  rowAnchors?: RowAnchor[];
  /** Current scroll metrics for connected CommentNodes. Updated by LogViewDisplay. */
  scrollState?: LogViewScrollState;
};
export type DerivedLogViewNodeType = Node<DerivedLogViewData, "derivedLogView">;
