import { apiUrl } from "./config";
import type { RegionStats } from "../types/globalStats";

export async function getRegions(): Promise<RegionStats[]> {
  const res = await fetch(apiUrl("/regions/"));
  if (!res.ok) throw new Error("Error regiones");
  return res.json();
}
