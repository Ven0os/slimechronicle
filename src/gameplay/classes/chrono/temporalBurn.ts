// @ts-nocheck
/** Brûlure Temporelle — DoT appliqué par les rayons routés via prisme (prismDepth > 0). */

import { Globals } from '@/core/globals';
import { dealDamageToEnemy } from '@/gameplay/combat/damage_helpers';
import { canApplyGameplay } from '@/multiplayer/net_authority';
import { createDamageText } from '@/visual/effects';

export const CHRONO_TEMPORAL_BURN = {
  maxStacks: 3,
  duration: 3,
  /** 10 % des dégâts infligés par seconde. */
  dpsRatio: 0.1,
} as const;

type TemporalBurnStack = {
  dps: number;
  remaining: number;
  appliedAt: number;
};

type TemporalBurnState = {
  stacks: TemporalBurnStack[];
};

function getBurnState(enemy: { _chronoTemporalBurn?: TemporalBurnState }): TemporalBurnState {
  if (!enemy._chronoTemporalBurn) {
    enemy._chronoTemporalBurn = { stacks: [] };
  }
  return enemy._chronoTemporalBurn;
}

/** Applique ou rafraîchit un cumul depuis les dégâts réellement infligés (post-crit/DEF). */
export function applyChronoTemporalBurn(
  enemy: { dead?: boolean; position?: THREE.Vector3; _chronoTemporalBurn?: TemporalBurnState },
  dealtDamage: number,
): void {
  if (!enemy || enemy.dead || dealtDamage <= 0) return;
  if (!canApplyGameplay()) return;

  const { maxStacks, duration, dpsRatio } = CHRONO_TEMPORAL_BURN;
  const state = getBurnState(enemy);
  const prevCount = state.stacks.length;
  const stack: TemporalBurnStack = {
    dps: dealtDamage * dpsRatio,
    remaining: duration,
    appliedAt: performance.now(),
  };

  if (state.stacks.length >= maxStacks) {
    let oldestIdx = 0;
    for (let i = 1; i < state.stacks.length; i++) {
      if (state.stacks[i].appliedAt < state.stacks[oldestIdx].appliedAt) {
        oldestIdx = i;
      }
    }
    state.stacks[oldestIdx] = stack;
  } else {
    state.stacks.push(stack);
  }

  if (state.stacks.length > prevCount && enemy.position) {
    createDamageText('BRÛLURE TEMP.', enemy.position, '#ff6600');
  }
}

/** Tick global des cumuls actifs (autorité serveur / solo uniquement). */
export function tickChronoTemporalBurns(dt: number): void {
  if (!canApplyGameplay() || !Globals.enemies?.length) return;

  for (const enemy of Globals.enemies) {
    if (enemy.dead || !enemy._chronoTemporalBurn?.stacks?.length) continue;

    const state = enemy._chronoTemporalBurn;
    for (let i = state.stacks.length - 1; i >= 0; i--) {
      state.stacks[i].remaining -= dt;
      if (state.stacks[i].remaining <= 0) state.stacks.splice(i, 1);
    }
    if (!state.stacks.length) continue;

    let totalDps = 0;
    for (const s of state.stacks) totalDps += s.dps;
    if (totalDps <= 0) continue;

    dealDamageToEnemy(enemy, totalDps * dt, {
      pos: enemy.position,
      noCrit: true,
      skillKey: 'primary',
    });
  }
}
