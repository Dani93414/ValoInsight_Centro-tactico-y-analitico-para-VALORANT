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
      getMeta={() => "Flex"}
    />
  );
}
