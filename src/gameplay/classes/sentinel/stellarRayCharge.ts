import { ConstellationEngine } from '@/systems/constellationEngine';

/** Incantation standard sans passif de branche. */
export const STELLAR_NORMAL_CAST_SEC = 1;

/** Durée totale de charge avec Surcharge Stellaire. */
export const STELLAR_CHARGE_MAX_SEC = 3.25;

/** Fin du segment 50 % → 100 %. */
export const STELLAR_CHARGE_SEG1_END_SEC = 2;

export const STELLAR_AMP_MIN = 0.5;
export const STELLAR_AMP_MID = 1.0;
export const STELLAR_AMP_MAX = 2.5;

export const STELLAR_RANGE_BONUS_THRESHOLD = STELLAR_AMP_MAX;
export const STELLAR_RANGE_BONUS_MULT = 1.2;

export const STELLAR_OVERCHARGE_NODE_ID = 'sentinel-surcharge-10';

export function hasStellarOvercharge(): boolean {
  const rank = ConstellationEngine.getPassiveRank('stellarOvercharge');
  if (rank > 0) return true;

  if (!ConstellationEngine.isNodeUnlocked(STELLAR_OVERCHARGE_NODE_ID)) return false;

  // Réapplique le passif si STATE.passives a été écrasé (forge, compendium, etc.)
  ConstellationEngine.ensureKeystonePassive('stellarOvercharge', STELLAR_OVERCHARGE_NODE_ID);
  return ConstellationEngine.getPassiveRank('stellarOvercharge') > 0;
}

/**
 * Amplification continue du Rayon Stellaire.
 * 0–2 s : 50 % → 100 % · 2–3,25 s : 100 % → 250 % (avec passif).
 */
export function calcStellarRayAmplification(chargeSec: number, overchargeEnabled?: boolean): number {
  const over = overchargeEnabled ?? hasStellarOvercharge();
  const t = Math.max(0, chargeSec);

  if (t <= STELLAR_CHARGE_SEG1_END_SEC) {
    const seg = t / STELLAR_CHARGE_SEG1_END_SEC;
    const amp = STELLAR_AMP_MIN + (STELLAR_AMP_MID - STELLAR_AMP_MIN) * seg;
    return over ? amp : Math.min(amp, STELLAR_AMP_MID);
  }

  if (!over) return STELLAR_AMP_MID;

  const seg2Dur = STELLAR_CHARGE_MAX_SEC - STELLAR_CHARGE_SEG1_END_SEC;
  const seg = Math.min(t - STELLAR_CHARGE_SEG1_END_SEC, seg2Dur) / seg2Dur;
  return STELLAR_AMP_MID + (STELLAR_AMP_MAX - STELLAR_AMP_MID) * seg;
}

export function getStellarChargeMaxSec(overchargeEnabled?: boolean): number {
  return (overchargeEnabled ?? hasStellarOvercharge()) ? STELLAR_CHARGE_MAX_SEC : STELLAR_CHARGE_SEG1_END_SEC;
}

/** Remplissage de la jauge (0–100 %) par rapport au maximum atteignable. */
export function getStellarChargeBarFillPct(amp: number, overchargeEnabled?: boolean): number {
  const max = (overchargeEnabled ?? hasStellarOvercharge()) ? STELLAR_AMP_MAX : STELLAR_AMP_MID;
  return Math.min(100, Math.max(0, (amp / max) * 100));
}

export type StellarChargeVisualTier = 'normal' | 'enhanced' | 'high' | 'maximum';

export function getStellarChargeVisualTier(amp: number): StellarChargeVisualTier {
  if (amp >= STELLAR_AMP_MAX - 0.0001) return 'maximum';
  if (amp >= 2.0) return 'high';
  if (amp >= STELLAR_AMP_MID) return 'enhanced';
  return 'normal';
}

export function hasStellarRangeBonus(amp: number): boolean {
  return amp >= STELLAR_RANGE_BONUS_THRESHOLD - 0.0001;
}

export function formatStellarAmplificationPct(amp: number): string {
  return `${(amp * 100).toFixed(2)}%`;
}
