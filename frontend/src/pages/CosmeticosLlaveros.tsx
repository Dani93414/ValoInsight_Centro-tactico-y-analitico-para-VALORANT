import { useState } from "react";
import { useBuddies } from "../api/hooks";
import CosmeticGridPage from "./CosmeticGridPage";

export default function CosmeticosLlaveros() {
  const query = useBuddies();
  const [levelsFilter, setLevelsFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  return (
    <CosmeticGridPage
      title="Llaveros"
      subtitle="Buddies para armas disponibles en el contenido local."
      query={query}
      searchPlaceholder="Buscar llavero..."
      getMeta={(item) =>
        [
          `${item.levelsCount ?? 0} niveles`,
          item.isHiddenIfNotOwned ? "Oculto" : null,
        ]
          .filter(Boolean)
          .join(" · ")
      }
      getSearchText={(item) =>
        `${item.displayName} ${item.themeUuid ?? ""} ${
          item.isHiddenIfNotOwned ? "oculto" : ""
        }`
      }
      extraFilter={(item) => {
        const levels = item.levelsCount ?? 0;
        const matchesLevels =
          levelsFilter === "all" ||
          (levelsFilter === "single" && levels <= 1) ||
          (levelsFilter === "multi" && levels > 1);
        const matchesVisibility =
          visibilityFilter === "all" ||
          (visibilityFilter === "hidden" && item.isHiddenIfNotOwned) ||
          (visibilityFilter === "visible" && !item.isHiddenIfNotOwned);
        return matchesLevels && matchesVisibility;
      }}
      filterControls={
        <div className="content-inline-controls">
          <label className="content-select-label">
            Niveles
            <select
              className="content-select"
              value={levelsFilter}
              onChange={(event) => setLevelsFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="single">1 nivel</option>
              <option value="multi">Varios</option>
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
