const API_URL = "http://localhost:8000/content";

export async function getAgentes() {
  const res = await fetch(`${API_URL}/agentes`);
  if (!res.ok) throw new Error("Error agentes");
  return res.json();
}
