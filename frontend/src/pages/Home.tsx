import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Crosshair,
  Gem,
  Info,
  Layers3,
  LogIn,
  Map,
  Medal,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserRoundSearch,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { searchPlayers } from "../api/stats.ts";
import "./Home.css";

type SearchResult = {
  id: string;
  gameName: string;
  tagLine: string;
  displayName: string;
};

type NavItem = {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  className?: string;
};

const topbarLinks = [
  { label: "Estadisticas", path: "/estadisticas-globales" },
  { label: "Agentes", path: "/agentes" },
  { label: "Armas", path: "/armas" },
  { label: "Mapas", path: "/mapas" },
];

const analysisCards: NavItem[] = [
  {
    title: "Agentes",
    description: "Roles, habilidades y lectura tactica para cada composicion.",
    path: "/agentes",
    icon: Shield,
    className: "home-analysis-card--agents",
  },
  {
    title: "Armas",
    description: "Dano, cadencia, economia y rendimiento por rango.",
    path: "/armas",
    icon: Crosshair,
    className: "home-analysis-card--weapons",
  },
  {
    title: "Mapas",
    description: "Zonas, sites y contexto competitivo por escenario.",
    path: "/mapas",
    icon: Map,
    className: "home-analysis-card--maps",
  },
];

const exploreCards: NavItem[] = [
  {
    title: "Actos",
    description: "Temporadas, episodios y contexto competitivo.",
    path: "/actos",
    icon: Trophy,
  },
  {
    title: "Eventos",
    description: "Contenido temporal y disponibilidad.",
    path: "/eventos",
    icon: CalendarDays,
  },
  {
    title: "Modos",
    description: "Reglas, duracion y variantes jugables.",
    path: "/modos",
    icon: Swords,
  },
  {
    title: "Informacion",
    description: "Rangos, monedas, contratos y datos base.",
    path: "/informacion",
    icon: Info,
  },
];

const cosmeticCards: NavItem[] = [
  {
    title: "Skins",
    description: "Colecciones y acabados",
    path: "/cosmeticos/skins",
    icon: Sparkles,
  },
  {
    title: "Llaveros",
    description: "Buddies para armas",
    path: "/cosmeticos/llaveros",
    icon: Gem,
  },
  {
    title: "Flex",
    description: "Objetos flexibles",
    path: "/cosmeticos/flex",
    icon: Zap,
  },
  {
    title: "Bordes de nivel",
    description: "Progreso visual",
    path: "/cosmeticos/bordes",
    icon: Medal,
  },
  {
    title: "Titulos y tarjetas",
    description: "Identidad de perfil",
    path: "/cosmeticos/titulos-tarjetas",
    icon: Layers3,
  },
  {
    title: "Sprays",
    description: "Graffiti y expresion",
    path: "/cosmeticos/sprays",
    icon: Crosshair,
  },
];

