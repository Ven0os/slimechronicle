import { ConstellationEngine } from '@/systems/constellationEngine';

export const LANCE_CHARGE_MAX_SEC = 2;
export const LANCE_CHARGE_MIN_SEC = 0.35;
export const LANCE_CHARGE_RANGE_MAX = 0.75;
export const FULGURANCE_DMG_BONUS_PER_TARGET = 0.07;
export const ECLIPSE_CROWN_NODE_ID = 'eclipse-soleil-10';

/** Attaque chargée valide uniquement après le maintien minimum. */
export function isValidChargedLanceRelease(chargeSec: number): boolean {
  return chargeSec >= LANCE_CHARGE_MIN_SEC;
}

/**
 * Portée bonus : 0 % à 0,35 s → +75 % à 2 s (interpolation lisse).
 * En dessous du minimum, retourne 0 (attaque normale au relâchement).
 */
export function calcLanceChargeRangeBonus(chargeSec: number): number {
  const t = Math.min(LANCE_CHARGE_MAX_SEC, Math.max(0, chargeSec));
  if (t < LANCE_CHARGE_MIN_SEC) return 0;
  const seg = (t - LANCE_CHARGE_MIN_SEC) / (LANCE_CHARGE_MAX_SEC - LANCE_CHARGE_MIN_SEC);
  return seg * LANCE_CHARGE_RANGE_MAX;
}

export function formatLanceRangeBonusPct(bonus: number): string {
  return `${(bonus * 100).toFixed(0)}%`;
}

export function hasEclipseCrown(): boolean {
  const rank = ConstellationEngine.getPassiveRank('solarFlare');
  if (rank > 0) return true;
  if (!ConstellationEngine.isNodeUnlocked(ECLIPSE_CROWN_NODE_ID)) return false;
  ConstellationEngine.ensureKeystonePassive('solarFlare', ECLIPSE_CROWN_NODE_ID);
  return ConstellationEngine.getPassiveRank('solarFlare') > 0;
}

/** Enregistre le nombre d'ennemis traversés par la dernière Fulgurance (sans cumul persistant). */
export function recordFulguranceTargets(
  player: { lastFulguranceTargetsHit?: number },
  count: number,
): void {
  if (!hasEclipseCrown()) return;
  player.lastFulguranceTargetsHit = Math.max(0, count);
}

/** Bonus dégâts unique sur la prochaine attaque chargée, puis effacement. */
export function consumeFulguranceDamageBonus(player: { lastFulguranceTargetsHit?: number }): number {
  if (!hasEclipseCrown()) return 1;
  const targets = player.lastFulguranceTargetsHit || 0;
  player.lastFulguranceTargetsHit = 0;
  return 1 + targets * FULGURANCE_DMG_BONUS_PER_TARGET;
}
