import type { Node } from "@xyflow/react";
import type { DltFilter } from "../bindings";
import type { MarkColor } from "../utils/constraint";

export type FilterNodeData = {
  filters: DltFilter[];
};
export type FilterNodeType = Node<FilterNodeData, "filter">;

export type MarkingRule = {
  field: string;
  op: string;
  value: string;
  color: MarkColor;
};
export type MarkingNodeData = {
  rules: MarkingRule[];
};
export type MarkingNodeType = Node<MarkingNodeData, "marking">;
