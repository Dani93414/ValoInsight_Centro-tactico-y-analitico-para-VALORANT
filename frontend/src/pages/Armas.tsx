import { useEffect, useRef, useState } from "react";
import { getArmas } from "../api/content";
import "./Armas.css";

/* =============================
   TIPOS
============================== */

type DamageRange = {
  rangeStartMeters: number;
  rangeEndMeters: number;
  headDamage: number;
  bodyDamage: number;
  legDamage: number;
};

type WeaponStats = {
  fireRate?: number;
  magazineSize?: number;
  runSpeedMultiplier?: number;
  equipTimeSeconds?: number;
  reloadTimeSeconds?: number;
  firstBulletAccuracy?: number;
  shotgunPelletCount?: number;
  wallPenetration?: string;
  feature?: string;
  fireMode?: string;
  altFireType?: string;
};

type AdsStats = {
  zoomMultiplier?: number;
  fireRate?: number;
  runSpeedMultiplier?: number;
  firstBulletAccuracy?: number;
  burstCount?: number;
};

type Arma = {
  displayName: string;
  displayIcon?: string | null;
  category: string;
  cost?: number | null; // Opcional para el cuchillo
  stats?: WeaponStats | null; // Opcional para el cuchillo
  adsStats?: AdsStats | null; // Opcional para el cuchillo
  damageRanges?: DamageRange[] | null; // Opcional para el cuchillo
};

/* =============================
   HELPERS
============================== */

const normalizarCategoria = (category?: string) => {
  if (!category) return "Cuchillo";
  
  const catLower = category.toLowerCase();

  if (catLower.includes("melee")) return "Cuchillo";
  if (catLower.includes("sidearm")) return "Pistolas";
  if (catLower.includes("smg")) return "Subfusiles";
  if (catLower.includes("shotgun")) return "Escopetas";
  if (catLower.includes("rifle")) return "Rifles";
  if (catLower.includes("sniper")) return "Francotiradores";
  if (catLower.includes("heavy")) return "Ametralladoras";

  if (category.includes("::")) return category.split("::")[1];

  return category;
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
  burstCount: "Disparos por ráfaga"
};

const formatearValor = (valor: any) => {
  if (typeof valor === "string" && valor.includes("::")) {
    return valor.split("::")[1];
  }
  return valor;
};

/* =============================
   COMPONENTE
============================== */

export default function Armas() {
  const [armas, setArmas] = useState<Arma[]>([]);
  const [loading, setLoading] = useState(true);
  const [armaSeleccionada, setArmaSeleccionada] = useState<Arma | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const detalleRef = useRef<HTMLDivElement | null>(null);

  /* =============================
     CARGA DE ARMAS
  ============================== */
  useEffect(() => {
    getArmas().then((data: Arma[]) => {
      const armasOrdenadas = data.sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      );
      setArmas(armasOrdenadas);
      setLoading(false);
    });
  }, []);

  /* =============================
     FILTRADO POR BÚSQUEDA
  ============================== */
  const armasFiltradas = armas.filter((arma) =>
    arma.displayName.toLowerCase().includes(busqueda.toLowerCase())
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
    {}
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
              <h2 className="weapon-name">
                {armaSeleccionada.displayName}
              </h2>

              <div className="weapon-badges">
                <span className="weapon-category">
                  {normalizarCategoria(armaSeleccionada.category)}
                </span>
                <span className="weapon-cost">
                  {armaSeleccionada.cost ? `${armaSeleccionada.cost} créditos` : "Gratis"}
                </span>
              </div>

              {/* =============================
                 ESTADÍSTICAS
              ============================== */}
              {armaSeleccionada.stats && Object.keys(armaSeleccionada.stats).length > 0 && (
                <>
                  <h3 className="weapon-section-title">Estadísticas</h3>
                  <div className="weapon-stats">
                    {Object.entries(armaSeleccionada.stats || {}).map(
                      ([key, value]) =>
                        value !== undefined && value !== null && (
                          <div key={key} className="weapon-stat">
                            <span>{traduccionesStats[key] || key}</span>
                            <strong>{formatearValor(value)}</strong>
                          </div>
                        )
                    )}
                  </div>
                </>
              )}

              {/* =============================
                 MIRA (ADS)
              ============================== */}
              {armaSeleccionada.adsStats && Object.keys(armaSeleccionada.adsStats).length > 0 && (
                <>
                  <h3 className="weapon-section-title">Apuntar con mira</h3>
                  <div className="weapon-stats">
                    {Object.entries(armaSeleccionada.adsStats || {}).map(
                      ([key, value]) =>
                        value !== undefined && value !== null && (
                          <div key={key} className="weapon-stat">
                            <span>{traduccionesStats[key] || key}</span>
                            <strong>{formatearValor(value)}</strong>
                          </div>
                        )
                    )}
                  </div>
                </>
              )}

              {/* =============================
                 DAÑO
              ============================== */}
              {armaSeleccionada.damageRanges && armaSeleccionada.damageRanges.length > 0 && (
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
      {Object.entries(armasPorCategoria).map(
        ([categoria, armasCategoria]) => (
          <section key={categoria} className="weapons-category">
            <h2 className="weapons-category-title">{categoria}</h2>

            <div className="weapons-grid">
              {armasCategoria.map((arma, idx) => {
                const activa =
                  armaSeleccionada?.displayName === arma.displayName;

                return (
                  <div
                    key={idx}
                    className={`weapon-card ${activa ? "active" : ""}`}
                    onClick={() =>
                      setArmaSeleccionada(activa ? null : arma)
                    }
                  >
                    {arma.displayIcon && (
                      <img
                        src={arma.displayIcon}
                        alt={arma.displayName}
                        className="weapon-image"
                        loading="lazy"
                      />
                    )}

                    <h2 className="weapon-card-name">
                      {arma.displayName}
                    </h2>
                  </div>
                );
              })}
            </div>
          </section>
        )
      )}
    </div>
  );
}