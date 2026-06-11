// @ts-nocheck
/** Effets de Convergence stellaire (centre constellation) — gameplay uniquement. */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { createDamageText, createSkillVisual, spawnParticles } from '@/visual/effects';

function rank(key: string): number {
  return (STATE.passives?.[key] as number) || 0;
}

function passives() {
  if (!STATE.passives) STATE.passives = {};
  return STATE.passives as Record<string, unknown>;
}

const PARADOX_STAT_KEYS = ['atk', 'maxHp', 'speed', 'crit', 'critDmg', 'def', 'regen', 'lifesteal'] as const;

export const ConvergenceEffects = {
  // ——— Pacificateur : Méga-Critique ———
  applyPacifierConvergenceStats() {
    if (rank('bloodPact') < 2) return;
    STATE.stats.critDmg = (STATE.stats.critDmg || 1.5) + 0.45;
  },

  getPacifierShotIndex(player: { _convergenceShotIndex?: number }): number {
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

  // ——— Guerrier : Parade réfléchissante ———
  calcParryReflectDamage(blocked: number): number {
    if (rank('runicColossus') < 2) return 0;
    const def = STATE.stats.def || 0;
    return blocked * 0.3 + def * 0.05;
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
    const missingPct = Math.max(0, 1 - player.hp / Math.max(1, player.maxHp));
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
    return rank('continuumMastery') >= 2;
  },

  getFractureMax(): number {
    return this.hasRefinedPrisms() ? 150 : 100;
  },

  getFractureDamageMult(fractureGauge: number): number {
    if (!this.hasRefinedPrisms()) return 1;
    return 1 + (fractureGauge / 100) * 0.33;
  },

  getPrismBeamDmgMult(prismDepth: number): number {
    if (!this.hasRefinedPrisms() || prismDepth <= 0) return 1;
    return Math.pow(0.8, prismDepth);
  },

  getPrismCritMods(prismDepth: number): { forceCrit: boolean; critDmgMult: number } {
    if (!this.hasRefinedPrisms() || prismDepth <= 0) {
      return { forceCrit: false, critDmgMult: 1 };
    }
    return { forceCrit: true, critDmgMult: 0.75 };
  },

  getMaxRefinedPrisms(): number {
    return this.hasRefinedPrisms() ? 3 : Infinity;
  },

  // ——— Éclipse : Fenêtre Cataclysme ———
  onEclipseCataclysm(player: {
    position: THREE.Vector3;
    _empoweredAttacksLeft?: number;
    _cataclysmHasteUntil?: number;
    attackSpeedMod?: number;
  }) {
    if (rank('celestialConvergence') < 2 || !player) return;
    player._empoweredAttacksLeft = 6;
    player._cataclysmHasteUntil = Date.now() + 5000;
    createDamageText('FENÊTRE CATACLYSME', player.position, '#ffffff');
    createSkillVisual('shockwave', player.position, 5, 0xffffff);
  },

  getEclipseAttackSpeedMult(player: { _cataclysmHasteUntil?: number }): number {
    if (!player?._cataclysmHasteUntil || Date.now() > player._cataclysmHasteUntil) return 1;
    return rank('celestialConvergence') >= 2 ? 1.5 : 1;
  },

  consumeEmpoweredAttack(player: { _empoweredAttacksLeft?: number }): boolean {
    if (!player || (player._empoweredAttacksLeft || 0) <= 0) return false;
    player._empoweredAttacksLeft -= 1;
    return true;
  },

  applyCataclysmVulnerability(enemy: { _cataclysmVuln?: boolean }) {
    if (!enemy || rank('celestialConvergence') < 2) return;
    enemy._cataclysmVuln = true;
  },

  getCataclysmVulnMult(enemy: { _cataclysmVuln?: boolean }): number {
    return enemy?._cataclysmVuln && rank('celestialConvergence') >= 2 ? 1.25 : 1;
  },
};
