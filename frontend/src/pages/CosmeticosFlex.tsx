import { useFlex } from "../api/hooks";
import CosmeticGridPage from "./CosmeticGridPage";

export default function CosmeticosFlex() {
  const query = useFlex();

  return (
    <CosmeticGridPage
      title="Flex"
      subtitle="Objetos flex del inventario cosmetico."
      query={query}
      searchPlaceholder="Buscar flex..."
      toolbarClassName="content-toolbar--catalog content-toolbar--flex"
      searchClassName="content-search--catalog"
      gridClassName="cflex-grid"
      slotClassName="cflex-slot"
      detailSlotClassName="cflex-detail-slot"
      cardClassName="cflex-card"
      detailClassName="cflex-detail"
      inlineDetail
      filterHeading={({ filtered }) => (
        <span className="content-result-count">{filtered.length}</span>
      )}
      getMeta={() => "Flex"}
    />
  );
}
