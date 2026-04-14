/* =====================================================
   Weapon-related types used across pages and modals.
   ===================================================== */

export type DamageRange = {
  rangeStartMeters: number;
  rangeEndMeters: number;
  headDamage: number;
  bodyDamage: number;
  legDamage: number;
};

export type WeaponStats = {
  fireRate?: number;
  magazineSize?: number;
  runSpeedMultiplier?: number;
  equipTimeSeconds?: number;
  reloadTimeSeconds?: number;
  firstBulletAccuracy?: number;
  shotgunPelletCount?: number;
  wallPenetration?: string;
  feature?: string;
  fireMode?: string;
  altFireType?: string;
};

export type AdsStats = {
  zoomMultiplier?: number;
  fireRate?: number;
  runSpeedMultiplier?: number;
  firstBulletAccuracy?: number;
  burstCount?: number;
};

export type Arma = {
  displayName: string;
  displayIcon?: string | null;
  category: string;
  cost?: number | null;
  stats?: WeaponStats | null;
  adsStats?: AdsStats | null;
  damageRanges?: DamageRange[] | null;
};
