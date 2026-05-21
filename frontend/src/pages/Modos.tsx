import { useEffect, useMemo, useRef, useState } from "react";
import { useGameModes } from "../api/hooks";
import type { GameModeContent } from "../types/content";
import {
  ClearableSearchInput,
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentShell,
} from "./contentPageUtils";
import { hideBrokenImage, normalizeText } from "./contentFormatters";
import "./ContentPages.css";

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

function getGridColumns(container: HTMLElement | null) {
  if (!container) return 1;
  const template = window.getComputedStyle(container).gridTemplateColumns;
  return Math.max(1, template.split(" ").filter(Boolean).length);
}

function getInsertIndex(selectedIndex: number, columns: number, total: number) {
  const rowEnd = selectedIndex + (columns - (selectedIndex % columns));
  return Math.min(rowEnd, total);
}

function getModeKey(mode: GameModeContent) {
  return mode.uuid ?? mode.displayName;
}

function getModeImage(mode: GameModeContent) {
  return mode.displayIcon || mode.listViewIconTall || null;
}

export default function Modos() {
  const query = useGameModes();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GameModeContent | null>(null);
  const [gridColumns, setGridColumns] = useState(1);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());

  const modes = useMemo(
    () =>
      [...(query.data ?? [])].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    [query.data],
  );

  const filtered = useMemo(() => {
    const needle = normalizeText(search);
    return modes.filter((mode) =>
      normalizeText(`${mode.displayName} ${mode.description ?? ""}`).includes(needle),
    );
  }, [modes, search]);

  const selectedKey = selected ? getModeKey(selected) : null;
  const selectedIndex = selectedKey
    ? filtered.findIndex((mode) => getModeKey(mode) === selectedKey)
    : -1;
  const detailInsertIndex =
    selected && selectedIndex >= 0
      ? getInsertIndex(selectedIndex, gridColumns, filtered.length)
      : -1;

  useEffect(() => {
    const updateColumns = () => setGridColumns(getGridColumns(gridRef.current));
    updateColumns();

    const observer =
      typeof ResizeObserver === "undefined" || !gridRef.current
        ? null
        : new ResizeObserver(updateColumns);

    if (observer && gridRef.current) {
      observer.observe(gridRef.current);
    }

    window.addEventListener("resize", updateColumns);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateColumns);
    };
  }, [filtered.length]);

  useEffect(() => {
    if (!selectedKey) return;
    window.requestAnimationFrame(() => scrollToElement(cardRefs.current.get(selectedKey) ?? null));
  }, [selectedKey]);

  const closeSelectedMode = (modeKey?: string) => {
    const targetKey = modeKey ?? selectedKey;
    setSelected(null);
    window.requestAnimationFrame(() => {
      if (targetKey) {
        scrollToElement(cardRefs.current.get(targetKey) ?? null);
      }
    });
  };

  const selectMode = (mode: GameModeContent) => {
    const modeKey = getModeKey(mode);
    if (selectedKey === modeKey) {
      closeSelectedMode(modeKey);
      return;
    }
    setSelected(mode);
  };

  const selectedDetail = selected ? (
    <article className="content-detail cskins-detail modos-detail">
      <button
        className="content-detail-close"
        type="button"
        aria-label="Cerrar detalle"
        onClick={() => closeSelectedMode()}
      >
        <span className="content-detail-close-icon" aria-hidden="true" />
      </button>
      <div className="content-detail-grid modos-detail-grid">
        <div>
          <h2 className="content-detail-title">{selected.displayName}</h2>
          <div className="content-badge-row">
            <span className="content-badge">
              {selected.duration || "Modo"}
            </span>
            <span className="content-badge">
              {selected.isTeamVoiceAllowed ? "Voz de equipo" : "Sin voz de equipo"}
            </span>
          </div>
          <p className="content-detail-text">
            {selected.description || "Sin descripcion."}
          </p>
          <div className="content-rule-grid modos-rule-grid">
            <div className="content-rule">
              <span>Minimapa</span>
              <strong>{selected.isMinimapHidden ? "Oculto" : "Visible"}</strong>
            </div>
            <div className="content-rule">
              <span>Timeouts</span>
              <strong>{selected.allowsMatchTimeouts ? "Permitidos" : "No permitidos"}</strong>
            </div>
            <div className="content-rule">
              <span>Replays custom</span>
              <strong>{selected.allowsCustomGameReplays ? "Permitidos" : "No permitidos"}</strong>
            </div>
          </div>
        </div>
        <div className="content-detail-media modos-detail-media">
          {getModeImage(selected) ? (
            <img
              className="content-detail-image modos-detail-image"
              src={getModeImage(selected) ?? ""}
              alt={selected.displayName}
              onError={hideBrokenImage}
            />
          ) : (
            <div className="modos-empty-image">Sin imagen</div>
          )}
        </div>
      </div>
    </article>
  ) : null;

  if (query.isLoading) {
    return <ContentLoading title="Cargando modos" />;
  }

  return (
    <ContentShell
      title="Modos de juego"
      subtitle="Modos disponibles con descripcion e icono local cuando existe."
    >
      {query.isError && (
        <ContentError
          message="No se pudieron cargar los modos de juego."
          onRetry={() => query.refetch()}
        />
      )}

      {!query.isError && modes.length === 0 && (
        <ContentEmpty message="No hay modos de juego disponibles." />
      )}

      {!query.isError && modes.length > 0 && (
        <>
          <div className="content-toolbar content-toolbar--catalog modos-toolbar">
            <ClearableSearchInput
              inputClassName="content-search--catalog"
              placeholder="Buscar modo..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelected(null);
              }}
              onClear={() => {
                setSearch("");
                setSelected(null);
              }}
            />

            <span className="content-result-count">{filtered.length}</span>
          </div>

          {filtered.length === 0 ? (
            <ContentEmpty message="No hay modos con esa busqueda." />
          ) : (
            <div className="content-grid modos-grid" ref={gridRef}>
              {filtered.map((mode, index) => {
                const modeKey = getModeKey(mode);
                const active = selectedKey === modeKey;
                const icon = getModeImage(mode);
                return (
                  <div key={modeKey} className="modos-slot">
                    <button
                      ref={(element) => {
                        if (element) cardRefs.current.set(modeKey, element);
                        else cardRefs.current.delete(modeKey);
                      }}
                      className={`content-card modos-card ${active ? "active" : ""}`}
                      type="button"
                      onClick={() => selectMode(mode)}
                    >
                      {icon && (
                        <span className="content-card-image-wrap modos-card-image-wrap">
                          <img
                            className="content-card-image modos-card-image"
                            src={icon}
                            alt={mode.displayName}
                            loading="lazy"
                            onError={hideBrokenImage}
                          />
                        </span>
                      )}
                      <h2 className="content-card-title">{mode.displayName}</h2>
                      <p className="content-card-meta">
                        {mode.duration || "Modo"}
                      </p>
                    </button>
                    {selectedDetail && detailInsertIndex === index + 1 && (
                      <div className="modos-detail-slot" ref={detailRef}>
                        {selectedDetail}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </ContentShell>
  );
}
