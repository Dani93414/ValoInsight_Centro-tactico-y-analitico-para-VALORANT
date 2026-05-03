import { apiUrl } from "./config.ts";

export type AuthUser = {
  id: string;
  email: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  createdAt?: string;
  lastLoginAt?: string;
};

type AuthRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function authRequest<T>(
  path: string,
  { method = "GET", body }: AuthRequestOptions = {},
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "No se pudo completar la operacion";
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") {
        message = payload.detail;
      }
    } catch {
      // Keep the generic message when the server does not return JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function getMe(): Promise<AuthUser> {
  return authRequest<AuthUser>("/auth/me");
}

export function login(email: string, password: string): Promise<AuthUser> {
  return authRequest<AuthUser>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function register(
  email: string,
  password: string,
  puuid: string,
): Promise<AuthUser> {
  return authRequest<AuthUser>("/auth/register", {
    method: "POST",
    body: { email, password, puuid },
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return authRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
}
