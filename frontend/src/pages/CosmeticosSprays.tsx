import { useMemo, useState } from "react";
import { useSprays } from "../api/hooks";
import type { SprayContent } from "../types/content";
import CosmeticGridPage from "./CosmeticGridPage";

export default function CosmeticosSprays() {
  const query = useSprays();
  const [animationFilter, setAnimationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  const categories = useMemo(() => {
    const values = new Set(
      (query.data ?? [])
        .map((item) => item.category)
        .filter((category): category is string => Boolean(category)),
    );
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [query.data]);

  const getSprayMeta = (item: SprayContent) =>
    [
      item.category,
      item.isAnimated ? "Animado" : "Estatico",
      item.levelsCount ? `${item.levelsCount} niveles` : null,
      item.hideIfNotOwned ? "Oculto" : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <CosmeticGridPage
      title="Sprays"
      subtitle="Sprays y variantes animadas del contenido disponible."
      query={query}
      searchPlaceholder="Buscar spray..."
      getImage={(item) =>
        item.fullTransparentIcon || item.fullIcon || item.displayIcon
      }
      getMeta={getSprayMeta}
      getSearchText={(item) =>
        `${item.displayName} ${item.category ?? ""} ${item.themeUuid ?? ""}`
      }
      extraFilter={(item) => {
        const matchesAnimation =
          animationFilter === "all" ||
          (animationFilter === "animated" && item.isAnimated) ||
          (animationFilter === "static" && !item.isAnimated);
        const matchesCategory =
          categoryFilter === "all" || item.category === categoryFilter;
        const matchesVisibility =
          visibilityFilter === "all" ||
          (visibilityFilter === "hidden" && item.hideIfNotOwned) ||
          (visibilityFilter === "visible" && !item.hideIfNotOwned);
        return matchesAnimation && matchesCategory && matchesVisibility;
      }}
      filterControls={
        <div className="content-inline-controls">
          <label className="content-select-label">
            Animacion
            <select
              className="content-select"
              value={animationFilter}
              onChange={(event) => setAnimationFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="animated">Animados</option>
              <option value="static">Estaticos</option>
            </select>
          </label>
          <label className="content-select-label">
            Categoria
            <select
              className="content-select"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="content-select-label">
            Visibilidad
            <select
              className="content-select"
              value={visibilityFilter}
              onChange={(event) => setVisibilityFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="visible">Visibles</option>
              <option value="hidden">Ocultos</option>
            </select>
          </label>
        </div>
      }
    />
  );
}
