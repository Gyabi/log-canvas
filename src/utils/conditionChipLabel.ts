import { FIELD_OPTIONS, OP_OPTIONS } from "./constraint";

export type ChipLabelInput = {
  field: string;
  op: string;
  value: string;
};

/** Both DltFilter and MarkingRule are structurally assignable to ChipLabelInput. */
export function conditionChipLabel(item: ChipLabelInput): string {
  const field =
    FIELD_OPTIONS.find((o) => o.value === item.field)?.label ?? item.field;
  const op =
    OP_OPTIONS.find((o) => o.value === item.op)?.label?.split(" ")[0] ?? item.op;
  return `${field} ${op} ${item.value}`;
}
