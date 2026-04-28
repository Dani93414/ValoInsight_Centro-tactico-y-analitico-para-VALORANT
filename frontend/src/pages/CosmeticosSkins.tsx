import { useMemo, useState } from "react";
import { useContentTiers, useSkins } from "../api/hooks";
import type { SkinContent } from "../types/content";
import CosmeticGridPage from "./CosmeticGridPage";
import { hideBrokenImage } from "./contentFormatters";

function SkinDetail({
  item,
  tierName,
}: {
  item: SkinContent;
  tierName?: string | null;
}) {
  return (
    <div className="content-detail-grid">
      <div>
        <h2 className="content-detail-title">{item.displayName}</h2>
        <div className="content-badge-row">
          <span className="content-badge">{item.weaponName ?? "Arma"}</span>
          {tierName && <span className="content-badge">{tierName}</span>}
          <span className="content-badge">
            {item.chromasCount ?? 0} variantes
          </span>
          <span className="content-badge">{item.levelsCount ?? 0} niveles</span>
        </div>
      </div>
      <div className="content-detail-media">
        {(item.wallpaper || item.displayIcon) && (
          <img
            className="content-detail-image"
            src={item.wallpaper || item.displayIcon || ""}
            alt={item.displayName}
            onError={hideBrokenImage}
          />
        )}
      </div>
    </div>
  );
}

export default function CosmeticosSkins() {
  const query = useSkins();
  const tiersQuery = useContentTiers();
  const [weaponFilter, setWeaponFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");

  const tierNames = useMemo(() => {
    const map = new Map<string, string>();
    (tiersQuery.data ?? []).forEach((tier) => {
      if (tier.uuid) {
        map.set(tier.uuid, tier.displayName);
      }
    });
    return map;
  }, [tiersQuery.data]);

  const weaponOptions = useMemo(() => {
    const weapons = new Set(
      (query.data ?? [])
        .map((item) => item.weaponName)
        .filter((name): name is string => Boolean(name)),
    );
    return [...weapons].sort((a, b) => a.localeCompare(b));
  }, [query.data]);

  const tierOptions = useMemo(() => {
    const tiers = new Set(
      (query.data ?? [])
        .map((item) => item.contentTierUuid)
        .filter((uuid): uuid is string => Boolean(uuid)),
    );
    return [...tiers]
      .map((uuid) => ({ uuid, label: tierNames.get(uuid) ?? uuid }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [query.data, tierNames]);

  const getTierName = (item: SkinContent) =>
    item.contentTierUuid ? tierNames.get(item.contentTierUuid) : null;

  return (
    <CosmeticGridPage
      title="Skins"
      subtitle="Coleccion de apariencias de armas agrupadas por arma base."
      query={query}
      searchPlaceholder="Buscar skin..."
      getImage={(item) => item.displayIcon || item.wallpaper}
      getMeta={(item) =>
        [item.weaponName, getTierName(item)].filter(Boolean).join(" · ")
      }
      getSearchText={(item) =>
        `${item.displayName} ${item.weaponName ?? ""} ${getTierName(item) ?? ""}`
      }
      extraFilter={(item) =>
        (weaponFilter === "all" || item.weaponName === weaponFilter) &&
        (tierFilter === "all" || item.contentTierUuid === tierFilter)
      }
      filterControls={
        <div className="content-inline-controls">
          <label className="content-select-label">
            Arma
            <select
              className="content-select"
              value={weaponFilter}
              onChange={(event) => setWeaponFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {weaponOptions.map((weapon) => (
                <option key={weapon} value={weapon}>
                  {weapon}
                </option>
              ))}
            </select>
          </label>
          <label className="content-select-label">
            Rareza
            <select
              className="content-select"
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {tierOptions.map((tier) => (
                <option key={tier.uuid} value={tier.uuid}>
                  {tier.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      renderDetail={(item) => (
        <SkinDetail item={item} tierName={getTierName(item)} />
      )}
    />
  );
}
