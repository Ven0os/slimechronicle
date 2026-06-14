import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { PassiveKeystoneHooks } from '@/systems/passiveKeystoneHooks';
import { createDamageText, createSkillVisual, spawnParticles } from '@/visual/effects';
import { dealDamageToEnemy } from '@/gameplay/combat/damage_helpers';
import { canApplyGameplay, canDealDamageDirectly } from '@/multiplayer/net_authority';

export const RUPTURE_ASTRALE_NODE_ID = 'eclipse-orbite-10';
export const ECLIPSE_CATACLYSM_WINDOW_MS = 8000;
export const RUPTURE_STACK_MAX = 4;
export const RUPTURE_LANCE_DMG_RATIO = 0.8;
export const CATACLYSM_RUPTURE_DMG_MULT = 1.5;
export const LUNAR_FRAGILITY_MS = 4000;
export const LUNAR_FRAGILITY_DMG_MULT = 1.1;
export const RUPTURE_ENERGY_GAIN = 15;

export function hasRuptureAstrale(): boolean {
  const rank = ConstellationEngine.getPassiveRank('ruptureAstrale');
  if (rank > 0) return true;
  if (!ConstellationEngine.isNodeUnlocked(RUPTURE_ASTRALE_NODE_ID)) return false;
  ConstellationEngine.ensureKeystonePassive('ruptureAstrale', RUPTURE_ASTRALE_NODE_ID);
  return ConstellationEngine.getPassiveRank('ruptureAstrale') > 0;
}

export function isEclipseCataclysmWindow(player: { _cataclysmWindowUntil?: number } | null | undefined): boolean {
  return !!(player?._cataclysmWindowUntil && Date.now() < player._cataclysmWindowUntil);
}

export function openEclipseCataclysmWindow(player: { _cataclysmWindowUntil?: number }): void {
  player._cataclysmWindowUntil = Date.now() + ECLIPSE_CATACLYSM_WINDOW_MS;
}

export function canEclipseDisplaceEnemy(enemy: { dead?: boolean; isBoss?: boolean; isMiniBoss?: boolean } | null | undefined): boolean {
  return !!enemy && !enemy.dead && !enemy.isBoss && !enemy.isMiniBoss;
}

export function getLunarFragilityMult(enemy: { _lunarFragilityUntil?: number } | null | undefined): number {
  if (!enemy?._lunarFragilityUntil || Date.now() >= enemy._lunarFragilityUntil) return 1;
  return LUNAR_FRAGILITY_DMG_MULT;
}

export function applyLunarFragility(enemy: { _lunarFragilityUntil?: number }): void {
  enemy._lunarFragilityUntil = Date.now() + LUNAR_FRAGILITY_MS;
}

function applySolarHitEffects(
  enemy: { dead?: boolean; position?: THREE.Vector3 },
  player: { _solarSparks?: number; position?: THREE.Vector3 } | null | undefined,
): void {
  const sunMods = PassiveKeystoneHooks.getDevouringSunMods();
  const burnDmg = STATE.stats.atk * 0.2 * sunMods.burnDmgMult;
  for (let t = 0; t < sunMods.burnTicks; t++) {
    const delay = sunMods.burnStartMs + t * sunMods.burnIntervalMs;
    setTimeout(() => {
      if (!enemy.dead && canApplyGameplay()) {
        dealDamageToEnemy(enemy, burnDmg, { pos: enemy.position, noCrit: true, skillKey: 'primary' });
        createDamageText('FEU', enemy.position, '#ffa500');
        PassiveKeystoneHooks.onEclipseBurnTick(player);
      }
    }, delay);
  }
}

function applyLunarHitEffects(
  player: { isLocalPlayer?: () => boolean; heal?: (n: number) => void; position?: THREE.Vector3 },
  empMult = 1,
): void {
  if (player.isLocalPlayer?.() && Math.random() < 0.5) {
    player.heal?.(STATE.stats.atk * 0.1 * empMult);
    createDamageText('+HP', player.position, '#00ff00');
  }
}

