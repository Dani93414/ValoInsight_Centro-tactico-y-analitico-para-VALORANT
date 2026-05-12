import { useEffect, useMemo, useRef, useState } from "react";
import { useArmas, useBundles, useContentTiers, useSkins, useThemes } from "../api/hooks";
import type {
  BundleContent,
  SkinChromaContent,
  SkinContent,
  SkinLevelContent,
  ThemeContent,
} from "../types/content";
import { hideBrokenImage, normalizeText } from "./contentFormatters";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentShell,
} from "./contentPageUtils";
import "./ContentPages.css";

type OrganizationMode = "skins" | "collections" | "weapons";

type SkinGroup = {
  key: string;
  label: string;
  image?: string | null;
  source?: "bundle" | "theme" | "none";
  items: SkinContent[];
};

type ResolvedCollection = {
  uuid?: string | null;
  name: string;
  source: "bundle" | "theme" | "none";
  image?: string | null;
};

type WeaponLite = {
  uuid?: string | null;
  displayName?: string | null;
  displayIcon?: string | null;
};

const NO_COLLECTION_KEY = "none:Sin coleccion";

function uniqueImages(images: Array<string | null | undefined>) {
  return [...new Set(images.filter((image): image is string => Boolean(image)))];
}

function getBundleDisplayIcon(collectionUuid?: string | null) {
  return collectionUuid ? `/content/bundles/${collectionUuid}/displayIcon.png` : null;
}

