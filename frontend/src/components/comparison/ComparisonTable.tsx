import { useId, useState, type FocusEvent, type MouseEvent } from "react";
import { Info } from "lucide-react";
import "./ComparisonTable.css";

export type ComparisonTone = "positive" | "negative" | "neutral" | "plain";

export type ComparisonTableRow = {
  key: string;
  label: string;
  globalLabel: string;
  personalLabel: string;
  diffLabel: string;
  globalNormalizedLabel?: string;
  personalNormalizedLabel?: string;
  normalizedDiffLabel?: string;
  diffTone?: ComparisonTone;
  normalizedDiffTone?: ComparisonTone;
};

type Props = {
  rows: ComparisonTableRow[];
  ariaLabel: string;
  className?: string;
};

const REAL_METRICS_HELP =
  "Las métricas reales muestran los valores observados directamente en los datos, sin ajuste por tamaño de muestra. Son útiles para ver el rendimiento bruto, pero pueden ser menos fiables cuando hay pocas partidas o rondas.";

const COMPARABLE_METRICS_HELP =
  "Las métricas comparables aplican un ajuste bayesiano o shrinkage para reducir el ruido de muestras pequeñas. Si hay pocas partidas o rondas, el valor se acerca parcialmente a una referencia global/prior. Cuanta más muestra hay, menor es el ajuste. Esto permite comparar mejor tu rendimiento con el global sin sobrerreaccionar a pocos datos.";

function ComparisonInfoTooltip({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const showTooltip = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setPosition({
      left: Math.min(window.innerWidth - 24, Math.max(24, rect.left + rect.width / 2)),
      top: rect.bottom + 10,
    });
  };
  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => showTooltip(event.currentTarget);
  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => showTooltip(event.currentTarget);
  const hideTooltip = () => setPosition(null);

  return (
    <>
      <button
      type="button"
      className="metric-info-button comparison-table__info"
      aria-label={label}
      aria-describedby={position ? tooltipId : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={hideTooltip}
      onFocus={handleFocus}
      onBlur={hideTooltip}
    >
        <Info size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      {position && (
        <span
          id={tooltipId}
          className="comparison-table__tooltip"
          role="tooltip"
          style={{ left: position.left, top: position.top }}
        >
          {text}
        </span>
      )}
    </>
  );
}

export function ComparisonTable({ rows, ariaLabel, className = "" }: Props) {
  return (
    <div className={`comparison-table ${className}`.trim()} role="table" aria-label={ariaLabel}>
      <div className="comparison-table__group-header" role="row">
        <span
          className="comparison-table__metric-cell comparison-table__metric-separator"
          role="columnheader"
        >
          Métrica
        </span>
        <span className="comparison-table__real-group" role="columnheader" aria-colspan={3}>
          Métricas reales
          <ComparisonInfoTooltip
            label="Información sobre métricas reales"
            text={REAL_METRICS_HELP}
          />
        </span>
        <span
          className="comparison-table__comparable-group comparison-table__normalized-separator"
          role="columnheader"
          aria-colspan={3}
        >
          Métricas comparables
          <ComparisonInfoTooltip
            label="Información sobre métricas comparables"
            text={COMPARABLE_METRICS_HELP}
          />
        </span>
      </div>

      <div className="comparison-table__row comparison-table__row--head" role="row">
        <span
          className="comparison-table__metric-cell comparison-table__metric-separator"
          role="columnheader"
          aria-hidden="true"
        />
        <span role="columnheader">Global</span>
        <span role="columnheader">Tú</span>
        <span role="columnheader">Diferencia</span>
        <span className="comparison-table__normalized-separator" role="columnheader">Global norm.</span>
        <span role="columnheader">Tú norm.</span>
        <span role="columnheader">Diferencia norm.</span>
      </div>

      {rows.map((row) => {
        const diffTone = row.diffTone ?? "neutral";
        const normalizedDiffTone = row.normalizedDiffTone ?? "neutral";
        return (
          <div className="comparison-table__row" role="row" key={row.key}>
            <span
              className="comparison-table__metric-cell comparison-table__metric-separator"
              role="cell"
            >
              {row.label}
            </span>
            <strong role="cell">{row.globalLabel}</strong>
            <strong role="cell">{row.personalLabel}</strong>
            <em role="cell" className={`metric-diff metric-diff-${diffTone}`}>
              {row.diffLabel}
            </em>
            <strong className="comparison-table__normalized-separator" role="cell">
              {row.globalNormalizedLabel ?? "-"}
            </strong>
            <strong role="cell">{row.personalNormalizedLabel ?? "-"}</strong>
            <em role="cell" className={`metric-diff metric-diff-${normalizedDiffTone}`}>
              {row.normalizedDiffLabel ?? "-"}
            </em>
          </div>
        );
      })}
    </div>
  );
}
