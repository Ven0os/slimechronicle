// @ts-nocheck
import * as THREE from 'three';
import { STATE } from '../../core/config';

export const SAFE_ZONE_RADIUS = 18;
export const WILD_SPAWN_MIN = 28;
export const WILD_SPAWN_MAX = 88;

export const BOSS_ZONE = {
  id: 'boss',
  label: 'Sanctuaire du Roi',
  cx: 0,
  cz: -72,
  radius: 22,
  ground: 0x2a1018,
};

export interface MobSpawnType {
  id: string;
  mobs: string[];
  weight: number;
  minLevel?: number;
  miniBoss?: string;
}

export const MOB_SPAWN_POOL: MobSpawnType[] = [
  { id: 'rogue', mobs: ['rogue'], weight: 1, miniBoss: 'verdant_stalker' },
  { id: 'sentinel', mobs: ['sentinel'], weight: 1, miniBoss: 'iron_warden' },
  { id: 'warlock', mobs: ['warlock'], weight: 1, miniBoss: 'arcane_herald' },
  { id: 'corrupted', mobs: ['corrupted'], weight: 0.55, minLevel: 2, miniBoss: 'corrupt_warden' },
];

export function distToSafeZone(pos: THREE.Vector3): number {
  // Distance approximative par rapport aux bordures de la carte
  const xDist = Math.max(0, 80 - Math.abs(pos.x));
  const zDist = Math.max(0, 80 - Math.abs(pos.z));
  return Math.min(xDist, zDist);
}

export function isInSafeZone(pos: THREE.Vector3): boolean {
  // Zone sûre uniquement sur la plateforme de spawn de rayon 12 centrée à (90, 90)
  const dx = pos.x - 90;
  const dz = pos.z - 90;
  return Math.hypot(dx, dz) < 12;
}

export function getGroundLevelAt(pos: THREE.Vector3 | { x: number, z: number }): number {
  const dx = pos.x - 90;
  const dz = pos.z - 90;
  const dist = Math.hypot(dx, dz);
  return (dist < 12 && !STATE.leftSafeZone) ? 4.0 : 0.0;
}

export function isInBossZone(pos: THREE.Vector3): boolean {
  return Math.hypot(pos.x - BOSS_ZONE.cx, pos.z - BOSS_ZONE.cz) < BOSS_ZONE.radius;
}

export function isNoMobZone(pos: THREE.Vector3): boolean {
  return isInSafeZone(pos) || isInBossZone(pos);
}

export function isValidEventPos(pos: THREE.Vector3): boolean {
  return !isInSafeZone(pos) && !isInBossZone(pos);
}

export function pickMobSpawnType(level = 1): MobSpawnType {
  const pool = MOB_SPAWN_POOL.filter((z) => !z.minLevel || level >= z.minLevel);
  const total = pool.reduce((s, z) => s + z.weight, 0);
  let roll = Math.random() * total;
  for (const z of pool) {
    roll -= z.weight;
    if (roll <= 0) return z;
  }
  return pool[0];
}

export const pickSpawnZone = pickMobSpawnType;

export function randomWildSpawnPos(): THREE.Vector3 {
  // Mobs spawner dans la zone de combat (région centrale, x/z entre -75 et 75)
  for (let i = 0; i < 32; i++) {
    const x = (Math.random() - 0.5) * 150;
    const z = (Math.random() - 0.5) * 150;
    const pos = new THREE.Vector3(x, 0, z);
    if (!isNoMobZone(pos)) return pos;
  }
  return new THREE.Vector3(0, 0, 0);
}

export function pushOutOfSafeZone(pos: THREE.Vector3): boolean {
  // Si le joueur/monstre a quitté la safe zone, on l'empêche de remonter la falaise (rayon 12)
  const dx = pos.x - 90;
  const dz = pos.z - 90;
  const dist = Math.hypot(dx, dz);
  const safeRadius = 12;
  if (dist < safeRadius && dist > 0.001) {
    const overlap = safeRadius - dist;
    pos.x -= (dx / dist) * overlap;
    pos.z -= (dz / dist) * overlap;
    return true;
  }
  return false;
}

export function pushOutOfCircle(pos: THREE.Vector3, cx: number, cz: number, radius: number): boolean {
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const d = Math.hypot(dx, dz);
  if (d >= radius || d < 0.001) return false;
  const s = radius / d;
  pos.x = cx + dx * s;
  pos.z = cz + dz * s;
  return true;
}
