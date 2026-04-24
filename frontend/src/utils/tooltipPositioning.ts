export type TooltipPlacement = "top" | "right" | "bottom" | "left";

export type TooltipRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type TooltipSize = {
  width: number;
  height: number;
};

type TooltipBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type ResolveFloatingTooltipPositionOptions = {
  anchorRect: TooltipRect;
  tooltipSize: TooltipSize;
  containerRect?: TooltipRect | null;
  viewportWidth?: number;
  viewportHeight?: number;
  placements?: TooltipPlacement[];
  gap?: number;
  padding?: number;
};

const DEFAULT_PLACEMENTS: TooltipPlacement[] = [
  "top",
  "bottom",
  "right",
  "left",
];

const DEFAULT_GAP = 10;
const DEFAULT_PADDING = 10;

export const RECHARTS_TOOLTIP_CLAMP_VIEWBOX = { x: false, y: false } as const;

export const RECHARTS_TOOLTIP_WRAPPER_STYLE = {
  pointerEvents: "none",
  zIndex: 2200,
} as const;

function toFiniteNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function getBoundsWidth(bounds: TooltipBounds): number {
  return Math.max(0, bounds.right - bounds.left);
}

function getBoundsHeight(bounds: TooltipBounds): number {
  return Math.max(0, bounds.bottom - bounds.top);
}

function intersectBounds(a: TooltipBounds, b: TooltipBounds): TooltipBounds {
  return {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
}

function normalizeSize(size: TooltipSize): TooltipSize {
  return {
    width: Math.max(1, toFiniteNumber(size.width, 1)),
    height: Math.max(1, toFiniteNumber(size.height, 1)),
  };
}

function getPlacementCoordinates(
  anchorRect: TooltipRect,
  tooltipSize: TooltipSize,
  placement: TooltipPlacement,
  gap: number,
): { x: number; y: number } {
  const centerX = anchorRect.left + anchorRect.width / 2;
  const centerY = anchorRect.top + anchorRect.height / 2;

  if (placement === "top") {
    return {
      x: centerX - tooltipSize.width / 2,
      y: anchorRect.top - tooltipSize.height - gap,
    };
  }

  if (placement === "bottom") {
    return {
      x: centerX - tooltipSize.width / 2,
      y: anchorRect.bottom + gap,
    };
  }

  if (placement === "right") {
    return {
      x: anchorRect.right + gap,
      y: centerY - tooltipSize.height / 2,
    };
  }

  return {
    x: anchorRect.left - tooltipSize.width - gap,
    y: centerY - tooltipSize.height / 2,
  };
}

function fitsWithinBounds(
  coordinates: { x: number; y: number },
  tooltipSize: TooltipSize,
  bounds: TooltipBounds,
): boolean {
  return (
    coordinates.x >= bounds.left &&
    coordinates.y >= bounds.top &&
    coordinates.x + tooltipSize.width <= bounds.right &&
    coordinates.y + tooltipSize.height <= bounds.bottom
  );
}

function clampCoordinatesToBounds(
  coordinates: { x: number; y: number },
  tooltipSize: TooltipSize,
  bounds: TooltipBounds,
): { x: number; y: number } {
  return {
    x: clampNumber(
      coordinates.x,
      bounds.left,
      bounds.right - tooltipSize.width,
    ),
    y: clampNumber(
      coordinates.y,
      bounds.top,
      bounds.bottom - tooltipSize.height,
    ),
  };
}

function buildViewportBounds(
  viewportWidth: number,
  viewportHeight: number,
  padding: number,
): TooltipBounds {
  return {
    left: padding,
    top: padding,
    right: Math.max(padding, viewportWidth - padding),
    bottom: Math.max(padding, viewportHeight - padding),
  };
}

function buildContainerBounds(
  containerRect: TooltipRect,
  viewportBounds: TooltipBounds,
  padding: number,
): TooltipBounds {
  const paddedContainerBounds: TooltipBounds = {
    left: containerRect.left + padding,
    top: containerRect.top + padding,
    right: containerRect.right - padding,
    bottom: containerRect.bottom - padding,
  };

  return intersectBounds(viewportBounds, paddedContainerBounds);
}

export function snapshotTooltipRect(
  rect: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">,
): TooltipRect {
  const width = Math.max(0, toFiniteNumber(rect.width));
  const height = Math.max(0, toFiniteNumber(rect.height));
  const left = toFiniteNumber(rect.left);
  const top = toFiniteNumber(rect.top);
  const right = toFiniteNumber(rect.right, left + width);
  const bottom = toFiniteNumber(rect.bottom, top + height);

  return {
    left,
    top,
    right,
    bottom,
    width,
    height,
  };
}

export function estimateFloatingInfoTooltipSize(
  content: string,
  maxWidth = 360,
): TooltipSize {
  const normalizedText = content.replace(/\s+/g, " ").trim();
  const lineCount = Math.max(1, Math.ceil(normalizedText.length / 56));

  return {
    width: Math.max(220, Math.min(maxWidth, 240 + lineCount * 16)),
    height: Math.max(72, Math.min(280, 34 + lineCount * 20)),
  };
}

export function resolveFloatingTooltipPosition(
  options: ResolveFloatingTooltipPositionOptions,
): { x: number; y: number; placement: TooltipPlacement } {
  const {
    anchorRect,
    containerRect,
    gap = DEFAULT_GAP,
    padding = DEFAULT_PADDING,
  } = options;

  const tooltipSize = normalizeSize(options.tooltipSize);
  const placements =
    options.placements && options.placements.length > 0
      ? options.placements
      : DEFAULT_PLACEMENTS;

  const viewportWidth =
    toFiniteNumber(options.viewportWidth) ||
    (typeof window !== "undefined" ? window.innerWidth : anchorRect.right + 32);
  const viewportHeight =
    toFiniteNumber(options.viewportHeight) ||
    (typeof window !== "undefined" ? window.innerHeight : anchorRect.bottom + 32);

  const viewportBounds = buildViewportBounds(
    viewportWidth,
    viewportHeight,
    Math.max(0, padding),
  );

  let workingBounds = viewportBounds;

  if (containerRect) {
    const candidateBounds = buildContainerBounds(
      containerRect,
      viewportBounds,
      Math.max(0, padding),
    );

    if (
      getBoundsWidth(candidateBounds) >= tooltipSize.width &&
      getBoundsHeight(candidateBounds) >= tooltipSize.height
    ) {
      workingBounds = candidateBounds;
    }
  }

  let bestPlacement: TooltipPlacement = placements[0] ?? "top";
  let bestCoordinates = clampCoordinatesToBounds(
    getPlacementCoordinates(anchorRect, tooltipSize, bestPlacement, gap),
    tooltipSize,
    workingBounds,
  );
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (const placement of placements) {
    const rawCoordinates = getPlacementCoordinates(
      anchorRect,
      tooltipSize,
      placement,
      gap,
    );

    if (fitsWithinBounds(rawCoordinates, tooltipSize, workingBounds)) {
      return {
        x: rawCoordinates.x,
        y: rawCoordinates.y,
        placement,
      };
    }

    const clamped = clampCoordinatesToBounds(
      rawCoordinates,
      tooltipSize,
      workingBounds,
    );
    const penalty =
      Math.abs(clamped.x - rawCoordinates.x) +
      Math.abs(clamped.y - rawCoordinates.y);

    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestPlacement = placement;
      bestCoordinates = clamped;
    }
  }

  return {
    x: bestCoordinates.x,
    y: bestCoordinates.y,
    placement: bestPlacement,
  };
}
