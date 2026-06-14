// @ts-nocheck
/** Effets de Convergence stellaire (centre constellation) — gameplay uniquement. */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { getPlayerDefense } from '@/gameplay/combat/defense';
import { CHRONO_FRACTURE, CHRONO_SKILLS } from '@/gameplay/classes/chrono/constants';
import {
  getFractureBeamSizeMult as computeFractureBeamSizeMult,
  getFractureDamageMult as computeFractureDamageMult,
  getFractureOverheatAt,
  getMaxFracture as resolveMaxFracture,
  isChronoFractureApexActive,
} from '@/gameplay/classes/chrono/fractureHelpers';
import { createDamageText, createSkillVisual, spawnParticles } from '@/visual/effects';
import { openEclipseCataclysmWindow } from '@/gameplay/classes/eclipse/eclipseRupture';

/** Passif Apex unique par classe — doit correspondre au nœud `{class}-apex`. */
export const APEX_PASSIVE_BY_CLASS: Record<string, string> = {
  warrior: 'runicColossus',
  mage: 'paradoxOverload',
  sentinel: 'solarInspiration',
  blade: 'eternalThirst',
  pacifier: 'bloodPact',
  eclipse: 'celestialConvergence',
  chronoregulator: 'continuumMastery',
};

export function isApexNodeUnlocked(classId = STATE.class): boolean {
  if (!classId) return false;
  return STATE.unlockedNodes?.includes(`${classId}-apex`) ?? false;
}

/** Apex Chronoregent actif : classe chrono + Apex débloqué ou passif continuumMastery ≥ 2. */
export function isChronoApexActive(): boolean {
  return isChronoFractureApexActive();
}

/** Rang effectif du passif Apex : 0 si nœud verrouillé, mauvaise classe, ou rang insuffisant. */
export function getApexPassiveRank(passiveKey: string, classId = STATE.class): number {
  const r = (STATE.passives?.[passiveKey] as number) || 0;
  if (r < 2) return 0;
  if (!classId || APEX_PASSIVE_BY_CLASS[classId] !== passiveKey) return 0;
  if (!isApexNodeUnlocked(classId)) return 0;
  return r;
}

function rank(key: string): number {
  const classId = Globals.player?.className || STATE.class;
  return getApexPassiveRank(key, classId);
}

function passives() {
  if (!STATE.passives) STATE.passives = {};
  return STATE.passives as Record<string, unknown>;
}

const PARADOX_STAT_KEYS = ['atk', 'maxHp', 'speed', 'crit', 'critDmg', 'defense', 'regen', 'lifesteal'] as const;

