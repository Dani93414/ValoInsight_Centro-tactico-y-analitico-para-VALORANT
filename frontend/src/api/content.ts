import { apiUrl } from "./config.ts";

export async function getAgentes() {
  const res = await fetch(apiUrl("/content/agentes"));
  if (!res.ok) throw new Error("Error agentes");
  return res.json();
}

export async function getArmas() {
  const res = await fetch(apiUrl("/content/armas"));
  if (!res.ok) throw new Error("Error armas");
  return res.json();
}

export async function getActos() {
  const res = await fetch(apiUrl("/content/actos"));
  if (!res.ok) throw new Error("Error actos");
  return res.json();
}

export async function getCompetitiveTiers() {
  const res = await fetch(apiUrl("/content/competitive-tiers"));
  if (!res.ok) throw new Error("Error competitive tiers");
  return res.json();
}