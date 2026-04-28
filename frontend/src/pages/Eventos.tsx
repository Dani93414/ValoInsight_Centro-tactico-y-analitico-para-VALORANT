import { useMemo, useState } from "react";
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

export default function Eventos() {
  const query = useEvents();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EventStatus>("all");
  const [selected, setSelected] = useState<EventContent | null>(null);

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
              onChange={(event) => setSearch(event.target.value)}
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
                    onClick={() => setStatus(item)}
                  >
                    {statusLabel(item)}
                  </button>
                ),
              )}
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
          )}

          {filtered.length === 0 ? (
            <ContentEmpty message="No hay eventos con ese filtro." />
          ) : (
            <div className="content-grid">
              {filtered.map((event) => {
                const active = selected?.displayName === event.displayName;
                return (
                  <button
                    key={event.uuid ?? event.displayName}
                    className={`content-card ${active ? "active" : ""}`}
                    type="button"
                    onClick={() => setSelected(active ? null : event)}
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
                );
              })}
            </div>
          )}
        </>
      )}
    </ContentShell>
  );
}
