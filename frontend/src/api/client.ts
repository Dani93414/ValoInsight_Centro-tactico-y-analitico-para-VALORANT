import { apiUrl } from "./config.ts";

export async function getRoot() {
  const res = await fetch(apiUrl("/"));
  if (!res.ok) throw new Error("Error backend");
  return res.json();
}
