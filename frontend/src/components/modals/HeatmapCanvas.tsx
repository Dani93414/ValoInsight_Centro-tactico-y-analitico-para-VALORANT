import { useRef, useEffect, useState, useCallback } from "react";
import simpleheat from "simpleheat";
import type { HeatmapTransformMeta } from "../../api/stats";

export interface HeatmapEvent {
  x: number; // 0-1 normalised
  y: number; // 0-1 normalised
  weight: number;
  event_type: string;
  round_num?: number;
  round_phase?: string;
  side?: string;
  match_id?: string;
}

interface Props {
  events: HeatmapEvent[];
  mapImageUrl: string;
  opacity: number; // 0-1
  radius: number; // px (at base resolution)
  maxWeight?: number; // for normalisation across comparisons
  debugEnabled?: boolean;
  transformMeta?: HeatmapTransformMeta | null;
  eventTypeLabels?: Record<string, string>;
}

function formatTransformValue(value: number): string {
  const absValue = Math.abs(value);
  if (absValue !== 0 && (absValue < 0.001 || absValue >= 1000)) {
    return value.toExponential(4);
  }
  return value.toFixed(6);
}

const GRADIENT: Record<number, string> = {
  0.0: "rgba(0,0,255,0)",
  0.15: "royalblue",
  0.3: "cyan",
  0.45: "lime",
  0.6: "yellow",
  0.78: "orange",
  1.0: "red",
};

