import type { DamageRange } from "../../../types/weapons";
import { getMaxHeadDamage } from "../weaponUtils";

type Props = { ranges: DamageRange[] };

export function WeaponDamageTable({ ranges }: Props) {
  const maxHeadDamage = getMaxHeadDamage(ranges);

  return (
    <div className="weapon-damage-table">
      <div className="weapon-damage-header">
        <span>Distancia</span>
        <span>Cabeza</span>
        <span>Cuerpo</span>
        <span>Piernas</span>
      </div>
      {ranges.map((range) => {
        const oneTap = range.headDamage >= 150;
        const intensity = maxHeadDamage > 0 ? (range.headDamage / maxHeadDamage) * 100 : 0;

        return (
          <div
            key={`${range.rangeStartMeters}-${range.rangeEndMeters}`}
            className={`weapon-damage-row ${oneTap ? "is-one-tap" : ""}`}
          >
            <span>
              {range.rangeStartMeters}-{range.rangeEndMeters}m
            </span>
            <strong>
              {range.headDamage}
              {oneTap && <em>One tap</em>}
              <i style={{ width: `${intensity}%` }} aria-hidden="true" />
            </strong>
            <span>{range.bodyDamage}</span>
            <span>{range.legDamage}</span>
          </div>
        );
      })}
    </div>
  );
}