export const ConvergenceEffects = {
  isChronoApexActive,

  // ——— Pacificateur : Méga-Critique ———
  applyPacifierConvergenceStats() {
    if (rank('bloodPact') < 2) return;
    STATE.stats.critDmg = (STATE.stats.critDmg || 1.5) + 0.45;
  },

  getPacifierShotIndex(player: { _convergenceShotIndex?: number }): number {
    if (STATE.multiplayer.active) {
      return (player?._convergenceShotIndex as number) || 0;
    }
    const idx = player?._convergenceShotIndex || 0;
    if (player) player._convergenceShotIndex = idx + 1;
    return idx;
  },

  isMegaCritShot(shotIndex: number): boolean {
    return rank('bloodPact') >= 2 && (shotIndex + 1) % 3 === 0;
  },

  getMegaCritMult(): number {
    return 1.5;
  },

  getPacifierShotsUntilMegaCrit(player: { _convergenceShotIndex?: number }): number {
    if (rank('bloodPact') < 2) return 0;
    const current = player?._convergenceShotIndex || 0;
    const until = 3 - (current % 3);
    return until === 0 ? 3 : until;
  },

  // ——— Guerrier : Parade réfléchissante ———
  calcParryReflectDamage(blocked: number): number {
    if (rank('runicColossus') < 2) return 0;
    const defense = getPlayerDefense();
    return blocked * 0.3 + defense * 0.05;
  },

  // ——— Mage : Récompense paradoxale ———
  onParadoxKill(player = Globals.player) {
    if (rank('paradoxOverload') < 2 || !player) return;
    const p = passives();
    const kills = ((p._paradoxKillCount as number) || 0) + 1;
    p._paradoxKillCount = kills;

    if (kills % 5 !== 0) return;

    const statKey = PARADOX_STAT_KEYS[Math.floor(Math.random() * PARADOX_STAT_KEYS.length)];
    const bonus = 0.0001 + Math.random() * 0.0008;
    const rewards = (p._paradoxRewards as Record<string, number>) || {};
    rewards[statKey] = (rewards[statKey] || 0) + bonus;
    p._paradoxRewards = rewards;

    if (statKey === 'maxHp') STATE.stats.maxHp = Math.floor(STATE.stats.maxHp * (1 + bonus));
    else if (statKey === 'atk') STATE.stats.atk *= 1 + bonus;
    else if (statKey === 'speed') STATE.stats.speed *= 1 + bonus;
    else STATE.stats[statKey] = (STATE.stats[statKey] || 0) + bonus;

    const label = statKey.toUpperCase();
    const pct = (bonus * 100).toFixed(3);
    createDamageText(`PARADOXE +${pct}%`, player.position, '#3498db');
    createSkillVisual('shockwave', player.position, 4, 0x3498db);
    spawnParticles(player.position, 0x00ffff, 16);
    if (window.UI) window.UI.toast(`${label} +${pct}% (récompense paradoxale)`);
  },

  reapplyParadoxRewards() {
    const rewards = passives()._paradoxRewards as Record<string, number> | undefined;
    if (!rewards || rank('paradoxOverload') < 2) return;
    for (const [key, val] of Object.entries(rewards)) {
      if (key === 'maxHp') STATE.stats.maxHp = Math.floor(STATE.stats.maxHp * (1 + val));
      else if (key === 'atk' || key === 'speed') STATE.stats[key] *= 1 + val;
      else STATE.stats[key] = (STATE.stats[key] || 0) + val;
    }
  },

  // ——— Blade : Soif critique ———
  syncBladeThirstCrit(player: { hp: number; maxHp: number; className?: string }) {
    if (!player || player.className !== 'blade' || rank('eternalThirst') < 2) return;
    let missingPct = Math.max(0, 1 - player.hp / Math.max(1, player.maxHp));
    const earlyBonus = (STATE.passives?.earlyThirst as number) ? 0.3 : 0;
    if (earlyBonus > 0) missingPct = Math.min(1, missingPct + earlyBonus);
    const bonus = missingPct * 0.003;
    const p = passives();
    const baseCrit = (p._bladeBaseCrit as number) ?? STATE.stats.crit;
    const baseCritDmg = (p._bladeBaseCritDmg as number) ?? STATE.stats.critDmg;
    if (p._bladeBaseCrit == null) {
      p._bladeBaseCrit = baseCrit;
      p._bladeBaseCritDmg = baseCritDmg;
    }
    STATE.stats.crit = baseCrit + bonus;
    STATE.stats.critDmg = baseCritDmg + bonus;
  },

  resetBladeThirstCrit() {
    const p = passives();
    if (p._bladeBaseCrit != null) STATE.stats.crit = p._bladeBaseCrit as number;
    if (p._bladeBaseCritDmg != null) STATE.stats.critDmg = p._bladeBaseCritDmg as number;
    delete p._bladeBaseCrit;
    delete p._bladeBaseCritDmg;
  },

  // ——— Chrono : Prismes affinés + Fracture ———
  hasRefinedPrisms(): boolean {
    return isChronoFractureApexActive();
  },

  getFractureMax(): number {
    return resolveMaxFracture();
  },

  getFractureOverheatThreshold(): number {
    return getFractureOverheatAt();
  },

  getFractureDamageMult(fractureGauge: number): number {
    return computeFractureDamageMult(fractureGauge);
  },

  getFractureBeamSizeMult(fractureGauge: number): number {
    return computeFractureBeamSizeMult(fractureGauge);
  },

  getPrismBeamDmgMult(prismDepth: number): number {
    if (!this.hasRefinedPrisms() || prismDepth <= 0) return 1;
    return Math.pow(0.8, prismDepth);
  },

  getMaxRefinedPrisms(): number {
    return this.hasRefinedPrisms() ? 3 : Infinity;
  },

  getLensBaseDuration(): number {
    return CHRONO_SKILLS.lens.baseDuration;
  },

  getLensApexExtension(): number {
    return CHRONO_SKILLS.refinedLens.apexExtension;
  },

  /** Durée initiale d'un nouveau prisme Apex : 5 s + 3,5 s = 8,5 s. */
  getRefinedLensFullDuration(): number {
    return this.getLensBaseDuration() + this.getLensApexExtension();
  },

  /** Durée affichée / initiale selon Apex. */
  getLensDuration(): number {
    return this.hasRefinedPrisms()
      ? this.getRefinedLensFullDuration()
      : this.getLensBaseDuration();
  },

  /**
   * Chaque prisme déjà actif gagne +3,5 s (empilable à chaque nouveau prisme posé).
   * Ne remplace pas la durée restante.
   */
  extendActiveRefinedLenses(lenses: Array<{ timer: number; maxTimer?: number }>) {
    if (!this.hasRefinedPrisms() || !lenses?.length) return;
    const bonus = this.getLensApexExtension();
    for (const lens of lenses) {
      lens.timer += bonus;
      lens.maxTimer = (lens.maxTimer ?? lens.timer) + bonus;
    }
  },

  // ——— Éclipse : fenêtre Cataclysme (combo mêlée) ———
  onEclipseCataclysm(player: { _cataclysmWindowUntil?: number; position?: THREE.Vector3 }) {
    if (!player) return;
    openEclipseCataclysmWindow(player);
    createDamageText('FENÊTRE CATACLYSME', player.position, '#ffffff');
    createSkillVisual('shockwave', player.position, 5, 0xffffff);
  },

  getEclipseAttackSpeedMult(): number {
    return 1;
  },

  consumeEmpoweredAttack(): boolean {
    return false;
  },

  applyCataclysmVulnerability() {},

  getCataclysmVulnMult(): number {
    return 1;
  },
};
