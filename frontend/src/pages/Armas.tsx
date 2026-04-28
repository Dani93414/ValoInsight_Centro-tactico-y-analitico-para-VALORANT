import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useArmas, useGear, useRegions } from "../api/hooks";
import BackButton from "../components/BackButton";
import FloatingActionButton from "../components/FloatingActionButton";
import type { GearContent } from "../types/content";
import type { Arma } from "../types/weapons";
import "./Armas.css";

/* =============================
   HELPERS
============================== */

const normalizarCategoria = (category?: string) => {
  const categoryLimpia = category?.trim() ?? "";
  if (!categoryLimpia || /^[-\u2013\u2014]+$/u.test(categoryLimpia)) {
    return "CUERPO A CUERPO";
  }

  const catLower = categoryLimpia.toLowerCase();

  if (catLower.includes("melee") || catLower.includes("cuchillo")) {
    return "CUERPO A CUERPO";
  }
  if (catLower.includes("sidearm")) return "Pistolas";
  if (catLower.includes("smg")) return "Subfusiles";
  if (catLower.includes("shotgun")) return "Escopetas";
  if (catLower.includes("rifle")) return "Rifles";
  if (catLower.includes("sniper")) return "Francotiradores";
  if (catLower.includes("heavy")) return "Ametralladoras";

  if (categoryLimpia.includes("::")) {
    const valor = categoryLimpia.split("::").pop()?.trim() ?? "";
    if (!valor || /^[-\u2013\u2014]+$/u.test(valor)) {
      return "CUERPO A CUERPO";
    }
    if (valor.toLowerCase().includes("melee")) {
      return "CUERPO A CUERPO";
    }
    return valor;
  }

  return categoryLimpia;
};

const traduccionesStats: Record<string, string> = {
  fireRate: "Cadencia de disparo",
  magazineSize: "Capacidad del cargador",
  runSpeedMultiplier: "Velocidad de movimiento",
  equipTimeSeconds: "Tiempo de equipamiento",
  reloadTimeSeconds: "Tiempo de recarga",
  firstBulletAccuracy: "Precisión del primer disparo",
  shotgunPelletCount: "Perdigones por disparo",
  wallPenetration: "Penetración de pared",
  feature: "Característica especial",
  fireMode: "Modo de disparo",
  altFireType: "Modo alternativo",
  zoomMultiplier: "Multiplicador de zoom",
  burstCount: "Disparos por ráfaga",
};

const formatearValor = (valor: unknown): string | number => {
  if (typeof valor === "string" && valor.includes("::")) {
    return valor.split("::")[1];
  }
  if (typeof valor === "number") {
    return valor;
  }
  if (typeof valor === "string") {
    return valor;
  }
  return "-";
};

const formatearCoste = (valor: unknown) => {
  if (valor === undefined || valor === null || valor === "" || valor === "—") {
    return "Gratis";
  }
  return `${valor} créditos`;
};

/* =============================
   COMPONENTE
============================== */

