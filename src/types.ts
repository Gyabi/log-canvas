import type { DltFilter } from "./bindings";

// ── Display types ────────────────────────────────────────────────────────────

export type MarkColor = "red" | "yellow" | "green" | "blue" | "purple";

export type MarkingRule = {
  field: string;
  op: string;
  value: string;
  color: MarkColor;
};

// ── Node data shapes ─────────────────────────────────────────────────────────

export type FilterNodeData = {
  filters: DltFilter[];
};

export type MarkingNodeData = {
  rules: MarkingRule[];
};

export type SourceLogViewData = {
  /** UUID assigned at open_dlt_file time. Not the file path. */
  viewId?: string;
  /** Full file path — used only for display. */
  filePath?: string;
  rowCount?: number;
  /** Set to a 0-based row index to request a scroll jump; cleared after handling. */
  jumpRequest?: number;
};

export type DerivedLogViewData = {
  /**
   * Current backend view ID.
   * - undefined until useDerivedViewSync runs for the first time
   * - equals upstream sourceViewId when no FilterNodes are connected (marking only)
   * - a new UUID whenever filters are (re-)applied
   */
  viewId?: string;
  rowCount: number;
  label?: string;
  markingRules?: MarkingRule[];
  /** Set to a 0-based row index to request a scroll jump; cleared after handling. */
  jumpRequest?: number;
};
