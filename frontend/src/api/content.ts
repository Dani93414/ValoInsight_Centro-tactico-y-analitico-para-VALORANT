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

export async function getCompetitiveTiers() {
  const res = await fetch(apiUrl("/content/competitive-tiers"));
  if (!res.ok) throw new Error("Error competitive tiers");
  return res.json();
}

export async function getMapasGeo() {
  const res = await fetch(apiUrl("/content/mapas-geo"));
  if (!res.ok) throw new Error("Error mapas geo");
  return res.json();
}
