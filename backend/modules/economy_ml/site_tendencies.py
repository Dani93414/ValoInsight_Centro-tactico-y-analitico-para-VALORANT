from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class SiteTendencies:
    available: bool
    rounds_observed: int = 0
    plant_site_counts: dict[str, int] = field(default_factory=dict)
    attack_site_preference: dict[str, float] = field(default_factory=dict)
    defense_site_weakness: dict[str, float] = field(default_factory=dict)
    retake_success_by_site: dict[str, float] = field(default_factory=dict)
    plant_success_by_site: dict[str, float] = field(default_factory=dict)
    likely_attack_site: str | None = None
    confidence: float = 0.0
    source: str = "unavailable"
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _site(round_obj: dict) -> str | None:
    for key in ("plantSite", "bombSite", "spikeSite", "site"):
        if round_obj.get(key):
            return str(round_obj[key]).upper()
    plant = round_obj.get("plant") or round_obj.get("spikePlant") or {}
    if isinstance(plant, dict) and (plant.get("site") or plant.get("plantSite")):
        return str(plant.get("site") or plant.get("plantSite")).upper()
    return None


def build_site_tendencies(match: dict, *, round_number: int, team_id: str | None = None) -> SiteTendencies:
    # Strictly exclude the current round: round_number is one-based.
    previous = (match.get("roundResults") or [])[:max(0, round_number - 1)]
    sites = [(obj, _site(obj)) for obj in previous]
    sites = [(obj, site) for obj, site in sites if site]
    if not sites:
        return SiteTendencies(False, warnings=["site_tendency_not_available"])
    counts = Counter(site for _, site in sites)
    total = sum(counts.values())
    won = Counter()
    retakes = Counter()
    for obj, site in sites:
        winner = str(obj.get("winningTeam") or "")
        if team_id and winner == str(team_id):
            won[site] += 1
        if obj.get("bombDefused") or obj.get("spikeDefused") or obj.get("defuseRoundTime"):
            retakes[site] += 1
    preference = {site: round(count / total, 4) for site, count in counts.items()}
    success = {site: round(won[site] / count, 4) for site, count in counts.items()}
    retake = {site: round(retakes[site] / count, 4) for site, count in counts.items()}
    likely = max(counts, key=counts.get)
    return SiteTendencies(True, len(sites), dict(counts), preference,
                          {site: round(1 - success[site], 4) for site in counts}, retake, success,
                          likely, min(.9, .25 + len(sites) * .08), "prior_round_results", [])
