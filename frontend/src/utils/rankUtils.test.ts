import { describe, expect, it } from "vitest";
import {
  UNRANKED_RANK_ICON_FALLBACK,
  resolveCompetitiveTierIcon,
} from "./rankUtils";

const tiers = [
  { tier: 0, tierName: "Unranked", smallIcon: "/content/ranks/unranked.png" },
  { tier: 12, tierName: "Gold 1", smallIcon: "/content/ranks/gold.png" },
];

describe("resolveCompetitiveTierIcon", () => {
  it("uses the exact rank icon when available", () => {
    expect(resolveCompetitiveTierIcon(12, null, tiers)).toBe("/content/ranks/gold.png");
  });

  it("uses the catalog unranked symbol when tier is missing", () => {
    expect(resolveCompetitiveTierIcon(null, null, tiers)).toBe("/content/ranks/unranked.png");
  });

  it("uses the built-in unranked symbol when catalog assets are missing", () => {
    expect(resolveCompetitiveTierIcon(null, null, [])).toBe(UNRANKED_RANK_ICON_FALLBACK);
  });

  it("falls back to unranked when a known tier has no usable image", () => {
    expect(resolveCompetitiveTierIcon(18, null, tiers)).toBe("/content/ranks/unranked.png");
  });
});
