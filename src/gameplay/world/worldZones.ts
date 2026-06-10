// @ts-nocheck
import * as THREE from 'three';

export const SAFE_ZONE_RADIUS = 18;
export const WILD_SPAWN_MIN = SAFE_ZONE_RADIUS + 10;
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
  return Math.hypot(pos.x, pos.z);
}

export function isInSafeZone(pos: THREE.Vector3): boolean {
  return distToSafeZone(pos) < SAFE_ZONE_RADIUS;
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

/** @deprecated alias */
export const pickSpawnZone = pickMobSpawnType;

export function randomWildSpawnPos(): THREE.Vector3 {
  for (let i = 0; i < 32; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = WILD_SPAWN_MIN + Math.random() * (WILD_SPAWN_MAX - WILD_SPAWN_MIN);
    const pos = new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    if (!isNoMobZone(pos)) return pos;
  }
  return new THREE.Vector3(0, 0, WILD_SPAWN_MIN + 6);
}

export function pushOutOfSafeZone(pos: THREE.Vector3): boolean {
  const d = distToSafeZone(pos);
  if (d >= SAFE_ZONE_RADIUS || d < 0.001) return false;
  const scale = SAFE_ZONE_RADIUS / d;
  pos.x *= scale;
  pos.z *= scale;
  return true;
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
