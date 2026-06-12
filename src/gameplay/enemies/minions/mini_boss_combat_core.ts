// @ts-nocheck
/** Cœur overshield / immunités Mini-Boss (sans dépendance UI). */

export const MINI_BOSS_HP_MULT = 2.8;
export const MINI_BOSS_OVERSHIELD_RATIO = 0.4;
export const MINI_BOSS_SPEED_MULT = 0.88;
/** Bonus global Mini-Boss — appliqué une seule fois, hors tiers. */
export const MINI_BOSS_GLOBAL_DAMAGE_MULT = 1.05;
export const MINI_BOSS_GLOBAL_DURABILITY_MULT = 1.05;

export function isMiniBossTarget(enemy: { isMiniBoss?: boolean } | null | undefined): boolean {
  return !!enemy?.isMiniBoss;
}

export function getOvershieldHp(enemy: { overshieldHp?: number; barrierHp?: number }): number {
  return Math.max(0, enemy?.overshieldHp ?? enemy?.barrierHp ?? 0);
}

export function getMaxOvershieldHp(enemy: { maxOvershieldHp?: number; maxBarrierHp?: number }): number {
  return Math.max(0, enemy?.maxOvershieldHp ?? enemy?.maxBarrierHp ?? 0);
}

export function setOvershield(
  enemy: { overshieldHp?: number; maxOvershieldHp?: number; barrierHp?: number; maxBarrierHp?: number },
  current: number,
  max: number,
): void {
  const cur = Math.max(0, Math.floor(current));
  const cap = Math.max(0, Math.floor(max));
  enemy.overshieldHp = cur;
  enemy.maxOvershieldHp = cap;
  enemy.barrierHp = cur;
  enemy.maxBarrierHp = cap;
}

export function shouldApplyMarkedBonus(enemy: { isMiniBoss?: boolean; sanguineInstability?: boolean }): boolean {
  if (isMiniBossTarget(enemy)) return false;
  return true;
}

export function shouldApplySolarLightAmp(enemy: { isMiniBoss?: boolean }): boolean {
  return !isMiniBossTarget(enemy);
}

export function shouldApplyCataclysmVuln(enemy: { isMiniBoss?: boolean }): boolean {
  return !isMiniBossTarget(enemy);
}

export function blocksCriticalHits(enemy: {
  isMiniBoss?: boolean;
  overshieldHp?: number;
  barrierHp?: number;
  type?: string;
}): boolean {
  if (isMiniBossTarget(enemy)) return false;
  return getOvershieldHp(enemy) > 0 && enemy.type === 'corrupted';
}

export function grantMiniBossOvershield(
  enemy: { maxHp: number },
  ratio = MINI_BOSS_OVERSHIELD_RATIO,
  bonusMult = 1,
): void {
  const cap = Math.floor(enemy.maxHp * ratio * bonusMult);
  setOvershield(enemy, cap, cap);
}
