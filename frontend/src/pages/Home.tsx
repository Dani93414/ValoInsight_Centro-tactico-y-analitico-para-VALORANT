import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchPlayers } from "../api/stats.ts";
import "./Home.css";

export default function Home() {
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [results, setResults] = useState<Array<{ id: string; gameName: string; tagLine: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (nextGameName: string, nextTagLine: string) => {
    setGameName(nextGameName);
    setTagLine(nextTagLine);

    if (!nextGameName.trim() && !nextTagLine.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await searchPlayers(nextGameName, nextTagLine);
      setResults(res || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="home-container">
      <header className="home-header">
        <h1>Valorant API Dashboard</h1>
        <p className="home-sub">Buscar jugador por gameName y tagLine</p>
      </header>

      <div className="home-actions">
        <div className="home-search">
          <div className="home-search-row">
            <input
              placeholder="gameName (ej: TenZ)"
              value={gameName}
              onChange={(e) => handleSearch(e.target.value, tagLine)}
            />
            <input
              placeholder="tagLine (ej: NA1)"
              value={tagLine}
              onChange={(e) => handleSearch(gameName, e.target.value)}
            />
          </div>

          {loading && <div className="small-loader" />}

          {results.length > 0 && (
            <ul className="search-results">
              {results.map((r) => (
                <li key={r.id} onClick={() => navigate(`/estadisticas/${r.id}`)}>
                  <span>{r.displayName}</span>
                </li>
              ))}
            </ul>
          )}

          {!loading && (gameName.trim() || tagLine.trim()) && results.length === 0 && (
            <div className="search-empty">No se encontraron jugadores con esos filtros.</div>
          )}
        </div>

        <div className="home-cards">
          <div className="home-card" onClick={() => navigate('/agentes')}>
            <h3>Agentes</h3>
            <p>Explora agentes y sus habilidades</p>
          </div>

          <div className="home-card" onClick={() => navigate('/armas')}>
            <h3>Armas</h3>
            <p>Consulta estadísticas y daño por distancia</p>
          </div>
        </div>
      </div>
    </main>
  );
}
