// @ts-nocheck
/** Règles combat Mini-Boss — overshield, immunités, tiers, pipeline dégâts. */

import { applyDefenseReduction, getEnemyDefense } from '@/gameplay/combat/defense';
import { triggerMiniBossShieldFlash } from './mini_boss_ui';
import type { MiniBossAggregatedStats } from './mini_boss_tiers';
import { createDamageText } from '@/visual/effects';

export * from './mini_boss_combat_core';

import {
  getMaxOvershieldHp,
  getOvershieldHp,
  setOvershield,
  MINI_BOSS_GLOBAL_DAMAGE_MULT,
} from './mini_boss_combat_core';

export function resolveMiniBossOutgoingDamage(
  enemy: {
    isMiniBoss?: boolean;
    miniBossStats?: MiniBossAggregatedStats | null;
    hp?: number;
    maxHp?: number;
  },
  baseDamage: number,
  target?: { hp?: number; maxHp?: number } | null,
  opts: { isAbility?: boolean } = {},
): { damage: number; isCrit: boolean; lifeStealHeal: number } {
  if (!enemy.isMiniBoss || !enemy.miniBossStats) {
    return { damage: baseDamage, isCrit: false, lifeStealHeal: 0 };
  }

  const s = enemy.miniBossStats;
  let dmg = baseDamage * s.damageMult;

  if (opts.isAbility && s.abilityDamageMult > 1) {
    dmg *= s.abilityDamageMult;
  }
  if (s.accuracyBonus > 0) {
    dmg *= 1 + s.accuracyBonus;
  }

  let isCrit = Math.random() < s.critChance;
  if (isCrit) dmg *= s.critDmgMult;

  if (s.lowHpDmgScale > 0 && enemy.maxHp && enemy.maxHp > 0) {
    const missing = 1 - (enemy.hp ?? enemy.maxHp) / enemy.maxHp;
    dmg *= 1 + missing * s.lowHpDmgScale;
  }

  if (target && s.executeThreshold > 0 && target.maxHp && target.maxHp > 0) {
    const hpRatio = (target.hp ?? target.maxHp) / target.maxHp;
    if (hpRatio <= s.executeThreshold) dmg *= 1 + s.executeBonus;
  }

  dmg *= MINI_BOSS_GLOBAL_DAMAGE_MULT;

  const lifeStealHeal = s.lifeSteal > 0 ? dmg * s.lifeSteal : 0;
  return { damage: Math.max(1, Math.floor(dmg)), isCrit, lifeStealHeal };
}

/** Applique la vulnérabilité Abyssal sur la cible touchée. */
export function applyAbyssalCorruptionOnHit(
  target: { _abyssalVulnUntil?: number; _abyssalVulnMult?: number },
  effectDurationMult = 1,
): void {
  if (!target) return;
  const durMs = Math.floor(3500 * Math.max(1, effectDurationMult));
  target._abyssalVulnUntil = Date.now() + durMs;
  target._abyssalVulnMult = 1.1;
}

export function applyMiniBossIncomingDamage(
  enemy: {
    isMiniBoss?: boolean;
    miniBossStats?: MiniBossAggregatedStats | null;
    _gardienBuffUntil?: number;
  },
  amount: number,
  opts: { isRanged?: boolean } = {},
): number {
  let dmg = Math.max(0, amount);
  if (!enemy.isMiniBoss || !enemy.miniBossStats) return dmg;

  const s = enemy.miniBossStats;
  const enemyDef = getEnemyDefense(enemy) || s.defense || 0;
  if (enemyDef > 0) dmg = applyDefenseReduction(dmg, enemyDef, { allowZero: true });
  if (enemy._gardienBuffUntil && Date.now() < enemy._gardienBuffUntil && s.gardienBuff > 0) {
    dmg *= 1 - s.gardienBuff;
  }
  if (opts.isRanged && s.rangedReduction > 0) dmg *= 1 - s.rangedReduction;
  if (s.smallHitThreshold > 0 && dmg < s.smallHitThreshold) {
    dmg *= 1 - s.smallHitReduction;
  }
  return Math.max(0, dmg);
}

export function tickMiniBossCombat(
  enemy: {
    isMiniBoss?: boolean;
    miniBossStats?: MiniBossAggregatedStats | null;
    hp?: number;
    maxHp?: number;
    dead?: boolean;
    _antiHealUntil?: number;
    _miniBossCombatTimers?: { shieldPulse: number; gardien: number };
  },
  dt: number,
): void {
  if (!enemy.isMiniBoss || !enemy.miniBossStats || enemy.dead) return;

  if (!enemy._miniBossCombatTimers) {
    enemy._miniBossCombatTimers = { shieldPulse: 0, gardien: 0 };
  }
  const timers = enemy._miniBossCombatTimers;
  const s = enemy.miniBossStats;
  const antiHeal = !!(enemy._antiHealUntil && Date.now() < enemy._antiHealUntil);

  if (s.regenPerSec > 0 && enemy.maxHp && !antiHeal) {
    enemy.hp = Math.min(enemy.maxHp, (enemy.hp ?? 0) + s.regenPerSec * dt);
  }

  if (s.overshieldPulse > 0 && s.overshieldPulseInterval > 0) {
    timers.shieldPulse += dt;
    if (timers.shieldPulse >= s.overshieldPulseInterval) {
      timers.shieldPulse = 0;
      const maxShield = getMaxOvershieldHp(enemy);
      if (maxShield > 0) {
        const add = Math.floor(maxShield * s.overshieldPulse);
        const cur = getOvershieldHp(enemy);
        setOvershield(enemy, Math.min(maxShield, cur + add), maxShield);
      }
    }
  }

  if (s.gardienBuff > 0 && s.gardienInterval > 0) {
    timers.gardien += dt;
    if (timers.gardien >= s.gardienInterval) {
      timers.gardien = 0;
      enemy._gardienBuffUntil = Date.now() + 4000;
    }
  }
}

export function absorbOvershieldDamage(
  enemy: {
    overshieldHp?: number;
    maxOvershieldHp?: number;
    barrierHp?: number;
    maxBarrierHp?: number;
    position?: THREE.Vector3;
    isMiniBoss?: boolean;
  },
  amount: number,
): number {
  let remaining = Math.max(0, amount);
  const shield = getOvershieldHp(enemy);
  if (shield <= 0 || remaining <= 0) return remaining;

  const absorbed = Math.min(shield, remaining);
  const next = shield - absorbed;
  setOvershield(enemy, next, getMaxOvershieldHp(enemy));
  remaining -= absorbed;

  if (absorbed > 0) {
    if (enemy.isMiniBoss) triggerMiniBossShieldFlash(enemy);
    if (enemy.position) {
      const color = enemy.isMiniBoss ? '#5dade2' : '#a855f7';
      createDamageText(Math.floor(absorbed), enemy.position, color);
    }
  }
  return remaining;
}
