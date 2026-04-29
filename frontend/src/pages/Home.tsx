import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { useRegions } from "../api/hooks";
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

type GlobalInsightCard = {
  label: string;
  value: string;
  detail: string;
  accent: "red" | "teal" | "gold" | "white";
};

type RevealStyle = CSSProperties & {
  "--reveal-index"?: number;
};

const numberFormatters = new globalThis.Map<number, Intl.NumberFormat>();
const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const topbarLinks = [
  { label: "Estadísticas", path: "/estadisticas-globales" },
  { label: "Agentes", path: "/agentes" },
  { label: "Armas", path: "/armas" },
  { label: "Mapas", path: "/mapas" },
];

const analysisCards: NavItem[] = [
  {
    title: "Agentes",
    description: "Roles, habilidades y lectura táctica para cada composición.",
    path: "/agentes",
    icon: Shield,
    className: "home-analysis-card--agents",
  },
  {
    title: "Armas",
    description: "Daño, cadencia, economía y rendimiento por rango.",
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
    description: "Episodios competitivos, rangos y leaderboards.",
    path: "/actos",
    icon: Trophy,
  },
  {
    title: "Eventos",
    description: "Contenido temporal, fechas y recompensas disponibles.",
    path: "/eventos",
    icon: CalendarDays,
  },
  {
    title: "Modos",
    description: "Reglas, duración y variantes de juego.",
    path: "/modos",
    icon: Swords,
  },
  {
    title: "Información",
    description: "Versión actual, monedas, rangos, contratos y tiers.",
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
    title: "Títulos y tarjetas",
    description: "Identidad de perfil",
    path: "/cosmeticos/titulos-tarjetas",
    icon: Layers3,
  },
  {
    title: "Sprays",
    description: "Graffiti y expresión",
    path: "/cosmeticos/sprays",
    icon: Crosshair,
  },
];

function revealStyle(index: number): RevealStyle {
  return { "--reveal-index": index };
}

function formatNumber(value?: number, decimals = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  let formatter = numberFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormatters.set(decimals, formatter);
  }
  return formatter.format(value);
}

