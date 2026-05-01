import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Crosshair,
  Gem,
  Info,
  Layers3,
  Lock,
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
  accountLevel?: number | null;
  lastMatchStartMillis?: number | null;
  lastMatchDurationMillis?: number | null;
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

type SearchSectionId = "search" | "favorites" | "recent" | "frequent" | "premier";

type SearchSection = {
  id: SearchSectionId;
  label: string;
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
    description: "Aspectos de armas",
    path: "/cosmeticos/skins",
    icon: Sparkles,
  },
  {
    title: "Llaveros",
    description: "Detalles para tus armas",
    path: "/cosmeticos/llaveros",
    icon: Gem,
  },
  {
    title: "Flex",
    description: "Equipables animados",
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
    description: "Expresión durante el juego",
    path: "/cosmeticos/sprays",
    icon: Crosshair,
  },
];

const searchSections: SearchSection[] = [
  { id: "search", label: "Búsqueda" },
  { id: "favorites", label: "Favoritos" },
  { id: "recent", label: "Recientes" },
  { id: "frequent", label: "Jugadores más frecuentes" },
  { id: "premier", label: "Equipo de premier" },
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

function formatLastSeen(
  startMillis?: number | null,
  durationMillis?: number | null,
) {
  if (typeof startMillis !== "number" || !Number.isFinite(startMillis)) {
    return "Sin partidas registradas";
  }

  const safeDuration =
    typeof durationMillis === "number" && Number.isFinite(durationMillis)
      ? durationMillis
      : 0;
  const elapsedMillis = Math.max(0, Date.now() - (startMillis + safeDuration));
  const elapsedHours = Math.floor(elapsedMillis / (60 * 60 * 1000));

  if (elapsedHours < 1) return "Hace menos de 1 hora";
  if (elapsedHours < 24) {
    return elapsedHours === 1 ? "Hace 1 hora" : `Hace ${elapsedHours} horas`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays === 1 ? "Hace 1 día" : `Hace ${elapsedDays} días`;
}

export default function Home() {
  const isLoggedIn = false;
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [activeSearchSection, setActiveSearchSection] =
    useState<SearchSectionId>("search");
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

    const trimmedGameName = nextGameName.trim();
    const trimmedTagLine = nextTagLine.trim();

    if (!trimmedGameName && !trimmedTagLine) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (trimmedGameName.length < 3 && trimmedTagLine.length < 3) {
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

    if (gameName.trim().length >= 3 || tagLine.trim().length >= 3) {
      handleSearch(gameName, tagLine);
    }
  };

  const handleSelectSearchSection = (section: SearchSection) => {
    const isLocked = !isLoggedIn && section.id !== "search";
    if (isLocked) return;
    setActiveSearchSection(section.id);
  };

  const handleGlobalCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigate("/estadisticas-globales");
    }
  };

  const handleScrollHintClick = () => {
    window.scrollBy({
      top: window.innerHeight * 0.85,
      behavior: "smooth",
    });
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

  useEffect(() => {
    const updateScrollHintVisibility = () => {
      const isNearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 80;

      setShowScrollHint(!isNearBottom);
    };

    updateScrollHintVisibility();
    window.addEventListener("scroll", updateScrollHintVisibility, {
      passive: true,
    });
    window.addEventListener("resize", updateScrollHintVisibility);

    return () => {
      window.removeEventListener("scroll", updateScrollHintVisibility);
      window.removeEventListener("resize", updateScrollHintVisibility);
    };
  }, []);

  const trimmedGameName = gameName.trim();
  const trimmedTagLine = tagLine.trim();
  const hasSearch = Boolean(trimmedGameName || trimmedTagLine);
  const canSearch = trimmedGameName.length >= 3 || trimmedTagLine.length >= 3;
  const showMinCharactersMessage = hasSearch && !canSearch;
  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);
  const activeRegionCode = selectedRegion || regions[0]?.region || "";
  const activeRegion =
    regions.find((region) => region.region === activeRegionCode) ?? regions[0];
  const topAgent = activeRegion?.mostPlayedAgents?.[0];
  const topMap = activeRegion?.mostPlayedMaps?.[0];
  const topWeapon = activeRegion?.mostLethalWeapons?.[0];
  const averages = activeRegion?.averages;
  const isGlobalLoading = regionsQuery.isLoading;
  const updatedAt = formatDate(activeRegion?.updatedAt);

  useEffect(() => {
    if (!selectedRegion && regions.length > 0) {
      setSelectedRegion(regions[0].region);
    }
  }, [regions, selectedRegion]);

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
            <div className="home-search-panel__title">
              <UserRoundSearch size={24} aria-hidden="true" />
              <h2>Buscar jugador</h2>
            </div>
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

          <div className="home-search-tabs" role="tablist" aria-label="Apartados del buscador">
            {searchSections.map((section) => {
              const isLocked = !isLoggedIn && section.id !== "search";
              const isActive = activeSearchSection === section.id;
              return (
                <button
                  key={section.id}
                  className={`home-search-tab${isActive ? " home-search-tab--active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-disabled={isLocked}
                  disabled={isLocked}
                  onClick={() => handleSelectSearchSection(section)}
                >
                  <span>{section.label}</span>
                  {isLocked && <Lock size={14} aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {activeSearchSection === "search" ? (
            <>
              <div className="home-search-status" aria-live="polite">
                {loading && (
                  <div className="home-search-loading">
                    <span className="home-search-spinner" />
                    Buscando jugador...
                  </div>
                )}

                {!loading && showMinCharactersMessage && (
                  <div className="home-search-empty">Mínimo escribe 3 letras</div>
                )}

                {!loading && !showMinCharactersMessage && hasSearch && results.length === 0 && (
                  <div className="home-search-empty">
                    No se encontraron jugadores con esos filtros.
                  </div>
                )}
              </div>

              {results.length > 0 && (
                <ul className="home-search-results">
                  {results.map((result, index) => {
                    const playerNameTag = result.tagLine
                      ? `${result.gameName}#${result.tagLine}`
                      : result.gameName;
                    const displayTitle = result.displayName || playerNameTag;

                    return (
                      <li key={result.id} style={revealStyle(index)}>
                        <button
                          type="button"
                          onClick={() => navigate(`/estadisticas/${result.id}`)}
                        >
                          <span className="home-search-result__main">
                            <strong>{displayTitle}</strong>
                          </span>

                          <span className="home-search-result__last-seen">
                            Última conexión ·{" "}
                            {formatLastSeen(
                              result.lastMatchStartMillis,
                              result.lastMatchDurationMillis,
                            )}
                          </span>

                          <span className="home-search-result__level">
                            {typeof result.accountLevel === "number"
                              ? `Nivel ${result.accountLevel}`
                              : "Nivel -"}
                          </span>

                          <ArrowRight
                            className="home-search-result__arrow"
                            size={18}
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="home-search-coming-soon">Disponible próximamente</div>
          )}
        </section>
      </section>

      <section
        className="home-section home-reveal"
        aria-labelledby="analysis-title"
      >
        <div className="home-section__header">
          <span className="home-kicker">Centro de análisis</span>
          <h2 id="analysis-title">Análisis competitivo y datos del juego</h2>
        </div>

        <div className="home-analysis-grid">
          <article
            className="home-global-card home-reveal"
            role="button"
            tabIndex={0}
            style={revealStyle(0)}
            onClick={() => navigate("/estadisticas-globales")}
            onKeyDown={handleGlobalCardKeyDown}
          >
            <div className="home-global-card__content">
              <div className="home-global-card__meta">
                <span className="home-panel-label">Data center</span>
                <span>
                  Región {activeRegion?.region ?? "-"}
                  {updatedAt ? ` · Actualizado ${updatedAt}` : ""}
                </span>
              </div>
              <label
                className="home-region-select"
                onClick={(event) => event.stopPropagation()}
              >
                <span>Región activa</span>
                <select
                  value={activeRegionCode}
                  disabled={regions.length === 0}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    setSelectedRegion(event.target.value);
                  }}
                >
                  {regions.length === 0 ? (
                    <option value="">Sin regiones</option>
                  ) : (
                    regions.map((region) => (
                      <option key={region.region} value={region.region}>
                        {region.region}
                      </option>
                    ))
                  )}
                </select>
              </label>
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
          </article>

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

      {showScrollHint && (
        <button
          className="home-scroll-hint"
          type="button"
          aria-label="Ver más contenido"
          onClick={handleScrollHintClick}
        >
          <ChevronDown size={24} aria-hidden="true" />
        </button>
      )}
    </main>
  );
}
