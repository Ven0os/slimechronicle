// @ts-nocheck
/** Source unique de vérité — plafond, clamp et affichage Fracture Chronoregent. */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { CHRONO_FRACTURE } from './constants';

function isChronoApexNodeUnlocked(): boolean {
  const nodes = STATE.unlockedNodes;
  if (!Array.isArray(nodes)) return false;
  return nodes.some((id) => id === 'chronoregulator-apex');
}

/** Apex Chronoregent actif : nœud débloqué OU passif continuumMastery ≥ 2. */
export function isChronoFractureApexActive(): boolean {
  const cls = Globals.player?.className ?? STATE.class;
  if (cls !== 'chronoregulator') return false;
  if (isChronoApexNodeUnlocked()) return true;
  return ((STATE.passives?.continuumMastery as number) ?? 0) >= 2;
}

/** Plafond Fracture : 100 % par défaut, 150 % avec Apex Chronoregent. */
export function getMaxFracture(): number {
  return isChronoFractureApexActive() ? CHRONO_FRACTURE.apexMax : CHRONO_FRACTURE.max;
}

/** Seuil de surchauffe (= plafond Fracture actuel : 100 ou 150 avec Apex). */
export function getFractureOverheatAt(max = getMaxFracture()): number {
  return max;
}

/** Seuil Surcharge imminente : plafond − 5 (95 à 100 cap, 145 à 150 cap). */
export function getOverloadImminenceThreshold(max = getMaxFracture()): number {
  return max - CHRONO_FRACTURE.overloadWarningBeforeMax;
}

export function clampFracture(gauge: number): number {
  return Math.max(0, Math.min(gauge, getMaxFracture()));
}

/** Remplissage barre UI : 150 Fracture sur max 150 = 100 % de largeur. */
export function getFractureBarFillPct(gauge: number, max = getMaxFracture()): number {
  if (max <= 0) return 0;
  return (Math.min(max, Math.max(0, gauge)) / max) * 100;
}

/** Valeur absolue affichée (75, 100, 150…) — pas le % de remplissage barre. */
export function getFractureDisplayValue(gauge: number, max = getMaxFracture()): number {
  return Math.floor(Math.min(max, Math.max(0, gauge)));
}

/** Surcharge imminente : [max−5, max[ (ex. 95–99 à 100 cap, 145–149 à 150 cap). */
export function isOverloadImminenceActive(gauge: number, max = getMaxFracture()): boolean {
  return gauge >= getOverloadImminenceThreshold(max) && gauge < getFractureOverheatAt(max);
}

/** Fenêtre de relâchement correct (identique à Surcharge imminente). */
export function isInOverloadReleaseWindow(gauge: number, max = getMaxFracture()): boolean {
  return isOverloadImminenceActive(gauge, max);
}

export function isFractureAtOverheat(gauge: number, max = getMaxFracture()): boolean {
  return gauge >= getFractureOverheatAt(max);
}

export type FractureDecayState = {
  /** Temps écoulé depuis la dernière action offensive (s). */
  inactivityTime: number;
};

export function createFractureDecayState(): FractureDecayState {
  return { inactivityTime: 0 };
}

export function resetFractureDecayState(state: FractureDecayState): void {
  state.inactivityTime = 0;
}

/** Vitesse de décroissance en points/s (4 % du plafond actuel). */
export function getFractureDecayPerSecond(max = getMaxFracture()): number {
  return max * CHRONO_FRACTURE.decayPerSecondPct;
}

/** Vrai lorsque la jauge décroît activement (après le délai d'inactivité). */
export function isFractureDecaying(
  gauge: number,
  state: FractureDecayState,
  isAttacking: boolean,
): boolean {
  if (isAttacking || gauge <= 0) return false;
  return state.inactivityTime >= CHRONO_FRACTURE.decayDelay;
}

/**
 * Décroissance Fracture fluide : 1 s d'inactivité, puis −4 % du plafond / s.
 * Équivalent à −2 % toutes les 0,5 s, appliqué frame par frame via dt.
 */
export function tickFractureDecay(
  gauge: number,
  state: FractureDecayState,
  dt: number,
  isAttacking: boolean,
): number {
  if (isAttacking) {
    resetFractureDecayState(state);
    return clampFracture(gauge);
  }
  if (gauge <= 0) {
    resetFractureDecayState(state);
    return 0;
  }

  state.inactivityTime += dt;
  if (state.inactivityTime < CHRONO_FRACTURE.decayDelay) {
    return clampFracture(gauge);
  }

  const decayRate = getFractureDecayPerSecond();
  return clampFracture(gauge - decayRate * dt);
}

/** +0,33 % dégâts par point de Fracture (Apex uniquement). */
export function getFractureDamageMult(gauge: number): number {
  if (!isChronoFractureApexActive()) return 1;
  return 1 + gauge * CHRONO_FRACTURE.apexDmgPerPoint;
}