export default function HeatmapCanvas({
  events,
  mapImageUrl,
  opacity,
  radius,
  maxWeight,
  debugEnabled = false,
  transformMeta = null,
  eventTypeLabels = {},
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heatRef = useRef<ReturnType<typeof simpleheat> | null>(null);
  const dprRef = useRef(1);

  // Actual rendered size of the map image (set by onLoad / ResizeObserver)
  const [imgSize, setImgSize] = useState({ w: 1024, h: 1024 });
  const imgRef = useRef<HTMLImageElement>(null);

  // Zoom / pan state
  const [scale, setScale] = useState(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const [translateState, setTranslateState] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  // Tooltip
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [hoverNorm, setHoverNorm] = useState<{ x: number; y: number } | null>(
    null,
  );

  // ── Track the rendered size of the image ──────────────────
  const syncSize = useCallback(() => {
    if (!imgRef.current) return;
    const { clientWidth: w, clientHeight: h } = imgRef.current;
    if (w > 0 && h > 0)
      setImgSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => syncSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [syncSize]);

  // ── (Re-)create simpleheat when canvas logical size changes ─
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    // Request the 2D context in read-heavy mode before simpleheat initializes it.
    canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = Math.max(1, Math.round(imgSize.w * dpr));
    canvas.height = Math.max(1, Math.round(imgSize.h * dpr));
    canvas.style.width = `${imgSize.w}px`;
    canvas.style.height = `${imgSize.h}px`;

    const h = simpleheat(canvas);
    h.gradient(GRADIENT);
    heatRef.current = h;
  }, [imgSize]);

  // ── Redraw whenever events/radius/opacity/size change ─────
  useEffect(() => {
    const h = heatRef.current;
    const canvas = canvasRef.current;
    if (!h || !canvas) return;

    const { w, h: hh } = imgSize;
    const dpr = dprRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (events.length === 0) return;

    // Use a sensible max: at least 8 so isolated 1-2 weight events stay cool-toned
    const rawMax = maxWeight ?? Math.max(...events.map((e) => e.weight), 1);
    const effectiveMax = Math.max(rawMax, 8);

    const points: [number, number, number][] = events.map((e) => [
      e.x * w * dpr,
      e.y * hh * dpr,
      e.weight / effectiveMax,
    ]);

    h.radius(radius * dpr, radius * 0.4 * dpr);
    h.max(1);
    h.data(points);
    h.draw(0.05);
  }, [events, radius, opacity, maxWeight, imgSize]);

  // ── Zoom (mouse wheel) ────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    setScale((s) => {
      const next = Math.min(Math.max(s + dir * 0.2, 1), 5);
      if (next <= 1) {
        translateRef.current = { x: 0, y: 0 };
        setTranslateState({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  // ── Pan (mouse drag) ─────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translateRef.current };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging.current) {
        const newT = {
          x: translateStart.current.x + (e.clientX - dragStart.current.x),
          y: translateStart.current.y + (e.clientY - dragStart.current.y),
        };
        translateRef.current = newT;
        setTranslateState(newT);
        return;
      }

      // Tooltip
      if (!containerRef.current || !imgRef.current || events.length === 0) {
        setTooltip(null);
        setHoverNorm(null);
        return;
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const imageRect = imgRef.current.getBoundingClientRect();
      if (imageRect.width <= 0 || imageRect.height <= 0) {
        setTooltip(null);
        setHoverNorm(null);
        return;
      }

      const localX = e.clientX - imageRect.left;
      const localY = e.clientY - imageRect.top;
      if (
        localX < 0 ||
        localY < 0 ||
        localX > imageRect.width ||
        localY > imageRect.height
      ) {
        setTooltip(null);
        setHoverNorm(null);
        return;
      }

      const relX = localX / imageRect.width;
      const relY = localY / imageRect.height;
      if (debugEnabled) {
        setHoverNorm({ x: relX, y: relY });
      }

      // Use a pixel radius for hover hit-testing to avoid broad false positives.
      const hoverRadiusPx = Math.max(5, Math.min(12, radius * 0.9));
      const hoverRadiusSq = hoverRadiusPx * hoverRadiusPx;
      let count = 0;
      const eventTypeCount = new Map<string, number>();
      for (const ev of events) {
        const dxPx = ev.x * imageRect.width - localX;
        const dyPx = ev.y * imageRect.height - localY;
        if (dxPx * dxPx + dyPx * dyPx <= hoverRadiusSq) {
          count++;
          eventTypeCount.set(
            ev.event_type,
            (eventTypeCount.get(ev.event_type) ?? 0) + 1,
          );
        }
      }

      if (count > 0) {
        const parts: string[] = [`${count} evento${count > 1 ? "s" : ""}`];

        const sortedBreakdown = [...eventTypeCount.entries()].sort(
          (a, b) =>
            b[1] - a[1] ||
            (eventTypeLabels[a[0]] ?? a[0]).localeCompare(
              eventTypeLabels[b[0]] ?? b[0],
              "es",
            ),
        );

        for (const [eventType, amount] of sortedBreakdown) {
          parts.push(`${eventTypeLabels[eventType] ?? eventType}: ${amount}`);
        }

        setTooltip({
          x: e.clientX - containerRect.left,
          y: e.clientY - containerRect.top,
          text: parts.join(" · "),
        });
      } else {
        setTooltip(null);
      }
    },
    [debugEnabled, events, eventTypeLabels, radius],
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Reset zoom when map changes
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setScale(1);
      translateRef.current = { x: 0, y: 0 };
      setTranslateState({ x: 0, y: 0 });
    });

    return () => cancelAnimationFrame(frame);
  }, [mapImageUrl]);

  return (
    <div
      ref={containerRef}
      className="heatmap-canvas-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        dragging.current = false;
        setTooltip(null);
        setHoverNorm(null);
      }}
    >
      <div
        className="heatmap-canvas-transform"
        style={{
          transform: `scale(${scale}) translate(${translateState.x / scale}px, ${translateState.y / scale}px)`,
        }}
      >
        <img
          ref={imgRef}
          src={mapImageUrl}
          alt="Map"
          className="heatmap-map-image"
          draggable={false}
          onLoad={syncSize}
        />
        <canvas
          ref={canvasRef}
          className="heatmap-heat-layer"
          style={{
            opacity,
            width: `${imgSize.w}px`,
            height: `${imgSize.h}px`,
          }}
        />
        {debugEnabled && (
          <div className="heatmap-debug-points">
            {events.slice(0, Math.min(events.length, 90)).map((event, idx) => (
              <span
                key={`${event.match_id ?? "m"}-${event.round_num ?? "r"}-${idx}`}
                className="heatmap-debug-point"
                style={{
                  left: `${event.x * 100}%`,
                  top: `${event.y * 100}%`,
                }}
              />
            ))}
            {hoverNorm && (
              <span
                className="heatmap-debug-cursor"
                style={{
                  left: `${hoverNorm.x * 100}%`,
                  top: `${hoverNorm.y * 100}%`,
                }}
              />
            )}
          </div>
        )}
      </div>

      {debugEnabled && transformMeta && (
        <div className="heatmap-debug-hud">
          <span>
            x &larr; {transformMeta.axis_swap?.x_from ?? "game_y"} *{" "}
            {formatTransformValue(transformMeta.xMultiplier)} +{" "}
            {formatTransformValue(transformMeta.xScalarToAdd)}
          </span>
          <span>
            y &larr; {transformMeta.axis_swap?.y_from ?? "game_x"} *{" "}
            {formatTransformValue(transformMeta.yMultiplier)} +{" "}
            {formatTransformValue(transformMeta.yScalarToAdd)}
          </span>
        </div>
      )}

      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}

      {scale > 1 && (
        <button
          className="heatmap-reset-zoom"
          onClick={() => {
            setScale(1);
            translateRef.current = { x: 0, y: 0 };
            setTranslateState({ x: 0, y: 0 });
          }}
        >
          Restablecer zoom
        </button>
      )}
    </div>
  );
}
