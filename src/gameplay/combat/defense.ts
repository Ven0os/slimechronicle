// @ts-nocheck
/**
 * Stat globale Défense — courbe log-puissance à rendements extrêmes décroissants.
 *
 *   x = ln(1 + defense / B)
 *   damageReduction = min(MAX, MAX × x^P / (x^P + C^P + F × x²))
 *   finalDamage     = incomingDamage × (1 - damageReduction)
 *
 * Calibré sur les objectifs d'équilibrage :
 *   85 DEF    → ~1.26 %   |  12624 DEF → ~29.46 %   |  61246 DEF → ~31.36 %
 */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';

/** Plafond de réduction de dégâts (50 %). */
export const MAX_DAMAGE_REDUCTION = 0.5;

/** Échelle logarithmique — défense faible reste utile sans explosion. */
export const DEFENSE_LOG_BASE = 237.5202680851118;

/** Exposant de la courbe — montée rapide en mid-game, plateau en late-game. */
export const DEFENSE_LOG_POWER = 2.132168318189872;

/** Offset du dénominateur — stabilise la basse défense. */
export const DEFENSE_LOG_OFFSET = 1.683232436719584;

/** Terme quadratique log — rendements extrêmes décroissants à haute défense. */
export const DEFENSE_LOG_QUAD = 0.6465778902541645;

/** @deprecated Ancienne constante soft-cap — conservée pour compatibilité outils. */
export const SOFT_CAP = DEFENSE_LOG_BASE;

/** @deprecated Utiliser MAX_DAMAGE_REDUCTION */
export const DEFENSE_MAX_REDUCTION = MAX_DAMAGE_REDUCTION;

/** @deprecated Utiliser DEFENSE_LOG_BASE */
export const DEFENSE_SOFT_CAP = DEFENSE_LOG_BASE;

export type DefenseDamageOpts = {
  /** Autoriser 0 dégât (ennemis) ; joueurs gardent un plancher de 1. */
  allowZero?: boolean;
};

/** Clamp Défense ≥ 0. */
export function clampDefense(defense: number): number {
  return Math.max(0, defense);
}

/**
 * Réduction de dégâts (0 → MAX_DAMAGE_REDUCTION).
 * Source unique : joueurs, ennemis, Mini-Boss, boss et UI.
 */
export function calcDamageReduction(defense: number): number {
  const d = clampDefense(defense);
  if (d <= 0) return 0;

  const logX = Math.log1p(d / DEFENSE_LOG_BASE);
  if (logX <= 0) return 0;

  const powered = Math.pow(logX, DEFENSE_LOG_POWER);
  const denom = powered + Math.pow(DEFENSE_LOG_OFFSET, DEFENSE_LOG_POWER) + DEFENSE_LOG_QUAD * logX * logX;
  if (denom <= 0) return 0;

  return Math.min(MAX_DAMAGE_REDUCTION, MAX_DAMAGE_REDUCTION * (powered / denom));
}

/** Multiplicateur de dégâts après Défense (1 = aucune réduction). */
export function calcDefenseDamageMultiplier(defense: number): number {
  return 1 - calcDamageReduction(defense);
}

/** Applique la réduction Défense à un montant de dégâts entrants. */
export function applyDefenseReduction(
  amount: number,
  defense: number,
  opts: DefenseDamageOpts = {},
): number {
  if (amount <= 0) return 0;
  const mult = calcDefenseDamageMultiplier(defense);
  const out = amount * mult;
  return opts.allowZero ? Math.max(0, out) : Math.max(1, out);
}

/** Défense totale du joueur (base + constellation/fragments + Sang de Titan). */
export function getPlayerDefense(): number {
  const base = STATE.stats.defense ?? 10;
  const titan = STATE.stats.titanDefBonus || 0;
  const guardian = Globals.player?._guardianDefBonus || 0;
  return clampDefense(Math.floor(base + titan + guardian));
}

/** Défense d'une cible ennemie. */
export function getEnemyDefense(enemy: { defense?: number } | null | undefined): number {
  return clampDefense(Math.floor(enemy?.defense || 0));
}

/** Pourcentage de réduction affiché — identique au calcul combat (2 décimales). */
export function formatDefenseReductionPct(defense: number): string {
  return (calcDamageReduction(defense) * 100).toFixed(2);
}
