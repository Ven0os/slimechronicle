import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { createDamageText, createSkillVisual, spawnParticles } from '@/visual/effects';
import { dealDamageToEnemy } from '@/gameplay/combat/damage_helpers';
import { canApplyGameplay, canDealDamageDirectly } from '@/multiplayer/net_authority';
import { getEclipseLanceDamageMult, isEclipseCataclysmWindow } from './eclipseRupture';

/** Soleil Vorace — chance d'étincelle sur chaque tick de brûlure. */
export const SOLAR_SPARK_CHANCE = 0.2;
export const SOLAR_SPARK_MAX = 5;
export const SOLAR_EXPLOSION_RATIO = 0.8;
export const LUNAR_TIDE_HEAL_RATIO = 0.25;
export const LANCE_RANGE = 3.5;
export const LANCE_CONE_THRESHOLD = 0.4;

function rank(key: string): number {
  return ConstellationEngine.getPassiveRank(key);
}

/** Soleil Vorace — chance d'étincelle sur chaque tick de brûlure. */
export function onEclipseBurnTick(player: { _solarSparks?: number; position?: THREE.Vector3 } | null | undefined): void {
  if (!player || !rank('devouringSun')) return;
  if (Math.random() >= SOLAR_SPARK_CHANCE) return;
  const next = Math.min(SOLAR_SPARK_MAX, (player._solarSparks || 0) + 1);
  player._solarSparks = next;
  if (player.position) {
    createDamageText('ÉTINCELLE', player.position, '#ffaa00');
  }
}

export function getSolarSparks(player: { _solarSparks?: number }): number {
  if (!rank('devouringSun')) return 0;
  return player._solarSparks || 0;
}

export function shouldTriggerSolarExplosion(player: { _solarSparks?: number }): boolean {
  return rank('devouringSun') > 0 && (player._solarSparks || 0) >= SOLAR_SPARK_MAX;
}

/** Explosion Solaire — 80 % dégâts de lance en cône, consomme les étincelles. */
export function triggerSolarExplosion(
  player: { _solarSparks?: number; position: THREE.Vector3 },
  dir: THREE.Vector3,
): boolean {
  if (!shouldTriggerSolarExplosion(player) || !canDealDamageDirectly()) return false;

  player._solarSparks = 0;
  const flatDir = dir.clone();
  flatDir.y = 0;
  if (flatDir.lengthSq() < 0.001) flatDir.set(0, 0, 1);
  flatDir.normalize();

  Globals.enemies?.forEach((e) => {
    if (e.dead) return;
    const toE = e.position.clone().sub(player.position);
    toE.y = 0;
    const dist = toE.length();
    if (dist > LANCE_RANGE) return;
    toE.normalize();
    if (flatDir.dot(toE) < LANCE_CONE_THRESHOLD) return;

    const damage = STATE.stats.atk * SOLAR_EXPLOSION_RATIO * getEclipseLanceDamageMult(e);
    dealDamageToEnemy(e, damage, { pos: e.position, skillKey: 'primary' });
    spawnParticles(e.position, 0xffaa00, 10);
  });

  createDamageText('EXPLOSION SOLAIRE', player.position, '#ff6600');
  createSkillVisual('shockwave', player.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 3.2, 0xffaa00);
  return true;
}

/** Marée Lunaire — soin sous fenêtre Cataclysme sur dégâts du Pic. */
export function applyLunarTideHeal(
  player: { heal?: (n: number) => void; position?: THREE.Vector3; isLocalPlayer?: () => boolean },
  damageDealt: number,
): void {
  if (!rank('lunarSpike') || !isEclipseCataclysmWindow(player)) return;
  if (!player.isLocalPlayer?.()) return;
  const healAmt = damageDealt * LUNAR_TIDE_HEAL_RATIO;
  if (healAmt <= 0) return;
  player.heal?.(healAmt);
  if (player.position) createDamageText('+HP', player.position, '#a3b1cc');
}
