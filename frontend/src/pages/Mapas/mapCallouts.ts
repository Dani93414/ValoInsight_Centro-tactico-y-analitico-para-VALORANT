export type ValorantMapTransformInput = {
  gameX?: number | string | null;
  gameY?: number | string | null;
  game_x?: number | string | null;
  game_y?: number | string | null;
  xMultiplier?: number | string | null;
  yMultiplier?: number | string | null;
  xScalarToAdd?: number | string | null;
  yScalarToAdd?: number | string | null;
};

export type MapPercentPosition = {
  xPercent: number;
  yPercent: number;
};

function toFiniteNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function translateValorantCoordinatesToMapPosition(
  input: ValorantMapTransformInput,
): MapPercentPosition | null {
  const gameX = toFiniteNumber(input.gameX ?? input.game_x);
  const gameY = toFiniteNumber(input.gameY ?? input.game_y);
  const xMult = toFiniteNumber(input.xMultiplier);
  const yMult = toFiniteNumber(input.yMultiplier);
  const xAdd = toFiniteNumber(input.xScalarToAdd);
  const yAdd = toFiniteNumber(input.yScalarToAdd);

  if (
    gameX === undefined ||
    gameY === undefined ||
    xMult === undefined ||
    yMult === undefined ||
    xAdd === undefined ||
    yAdd === undefined
  ) {
    return null;
  }

  // Valorant's tactical-map transform intentionally swaps game_x/game_y.
  const x = gameY * xMult + xAdd;
  const y = gameX * yMult + yAdd;

  return {
    xPercent: x * 100,
    yPercent: y * 100,
  };
}

export function isValidMapPercentPosition(
  position: MapPercentPosition | null,
): position is MapPercentPosition {
  return Boolean(
    position &&
      position.xPercent >= 0 &&
      position.xPercent <= 100 &&
      position.yPercent >= 0 &&
      position.yPercent <= 100,
  );
}
