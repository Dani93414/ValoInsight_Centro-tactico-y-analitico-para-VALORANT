import { useBuddies } from "../api/hooks";
import CosmeticGridPage from "./CosmeticGridPage";

export default function CosmeticosLlaveros() {
  const query = useBuddies();

  return (
    <CosmeticGridPage
      title="Llaveros"
      subtitle="Buddies para armas disponibles en el contenido local."
      query={query}
      searchPlaceholder="Buscar llavero..."
      toolbarClassName="content-toolbar--catalog content-toolbar--buddies"
      searchClassName="content-search--catalog"
      gridClassName="cbuddies-grid"
      slotClassName="cbuddies-slot"
      detailSlotClassName="cbuddies-detail-slot"
      cardClassName="cbuddies-card"
      detailClassName="cbuddies-detail"
      inlineDetail
      filterHeading={({ filtered }) => (
        <span className="content-result-count">{filtered.length}</span>
      )}
      getMeta={(item) => `${item.levelsCount ?? 0} niveles`}
      getSearchText={(item) => `${item.displayName} ${item.themeUuid ?? ""}`}
    />
  );
}
