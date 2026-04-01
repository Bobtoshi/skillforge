const NON_WORD = /[^a-zA-Z0-9]+/g;

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(NON_WORD, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function toTitleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function toCamelCase(input: string): string {
  const words = input
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(NON_WORD, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "value";
  }

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function truncate(input: string, limit = 96): string {
  if (input.length <= limit) {
    return input;
  }

  return `${input.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}