function formatPercent(value?: number, decimals = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${formatNumber(value, decimals)}%`;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
}

export default function Home() {
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const regionsQuery = useRegions();
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

  const handleSubmitSearch = () => {
    const firstResult = results[0];
    if (firstResult) {
      navigate(`/estadisticas/${firstResult.id}`);
      return;
    }

    if (gameName.trim() || tagLine.trim()) {
      handleSearch(gameName, tagLine);
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".home-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("home-is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const hasSearch = Boolean(gameName.trim() || tagLine.trim());
  const regions = regionsQuery.data;
  const primaryRegion = regions?.[0];
  const topAgent = primaryRegion?.mostPlayedAgents?.[0];
  const topMap = primaryRegion?.mostPlayedMaps?.[0];
  const topWeapon = primaryRegion?.mostLethalWeapons?.[0];
  const averages = primaryRegion?.averages;
  const isGlobalLoading = regionsQuery.isLoading;
  const updatedAt = formatDate(primaryRegion?.updatedAt);

  const globalInsightCards = useMemo<GlobalInsightCard[]>(
    () => [
    {
      label: "Agente más jugado",
      value: isGlobalLoading ? "Cargando..." : topAgent?.agent_name ?? "-",
      detail: isGlobalLoading
        ? "Sincronizando datos globales"
        : `${formatNumber(topAgent?.picks)} picks · ${formatPercent(topAgent?.win_rate)} win rate`,
      accent: "red",
    },
    {
      label: "Mapa más jugado",
      value: isGlobalLoading ? "Cargando..." : topMap?.map_name ?? "-",
      detail: isGlobalLoading
        ? "Sincronizando datos globales"
        : `${formatNumber(topMap?.matches)} partidas`,
      accent: "teal",
    },
    {
      label: "Arma más letal",
      value: isGlobalLoading ? "Cargando..." : topWeapon?.weapon_name ?? "-",
      detail: isGlobalLoading
        ? "Sincronizando datos globales"
        : `${formatNumber(topWeapon?.kills)} kills · ${formatPercent(topWeapon?.headshot_pct)} HS`,
      accent: "gold",
    },
    {
      label: "Media global",
      value: isGlobalLoading ? "Cargando..." : `${formatNumber(averages?.acs, 1)} ACS`,
      detail: isGlobalLoading
        ? "Sincronizando datos globales"
        : `${formatNumber(averages?.adr, 1)} ADR · ${formatPercent(averages?.headshot_pct)} HS`,
      accent: "white",
    },
    ],
    [
      averages?.acs,
      averages?.adr,
      averages?.headshot_pct,
      isGlobalLoading,
      topAgent?.agent_name,
      topAgent?.picks,
      topAgent?.win_rate,
      topMap?.map_name,
      topMap?.matches,
      topWeapon?.headshot_pct,
      topWeapon?.kills,
      topWeapon?.weapon_name,
    ],
  );

  return (
    <main className="home-page">
      <header className="home-topbar" aria-label="Navegación principal">
        <button
          className="home-brand home-topbar__nav-button home-topbar__nav-button--active"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Ir al inicio de ValoInsight"
        >
          <span className="home-brand__mark">
            <span>VALO</span>
            <span>INSIGHT</span>
          </span>
          <span>ValoInsight</span>
        </button>

        <nav className="home-topbar__nav" aria-label="Accesos rápidos">
          {topbarLinks.map((link) => (
            <button
              key={link.path}
              className="home-topbar__nav-button"
              type="button"
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <button className="home-login-button" type="button">
          <LogIn size={17} aria-hidden="true" />
          Iniciar sesión
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
          <h1 id="home-hero-title">Tu centro táctico de Valorant</h1>
          <p>
            Busca jugadores, compara rendimiento y explora datos competitivos
            con una lectura clara.
          </p>
        </div>

        <section className="home-search-panel" aria-label="Buscar jugador">
          <div className="home-search-panel__header">
            <div>
              <span className="home-panel-label">Búsqueda competitiva</span>
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

            <button
              className="home-search-button"
              type="button"
              onClick={handleSubmitSearch}
            >
              <Search size={18} aria-hidden="true" />
              Buscar
            </button>
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
              {results.map((result, index) => (
                <li key={result.id} style={revealStyle(index)}>
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

      <section
        className="home-section home-reveal"
        aria-labelledby="analysis-title"
      >
        <div className="home-section__header">
          <span className="home-kicker">Centro de análisis</span>
          <h2 id="analysis-title">El núcleo competitivo de ValoInsight</h2>
        </div>

        <div className="home-analysis-grid">
          <button
            className="home-global-card home-reveal"
            type="button"
            style={revealStyle(0)}
            onClick={() => navigate("/estadisticas-globales")}
          >
            <div className="home-global-card__content">
              <div className="home-global-card__meta">
                <span className="home-panel-label">Data center</span>
                <span>
                  Región {primaryRegion?.region ?? "-"}
                  {updatedAt ? ` · Actualizado ${updatedAt}` : ""}
                </span>
              </div>
              <h3>Estadísticas globales</h3>
              <p>
                Rankings, regiones, agentes, mapas, armas y economía reunidos
                en una vista pensada para detectar tendencias.
              </p>
              <span className="home-card-link">
                Abrir panel global <ArrowRight size={18} aria-hidden="true" />
              </span>
            </div>

            <div className="home-global-card__insights" aria-label="Resumen global">
              {globalInsightCards.map((card, index) => (
                <div
                  key={card.label}
                  className={`home-global-insight home-global-insight--${card.accent}`}
                  style={revealStyle(index)}
                >
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </div>
              ))}
            </div>
          </button>

          {analysisCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <button
                key={card.path}
                className={`home-analysis-card home-reveal ${card.className ?? ""}`}
                type="button"
                style={revealStyle(index + 1)}
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

      <section
        className="home-section home-reveal"
        aria-labelledby="explore-title"
      >
        <div className="home-section__header home-section__header--inline">
          <div>
            <span className="home-kicker">Explorar Valorant</span>
            <h2 id="explore-title">Contenido, modos y contexto del juego</h2>
          </div>
        </div>

        <div className="home-explore-grid">
          {exploreCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <button
                key={card.path}
                className="home-explore-card home-reveal"
                type="button"
                style={revealStyle(index)}
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

      <section
        className="home-section home-reveal"
        aria-labelledby="cosmetics-title"
      >
        <div className="home-section__header">
          <span className="home-kicker">Colección cosmética</span>
          <h2 id="cosmetics-title">Inventario visual de Valorant</h2>
        </div>

        <div className="home-cosmetics-showcase">
          <article className="home-cosmetics-feature home-reveal" style={revealStyle(0)}>
            <span className="home-panel-label">Colección premium</span>
            <h3>Cosméticos</h3>
            <p>
              Explora skins, llaveros, sprays, flex y elementos de perfil desde
              un bloque visual dedicado.
            </p>
          </article>

          <div className="home-cosmetics-grid">
            {cosmeticCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.path}
                  className="home-cosmetic-card home-reveal"
                  type="button"
                  style={revealStyle(index + 1)}
                  onClick={() => navigate(card.path)}
                >
                  <span className="home-cosmetic-card__icon">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span className="home-cosmetic-card__text">
                    <strong>{card.title}</strong>
                    <small>{card.description}</small>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
