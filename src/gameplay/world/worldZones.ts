// @ts-nocheck
import * as THREE from 'three';
import { STATE } from '../../core/config';

export const SAFE_ZONE_RADIUS = 18;
export const WILD_SPAWN_MIN = 28;
export const WILD_SPAWN_MAX = 88;

export const BOSS_ZONE = {
  id: 'boss',
  label: 'Sanctuaire du Roi',
  cx: -90,
  cz: -90,
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

export function getPlayableRadiusAt(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const borderNoise = Math.sin(angle * 5) * 12 + Math.cos(angle * 3) * 6;
  return 112 + borderNoise; // Coastal playable limit in shallow water
}

// Constantes hissées hors de getGroundLevelAt : la fonction est appelée des dizaines
// de fois par frame (joueur + chaque ennemi), on évite l'allocation de ces tableaux à chaque appel.
const GROUND_REGIONS = [
  { id: 'mountain', cx: 80, cz: 80, weight: 1.0 },
  { id: 'cold', cx: -60, cz: 60, weight: 1.0 },
  { id: 'desert', cx: -60, cz: -60, weight: 1.0 },
  { id: 'temperate', cx: 10, cz: -20, weight: 2.2 },
] as const;
const groundWeights = new Array(GROUND_REGIONS.length).fill(0);

export function getGroundLevelAt(pos: THREE.Vector3 | { x: number, z: number }): number {
  const dx = pos.x - 90;
  const dz = pos.z - 90;
  const dist = Math.hypot(dx, dz);
  if (dist < 12 && !STATE.leftSafeZone) return 4.0;
  
  const x = pos.x;
  const z = pos.z;

  // Boss platform height (flat with surrounding desert)
  const distToBoss = Math.hypot(x - BOSS_ZONE.cx, z - BOSS_ZONE.cz);
  if (distToBoss < BOSS_ZONE.radius) {
    return 0.0;
  }
  
  // 1. Organic, wavy region distortion
  const noiseX = Math.sin(z * 0.15) * 8.0;
  const noiseZ = Math.cos(x * 0.15) * 8.0;
  const distValX = x + noiseX;
  const distValZ = z + noiseZ;
  
  let totalWeight = 0;
  for (let i = 0; i < GROUND_REGIONS.length; i++) {
    const r = GROUND_REGIONS[i];
    const rdx = distValX - r.cx;
    const rdz = distValZ - r.cz;
    const distVal = Math.hypot(rdx, rdz);
    const score = distVal / r.weight;
    const w = 1.0 / Math.pow(score + 0.1, 9.0); // Power 9.0 for very marked biome changes!
    groundWeights[i] = w;
    totalWeight += w;
  }
  
  let baseHeight = 0.0;
  for (let i = 0; i < GROUND_REGIONS.length; i++) {
    const wNorm = groundWeights[i] / totalWeight;
    let rh = 0.0;
    if (GROUND_REGIONS[i].id === 'mountain') {
      rh = 1.4 * (Math.sin(x * 0.08) * Math.cos(z * 0.08)) + 0.5 * Math.sin(x * 0.2);
    } else if (GROUND_REGIONS[i].id === 'desert') {
      rh = 0.8 * Math.sin(x * 0.06 + z * 0.06);
    } else if (GROUND_REGIONS[i].id === 'cold') {
      rh = 0.6 * (Math.sin(x * 0.07) + Math.cos(z * 0.07));
    } else {
      rh = 0.25 * Math.sin(x * 0.04) * Math.cos(z * 0.04);
    }
    baseHeight += rh * wNorm;
  }
  
  // 2. Flattening factors for boss and spawn platform areas
  let flattenFactor = 1.0;
  if (distToBoss < 30) {
    flattenFactor = Math.min(1.0, Math.max(0.0, (distToBoss - 18) / 12));
  }
  const distToSpawn = Math.hypot(x - 90, z - 90);
  if (distToSpawn < 25) {
    flattenFactor = Math.min(flattenFactor, Math.max(0.0, (distToSpawn - 12) / 13));
  }
  
  let finalHeight = baseHeight * flattenFactor;
  
  // 3. Slope down at shorelines (non-square, organic boundary)
  const distFromCenter = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const borderNoise = Math.sin(angle * 5) * 12 + Math.cos(angle * 3) * 6;
  const shoreStart = 95 + borderNoise;
  const shoreEnd = 118 + borderNoise;
  
  if (distFromCenter > shoreStart) {
    let factor = Math.min(1.0, (distFromCenter - shoreStart) / (shoreEnd - shoreStart));
    
    // Atténuer la pente vers la mer autour du spawn de (90, 90) pour qu'il y ait de la terre ferme dessous
    const distToSpawn = Math.hypot(x - 90, z - 90);
    if (distToSpawn < 30) {
      const spawnFactor = Math.max(0.0, (distToSpawn - 12) / 18);
      factor *= spawnFactor;
    }
    
    // Atténuer la pente vers la mer autour de la zone du boss de (-90, -90) pour qu'il y ait de la terre ferme dessous
    const distToBoss = Math.hypot(x - BOSS_ZONE.cx, z - BOSS_ZONE.cz);
    if (distToBoss < 30) {
      const bossFactor = Math.max(0.0, (distToBoss - 22) / 8);
      factor *= bossFactor;
    }
    
    finalHeight = finalHeight + (-4.5 - finalHeight) * Math.pow(factor, 1.5);
  }
  
  return finalHeight;
}

export function getRegionAt(x: number, z: number): 'mountain' | 'cold' | 'desert' | 'temperate' {
  // Wavy distortion to break symmetry
  const noiseX = Math.sin(z * 0.15) * 8.0;
  const noiseZ = Math.cos(x * 0.15) * 8.0;
  const distValX = x + noiseX;
  const distValZ = z + noiseZ;

  let bestId = 'temperate';
  let minScore = Infinity;
  
  for (const r of GROUND_REGIONS) {
    const dx = distValX - r.cx;
    const dz = distValZ - r.cz;
    const distVal = Math.hypot(dx, dz);
    const score = distVal / r.weight;
    if (score < minScore) {
      minScore = score;
      bestId = r.id;
    }
  }
  
  return bestId as 'mountain' | 'cold' | 'desert' | 'temperate';
}

export function getRegionColorAt(x: number, z: number): THREE.Color {
  // Le sol de la zone du boss doit être entièrement en sable
  const distToBoss = Math.hypot(x - BOSS_ZONE.cx, z - BOSS_ZONE.cz);
  if (distToBoss < BOSS_ZONE.radius + 6.0) {
    return new THREE.Color(0xdfc593); // Sand yellow
  }

  // Wavy distortion to break symmetry
  const noiseX = Math.sin(z * 0.15) * 8.0;
  const noiseZ = Math.cos(x * 0.15) * 8.0;
  const distValX = x + noiseX;
  const distValZ = z + noiseZ;

  const regions = [
    { id: 'mountain', cx: 80, cz: 80, weight: 1.0, color: new THREE.Color(0x323b49) }, // Slate/mountain grey-blue
    { id: 'cold', cx: -60, cz: 60, weight: 1.0, color: new THREE.Color(0xe0ecef) }, // Snowy/icy white-blue
    { id: 'desert', cx: -60, cz: -60, weight: 1.0, color: new THREE.Color(0xdfc593) }, // Sandy yellow
    { id: 'temperate', cx: 10, cz: -20, weight: 2.2, color: new THREE.Color(0x1fb53a) } // Green is much greener! (0x1fb53a)
  ];
  
  let totalWeight = 0;
  const weights: number[] = [];
  
  for (const r of regions) {
    const dx = distValX - r.cx;
    const dz = distValZ - r.cz;
    const distVal = Math.hypot(dx, dz);
    const score = distVal / r.weight;
    const w = 1.0 / Math.pow(score + 0.1, 9.0); // Power 9.0 for very marked biome changes!
    weights.push(w);
    totalWeight += w;
  }
  
  const finalColor = new THREE.Color(0, 0, 0);
  for (let i = 0; i < regions.length; i++) {
    const wNorm = weights[i] / totalWeight;
    finalColor.r += regions[i].color.r * wNorm;
    finalColor.g += regions[i].color.g * wNorm;
    finalColor.b += regions[i].color.b * wNorm;
  }
  
  return finalColor;
}

export function isInBossZone(pos: THREE.Vector3): boolean {
  return Math.hypot(pos.x - BOSS_ZONE.cx, pos.z - BOSS_ZONE.cz) < BOSS_ZONE.radius;
}

export function isNoMobZone(pos: THREE.Vector3): boolean {
  // Prevent mob spawning in safe zone, boss zone, or deep underwater (where Y < -1.0)
  return isInSafeZone(pos) || isInBossZone(pos) || getGroundLevelAt(pos) < -1.0;
}

export function isValidEventPos(pos: THREE.Vector3): boolean {
  return !isInSafeZone(pos) && !isInBossZone(pos) && getGroundLevelAt(pos) >= -1.0;
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
  // Mobs spawn inside the circular combat area (r up to 100) avoiding safe zones, boss zones, and deep sea
  for (let i = 0; i < 64; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 100;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
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
