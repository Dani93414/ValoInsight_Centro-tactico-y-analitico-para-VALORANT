import { describe, expect, it } from "vitest";
import { formatLastRecordedMatch } from "./lastSeen";

describe("formatLastRecordedMatch", () => {
  const now = Date.UTC(2026, 8, 30, 12, 0, 0);

  it("uses match end time and supports RAW epoch milliseconds", () => {
    expect(formatLastRecordedMatch(now - 3_600_000 - 30 * 60_000, 30 * 60_000, now)).toBe("Hace 1 hora");
  });

  it("normalizes legacy epoch seconds", () => {
    expect(formatLastRecordedMatch(Math.floor((now - 2 * 86_400_000) / 1000), 0, now)).toBe("Hace 2 días");
  });
});
