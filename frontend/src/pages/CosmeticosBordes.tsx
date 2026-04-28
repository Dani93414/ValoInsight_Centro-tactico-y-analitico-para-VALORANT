import { useState } from "react";
import { useLevelBorders } from "../api/hooks";
import CosmeticGridPage from "./CosmeticGridPage";

export default function CosmeticosBordes() {
  const query = useLevelBorders();
  const [levelFilter, setLevelFilter] = useState("all");

  return (
    <CosmeticGridPage
      title="Bordes de nivel"
      subtitle="Marcos de nivel con sus apariencias locales cuando estan disponibles."
      query={query}
      searchPlaceholder="Buscar borde..."
      getImage={(item) =>
        item.levelNumberAppearance || item.smallPlayerCardAppearance
      }
      getMeta={(item) =>
        item.startingLevel !== undefined && item.startingLevel !== null
          ? `Desde nivel ${item.startingLevel}`
          : "Level border"
      }
      extraFilter={(item) => {
        const level = item.startingLevel ?? item.levelNumber ?? 0;
        return (
          levelFilter === "all" ||
          (levelFilter === "early" && level < 100) ||
          (levelFilter === "mid" && level >= 100 && level < 300) ||
          (levelFilter === "late" && level >= 300)
        );
      }}
      filterControls={
        <label className="content-select-label">
          Nivel
          <select
            className="content-select"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="early">0-99</option>
            <option value="mid">100-299</option>
            <option value="late">300+</option>
          </select>
        </label>
      }
    />
  );
}
