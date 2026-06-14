/**
 * Identifier sanitization helpers. Source names (table names, OpenAPI paths,
 * operationIds, column names) cannot be trusted to be valid identifiers in the
 * target language, so everything is normalized before it reaches a template.
 */

/**
 * Convert any source name into a clean, language-safe `snake_case` identifier.
 * camelCase and ACRONYMBoundaries are split so `getPetById` -> `get_pet_by_id`
 * (conventional MCP tool naming) rather than the ugly `getpetbyid`.
 */
export function sanitizeIdentifier(raw: string): string {
  let s = String(raw)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camelCase boundary
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2") // ACRONYMWord boundary
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (!s) s = "tool";
  if (/^[0-9]/.test(s)) s = `_${s}`;
  return s;
}

export function pascalCase(raw: string): string {
  const parts = sanitizeIdentifier(raw).split("_").filter(Boolean);
  const out = parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return out || "Tool";
}

export function camelCase(raw: string): string {
  const p = pascalCase(raw);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** Collapse whitespace so descriptions are safe as inline comments/docstrings. */
export function cleanDescription(raw: string | undefined): string {
  if (!raw) return "";
  return String(raw).replace(/\s+/g, " ").trim();
}

/** Drop duplicate params (same sanitized name) which would break codegen. */
export function dedupeByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out;
}
