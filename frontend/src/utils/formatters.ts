export function formatNumber(value?: number, decimals = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value?: number, decimals = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${formatNumber(value, decimals)}%`;
}

export function formatHours(ms?: number) {
  if (!ms) return "-";
  return `${formatNumber(ms / 1000 / 60 / 60, 1)} h`;
}

export function safeDivide(a: number, b: number, fallback = 0): number {
  return b > 0 ? a / b : fallback;
}

export function normalizeLabel(value?: unknown): string {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (!text) return "";
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/\s+/g, " ").trim();
}

/**
 * Format epoch milliseconds as a short date string (dd/mm/yyyy).
 */
export function formatDate(ms?: number) {
  if (!ms) return "Fecha desconocida";
  return new Date(ms).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format epoch milliseconds as a full date-time string.
 */
export function formatDateTime(ms?: number) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("es-ES");
}

/**
 * Normalize a response that may be an array or `{ data: [...] }` envelope.
 */
export function normalizeArrayResponse<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    Array.isArray((raw as { data?: unknown[] }).data)
  ) {
    return (raw as { data: T[] }).data;
  }
  return [];
}
