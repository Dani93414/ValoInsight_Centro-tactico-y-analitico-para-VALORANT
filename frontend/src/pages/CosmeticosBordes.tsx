import { useMemo, useState } from "react";
import { useLevelBorders } from "../api/hooks";
import CosmeticGridPage from "./CosmeticGridPage";

export default function CosmeticosBordes() {
  const query = useLevelBorders();
  const [levelFilter, setLevelFilter] = useState("all");
  const levelRanges = useMemo(() => {
    const maxLevel = Math.max(
      0,
      ...(query.data ?? []).map((item) => item.startingLevel ?? item.levelNumber ?? 0),
    );
    const lastStart = Math.floor(maxLevel / 100) * 100;
    return Array.from({ length: lastStart / 100 + 1 }, (_, index) => {
      const start = index * 100;
      return { value: String(start), label: `${start}-${start + 99}` };
    });
  }, [query.data]);

  return (
    <CosmeticGridPage
      title="Bordes de nivel"
      subtitle="Marcos de nivel con sus apariencias locales cuando estan disponibles."
      query={query}
      searchPlaceholder="Buscar borde..."
      disableDetail
      sortItems={(a, b) =>
        (a.startingLevel ?? a.levelNumber ?? 0) - (b.startingLevel ?? b.levelNumber ?? 0)
        || a.displayName.localeCompare(b.displayName)
      }
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
        if (levelFilter === "all") return true;
        const start = Number(levelFilter);
        return level >= start && level < start + 100;
      }}
      filterControls={
        <label className="content-select-label content-level-selector">
          Nivel
          <select
            className="content-select content-level-select"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            {levelRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </label>
      }
    />
  );
}