export default function Home() {
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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

  const hasSearch = Boolean(gameName.trim() || tagLine.trim());

  return (
    <main className="home-page">
      <header className="home-topbar" aria-label="Navegacion principal">
        <button
          className="home-brand"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Ir al inicio de ValoInsight"
        >
          <span className="home-brand__mark">VI</span>
          <span>ValoInsight</span>
        </button>

        <nav className="home-topbar__nav" aria-label="Accesos rapidos">
          {topbarLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <button className="home-login-button" type="button">
          <LogIn size={17} aria-hidden="true" />
          Iniciar sesion
        </button>
      </header>

      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero__visual" aria-hidden="true">
          <span className="home-tactical-line home-tactical-line--one" />
          <span className="home-tactical-line home-tactical-line--two" />
          <span className="home-tactical-line home-tactical-line--three" />
          <span className="home-tactical-node home-tactical-node--one" />
          <span className="home-tactical-node home-tactical-node--two" />
          <span className="home-tactical-node home-tactical-node--three" />
        </div>

        <div className="home-hero__content">
          <span className="home-kicker">ValoInsight</span>
          <h1 id="home-hero-title">Tu centro tactico de Valorant</h1>
          <p>
            Busca jugadores, compara rendimiento y explora datos competitivos
            con una lectura clara.
          </p>
        </div>

        <section className="home-search-panel" aria-label="Buscar jugador">
          <div className="home-search-panel__header">
            <div>
              <span className="home-panel-label">Busqueda competitiva</span>
              <h2>Buscar jugador</h2>
            </div>
            <UserRoundSearch size={24} aria-hidden="true" />
          </div>

          <div className="home-search-grid">
            <label className="home-field">
              <span>gameName</span>
              <div className="home-field__control">
                <Search size={17} aria-hidden="true" />
                <input
                  placeholder="TenZ"
                  value={gameName}
                  onChange={(event) => handleSearch(event.target.value, tagLine)}
                />
              </div>
            </label>

            <label className="home-field">
              <span>tagLine</span>
              <div className="home-field__control">
                <span className="home-field__hash">#</span>
                <input
                  placeholder="NA1"
                  value={tagLine}
                  onChange={(event) => handleSearch(gameName, event.target.value)}
                />
              </div>
            </label>
          </div>

          <div className="home-search-status" aria-live="polite">
            {loading && (
              <div className="home-search-loading">
                <span className="home-search-spinner" />
                Buscando jugador...
              </div>
            )}

            {!loading && hasSearch && results.length === 0 && (
              <div className="home-search-empty">
                No se encontraron jugadores con esos filtros.
              </div>
            )}
          </div>

          {results.length > 0 && (
            <ul className="home-search-results">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/estadisticas/${result.id}`)}
                  >
                    <span>
                      <strong>{result.displayName}</strong>
                      <small>
                        {result.gameName}
                        {result.tagLine ? `#${result.tagLine}` : ""}
                      </small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <section className="home-section" aria-labelledby="analysis-title">
        <div className="home-section__header">
          <span className="home-kicker">Centro de analisis</span>
          <h2 id="analysis-title">El nucleo competitivo de ValoInsight</h2>
        </div>

        <div className="home-analysis-grid">
          <button
            className="home-global-card"
            type="button"
            onClick={() => navigate("/estadisticas-globales")}
          >
            <div className="home-global-card__content">
              <span className="home-panel-label">Data center</span>
              <h3>Estadisticas globales</h3>
              <p>
                Rankings, regiones, agentes, mapas, armas y economia reunidos
                en una vista pensada para detectar tendencias.
              </p>
              <span className="home-card-link">
                Abrir panel global <ArrowRight size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="home-global-card__dashboard" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </button>

          {analysisCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.path}
                className={`home-analysis-card ${card.className ?? ""}`}
                type="button"
                onClick={() => navigate(card.path)}
              >
                <div className="home-card-overlay" />
                <div className="home-analysis-card__content">
                  <Icon size={26} aria-hidden="true" />
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
                <ArrowRight className="home-card-arrow" size={22} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="home-section" aria-labelledby="explore-title">
        <div className="home-section__header home-section__header--inline">
          <div>
            <span className="home-kicker">Explorar Valorant</span>
            <h2 id="explore-title">Contenido, modos y contexto del juego</h2>
          </div>
        </div>

        <div className="home-explore-grid">
          {exploreCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.path}
                className="home-explore-card"
                type="button"
                onClick={() => navigate(card.path)}
              >
                <span className="home-explore-card__icon">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="home-explore-card__text">
                  <strong>{card.title}</strong>
                  <small>{card.description}</small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="home-section" aria-labelledby="cosmetics-title">
        <div className="home-section__header">
          <span className="home-kicker">Coleccion cosmetica</span>
          <h2 id="cosmetics-title">Inventario visual de Valorant</h2>
        </div>

        <div className="home-cosmetics-showcase">
          <article className="home-cosmetics-feature">
            <span className="home-panel-label">Coleccion premium</span>
            <h3>Cosmeticos</h3>
            <p>
              Explora skins, llaveros, sprays, flex y elementos de perfil desde
              un bloque visual dedicado.
            </p>
          </article>

          <div className="home-cosmetics-grid">
            {cosmeticCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.path}
                  className="home-cosmetic-card"
                  type="button"
                  onClick={() => navigate(card.path)}
                >
                  <Icon size={22} aria-hidden="true" />
                  <span>
                    <strong>{card.title}</strong>
                    <small>{card.description}</small>
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
