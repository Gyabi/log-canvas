export const FIELD_OPTIONS = [
  { value: "ecuId", label: "ECU" },
  { value: "appId", label: "App" },
  { value: "ctxId", label: "Ctx" },
  { value: "level", label: "Level" },
  { value: "payload", label: "Payload" },
] as const;

export const OP_OPTIONS = [
  { value: "eq", label: "= (equal)" },
  { value: "neq", label: "≠ (not equal)" },
  { value: "contains", label: "∋ (contains)" },
  { value: "regex", label: "~ (regex)" },
] as const;

export type MarkColor = "red" | "yellow" | "green" | "blue" | "purple";

export const DOT: Record<MarkColor, string> = {
  red: "bg-red-500",
  yellow: "bg-amber-400",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
};

export const MARK_BG: Record<MarkColor, string> = {
  red: "bg-red-900/50",
  yellow: "bg-amber-900/50",
  green: "bg-green-900/50",
  blue: "bg-blue-900/50",
  purple: "bg-purple-900/50",
};

export const EMPTY_MARKS: ReadonlyMap<number, MarkColor> = new Map();

export const SINGLE_INPUT_TYPES: ReadonlySet<string> = new Set([
  "derivedLogView",
  "filter",
  "marking",
]);

export const COLOR_OPTIONS: { value: MarkColor; dot: string }[] = [
  { value: "red", dot: "bg-red-500" },
  { value: "yellow", dot: "bg-amber-400" },
  { value: "green", dot: "bg-green-500" },
  { value: "blue", dot: "bg-blue-500" },
  { value: "purple", dot: "bg-purple-500" },
];

export const NODE_TEMPLATES = {
  sourceLogView: {
    position: { x: 100, y: 100 },
    data: {},
    style: { width: 1280, height: 720 },
  },
  filter: {
    position: { x: 200, y: 200 },
    data: { filters: [] },
    style: {},
  },
  marking: {
    position: { x: 200, y: 300 },
    data: { rules: [] },
    style: {},
  },
  derivedLogView: {
    position: { x: 100, y: 100 },
    data: {
      rowCount: 0,
      label: "DerivedView",
    },
    style: { width: 1280, height: 720 },
  },
} as const;

export const conditionBaseInputHandleId = "condition-input";
export const conditionBaseOutputHandleId = "condition-output";
export const derivedLogViewInputHandleId = "derived-log-view-input";
export const sourceLogViewOutputHandleId = "source-log-view-output";