export default function Armas() {
  const { data: rawArmas, isLoading: weaponsLoading } = useArmas();
  const { data: rawGear, isLoading: gearLoading } = useGear();
  const { data: regions } = useRegions();
  const location = useLocation();
  const navigate = useNavigate();

  const routeState =
    (location.state as {
      weaponName?: string;
      returnTo?: string;
      returnLabel?: string;
    } | null) ?? null;

  const returnTo = routeState?.returnTo ?? null;
  const returnLabel = routeState?.returnLabel ?? "Volver";

  const armas = useMemo(() => {
    if (!rawArmas) return [];
    return [...(rawArmas as Arma[])].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [rawArmas]);

  const escudos = useMemo<Arma[]>(() => {
    if (!rawGear) return [];
    return [...(rawGear as GearContent[])]
      .filter((item) => item.displayName)
      .map((item) => ({
        uuid: item.uuid,
        displayName: item.displayName,
        displayIcon: item.displayIcon || item.shopImage || null,
        category: "Escudos",
        cost: item.cost,
        description: item.description,
        isShield: true,
        stats: null,
        adsStats: null,
        damageRanges: null,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [rawGear]);

  const arsenal = useMemo(() => [...armas, ...escudos], [armas, escudos]);

  const [armaSeleccionada, setArmaSeleccionada] = useState<Arma | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("Todas");
  const [costeActivo, setCosteActivo] = useState("Todos");
  const consumedRouteWeaponNameRef = useRef<string | null>(null);

  const detalleRef = useRef<HTMLDivElement | null>(null);

  /* =============================
     AUTO-SELECT FROM ROUTE STATE
  ============================== */
  useEffect(() => {
    const routeWeaponName = routeState?.weaponName?.trim() || null;
    if (
      !routeWeaponName ||
      consumedRouteWeaponNameRef.current === routeWeaponName ||
      arsenal.length === 0 ||
      armaSeleccionada
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const match = arsenal.find(
        (weapon) =>
          weapon.displayName.toLowerCase() === routeWeaponName.toLowerCase(),
      );
      if (match) {
        setArmaSeleccionada(match);
      }
      consumedRouteWeaponNameRef.current = routeWeaponName;
    });

    return () => cancelAnimationFrame(frame);
  }, [arsenal, routeState?.weaponName, armaSeleccionada]);

  /* =============================
     FILTRADO POR BÚSQUEDA
  ============================== */
  const armasFiltradas = arsenal.filter((arma) =>
    {
      const matchesSearch = arma.displayName
        .toLowerCase()
        .includes(busqueda.toLowerCase());
      const normalizedCategory = normalizarCategoria(arma.category);
      const matchesCategory =
        categoriaActiva === "Todas" || normalizedCategory === categoriaActiva;
      const numericCost = Number(arma.cost);
      const matchesCost =
        costeActivo === "Todos" ||
        (costeActivo === "Gratis" && (!numericCost || Number.isNaN(numericCost))) ||
        (costeActivo === "Económicas" && numericCost > 0 && numericCost <= 1600) ||
        (costeActivo === "Premium" && numericCost > 1600);

      return matchesSearch && matchesCategory && matchesCost;
    },
  );

  const categorias = useMemo(
    () =>
      ["Todas", ...Array.from(new Set(arsenal.map((arma) => normalizarCategoria(arma.category))))],
    [arsenal],
  );

  const regionWeaponStats = regions?.[0]?.weaponStats ?? {};
  const weaponStatsByName = useMemo(() => {
    const map = new Map<string, (typeof regionWeaponStats)[string]>();
    Object.values(regionWeaponStats).forEach((stats) => {
      if (stats.weapon_name) {
        map.set(stats.weapon_name.toLowerCase(), stats);
      }
    });
    return map;
  }, [regionWeaponStats]);

  const getWeaponGlobalStats = (weapon: Arma) =>
    regionWeaponStats[weapon.uuid ?? ""] ??
    weaponStatsByName.get(weapon.displayName.toLowerCase());

  const topGlobalWeapons = useMemo(
    () =>
      Object.entries(regionWeaponStats)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => (b.kills ?? 0) - (a.kills ?? 0))
        .slice(0, 5),
    [regionWeaponStats],
  );

  /* =============================
     AGRUPAR POR CATEGORÍA
  ============================== */
  const armasPorCategoria = armasFiltradas.reduce(
    (acc: Record<string, Arma[]>, arma) => {
      const categoria = normalizarCategoria(arma.category);

      if (!acc[categoria]) {
        acc[categoria] = [];
      }

      acc[categoria].push(arma);
      return acc;
    },
    {},
  );

  /* =============================
     SCROLL AL DETALLE
  ============================== */
  useEffect(() => {
    if (armaSeleccionada && detalleRef.current) {
      detalleRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [armaSeleccionada]);

  /* =============================
     LOADING
  ============================== */
  if (weaponsLoading || gearLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-spinner" />
          <h2>Cargando arsenal</h2>
          <p>Comprando en la tienda…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="weapons-container">
      <BackButton />
      {returnTo && (
        <FloatingActionButton
          label={returnLabel}
          onClick={() => navigate(returnTo)}
          ariaLabel={returnLabel}
        />
      )}
      {/* =============================
         HEADER
      ============================== */}
      <div className="weapons-header">
        <span className="weapons-eyebrow">Valorant</span>
        <h1 className="weapons-title">Armas</h1>
        <div className="weapons-divider" />
      </div>

      {/* =============================
         BUSCADOR
      ============================== */}
      <div className="weapons-search">
        <input
          type="text"
          placeholder="Buscar arma..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="weapons-filter-row">
        <select
          value={categoriaActiva}
          onChange={(event) => setCategoriaActiva(event.target.value)}
        >
          {categorias.map((categoria) => (
            <option key={categoria} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>
        <select
          value={costeActivo}
          onChange={(event) => setCosteActivo(event.target.value)}
        >
          <option value="Todos">Todos los costes</option>
          <option value="Gratis">Gratis</option>
          <option value="Económicas">Económicas</option>
          <option value="Premium">Premium</option>
        </select>
      </div>

      {topGlobalWeapons.length > 0 && (
        <section className="weapons-global-ranking">
          <h2>Ranking global de armas</h2>
          <div className="weapons-global-list">
            {topGlobalWeapons.map((weapon) => (
              <article key={weapon.id} className="weapons-global-item">
                <span>{weapon.weapon_name ?? "Arma"}</span>
                <strong>{weapon.kills ?? 0} kills</strong>
                <small>{weapon.headshot_pct?.toFixed(1) ?? "-"}% HS</small>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* =============================
         DETALLE DEL ARMA
      ============================== */}
      {armaSeleccionada && (
        <div ref={detalleRef} className="weapon-detail">
          <button
            className="weapon-detail-close"
            onClick={() => setArmaSeleccionada(null)}
            aria-label="Cerrar detalle"
          >
            ✕
          </button>

          <div className="weapon-detail-content">
            {/* =============================
               COLUMNA IZQUIERDA
            ============================== */}
            <div className="weapon-detail-left">
              <h2 className="weapon-name">{armaSeleccionada.displayName}</h2>

              <div className="weapon-badges">
                <span className="weapon-category">
                  {normalizarCategoria(armaSeleccionada.category)}
                </span>
                <span className="weapon-cost">
                  {formatearCoste(armaSeleccionada.cost)}
                </span>
              </div>

              {getWeaponGlobalStats(armaSeleccionada) && (
                <div className="weapon-global-stats">
                  <div>
                    <span>Kills globales</span>
                    <strong>
                      {getWeaponGlobalStats(armaSeleccionada)?.kills ?? "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Rondas equipada</span>
                    <strong>
                      {getWeaponGlobalStats(armaSeleccionada)?.rounds_equipped ??
                        "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Headshot global</span>
                    <strong>
                      {getWeaponGlobalStats(armaSeleccionada)?.headshot_pct
                        ? `${getWeaponGlobalStats(armaSeleccionada)?.headshot_pct?.toFixed(1)}%`
                        : "-"}
                    </strong>
                  </div>
                </div>
              )}

              {armaSeleccionada.description && (
                <p className="weapon-description">
                  {armaSeleccionada.description}
                </p>
              )}

              {/* =============================
                 ESTADÍSTICAS
              ============================== */}
              {armaSeleccionada.stats &&
                Object.keys(armaSeleccionada.stats).length > 0 && (
                  <>
                    <h3 className="weapon-section-title">Estadísticas</h3>
                    <div className="weapon-stats">
                      {Object.entries(armaSeleccionada.stats || {}).map(
                        ([key, value]) =>
                          value !== undefined &&
                          value !== null && (
                            <div key={key} className="weapon-stat">
                              <span>{traduccionesStats[key] || key}</span>
                              <strong>{formatearValor(value)}</strong>
                            </div>
                          ),
                      )}
                    </div>
                  </>
                )}

              {/* =============================
                 MIRA (ADS)
              ============================== */}
              {armaSeleccionada.adsStats &&
                Object.keys(armaSeleccionada.adsStats).length > 0 && (
                  <>
                    <h3 className="weapon-section-title">Apuntar con mira</h3>
                    <div className="weapon-stats">
                      {Object.entries(armaSeleccionada.adsStats || {}).map(
                        ([key, value]) =>
                          value !== undefined &&
                          value !== null && (
                            <div key={key} className="weapon-stat">
                              <span>{traduccionesStats[key] || key}</span>
                              <strong>{formatearValor(value)}</strong>
                            </div>
                          ),
                      )}
                    </div>
                  </>
                )}

              {/* =============================
                 DAÑO
              ============================== */}
              {armaSeleccionada.damageRanges &&
                armaSeleccionada.damageRanges.length > 0 && (
                  <>
                    <h3 className="weapon-section-title">Daño por distancia</h3>
                    <div className="damage-table">
                      <div className="damage-header">
                        <span>Distancia</span>
                        <span>Cabeza</span>
                        <span>Cuerpo</span>
                        <span>Piernas</span>
                      </div>

                      {(armaSeleccionada.damageRanges || []).map((dmg, idx) => (
                        <div key={idx} className="damage-row">
                          <span>
                            {dmg.rangeStartMeters}–{dmg.rangeEndMeters}m
                          </span>
                          <span>{dmg.headDamage}</span>
                          <span>{dmg.bodyDamage}</span>
                          <span>{dmg.legDamage}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
            </div>

            {/* =============================
               COLUMNA DERECHA
            ============================== */}
            <div className="weapon-detail-right">
              {armaSeleccionada.displayIcon && (
                <img
                  src={armaSeleccionada.displayIcon}
                  alt={armaSeleccionada.displayName}
                  className="weapon-image-large"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* =============================
         ARMAS POR CATEGORÍA
      ============================== */}
      {Object.entries(armasPorCategoria).map(([categoria, armasCategoria]) => (
        <section key={categoria} className="weapons-category">
          <h2 className="weapons-category-title">{categoria}</h2>

          <div className="weapons-grid">
            {armasCategoria.map((arma, idx) => {
              const activa = armaSeleccionada?.displayName === arma.displayName;

              return (
                <div
                  key={idx}
                  className={`weapon-card ${activa ? "active" : ""}`}
                  onClick={() => setArmaSeleccionada(activa ? null : arma)}
                >
                  {arma.displayIcon && (
                    <img
                      src={arma.displayIcon}
                      alt={arma.displayName}
                      className="weapon-image"
                      loading="lazy"
                    />
                  )}

                  <h2 className="weapon-card-name">{arma.displayName}</h2>
                  {getWeaponGlobalStats(arma)?.kills ? (
                    <p className="weapon-card-meta">
                      {getWeaponGlobalStats(arma)?.kills} kills ·{" "}
                      {getWeaponGlobalStats(arma)?.headshot_pct?.toFixed(1)}% HS
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
