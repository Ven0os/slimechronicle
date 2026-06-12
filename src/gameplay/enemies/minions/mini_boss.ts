// @ts-nocheck

import {
  grantMiniBossOvershield,
  MINI_BOSS_HP_MULT,
  MINI_BOSS_OVERSHIELD_RATIO,
  MINI_BOSS_SPEED_MULT,
  MINI_BOSS_GLOBAL_DURABILITY_MULT,
} from './mini_boss_combat_core';
import { setupMiniBossUi } from './mini_boss_ui';
import {
  applyMiniBossTierState,
  dedupeMiniBossTiers,
  normalizeMiniBossTiers,
  rollMiniBossTiers,
  type MiniBossTierId,
} from './mini_boss_tiers';

const MINI_BOSS_STYLES: Record<
  string,
  { color: number; emissive: number; scale: number; label: string }
> = {
  verdant_stalker: { color: 0x1e5631, emissive: 0x27ae60, scale: 1.35, label: 'Traqueur' },
  iron_warden: { color: 0x566573, emissive: 0xbdc3c7, scale: 1.38, label: 'Gardien de fer' },
  arcane_herald: { color: 0x5b2c6f, emissive: 0x9b59b6, scale: 1.35, label: 'Héraut arcanique' },
  corrupt_warden: { color: 0x2e1065, emissive: 0xa855f7, scale: 1.4, label: 'Gardien corrompu' },
};

export type MiniBossApplyOpts = {
  fromNetwork?: boolean;
  maxHp?: number;
  overshieldHp?: number;
  maxOvershieldHp?: number;
  tiers?: MiniBossTierId[] | string;
};

function resolveTiers(miniId: string, opts: MiniBossApplyOpts): MiniBossTierId[] {
  if (opts.tiers) return dedupeMiniBossTiers(normalizeMiniBossTiers(opts.tiers));
  return rollMiniBossTiers(miniId);
}

function applyTierStatsToEnemy(enemy, tiers: MiniBossTierId[], style): void {
  applyMiniBossTierState(enemy, tiers);
  const stats = enemy.miniBossStats;

  enemy.hp = Math.floor(
    enemy.hp * MINI_BOSS_HP_MULT * stats.hpTierMult * (1 + stats.hpBonus) * MINI_BOSS_GLOBAL_DURABILITY_MULT,
  );
  enemy.maxHp = enemy.hp;

  const shieldMult = (1 + stats.overshieldBonus) * MINI_BOSS_GLOBAL_DURABILITY_MULT;
  grantMiniBossOvershield(enemy, MINI_BOSS_OVERSHIELD_RATIO, shieldMult);

  enemy.speed *= MINI_BOSS_SPEED_MULT * stats.speedMult;
  enemy.scaleVal *= style.scale * stats.sizeMult;
  enemy.radius = 1.15 + stats.sizeMult * 0.25;

  const baseXp = Math.floor(35 * 1.25);
  enemy._overrideXp = Math.floor(baseXp * stats.rewardMult);
}

export function applyMiniBossVariant(enemy, miniId: string, opts: MiniBossApplyOpts = {}): void {
  const style = MINI_BOSS_STYLES[miniId] || MINI_BOSS_STYLES.corrupt_warden;
  const tiers = resolveTiers(miniId, opts);

  enemy.isMiniBoss = true;
  enemy.miniBossId = miniId;
  enemy.miniBossName = style.label;

  if (opts.fromNetwork && opts.maxHp != null) {
    enemy.maxHp = opts.maxHp;
    enemy.hp = Math.min(enemy.hp ?? opts.maxHp, opts.maxHp);
    if (opts.maxOvershieldHp != null) {
      enemy.overshieldHp = opts.overshieldHp ?? opts.maxOvershieldHp;
      enemy.maxOvershieldHp = opts.maxOvershieldHp;
      enemy.barrierHp = enemy.overshieldHp;
      enemy.maxBarrierHp = opts.maxOvershieldHp;
    }
    applyMiniBossTierState(enemy, tiers);
  } else {
    applyTierStatsToEnemy(enemy, tiers, style);
  }

  if (enemy.mesh) {
    enemy.mesh.scale.setScalar(enemy.scaleVal);
    enemy.traverse((child) => {
      if (child.isMesh && child.material?.color) {
        child.material = child.material.clone();
        child.material.color.setHex(style.color);
        if (child.material.emissive) {
          child.material.emissive.setHex(style.emissive);
          child.material.emissiveIntensity = 0.32;
        }
      }
    });
  }

  setupMiniBossUi(enemy, {
    name: style.label,
    tiers: enemy.miniBossTiers,
    accentHex: style.emissive,
  });
}

export { rollMiniBossTiers, normalizeMiniBossTiers, applyMiniBossTierState };
