const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Avoid trailing slashes so URL composition is stable.
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}
