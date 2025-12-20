const BASE_URL = "http://localhost:8000";

export async function getRoot() {
  const res = await fetch(`${BASE_URL}/`);
  if (!res.ok) throw new Error("Error backend");
  return res.json();
}
