export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableStringify(value: unknown, spacing = 2): string {
  return JSON.stringify(sortJson(value), null, spacing);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJson(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function walkJsonStrings(
  value: unknown,
  visit: (text: string, path: string[]) => void,
  path: string[] = [],
): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkJsonStrings(entry, visit, [...path, String(index)]));
    return;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, entry]) => walkJsonStrings(entry, visit, [...path, key]));
  }
}
