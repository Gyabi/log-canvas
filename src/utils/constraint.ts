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
  comment: {
    position: { x: 300, y: 200 },
    data: { text: "", color: "yellow" },
    style: { width: 200, height: 120 },
  },
} as const;

export const conditionBaseInputHandleId = "condition-input";
export const conditionBaseOutputHandleId = "condition-output";
export const derivedLogViewInputHandleId = "derived-log-view-input";
export const sourceLogViewOutputHandleId = "source-log-view-output";
export const commentNodeTopHandleID = "comment-top";
export const commentNodeBottomHandleID = "comment-bottom";
export const commentNodeLeftHandleID = "comment-left";
export const commentNodeRightHandleID = "comment-right";

/** Prefix for dynamically generated row-anchor handle IDs (e.g. "row-anchor:<uuid>"). */
export const ROW_ANCHOR_HANDLE_PREFIX = "row-anchor:";

export function isRowAnchorHandle(id: string | null | undefined): id is string {
  return typeof id === "string" && id.startsWith(ROW_ANCHOR_HANDLE_PREFIX);
}

export function isCommentHandle(id: string | null | undefined): boolean {
  return (
    id === commentNodeTopHandleID ||
    id === commentNodeBottomHandleID ||
    id === commentNodeLeftHandleID ||
    id === commentNodeRightHandleID
  );
}

/** Height of a single log row in pixels (must match the virtualizer estimateSize). */
export const ROW_HEIGHT = 28;

// Comment node colors
export const COMMENT_BG: Record<MarkColor, string> = {
  red: "bg-red-950 border-red-700",
  yellow: "bg-amber-950 border-amber-600",
  green: "bg-green-950 border-green-700",
  blue: "bg-blue-950 border-blue-700",
  purple: "bg-purple-950 border-purple-700",
};

export const COMMENT_OUTLINE: Record<MarkColor, string> = {
  red: "outline-red-500",
  yellow: "outline-amber-400",
  green: "outline-green-500",
  blue: "outline-blue-500",
  purple: "outline-purple-500",
};
