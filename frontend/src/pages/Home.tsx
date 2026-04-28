import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContentSummary, useRegions } from "../api/hooks";
import { searchPlayers } from "../api/stats.ts";
import "./Home.css";

function formatCompact(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-ES", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function Home() {
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [results, setResults] = useState<
    Array<{
      id: string;
      gameName: string;
      tagLine: string;
      displayName: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [cosmeticsOpen, setCosmeticsOpen] = useState(false);
  const { data: contentSummary } = useContentSummary();
  const { data: regions } = useRegions();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef = useRef(0);
  const navigate = useNavigate();

  const cosmeticCategories = [
    { label: "Skins", path: "/cosmeticos/skins" },
    { label: "Llaveros", path: "/cosmeticos/llaveros" },
    { label: "Flex", path: "/cosmeticos/flex" },
    { label: "Bordes de Nivel", path: "/cosmeticos/bordes" },
    { label: "Titulos y Tarjetas", path: "/cosmeticos/titulos-tarjetas" },
    { label: "Sprays", path: "/cosmeticos/sprays" },
  ];

  const primaryRegion = regions?.[0];
  const contentCounts = contentSummary?.counts ?? {};
  const summaryStats = [
    {
      label: "Jugadores",
      value: formatCompact(primaryRegion?.uniquePlayers),
      detail: primaryRegion?.region ? `Región ${primaryRegion.region}` : "Global",
    },
    {
      label: "Partidas",
      value: formatCompact(primaryRegion?.totalMatches),
      detail: "ranked analizadas",
    },
    {
      label: "Rondas",
      value: formatCompact(primaryRegion?.totalRounds),
      detail: "eventos agregados",
    },
    {
      label: "Contenido",
      value: formatCompact(
        (contentCounts.agents ?? 0) +
          (contentCounts.maps ?? 0) +
          (contentCounts.weapons ?? 0),
      ),
      detail: "agentes, mapas y armas",
    },
  ];

  const handleSearch = (nextGameName: string, nextTagLine: string) => {
    setGameName(nextGameName);
    setTagLine(nextTagLine);
    requestSequenceRef.current += 1;
    const scheduledRequestId = requestSequenceRef.current;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    if (!nextGameName.trim() && !nextTagLine.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const requestId = scheduledRequestId;

      setLoading(true);
      try {
        const res = await searchPlayers(nextGameName, nextTagLine);
        if (requestId === requestSequenceRef.current) {
          setResults(res || []);
        }
      } catch {
        if (requestId === requestSequenceRef.current) {
          setResults([]);
        }
      } finally {
        if (requestId === requestSequenceRef.current) {
          setLoading(false);
        }
      }
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!cosmeticsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCosmeticsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cosmeticsOpen]);

  return (
    <main className="home-container">
      {/* =============================
         HEADER
      ============================== */}
      <header className="home-header">
        <span className="home-eyebrow">ValoInsight</span>
        <h1 className="home-title">Inicio</h1>
        <div className="home-divider" />
        <p className="home-subtitle">
          Tu centro de mando para explorar agentes, armas y estadísticas de
          Valorant
        </p>
      </header>

      {/* =============================
         BÚSQUEDA DE JUGADOR
      ============================== */}
      <section className="home-search-section">
        <h2 className="home-section-title">Buscar jugador</h2>

        <div className="home-search-row">
          <div className="home-input-wrapper">
            <svg
              className="home-input-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
              width="16"
              height="16"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              placeholder="gameName (ej: TenZ)"
              value={gameName}
              onChange={(e) => handleSearch(e.target.value, tagLine)}
            />
          </div>
          <div className="home-input-wrapper">
            <svg
              className="home-input-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
              width="16"
              height="16"
            >
              <path
                fillRule="evenodd"
                d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.94l1-4H9.03z"
                clipRule="evenodd"
              />
            </svg>
            <input
              placeholder="tagLine (ej: NA1)"
              value={tagLine}
              onChange={(e) => handleSearch(gameName, e.target.value)}
            />
          </div>
        </div>

        {loading && (
          <div className="home-search-loading">
            <div className="home-search-spinner" />
            <span>Buscando…</span>
          </div>
        )}

        {results.length > 0 && (
          <ul className="home-search-results">
            {results.map((r) => (
              <li key={r.id} onClick={() => navigate(`/estadisticas/${r.id}`)}>
                <span className="result-name">{r.displayName}</span>
                <svg
                  className="result-arrow"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  width="14"
                  height="14"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </li>
            ))}
          </ul>
        )}

        {!loading &&
          (gameName.trim() || tagLine.trim()) &&
          results.length === 0 && (
            <div className="home-search-empty">
              No se encontraron jugadores con esos filtros.
            </div>
          )}
      </section>

      <section className="home-stats-strip" aria-label="Resumen global">
        {summaryStats.map((stat) => (
          <article key={stat.label} className="home-stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </article>
        ))}
      </section>

      {/* =============================
         PANELES DE NAVEGACIÓN
      ============================== */}
      <section className="home-panels">
        <div
          className="home-panel home-panel--agentes"
          onClick={() => navigate("/agentes")}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Explorar</span>
            <h3 className="home-panel-title">Agentes</h3>
            <p className="home-panel-description">
              Descubre habilidades, roles y estrategias
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              width="24"
              height="24"
            >
              <path
                d="M5 12h14M12 5l7 7-7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div
          className="home-panel home-panel--armas"
          onClick={() => navigate("/armas")}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Explorar</span>
            <h3 className="home-panel-title">Armas</h3>
            <p className="home-panel-description">
              Consulta estadísticas y daño por distancia
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              width="24"
              height="24"
            >
              <path
                d="M5 12h14M12 5l7 7-7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div
          className="home-panel home-panel--mapas"
          onClick={() => navigate("/mapas")}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Explorar</span>
            <h3 className="home-panel-title">Mapas</h3>
            <p className="home-panel-description">
              Revisa mapas, zonas y clasificacion por modo
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div
          className="home-panel home-panel--actos"
          onClick={() => navigate("/actos")}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Competitivo</span>
            <h3 className="home-panel-title">Actos</h3>
            <p className="home-panel-description">
              Explora actos y leaderboards disponibles
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div
          className="home-panel home-panel--global-stats"
          onClick={() => navigate("/estadisticas-globales")}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Global</span>
            <h3 className="home-panel-title">Estadísticas</h3>
            <p className="home-panel-description">
              Rankings por región, agentes, mapas, armas y economía
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div
          className="home-panel home-panel--eventos"
          onClick={() => navigate("/eventos")}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Contenido</span>
            <h3 className="home-panel-title">Eventos</h3>
            <p className="home-panel-description">
              Consulta fechas y disponibilidad
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div
          className="home-panel home-panel--modos"
          onClick={() => navigate("/modos")}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Jugar</span>
            <h3 className="home-panel-title">Modos</h3>
            <p className="home-panel-description">
              Lee reglas, duracion y descripcion
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div
          className="home-panel home-panel--cosmeticos"
          onClick={() => setCosmeticsOpen(true)}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Coleccion</span>
            <h3 className="home-panel-title">Cosmeticos</h3>
            <p className="home-panel-description">
              Abre skins, llaveros, sprays y tarjetas
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div
          className="home-panel home-panel--informacion"
          onClick={() => navigate("/informacion")}
        >
          <div className="home-panel-overlay" />
          <div className="home-panel-content">
            <span className="home-panel-eyebrow">Datos</span>
            <h3 className="home-panel-title">Informacion</h3>
            <p className="home-panel-description">
              Version, rangos, monedas y contratos
            </p>
          </div>
          <div className="home-panel-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </section>

      {cosmeticsOpen && (
        <div
          className="home-modal-backdrop"
          role="presentation"
          onMouseDown={() => setCosmeticsOpen(false)}
        >
          <div
            className="home-cosmetics-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cosmetics-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="home-modal-close"
              type="button"
              aria-label="Cerrar cosmeticos"
              onClick={() => setCosmeticsOpen(false)}
            >
              x
            </button>
            <span className="home-panel-eyebrow">Coleccion</span>
            <h2 id="cosmetics-modal-title">Cosmeticos</h2>
            <div className="home-cosmetics-grid">
              {cosmeticCategories.map((category) => (
                <button
                  key={category.path}
                  className="home-cosmetic-option"
                  type="button"
                  onClick={() => {
                    setCosmeticsOpen(false);
                    navigate(category.path);
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
