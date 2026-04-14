import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchPlayers } from "../api/stats.ts";
import "./Home.css";

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
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSequenceRef = useRef(0);
  const navigate = useNavigate();

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
      </section>
    </main>
  );
}
