function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function escapeCsvCell(value: unknown): string {
  const normalized = normalizeCell(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

export function buildCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
