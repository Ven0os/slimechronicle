// @ts-nocheck
/** Source unique de vérité — plafond, clamp et affichage Fracture Chronoregent. */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { CHRONO_FRACTURE } from './constants';

/** Apex Chronoregent actif : nœud débloqué OU passif continuumMastery ≥ 2. */
export function isChronoFractureApexActive(): boolean {
  const cls = Globals.player?.className || STATE.class;
  if (cls !== 'chronoregulator') return false;
  if (STATE.unlockedNodes?.includes('chronoregulator-apex')) return true;
  return ((STATE.passives?.continuumMastery as number) ?? 0) >= 2;
}

/** Plafond Fracture : 100 % par défaut, 150 % avec Apex Chronoregent. */
export function getMaxFracture(): number {
  return isChronoFractureApexActive() ? CHRONO_FRACTURE.apexMax : CHRONO_FRACTURE.max;
}

/** Seuil de surchauffe (= plafond effectif). */
export function getFractureOverheatAt(): number {
  return getMaxFracture();
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

/** Fenêtre de rupture volontaire : 85–95 Fracture absolus (indépendant du plafond Apex). */
export function isFractureInRuptureWindow(gauge: number): boolean {
  return gauge >= CHRONO_FRACTURE.ruptureMin && gauge <= CHRONO_FRACTURE.ruptureMax;
}

/** +0,33 % dégâts par point de Fracture (Apex uniquement). */
export function getFractureDamageMult(gauge: number): number {
  if (!isChronoFractureApexActive()) return 1;
  return 1 + gauge * CHRONO_FRACTURE.apexDmgPerPoint;
}
