import type { Node, Edge } from "@xyflow/react";
import type { DltFilter } from "../../bindings";
import type { FilterNodeData } from "../condition/FilterNode";
import type { MarkingNodeData, MarkingRule } from "../condition/MarkingNode";

export type FilterStep = {
  kind: "filter";
  nodeId: string;
  filters: DltFilter[];
};

export type MarkingStep = {
  kind: "marking";
  nodeId: string;
  rules: MarkingRule[];
};

export type ConditionStep = FilterStep | MarkingStep;

export type UpstreamChain = {
  /** Condition steps ordered from source-side to derived-side. */
  steps: ConditionStep[];
  sourceViewId: string;
  sourceNodeId: string;
  sourceRowCount: number;
};

/**
 * Walk from `startNodeId` upward through the graph by following the single
 * incoming edge on each node. Condition nodes are collected; traversal stops
 * when a SourceLogViewNode with a loaded file is found.
 *
 * Returns null when the chain is disconnected or the source has no file loaded.
 */
export function collectUpstreamChain(
  startNodeId: string,
  nodes: Node[],
  edges: Edge[]
): UpstreamChain | null {
  const steps: ConditionStep[] = [];
  let currentId = startNodeId;

  for (;;) {
    const inEdge = edges.find((e) => e.target === currentId);
    if (!inEdge) return null;

    const upstream = nodes.find((n) => n.id === inEdge.source);
    if (!upstream) return null;

    if (upstream.type === "sourceLogView") {
      const d = upstream.data as { viewId?: string; rowCount?: number };
      if (!d.viewId) return null;
      // steps were pushed from derived→source; reverse to get source→derived order.
      return {
        steps: steps.reverse(),
        sourceViewId: d.viewId,
        sourceNodeId: upstream.id,
        sourceRowCount: d.rowCount ?? 0,
      };
    }

    if (upstream.type === "filter") {
      steps.push({
        kind: "filter",
        nodeId: upstream.id,
        filters: (upstream.data as FilterNodeData).filters ?? [],
      });
    } else if (upstream.type === "marking") {
      steps.push({
        kind: "marking",
        nodeId: upstream.id,
        rules: (upstream.data as MarkingNodeData).rules ?? [],
      });
    } else {
      return null;
    }

    currentId = upstream.id;
  }
}

/**
 * Produces a stable string that changes whenever anything in the upstream
 * chain changes. Used as a useEffect dependency in useDerivedViewSync.
 */
export function buildSyncSignature(chain: UpstreamChain | null): string {
  if (!chain) return "disconnected";
  const stepsPart = chain.steps
    .map((s) =>
      s.kind === "filter"
        ? `f:${s.nodeId}:${JSON.stringify(s.filters)}`
        : `m:${s.nodeId}:${JSON.stringify(s.rules)}`
    )
    .join("|");
  return `${chain.sourceViewId}:${chain.sourceRowCount}|${stepsPart}`;
}

/** Extracts all filter predicates from a chain (order: source → derived). */
export function chainFilters(chain: UpstreamChain): DltFilter[] {
  return chain.steps
    .filter((s): s is FilterStep => s.kind === "filter")
    .flatMap((s) => s.filters);
}

/** Extracts all marking rules from a chain (order: source → derived). */
export function chainMarkingRules(chain: UpstreamChain): MarkingRule[] {
  return chain.steps
    .filter((s): s is MarkingStep => s.kind === "marking")
    .flatMap((s) => s.rules);
}
