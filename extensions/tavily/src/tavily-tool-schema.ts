import { Type } from "typebox";

export function optionalStringEnum(
  values: readonly string[],
  options: { description?: string } = {},
) {
  return Type.Optional(
    Type.Unsafe<(typeof values)[number]>({
      type: "string",
      enum: [...values],
      ...options,
    }),
  );
}
