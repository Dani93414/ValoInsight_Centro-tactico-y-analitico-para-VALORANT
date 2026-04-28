import { useMemo, useState } from "react";
import { usePlayerCards, usePlayerTitles } from "../api/hooks";
import type { PlayerCardContent, PlayerTitleContent } from "../types/content";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentSection,
  ContentShell,
} from "./contentPageUtils";
import { hideBrokenImage, normalizeText } from "./contentFormatters";
import "./ContentPages.css";

type TitleEntry = PlayerTitleContent & { kind: "title" };
type CardEntry = PlayerCardContent & { kind: "card" };
type Entry = TitleEntry | CardEntry;

function getEntryImage(item: Entry) {
  if (item.kind === "card") {
    return item.wideArt || item.displayIcon || item.smallArt || item.largeArt;
  }
  return item.displayIcon;
}

export default function CosmeticosTitulosTarjetas() {
  const titlesQuery = usePlayerTitles();
  const cardsQuery = usePlayerCards();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [selected, setSelected] = useState<Entry | null>(null);

  const titles = useMemo<TitleEntry[]>(
    () =>
      [...(titlesQuery.data ?? [])]
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((item) => ({ ...item, kind: "title" })),
    [titlesQuery.data],
  );
  const cards = useMemo<CardEntry[]>(
    () =>
      [...(cardsQuery.data ?? [])]
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((item) => ({ ...item, kind: "card" })),
    [cardsQuery.data],
  );

  const filterItem = (item: Entry) => {
    const matchesKind = kindFilter === "all" || item.kind === kindFilter;
    const hidden = Boolean(item.isHiddenIfNotOwned);
    const matchesVisibility =
      visibilityFilter === "all" ||
      (visibilityFilter === "hidden" && hidden) ||
      (visibilityFilter === "visible" && !hidden);
    const text = normalizeText(
      `${item.displayName} ${
        item.kind === "title" ? item.titleText ?? "" : item.themeUuid ?? ""
      }`,
    );
    return (
      matchesKind &&
      matchesVisibility &&
      text.includes(normalizeText(search))
    );
  };

  if (titlesQuery.isLoading || cardsQuery.isLoading) {
    return <ContentLoading title="Cargando titulos y tarjetas" />;
  }

  return (
    <ContentShell
      title="Titulos y tarjetas"
      subtitle="Titulos de jugador y tarjetas de perfil en una vista combinada."
    >
      {(titlesQuery.isError || cardsQuery.isError) && (
        <ContentError
          message="No se pudieron cargar titulos o tarjetas."
          onRetry={() => {
            titlesQuery.refetch();
            cardsQuery.refetch();
          }}
        />
      )}

      {!titlesQuery.isError && !cardsQuery.isError && (
        <>
          <div className="content-toolbar">
            <input
              className="content-search"
              type="search"
              placeholder="Buscar titulo o tarjeta..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="content-inline-controls">
              <label className="content-select-label">
                Tipo
                <select
                  className="content-select"
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="title">Titulos</option>
                  <option value="card">Tarjetas</option>
                </select>
              </label>
              <label className="content-select-label">
                Visibilidad
                <select
                  className="content-select"
                  value={visibilityFilter}
                  onChange={(event) => setVisibilityFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="visible">Visibles</option>
                  <option value="hidden">Ocultos</option>
                </select>
              </label>
            </div>
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
              <div className="content-detail-grid">
                <div>
                  <h2 className="content-detail-title">
                    {selected.displayName}
                  </h2>
                  <div className="content-badge-row">
                    <span className="content-badge">
                      {selected.kind === "title" ? "Titulo" : "Tarjeta"}
                    </span>
                    {selected.kind === "title" && selected.titleText && (
                      <span className="content-badge">{selected.titleText}</span>
                    )}
                    {selected.kind === "card" && selected.themeUuid && (
                      <span className="content-badge">
                        Tema {selected.themeUuid}
                      </span>
                    )}
                    {selected.isHiddenIfNotOwned && (
                      <span className="content-badge">Oculto</span>
                    )}
                  </div>
                </div>
                <div className="content-detail-media">
                  {getEntryImage(selected) && (
                    <img
                      className="content-detail-image"
                      src={getEntryImage(selected) ?? ""}
                      alt={selected.displayName}
                      onError={hideBrokenImage}
                    />
                  )}
                </div>
              </div>
            </article>
          )}

          {titles.length + cards.length === 0 ? (
            <ContentEmpty message="No hay titulos ni tarjetas disponibles." />
          ) : (
            <>
              {kindFilter !== "card" && (
                <ContentSection title="Titulos">
                {titles.filter(filterItem).length === 0 ? (
                  <ContentEmpty message="No hay titulos con ese filtro." />
                ) : (
                  <div className="content-grid">
                    {titles.filter(filterItem).map((item) => (
                      <button
                        key={item.uuid ?? item.displayName}
                        className={`content-card ${
                          selected?.displayName === item.displayName
                            ? "active"
                            : ""
                        }`}
                        type="button"
                        onClick={() => setSelected(item)}
                      >
                        <h2 className="content-card-title">
                          {item.displayName}
                        </h2>
                        <p className="content-card-meta">
                          {item.titleText || "Titulo"}
                        </p>
                        {item.isHiddenIfNotOwned && (
                          <p className="content-card-meta">Oculto</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                </ContentSection>
              )}

              {kindFilter !== "title" && (
                <ContentSection title="Tarjetas">
                {cards.filter(filterItem).length === 0 ? (
                  <ContentEmpty message="No hay tarjetas con ese filtro." />
                ) : (
                  <div className="content-grid">
                    {cards.filter(filterItem).map((item) => (
                      <button
                        key={item.uuid ?? item.displayName}
                        className={`content-card ${
                          selected?.displayName === item.displayName
                            ? "active"
                            : ""
                        }`}
                        type="button"
                        onClick={() => setSelected(item)}
                      >
                        {getEntryImage(item) && (
                          <span className="content-card-image-wrap">
                            <img
                              className="content-card-image"
                              src={getEntryImage(item) ?? ""}
                              alt={item.displayName}
                              loading="lazy"
                              onError={hideBrokenImage}
                            />
                          </span>
                        )}
                        <h2 className="content-card-title">
                          {item.displayName}
                        </h2>
                        <p className="content-card-meta">Tarjeta</p>
                        {item.isHiddenIfNotOwned && (
                          <p className="content-card-meta">Oculta</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                </ContentSection>
              )}
            </>
          )}
        </>
      )}
    </ContentShell>
  );
}
