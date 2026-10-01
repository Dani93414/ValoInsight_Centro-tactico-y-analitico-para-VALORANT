export function formatLastRecordedMatch(
  startMillis?: number | null,
  durationMillis?: number | null,
  nowMillis = Date.now(),
) {
  if (typeof startMillis !== "number" || !Number.isFinite(startMillis) || startMillis <= 0) {
    return "Sin partidas registradas";
  }

  // Old imported records occasionally contain epoch seconds. RAW uses
  // milliseconds, so normalize both representations before calculating.
  const normalizedStart = startMillis < 100_000_000_000 ? startMillis * 1000 : startMillis;
  const safeDuration =
    typeof durationMillis === "number" && Number.isFinite(durationMillis) && durationMillis > 0
      ? durationMillis
      : 0;
  const elapsedMillis = Math.max(0, nowMillis - (normalizedStart + safeDuration));
  const elapsedHours = Math.floor(elapsedMillis / (60 * 60 * 1000));
  if (elapsedHours < 1) return "Hace menos de 1 hora";
  if (elapsedHours < 24) return elapsedHours === 1 ? "Hace 1 hora" : `Hace ${elapsedHours} horas`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays === 1 ? "Hace 1 día" : `Hace ${elapsedDays} días`;
}
