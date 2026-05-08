export type AgentThemeColor = {
  hex: string;
  name: string;
};

const SAFE_FALLBACKS: [string, string, string] = [
  "#ff4655",
  "#ff7a85",
  "#ffd7db",
];

export const valorantAgentColors: Record<string, AgentThemeColor[]> = {
  Astra: [
    { hex: "#6a38ff", name: "violeta cosmico" },
    { hex: "#c99cff", name: "lavanda brillante" },
    { hex: "#ffde59", name: "dorado astral" },
  ],
  Breach: [
    { hex: "#ff7a00", name: "naranja explosivo" },
    { hex: "#a14b00", name: "cobre oscuro" },
    { hex: "#ffe1b3", name: "arena clara" },
  ],
  Brimstone: [
    { hex: "#f45405", name: "rojo militar" },
    { hex: "#ff7b00", name: "marron caoba" },
    { hex: "#f5c16c", name: "dorado arena" },
  ],
  Chamber: [
    { hex: "#d7b56d", name: "oro elegante" },
    { hex: "#2b2b2b", name: "negro carbon" },
    { hex: "#f4efe2", name: "marfil" },
  ],
  Clove: [
    { hex: "#fc53c3", name: "rosa neon" },
    { hex: "#ba0dbd", name: "violeta magico" },
    { hex: "#2a1b4d", name: "purpura oscuro" },
  ],
  Cypher: [
    { hex: "#d8c9a3", name: "beige arena" },
    { hex: "#3a3f54", name: "azul grisaceo" },
    { hex: "#ffffff", name: "blanco puro" },
  ],
  Deadlock: [
    { hex: "#e9ef89", name: "azul artico" },
    { hex: "#747cee", name: "gris azulado" },
    { hex: "#e6f7ff", name: "blanco hielo" },
  ],
  Fade: [
    { hex: "#2b2142", name: "morado sombrio" },
    { hex: "#938a8e", name: "violeta espectral" },
    { hex: "#a6ffea", name: "verde fantasma" },
  ],
  Gekko: [
    { hex: "#c1f935", name: "verde lima" },
    { hex: "#96f358", name: "violeta electrico" },
    { hex: "#d8ffb8", name: "verde claro" },
  ],
  Harbor: [
    { hex: "#00aaff", name: "azul oceano" },
    { hex: "#004c6d", name: "azul profundo" },
    { hex: "#7ce7ff", name: "aqua brillante" },
  ],
  Iso: [
    { hex: "#8400ff", name: "cian energetico" },
    { hex: "#5b4bff", name: "azul violeta" },
    { hex: "#111827", name: "negro azulado" },
  ],
  Jett: [
    { hex: "#9be7ff", name: "celeste brillante" },
    { hex: "#4fb8ff", name: "azul viento" },
    { hex: "#dff8ff", name: "blanco hielo" },
  ],
  "KAY/O": [
    { hex: "#0044ff", name: "azul robotico" },
    { hex: "#9be7ff", name: "cian electrico" },
    { hex: "#1f2937", name: "gris titanio" },
  ],
  Killjoy: [
    { hex: "#ffe94d", name: "amarillo neon" },
    { hex: "#2f3136", name: "gris oscuro" },
    { hex: "#7dff9b", name: "verde tecnologico" },
  ],
  Neon: [
    { hex: "#00f0ff", name: "cian electrico" },
    { hex: "#0047ff", name: "azul relampago" },
    { hex: "#fff04a", name: "amarillo energia" },
  ],
  Omen: [
    { hex: "#3b2cff", name: "azul espectral" },
    { hex: "#1b1035", name: "purpura oscuro" },
    { hex: "#7e6bff", name: "lavanda oscura" },
  ],
  Phoenix: [
    { hex: "#ff6a00", name: "naranja fuego" },
    { hex: "#ffb347", name: "ambar brillante" },
    { hex: "#5a1e00", name: "marron quemado" },
  ],
  Raze: [
    { hex: "#ff9f1c", name: "naranja explosivo" },
    { hex: "#ff4d00", name: "rojo dinamita" },
    { hex: "#ffb05c", name: "verde graffiti" },
  ],
  Reyna: [
    { hex: "#7a00ff", name: "purpura intenso" },
    { hex: "#ff4df0", name: "magenta brillante" },
    { hex: "#1a001f", name: "negro purpura" },
  ],
  Sage: [
    { hex: "#8fffd1", name: "verde jade" },
    { hex: "#dbfff5", name: "menta clara" },
    { hex: "#3a6b61", name: "verde oscuro" },
  ],
  Skye: [
    { hex: "#4caf50", name: "verde naturaleza" },
    { hex: "#d4ff7f", name: "verde lima claro" },
    { hex: "#8b5a2b", name: "marron tierra" },
  ],
  Sova: [
    { hex: "#7dbdff", name: "azul glaciar" },
    { hex: "#294e80", name: "azul artico" },
    { hex: "#e6f3ff", name: "blanco nieve" },
  ],
  Tejo: [
    { hex: "#bf9200", name: "turquesa tactico" },
    { hex: "#ef9415", name: "azul militar" },
    { hex: "#d9fff8", name: "menta fria" },
  ],
  Veto: [
    { hex: "#39e0ff", name: "cian electrico" },
    { hex: "#2a2f38", name: "gris grafito" },
    { hex: "#6e3a46", name: "burdeos oscuro" },
  ],
  Viper: [
    { hex: "#00ff85", name: "verde veneno" },
    { hex: "#14532d", name: "verde toxico oscuro" },
    { hex: "#b7ffce", name: "verde acido claro" },
  ],
  Vyse: [
    { hex: "#b084ff", name: "lavanda metalica" },
    { hex: "#3d2c5a", name: "morado acero" },
    { hex: "#f3e8ff", name: "lila claro" },
  ],
  Waylay: [
    { hex: "#807d76", name: "violeta prismatico" },
    { hex: "#faca46", name: "cian holografico" },
    { hex: "#f0d35f", name: "amarillo dorado" },
  ],
  Miks: [
    { hex: "#ffb347", name: "verde neon" },
    { hex: "#bbb206", name: "naranja mango" },
    { hex: "#2a145c", name: "morado profundo" },
  ],
  Yoru: [
    { hex: "#0047ff", name: "azul dimensional" },
    { hex: "#0d1b4c", name: "azul noche" },
    { hex: "#59d0ff", name: "cian brillante" },
  ],
};

export function getAgentThemeColors(
  agentName: string,
  fallbackColors?: string[] | null,
): [string, string, string] {
  const manual = valorantAgentColors[agentName]?.map((item) => item.hex) ?? [];
  const fromApi = (fallbackColors ?? []).filter(Boolean);
  const merged = [...manual, ...fromApi, ...SAFE_FALLBACKS];
  return [merged[0], merged[1], merged[2]];
}
