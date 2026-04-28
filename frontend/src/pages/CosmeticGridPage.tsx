import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { NamedContentItem } from "../types/content";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentShell,
} from "./contentPageUtils";
import { hideBrokenImage, normalizeText } from "./contentFormatters";
import "./ContentPages.css";

type CosmeticGridPageProps<T extends NamedContentItem> = {
  title: string;
  subtitle: string;
  query: UseQueryResult<T[], Error>;
  searchPlaceholder: string;
  getImage?: (item: T) => string | null | undefined;
  getMeta?: (item: T) => string | null | undefined;
  getSearchText?: (item: T) => string;
  extraFilter?: (item: T) => boolean;
  filterControls?: ReactNode;
  renderDetail?: (item: T) => ReactNode;
};

export default function CosmeticGridPage<T extends NamedContentItem>({
  title,
  subtitle,
  query,
  searchPlaceholder,
  getImage = (item) => item.displayIcon,
  getMeta,
  getSearchText = (item) => item.displayName,
  extraFilter,
  filterControls,
  renderDetail,
}: CosmeticGridPageProps<T>) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<T | null>(null);

  const items = useMemo(
    () =>
      [...(query.data ?? [])].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [query.data],
  );

  const filtered = useMemo(() => {
    const needle = normalizeText(search);
    return items.filter(
      (item) =>
        normalizeText(getSearchText(item)).includes(needle) &&
        (!extraFilter || extraFilter(item)),
    );
  }, [extraFilter, getSearchText, items, search]);

  if (query.isLoading) {
    return <ContentLoading title={`Cargando ${title.toLowerCase()}`} />;
  }

  return (
    <ContentShell title={title} subtitle={subtitle}>
      {query.isError && (
        <ContentError
          message="No se pudo cargar esta categoria de cosmeticos."
          onRetry={() => query.refetch()}
        />
      )}

      {!query.isError && items.length === 0 && (
        <ContentEmpty message="No hay elementos disponibles en esta categoria." />
      )}

      {!query.isError && items.length > 0 && (
        <>
          <div className="content-toolbar">
            <input
              className="content-search"
              type="search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {filterControls}
          </div>

          {selected && (
            <article className="content-detail">
              <button
                className="content-detail-close"
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setSelected(null)}
              >
                x
              </button>
              {renderDetail ? (
                renderDetail(selected)
              ) : (
                <div className="content-detail-grid">
                  <div>
                    <h2 className="content-detail-title">
                      {selected.displayName}
                    </h2>
                    {getMeta?.(selected) && (
                      <div className="content-badge-row">
                        <span className="content-badge">
                          {getMeta(selected)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="content-detail-media">
                    {getImage(selected) && (
                      <img
                        className="content-detail-image"
                        src={getImage(selected) ?? ""}
                        alt={selected.displayName}
                        onError={hideBrokenImage}
                      />
                    )}
                  </div>
                </div>
              )}
            </article>
          )}

          {filtered.length === 0 ? (
            <ContentEmpty message="No hay resultados con ese filtro." />
          ) : (
            <div className="content-grid">
              {filtered.map((item) => {
                const active = selected?.displayName === item.displayName;
                const image = getImage(item);
                return (
                  <button
                    key={item.uuid ?? item.displayName}
                    className={`content-card ${active ? "active" : ""}`}
                    type="button"
                    onClick={() => setSelected(active ? null : item)}
                  >
                    {image && (
                      <span className="content-card-image-wrap">
                        <img
                          className="content-card-image"
                          src={image}
                          alt={item.displayName}
                          loading="lazy"
                          onError={hideBrokenImage}
                        />
                      </span>
                    )}
                    <h2 className="content-card-title">{item.displayName}</h2>
                    {getMeta?.(item) && (
                      <p className="content-card-meta">{getMeta(item)}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </ContentShell>
  );
}