function normalizeCollectionKey(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

function themeAssetToken(assetPath?: string | null) {
  const tail = (assetPath ?? "").split("/").pop() ?? "";
  return normalizeCollectionKey(
    tail.replace(/^Theme_/i, "").replace(/_PrimaryAsset$/i, ""),
  );
}

function bundleAssetToken(assetPath?: string | null) {
  const tail = (assetPath ?? "").split("/").pop() ?? "";
  return normalizeCollectionKey(
    tail
      .replace(/^StorefrontItem_/i, "")
      .replace(/_ThemeBundle_DataAsset$/i, "")
      .replace(/ThemeBundle_DataAsset$/i, ""),
  );
}

function getSkinKey(item: SkinContent) {
  return item.uuid ?? item.displayName;
}

function getPrimarySkinImage(item: SkinContent) {
  return getSkinImageCandidates(item)[0] ?? null;
}

function getSkinImageCandidates(item: SkinContent) {
  const chromaImage = (item.chromas ?? []).find((chroma) =>
    Boolean(chroma.fullRender || chroma.displayIcon),
  );
  const levelImage = (item.levels ?? []).find((level) =>
    Boolean(level.displayIcon),
  );
  return uniqueImages([
    item.displayIcon ||
      null,
    chromaImage?.fullRender,
    chromaImage?.displayIcon,
    item.wallpaper,
    levelImage?.displayIcon,
  ]);
}

function getSkinPreviewImage(item: SkinContent) {
  return getSkinImageCandidates(item)[0] ?? null;
}

function getVariantImage(item?: SkinChromaContent | SkinLevelContent | null) {
  return item?.fullRender || item?.displayIcon || null;
}

function FallbackImage({
  sources,
  alt,
  className,
  loading,
}: {
  sources: Array<string | null | undefined>;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const resolvedSources = useMemo(() => uniqueImages(sources), [sources]);
  const sourcesKey = resolvedSources.join("|");
  const [imageState, setImageState] = useState({ key: sourcesKey, index: 0 });
  const index = imageState.key === sourcesKey ? imageState.index : 0;

  const src = resolvedSources[index];
  if (!src) return null;

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      onError={(event) => {
        if (index < resolvedSources.length - 1) {
          setImageState({ key: sourcesKey, index: index + 1 });
          return;
        }
        hideBrokenImage(event);
      }}
    />
  );
}

function resolveCollectionName(item: SkinContent) {
  return item.collectionName || item.themeName || "Sin coleccion";
}

function resolveCollectionSource(item: SkinContent): "bundle" | "theme" | "none" {
  if (item.collectionSource === "bundle" || item.collectionSource === "theme") {
    return item.collectionSource;
  }
  return item.themeUuid || item.themeName ? "theme" : "none";
}

function formatCollectionSource(source?: SkinGroup["source"]) {
  if (source === "bundle") return "Bundle";
  if (source === "theme") return "Theme";
  return "Sin coleccion";
}

function getTopbarOffset() {
  const topbar = document.querySelector(".app-topbar");
  if (!(topbar instanceof HTMLElement)) {
    return 96;
  }
  return Math.ceil(topbar.getBoundingClientRect().height + 20);
}

function scrollToElement(element: HTMLElement | null) {
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY - getTopbarOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function getWeaponImageForSkin(item: SkinContent, weaponByUuid: Map<string, WeaponLite>) {
  if (!item.weaponUuid) return null;
  const fromApi = item.weaponImage || weaponByUuid.get(item.weaponUuid)?.displayIcon;
  return fromApi || `/content/weapons/${item.weaponUuid}/displayIcon.png`;
}

function SkinDetail({
  skin,
  tierLabel,
  onClose,
}: {
  skin: SkinContent;
  tierLabel: string;
  onClose: () => void;
}) {
  const chromas = skin.chromas ?? [];
  const levels = skin.levels ?? [];
  const [showChromas, setShowChromas] = useState(false);
  const [showLevels, setShowLevels] = useState(false);

  const primaryImage = getPrimarySkinImage(skin);

  return (
    <article className="content-detail skin-inline-detail cskins-detail" key={getSkinKey(skin)}>
      <button
        className="content-detail-close"
        type="button"
        aria-label="Cerrar detalle"
        onClick={onClose}
      >
        x
      </button>
      <div className="content-detail-grid cskins-detail-grid">
        <div className="cskins-detail-media">
          {primaryImage ? (
            <FallbackImage
              className="cskins-detail-main-image"
              sources={getSkinImageCandidates(skin)}
              alt={skin.displayName}
            />
          ) : (
            <div className="cskins-image-fallback">Sin imagen</div>
          )}
        </div>

        <div>
          <h2 className="content-detail-title">{skin.displayName}</h2>
          <div className="content-badge-row">
            <span className="content-badge">{skin.weaponName || "Arma"}</span>
            <span className="content-badge">{resolveCollectionName(skin)}</span>
            <span className="content-badge">{tierLabel}</span>
          </div>

          <div className="content-kv-grid">
            <div className="content-kv"><span>Arma</span><strong>{skin.weaponName || "Desconocida"}</strong></div>
            <div className="content-kv"><span>Rareza</span><strong>{tierLabel}</strong></div>
            <div className="content-kv"><span>Coleccion</span><strong>{resolveCollectionName(skin)}</strong></div>
            <div className="content-kv"><span>Origen</span><strong>{formatCollectionSource(resolveCollectionSource(skin))}</strong></div>
            <div className="content-kv"><span>Chromas</span><strong>{skin.chromasCount ?? chromas.length}</strong></div>
            <div className="content-kv"><span>Levels</span><strong>{skin.levelsCount ?? levels.length}</strong></div>
          </div>

          <section className={`cskins-accordion ${showChromas ? "is-open" : ""}`}>
            <button type="button" className="cskins-accordion-toggle" onClick={() => setShowChromas((v) => !v)} aria-expanded={showChromas}>
              <span>Chromas</span>
              <strong>{chromas.length}</strong>
              <i className={`cskins-toggle-indicator ${showChromas ? "is-open" : ""}`} />
            </button>
            {showChromas && (
              <div className="cskins-accordion-panel">
                {chromas.length === 0 && <p className="content-detail-text">No hay chromas.</p>}
                {chromas.length > 0 && (
                  <div className="cskins-variant-grid">
                    {chromas.map((chroma) => {
                      const image = getVariantImage(chroma) || chroma.swatch;
                      return (
                        <article className="cskins-variant-card" key={chroma.uuid ?? chroma.displayName}>
                          {image && (
                            <FallbackImage
                              sources={[chroma.fullRender, chroma.displayIcon, chroma.swatch]}
                              alt={chroma.displayName}
                              loading="lazy"
                            />
                          )}
                          <h4>{chroma.displayName}</h4>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className={`cskins-accordion ${showLevels ? "is-open" : ""}`}>
            <button type="button" className="cskins-accordion-toggle" onClick={() => setShowLevels((v) => !v)} aria-expanded={showLevels}>
              <span>Levels</span>
              <strong>{levels.length}</strong>
              <i className={`cskins-toggle-indicator ${showLevels ? "is-open" : ""}`} />
            </button>
            {showLevels && (
              <div className="cskins-accordion-panel">
                {levels.length === 0 && <p className="content-detail-text">No hay levels.</p>}
                {levels.length > 0 && (
                  <div className="cskins-variant-grid">
                    {levels.map((level) => (
                      <article className="cskins-variant-card" key={level.uuid ?? level.displayName}>
                        {getVariantImage(level) && (
                          <FallbackImage
                            sources={[level.fullRender, level.displayIcon]}
                            alt={level.displayName}
                            loading="lazy"
                          />
                        )}
                        <h4>{level.displayName}</h4>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}

export default function CosmeticosSkins() {
  const skinsQuery = useSkins();
  const tiersQuery = useContentTiers();
  const armasQuery = useArmas();
  const bundlesQuery = useBundles();
  const themesQuery = useThemes();

  const [mode, setMode] = useState<OrganizationMode>("collections");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "bundle" | "theme" | "none">("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedSkinKey, setSelectedSkinKey] = useState<string | null>(null);
  const inlineGroupRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const skins = useMemo(
    () => [...(skinsQuery.data ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [skinsQuery.data],
  );

  const tierNames = useMemo(() => {
    const map = new Map<string, string>();
    (tiersQuery.data ?? []).forEach((tier) => {
      if (tier.uuid) map.set(tier.uuid, tier.displayName);
    });
    return map;
  }, [tiersQuery.data]);

  const weaponByUuid = useMemo(() => {
    const map = new Map<string, WeaponLite>();
    ((armasQuery.data ?? []) as WeaponLite[]).forEach((weapon) => {
      if (weapon.uuid) map.set(weapon.uuid, weapon);
    });
    return map;
  }, [armasQuery.data]);

  const themeByUuid = useMemo(() => {
    const map = new Map<string, ThemeContent>();
    (themesQuery.data ?? []).forEach((theme) => {
      if (theme.uuid) map.set(theme.uuid, theme);
    });
    return map;
  }, [themesQuery.data]);

  const bundleIndexes = useMemo(() => {
    const byUuid = new Map<string, BundleContent>();
    const byThemeToken = new Map<string, BundleContent>();
    const byName = new Map<string, BundleContent[]>();

    (bundlesQuery.data ?? []).forEach((bundle) => {
      if (bundle.uuid) byUuid.set(bundle.uuid, bundle);

      const nameKey = normalizeCollectionKey(bundle.displayName);
      const token = bundleAssetToken(bundle.assetPath);
      if (nameKey && token) {
        byThemeToken.set(`${nameKey}:${token}`, bundle);
      }
      if (nameKey) {
        byName.set(nameKey, [...(byName.get(nameKey) ?? []), bundle]);
      }
    });

    return { byUuid, byThemeToken, byName };
  }, [bundlesQuery.data]);

  const resolveCollection = useMemo(() => {
    return (skin: SkinContent): ResolvedCollection => {
      if (skin.collectionSource === "bundle" && skin.collectionUuid) {
        const bundle = bundleIndexes.byUuid.get(skin.collectionUuid);
        return {
          uuid: skin.collectionUuid,
          name: bundle?.displayName || skin.collectionName || skin.themeName || "Sin coleccion",
          source: "bundle",
          image: getBundleDisplayIcon(skin.collectionUuid),
        };
      }

      const theme = skin.themeUuid ? themeByUuid.get(skin.themeUuid) : null;
      const themeName = theme?.displayName || skin.themeName || skin.collectionName;
      const nameKey = normalizeCollectionKey(themeName);
      const token = themeAssetToken(theme?.assetPath);
      const bundle =
        nameKey && token
          ? bundleIndexes.byThemeToken.get(`${nameKey}:${token}`)
          : null;
      const uniqueNameBundle =
        !bundle && nameKey && (bundleIndexes.byName.get(nameKey)?.length ?? 0) === 1
          ? bundleIndexes.byName.get(nameKey)?.[0]
          : null;
      const matchedBundle = bundle || uniqueNameBundle || null;

      if (matchedBundle?.uuid) {
        return {
          uuid: matchedBundle.uuid,
          name: matchedBundle.displayName,
          source: "bundle",
          image: getBundleDisplayIcon(matchedBundle.uuid),
        };
      }

      if (skin.collectionSource === "theme" || themeName || skin.themeUuid) {
        return {
          uuid: skin.themeUuid || skin.collectionUuid,
          name: themeName || "Sin coleccion",
          source: "theme",
          image: getSkinPreviewImage(skin),
        };
      }

      return {
        uuid: null,
        name: "Sin coleccion",
        source: "none",
        image: getSkinPreviewImage(skin),
      };
    };
  }, [bundleIndexes, themeByUuid]);

  const filteredSkins = useMemo(() => {
    const needle = normalizeText(search);
    return skins.filter((skin) => {
      const source = resolveCollection(skin).source;
      if (sourceFilter !== "all" && source !== sourceFilter) {
        return false;
      }
      const tier = skin.contentTierUuid ? tierNames.get(skin.contentTierUuid) : "";
      const collection = resolveCollection(skin).name;
      const text = `${skin.displayName} ${skin.weaponName ?? ""} ${collection} ${tier ?? ""}`;
      return normalizeText(text).includes(needle);
    });
  }, [resolveCollection, search, skins, sourceFilter, tierNames]);

  const catalogStats = useMemo(() => {
    const sources = skins.reduce(
      (acc, skin) => {
        acc[resolveCollection(skin).source] += 1;
        return acc;
      },
      { bundle: 0, theme: 0, none: 0 },
    );
    const weapons = new Set(skins.map((skin) => skin.weaponUuid || skin.weaponName).filter(Boolean));
    const collections = new Set(
      skins.map((skin) => {
        const collection = resolveCollection(skin);
        return `${collection.source}:${collection.uuid ?? collection.name}`;
      }),
    );
    return {
      total: skins.length,
      shown: filteredSkins.length,
      bundles: sources.bundle,
      themes: sources.theme,
      weapons: weapons.size,
      collections: collections.size,
    };
  }, [filteredSkins.length, resolveCollection, skins]);

  const groups = useMemo(() => {
    if (mode === "skins") {
      return [{ key: "all-skins", label: "Skins", items: filteredSkins }] as SkinGroup[];
    }

    if (mode === "collections") {
      const map = new Map<string, SkinGroup>();
      filteredSkins.forEach((skin) => {
        const collection = resolveCollection(skin);
        const groupSource = collection.source;
        const label = collection.name || "Sin coleccion";

        const groupKey =
          groupSource === "none" && label === "Sin coleccion"
            ? NO_COLLECTION_KEY
            : `${groupSource}:${collection.uuid ?? "none"}:${label}`;
        const collectionImage =
          groupSource === "bundle"
            ? collection.image
              ?? skin.collectionPromoImage
              ?? getSkinPreviewImage(skin)
            : collection.image ?? getSkinPreviewImage(skin);

        const current = map.get(groupKey);
        if (current) {
          current.items.push(skin);
          if (!current.image && collectionImage) {
            current.image = collectionImage;
          }
          return;
        }

        map.set(groupKey, {
          key: groupKey,
          label,
          image: collectionImage,
          source: groupSource,
          items: [skin],
        });
      });

      return [...map.values()]
        .sort((a, b) => {
          if (a.key === NO_COLLECTION_KEY) return 1;
          if (b.key === NO_COLLECTION_KEY) return -1;
          return a.label.localeCompare(b.label);
        });
    }

    const map = new Map<string, SkinGroup>();
    filteredSkins.forEach((skin) => {
      const weapon = (skin.weaponUuid && weaponByUuid.get(skin.weaponUuid)) || null;
      const label = weapon?.displayName || skin.weaponName || "Sin arma";
      const key = `weapon:${skin.weaponUuid ?? label}`;
      const current = map.get(key);
      if (current) {
        current.items.push(skin);
        return;
      }
      map.set(key, {
        key,
        label,
        image: weapon?.displayIcon || getWeaponImageForSkin(skin, weaponByUuid),
        items: [skin],
      });
    });

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredSkins, mode, resolveCollection, weaponByUuid]);

  const effectiveSelectedGroupKey = selectedGroupKey;
  const selectedGroup = groups.find((group) => group.key === effectiveSelectedGroupKey) ?? null;
  const selectedItems = mode === "skins" ? filteredSkins : selectedGroup?.items ?? [];
  const selectedSkin =
    selectedSkinKey
      ? filteredSkins.find((skin) => getSkinKey(skin) === selectedSkinKey) ?? null
      : null;
  const selectedSkinTierLabel =
    selectedSkin?.contentTierUuid && tierNames.get(selectedSkin.contentTierUuid)
      ? tierNames.get(selectedSkin.contentTierUuid)!
      : "Sin rareza";

  useEffect(() => {
    if (!selectedGroupKey) return;
    window.requestAnimationFrame(() => scrollToElement(inlineGroupRef.current));
  }, [selectedGroupKey]);

  useEffect(() => {
    if (!selectedSkinKey) return;
    window.requestAnimationFrame(() => scrollToElement(detailRef.current));
  }, [selectedSkinKey]);

  if (skinsQuery.isLoading) return <ContentLoading title="Cargando skins" />;

  return (
    <ContentShell title="Skins" subtitle="Catalogo moderno de skins con organizacion por skin, coleccion o arma.">
      {skinsQuery.isError && (
        <ContentError message="No se pudo cargar esta categoria de cosmeticos." onRetry={() => skinsQuery.refetch()} />
      )}

      {!skinsQuery.isError && skins.length === 0 && <ContentEmpty message="No hay skins disponibles." />}

      {!skinsQuery.isError && skins.length > 0 && (
        <>
          <div className="content-toolbar content-toolbar--skins">
            <label className="content-select-label content-select-label--premium content-filter-field--search">
              Buscar
              <input
                className="content-search content-search--premium"
                type="search"
                placeholder="Buscar skins, colecciones o armas"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSourceFilter("all");
                  setSelectedGroupKey(null);
                  setSelectedSkinKey(null);
                }}
              />
            </label>

            <div className="content-inline-controls content-inline-controls--premium">
              <label className="content-select-label content-select-label--premium">
                Origen
                <select
                  className="content-select content-select--premium"
                  value={sourceFilter}
                  onChange={(event) => {
                    setSourceFilter(event.target.value as typeof sourceFilter);
                    setSelectedGroupKey(null);
                    setSelectedSkinKey(null);
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="bundle">Bundles</option>
                  <option value="theme">Themes</option>
                  <option value="none">Sin coleccion</option>
                </select>
              </label>

              <label className="content-select-label content-select-label--premium">
                Agrupar
                <select
                  className="content-select content-select--premium"
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value as OrganizationMode);
                    setSelectedGroupKey(null);
                    setSelectedSkinKey(null);
                  }}
                >
                  <option value="collections">Por coleccion</option>
                  <option value="weapons">Por arma</option>
                  <option value="skins">Todas</option>
                </select>
              </label>
            </div>
          </div>

          <div className="cskins-catalog-stats" aria-label="Resumen del catalogo de skins">
            <span><strong>{catalogStats.shown}</strong> visibles</span>
            <span><strong>{catalogStats.total}</strong> skins</span>
            <span><strong>{catalogStats.collections}</strong> colecciones</span>
            <span><strong>{catalogStats.weapons}</strong> armas</span>
            <span><strong>{catalogStats.bundles}</strong> por bundle</span>
            <span><strong>{catalogStats.themes}</strong> por theme</span>
          </div>

          {groups.length === 0 && <ContentEmpty message="No hay resultados con ese filtro." />}

          {groups.length > 0 && mode !== "skins" && (
            <section className="content-section">
              <h2 className="content-section-title">{mode === "collections" ? "Colecciones" : "Armas"}</h2>
              <div className="content-grid cskins-group-grid">
                {groups.map((group) => {
                  const isOpen = effectiveSelectedGroupKey === group.key;
                  const firstSkin = group.items[0];
                  const groupImageSources = firstSkin
                    ? [
                        group.image,
                        getSkinPreviewImage(firstSkin),
                      ]
                    : [group.image];
                  return (
                    <div key={group.key} className="cskins-group-slot">
                      <button
                        type="button"
                        className={`content-card cskins-group-card cskins-group-card--${mode === "weapons" ? "weapon" : group.source ?? "none"} ${isOpen ? "active" : ""}`}
                        onClick={() => {
                          setSelectedGroupKey(group.key);
                          setSelectedSkinKey(null);
                        }}
                      >
                        <span className={`content-card-image-wrap cskins-group-image-wrap ${mode === "weapons" ? "cskins-group-image-wrap--weapon" : ""}`}>
                          {groupImageSources.some(Boolean) ? (
                            <FallbackImage
                              className={`content-card-image cskins-group-image ${mode === "weapons" ? "cskins-group-image--weapon" : ""}`}
                              sources={groupImageSources}
                              alt={group.label}
                              loading="lazy"
                            />
                          ) : (
                            <span className="cskins-image-fallback">{group.label.slice(0, 2).toUpperCase()}</span>
                          )}
                        </span>
                        <h3 className="content-card-title">{group.label}</h3>
                        <p className="content-card-meta">
                          <span>{group.items.length} skins</span>
                          <strong>{mode === "weapons" ? "Arma" : formatCollectionSource(group.source)}</strong>
                          <i className={`cskins-toggle-indicator ${isOpen ? "is-open" : ""}`} />
                        </p>
                      </button>
                    </div>
                  );
                })}
              </div>

              {selectedGroup && (
                <div className="cskins-inline-panel" ref={inlineGroupRef}>
                  {selectedSkin && selectedGroup.items.some((skin) => getSkinKey(skin) === selectedSkinKey) && (
                    <div className="cskins-detail-slot" ref={detailRef}>
                      <SkinDetail
                        skin={selectedSkin}
                        tierLabel={selectedSkinTierLabel}
                        onClose={() => setSelectedSkinKey(null)}
                      />
                    </div>
                  )}
                  <div className="content-grid cskins-skin-grid">
                    {selectedGroup.items.map((skin) => {
                      const key = getSkinKey(skin);
                      const skinOpen = selectedSkinKey === key;
                      const imageSources = [
                        ...getSkinImageCandidates(skin),
                        getWeaponImageForSkin(skin, weaponByUuid),
                      ];
                      const image = imageSources[0] ?? null;
                      const tierLabel = (skin.contentTierUuid && tierNames.get(skin.contentTierUuid)) || "Sin rareza";
                      return (
                        <div key={key} className="cskins-skin-slot">
                          <button
                            type="button"
                            className={`content-card cskins-skin-card ${skinOpen ? "active" : ""}`}
                            onClick={() => setSelectedSkinKey((curr) => (curr === key ? null : key))}
                          >
                            <span className="content-card-image-wrap cskins-skin-image-wrap">
                              {image ? (
                                <FallbackImage
                                  className="content-card-image cskins-skin-image"
                                  sources={imageSources}
                                  alt={skin.displayName}
                                  loading="lazy"
                                />
                              ) : (
                                <span className="cskins-image-fallback">SK</span>
                              )}
                            </span>
                            <h3 className="content-card-title">{skin.displayName}</h3>
                            <p className="content-card-meta">{skin.weaponName || "Arma"} - {tierLabel}<i className={`cskins-toggle-indicator ${skinOpen ? "is-open" : ""}`} /></p>
                            <p className="content-card-meta">{resolveCollectionName(skin)}</p>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {mode === "skins" && (
            <section className="content-section">
              <h2 className="content-section-title">Skins</h2>
              {selectedSkin && (
                <div className="cskins-detail-slot" ref={detailRef}>
                  <SkinDetail
                    skin={selectedSkin}
                    tierLabel={selectedSkinTierLabel}
                    onClose={() => setSelectedSkinKey(null)}
                  />
                </div>
              )}
              <div className="content-grid cskins-skin-grid">
                {selectedItems.map((skin) => {
                  const key = getSkinKey(skin);
                  const skinOpen = selectedSkinKey === key;
                  const imageSources = [
                    ...getSkinImageCandidates(skin),
                    getWeaponImageForSkin(skin, weaponByUuid),
                  ];
                  const image = imageSources[0] ?? null;
                  const tierLabel = (skin.contentTierUuid && tierNames.get(skin.contentTierUuid)) || "Sin rareza";
                  return (
                    <div key={key} className="cskins-skin-slot">
                      <button
                        type="button"
                        className={`content-card cskins-skin-card ${skinOpen ? "active" : ""}`}
                        onClick={() => setSelectedSkinKey((curr) => (curr === key ? null : key))}
                      >
                        <span className="content-card-image-wrap cskins-skin-image-wrap">
                          {image ? (
                            <FallbackImage
                              className="content-card-image cskins-skin-image"
                              sources={imageSources}
                              alt={skin.displayName}
                              loading="lazy"
                            />
                          ) : (
                            <span className="cskins-image-fallback">SK</span>
                          )}
                        </span>
                        <h3 className="content-card-title">{skin.displayName}</h3>
                        <p className="content-card-meta">{skin.weaponName || "Arma"} - {tierLabel}<i className={`cskins-toggle-indicator ${skinOpen ? "is-open" : ""}`} /></p>
                        <p className="content-card-meta">{resolveCollectionName(skin)}</p>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </ContentShell>
  );
}
