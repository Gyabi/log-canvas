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
  viewId?: string;
  rowCount?: number;
  /** Set to a 0-based row index to request a scroll jump; cleared after handling. */
  jumpRequest?: number;
};

export type DerivedLogViewData = {
  /** Upstream view ID — the data source for this node. Never changes after creation. */
  sourceViewId: string;
  /** Backend view ID (= sourceViewId when no filters, otherwise a UUID). */
  viewId: string;
  rowCount: number;
  label?: string;
  markingRules?: MarkingRule[];
  /** Set to a 0-based row index to request a scroll jump; cleared after handling. */
  jumpRequest?: number;
};
