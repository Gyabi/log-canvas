import type { Node } from "@xyflow/react";
import type { MarkingRule } from "./condition";

export type TsMode = "abs" | "rel" | "us";

export type SourceLogViewData = {
  /** UUID assigned at open_dlt_file time. Not the file path. */
  viewId?: string;
  /** Full file path — used only for display. */
  filePath?: string;
  rowCount?: number;
  /** Set to a 0-based row index to request a scroll jump; cleared after handling. */
  jumpRequest?: number;
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
};
export type DerivedLogViewNodeType = Node<DerivedLogViewData, "derivedLogView">;