export function triggerRuptureAstrale(
  player: {
    position: THREE.Vector3;
    eclipse?: { sun: number; moon: number };
    isLocalPlayer?: () => boolean;
    heal?: (n: number) => void;
    cooldowns?: Record<string, number>;
  },
  dir: THREE.Vector3,
): void {
  if (!hasRuptureAstrale() || !canDealDamageDirectly()) return;

  const sunMods = PassiveKeystoneHooks.getDevouringSunMods();
  const range = 3.5 * sunMods.spearRangeMult;
  const threshold = 0.4;
  const flatDir = dir.clone();
  flatDir.y = 0;
  if (flatDir.lengthSq() < 0.001) flatDir.set(0, 0, 1);
  flatDir.normalize();

  const cataclysm = isEclipseCataclysmWindow(player);
  const dmgRatio = RUPTURE_LANCE_DMG_RATIO * (cataclysm ? CATACLYSM_RUPTURE_DMG_MULT : 1);
  let hitCount = 0;

  Globals.enemies?.forEach((e) => {
    if (e.dead) return;
    const toE = e.position.clone().sub(player.position);
    toE.y = 0;
    const dist = toE.length();
    if (dist > range) return;
    toE.normalize();
    if (flatDir.dot(toE) < threshold) return;

    const damage = STATE.stats.atk * dmgRatio * getLunarFragilityMult(e);
    dealDamageToEnemy(e, damage, { pos: e.position, skillKey: 'primary' });
    applySolarHitEffects(e, player);
    applyLunarHitEffects(player);
    PassiveKeystoneHooks.onRuptureAstraleEnemyHit(player, e, cataclysm);
    spawnParticles(e.position, 0xaa00ff, 8);
    hitCount++;
  });

  if (player.eclipse && hitCount > 0) {
    player.eclipse.sun = Math.min(100, player.eclipse.sun + RUPTURE_ENERGY_GAIN);
    player.eclipse.moon = Math.min(100, player.eclipse.moon + RUPTURE_ENERGY_GAIN);
  }

  createDamageText('RUPTURE ASTRALE', player.position, '#c39bd3');
  createSkillVisual('shockwave', player.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 3.5, 0xaa00ff);
}

/** Incrémente les stacks de lance ; à 4 déclenche la rupture et repasse à 0. */
export function incrementRuptureLanceStack(
  player: {
    _ruptureStacks?: number;
    position: THREE.Vector3;
    eclipse?: { sun: number; moon: number };
    isLocalPlayer?: () => boolean;
    heal?: (n: number) => void;
    cooldowns?: Record<string, number>;
  },
  dir: THREE.Vector3,
): void {
  if (!hasRuptureAstrale()) return;

  const next = (player._ruptureStacks || 0) + 1;
  if (next >= RUPTURE_STACK_MAX) {
    player._ruptureStacks = 0;
    triggerRuptureAstrale(player, dir);
    return;
  }
  player._ruptureStacks = next;
}

/** Aspiration / élévation Pic de Lune — uniquement sous fenêtre Cataclysme, jamais sur boss/mini-boss. */
export function applyPicDeLuneDisplacement(
  enemy: { position: THREE.Vector3; dead?: boolean; isBoss?: boolean; isMiniBoss?: boolean },
  targetPos: THREE.Vector3,
  player: { _cataclysmWindowUntil?: number },
): void {
  if (!isEclipseCataclysmWindow(player) || !canEclipseDisplaceEnemy(enemy)) return;

  const pull = targetPos.clone().sub(enemy.position);
  pull.y = 0;
  if (pull.lengthSq() > 0.01) {
    pull.normalize().multiplyScalar(0.85);
    enemy.position.add(pull);
  }
  enemy.position.y += 0.35;
}
