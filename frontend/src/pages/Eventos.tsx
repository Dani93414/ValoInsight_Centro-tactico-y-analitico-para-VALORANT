import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useEvents } from "../api/hooks";
import type { EventContent } from "../types/content";
import {
  ContentEmpty,
  ContentError,
  ContentLoading,
  ContentShell,
} from "./contentPageUtils";
import { formatDate, normalizeText } from "./contentFormatters";
import "./ContentPages.css";

type EventStatus = "all" | "active" | "future" | "past";

function getEventStatus(event: EventContent): Exclude<EventStatus, "all"> {
  const now = Date.now();
  const start = event.startTime ? new Date(event.startTime).getTime() : NaN;
  const end = event.endTime ? new Date(event.endTime).getTime() : NaN;

  if (!Number.isNaN(start) && start > now) return "future";
  if (!Number.isNaN(end) && end < now) return "past";
  return "active";
}

function statusLabel(status: EventStatus) {
  if (status === "active") return "Activos";
  if (status === "future") return "Proximos";
  if (status === "past") return "Finalizados";
  return "Todos";
}

function getTopbarOffset() {
  const topbar = document.querySelector(".app-topbar");
  return topbar instanceof HTMLElement ? Math.ceil(topbar.getBoundingClientRect().height + 20) : 96;
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

function getEventKey(event: EventContent) {
  return event.uuid ?? event.displayName;
}

export default function Eventos() {
  const query = useEvents();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EventStatus>("all");
  const [selected, setSelected] = useState<EventContent | null>(null);
  const [gridColumns, setGridColumns] = useState(1);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousScrollBeforeDetailRef = useRef<number | null>(null);

  const events = useMemo(
    () =>
      [...(query.data ?? [])].sort((a, b) =>
        (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      ),
    [query.data],
  );

  const filtered = events.filter((event) => {
    const eventStatus = getEventStatus(event);
    const matchesStatus = status === "all" || eventStatus === status;
    const matchesSearch = normalizeText(event.displayName).includes(
      normalizeText(search),
    );
    return matchesStatus && matchesSearch;
  });

  const selectedKey = selected ? getEventKey(selected) : null;
  const selectedIndex = selectedKey
    ? filtered.findIndex((event) => getEventKey(event) === selectedKey)
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
    if (observer && gridRef.current) observer.observe(gridRef.current);
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

  const restoreScroll = () => {
    const savedScroll = previousScrollBeforeDetailRef.current;
    if (savedScroll === null) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScroll, behavior: "smooth" });
      previousScrollBeforeDetailRef.current = null;
    });
  };

  const closeSelectedEvent = () => {
    setSelected(null);
    restoreScroll();
  };

  const selectEvent = (event: EventContent) => {
    const eventKey = getEventKey(event);
    if (selectedKey === eventKey) {
      closeSelectedEvent();
      return;
    }
    previousScrollBeforeDetailRef.current = window.scrollY;
    setSelected(event);
  };

  const selectedDetail = selected ? (
    <article className="content-detail">
      <button
        className="content-detail-close"
        type="button"
        aria-label="Cerrar detalle"
        onClick={closeSelectedEvent}
      >
        <span className="content-detail-close-icon" aria-hidden="true" />
      </button>
      <h2 className="content-detail-title">{selected.displayName}</h2>
      <div className="content-badge-row">
        <span className="content-badge">
          {statusLabel(getEventStatus(selected))}
        </span>
      </div>
      <div className="content-kv-grid">
        <div className="content-kv">
          <span>Inicio</span>
          <strong>{formatDate(selected.startTime)}</strong>
        </div>
        <div className="content-kv">
          <span>Fin</span>
          <strong>{formatDate(selected.endTime)}</strong>
        </div>
      </div>
    </article>
  ) : null;

  if (query.isLoading) {
    return <ContentLoading title="Cargando eventos" />;
  }

  return (
    <ContentShell
      title="Eventos"
      subtitle="Eventos con fechas de inicio y fin cuando el contenido las aporta."
    >
      {query.isError && (
        <ContentError
          message="No se pudieron cargar los eventos."
          onRetry={() => query.refetch()}
        />
      )}

      {!query.isError && events.length === 0 && (
        <ContentEmpty message="No hay eventos disponibles." />
      )}

      {!query.isError && events.length > 0 && (
        <>
          <div className="content-toolbar">
            <input
              className="content-search"
              type="search"
              placeholder="Buscar evento..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelected(null);
              }}
            />
            <div className="content-filter-row" aria-label="Filtrar eventos">
              {(["all", "active", "future", "past"] as EventStatus[]).map(
                (item) => (
                  <button
                    key={item}
                    className={`content-filter-btn ${
                      status === item ? "active" : ""
                    }`}
                    type="button"
                    onClick={() => {
                      setStatus(item);
                      setSelected(null);
                    }}
                  >
                    {statusLabel(item)}
                  </button>
                ),
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <ContentEmpty message="No hay eventos con ese filtro." />
          ) : (
            <div className="content-grid" ref={gridRef}>
              {filtered.map((event, index) => {
                const eventKey = getEventKey(event);
                const active = selectedKey === eventKey;
                return (
                  <Fragment key={eventKey}>
                    <button
                      ref={(element) => {
                        if (element) cardRefs.current.set(eventKey, element);
                        else cardRefs.current.delete(eventKey);
                      }}
                      className={`content-card ${active ? "active" : ""}`}
                      type="button"
                      aria-expanded={active}
                      onClick={() => selectEvent(event)}
                    >
                      <h2 className="content-card-title">
                        {event.displayName}
                      </h2>
                      <p className="content-card-meta">
                        {statusLabel(getEventStatus(event))}
                      </p>
                      <p className="content-card-meta">
                        {formatDate(event.startTime)}
                      </p>
                    </button>
                    {selectedDetail && detailInsertIndex === index + 1 && (
                      <div className="eventos-detail-slot">
                        {selectedDetail}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </>
      )}
    </ContentShell>
  );
}
