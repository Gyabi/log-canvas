import type { DltRow } from "../../bindings";
import { MarkingRule } from "../condition/MarkingNode";
import { MarkColor } from "./LogViewDisplay";

function fieldValue(row: DltRow, field: string): string {
  switch (field) {
    case "ecuId":
      return row.ecuId;
    case "appId":
      return row.appId;
    case "ctxId":
      return row.ctxId;
    case "level":
      return row.level;
    case "payload":
      return row.payload;
    default:
      return "";
  }
}

function rowMatchesRule(
  row: DltRow,
  rule: MarkingRule,
  re: RegExp | null
): boolean {
  const v = fieldValue(row, rule.field);
  switch (rule.op) {
    case "eq":
      return v === rule.value;
    case "neq":
      return v !== rule.value;
    case "contains":
      return v.includes(rule.value);
    case "regex":
      return re?.test(v) ?? false;
    default:
      return false;
  }
}

export function computeMarks(
  rowCache: Map<number, DltRow>,
  rules: MarkingRule[]
): Map<number, MarkColor> {
  const compiled = rules.map((r) => {
    if (r.op !== "regex") return { rule: r, re: null };
    try {
      return { rule: r, re: new RegExp(r.value) };
    } catch {
      return { rule: r, re: null };
    }
  });

  const result = new Map<number, MarkColor>();
  for (const [index, row] of rowCache.entries()) {
    for (const { rule, re } of compiled) {
      if (rowMatchesRule(row, rule, re)) {
        result.set(index, rule.color);
        break; // First matching rule wins.
      }
    }
  }
  return result;
}
