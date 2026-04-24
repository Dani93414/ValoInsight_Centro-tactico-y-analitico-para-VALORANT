import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useArmas } from "../api/hooks";
import BackButton from "../components/BackButton";
import FloatingActionButton from "../components/FloatingActionButton";
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

/* =============================
   COMPONENTE
============================== */

export default function Armas() {
  const { data: rawArmas, isLoading: loading } = useArmas();
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

  const [armaSeleccionada, setArmaSeleccionada] = useState<Arma | null>(null);
  const [busqueda, setBusqueda] = useState("");
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
      armas.length === 0 ||
      armaSeleccionada
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const match = armas.find(
        (weapon) =>
          weapon.displayName.toLowerCase() === routeWeaponName.toLowerCase(),
      );
      if (match) {
        setArmaSeleccionada(match);
      }
      consumedRouteWeaponNameRef.current = routeWeaponName;
    });

    return () => cancelAnimationFrame(frame);
  }, [armas, routeState?.weaponName, armaSeleccionada]);

  /* =============================
     FILTRADO POR BÚSQUEDA
  ============================== */
  const armasFiltradas = armas.filter((arma) =>
    arma.displayName.toLowerCase().includes(busqueda.toLowerCase()),
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
  if (loading) {
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
                  {armaSeleccionada.cost
                    ? `${armaSeleccionada.cost} créditos`
                    : "Gratis"}
                </span>
              </div>

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
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
