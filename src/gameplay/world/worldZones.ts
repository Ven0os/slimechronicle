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

export type BiomeId = 'mountain' | 'cold' | 'desert' | 'temperate';

export interface BiomeDefinition {
  id: BiomeId;
  label: string;
  /** Centre d'influence du biome et poids de son rayonnement. */
  cx: number;
  cz: number;
  weight: number;
  /** Couleur du sol, mélangée avec celle des biomes voisins aux frontières. */
  groundColor: THREE.Color;
  /**
   * Seconde teinte du sol, mêlée à la première par plaques irrégulières. Sans elle le
   * terrain est un aplat uniforme qui écrase tout le relief.
   */
  groundColorAlt: THREE.Color;
  /** Relief local en unités monde. */
  height: (x: number, z: number) => number;
  /** Teinte et densité de la brume lorsque le joueur traverse ce biome. */
  fogColor: THREE.Color;
  fogDensity: number;
}

/**
 * Définition centralisée des biomes. Les centres, poids et couleurs vivaient auparavant
 * en double, dans le calcul du relief d'un côté et celui de la couleur du sol de l'autre,
 * avec le risque permanent de les voir diverger. Tout ce qui caractérise un biome tient
 * désormais ici, et les fonctions ci-dessous ne font que le consommer.
 *
 * Ces constantes sont figées au niveau du module : getGroundLevelAt est appelée des
 * dizaines de fois par frame et ne doit rien allouer.
 */
export const BIOMES: readonly BiomeDefinition[] = [
  {
    id: 'mountain',
    label: 'Cimes Ardoise',
    cx: 80, cz: 80, weight: 1.0,
    groundColor: new THREE.Color(0x323b49),
    groundColorAlt: new THREE.Color(0x59606e),
    height: (x, z) => 1.4 * (Math.sin(x * 0.08) * Math.cos(z * 0.08)) + 0.5 * Math.sin(x * 0.2),
    fogColor: new THREE.Color(0xb9c4d4),
    fogDensity: 0.0060,
  },
  {
    id: 'cold',
    label: 'Toundra Gelée',
    cx: -60, cz: 60, weight: 1.0,
    groundColor: new THREE.Color(0xe0ecef),
    groundColorAlt: new THREE.Color(0xa8c4d6),
    height: (x, z) => 0.6 * (Math.sin(x * 0.07) + Math.cos(z * 0.07)),
    fogColor: new THREE.Color(0xd8e8f5),
    fogDensity: 0.0072,
  },
  {
    id: 'desert',
    label: 'Dunes Brûlées',
    cx: -60, cz: -60, weight: 1.0,
    groundColor: new THREE.Color(0xdfc593),
    groundColorAlt: new THREE.Color(0xc09a5f),
    height: (x, z) => 0.8 * Math.sin(x * 0.06 + z * 0.06),
    fogColor: new THREE.Color(0xf0dcae),
    fogDensity: 0.0055,
  },
  {
    id: 'temperate',
    label: 'Plaines Verdoyantes',
    cx: 10, cz: -20, weight: 2.2,
    groundColor: new THREE.Color(0x1fb53a),
    groundColorAlt: new THREE.Color(0x4e8c2f),
    height: (x, z) => 0.25 * Math.sin(x * 0.04) * Math.cos(z * 0.04),
    fogColor: new THREE.Color(0xdff0e0),
    fogDensity: 0.0045,
  },
] as const;

const groundWeights = new Array(BIOMES.length).fill(0);

/** Exposant de mélange : plus il est élevé, plus la frontière entre biomes est nette. */
const BIOME_BLEND_POWER = 9.0;

/**
 * Renseigne `groundWeights` avec l'influence normalisée de chaque biome au point donné,
 * distorsion ondulante comprise. Partagé par le relief, la couleur et l'ambiance pour
 * garantir que les trois s'accordent exactement sur la position des frontières.
 */
function computeBiomeWeights(x: number, z: number): void {
  const distValX = x + Math.sin(z * 0.15) * 8.0;
  const distValZ = z + Math.cos(x * 0.15) * 8.0;

  let totalWeight = 0;
  for (let i = 0; i < BIOMES.length; i++) {
    const r = BIOMES[i];
    const rdx = distValX - r.cx;
    const rdz = distValZ - r.cz;
    const score = Math.hypot(rdx, rdz) / r.weight;
    const w = 1.0 / Math.pow(score + 0.1, BIOME_BLEND_POWER);
    groundWeights[i] = w;
    totalWeight += w;
  }
  for (let i = 0; i < BIOMES.length; i++) {
    groundWeights[i] /= totalWeight;
  }
}

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
  
  computeBiomeWeights(x, z);

  let baseHeight = 0.0;
  for (let i = 0; i < BIOMES.length; i++) {
    baseHeight += BIOMES[i].height(x, z) * groundWeights[i];
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

export function getRegionAt(x: number, z: number): BiomeId {
  // Distorsion ondulante pour casser la symétrie
  const distValX = x + Math.sin(z * 0.15) * 8.0;
  const distValZ = z + Math.cos(x * 0.15) * 8.0;

  let bestId: BiomeId = 'temperate';
  let minScore = Infinity;

  for (const r of BIOMES) {
    const dx = distValX - r.cx;
    const dz = distValZ - r.cz;
    const score = Math.hypot(dx, dz) / r.weight;
    if (score < minScore) {
      minScore = score;
      bestId = r.id;
    }
  }

  return bestId;
}

/**
 * Influence de chaque biome au point donné, du plus fort au plus faible, sous forme
 * normalisée. Sert à mélanger les ambiances aux frontières plutôt que de basculer
 * brutalement d'un décor à l'autre.
 */
export function sampleBiomeWeights(x: number, z: number, out: number[]): number[] {
  computeBiomeWeights(x, z);
  for (let i = 0; i < BIOMES.length; i++) out[i] = groundWeights[i];
  return out;
}

const BOSS_SAND_COLOR = new THREE.Color(0xdfc593);
/**
 * Couleur réutilisée d'un appel à l'autre : getRegionColorAt est invoquée une fois par
 * sommet du terrain (plus de dix mille fois au chargement). Les appelants doivent lire
 * les composantes immédiatement plutôt que conserver la référence.
 */
const _regionColor = new THREE.Color();

export function getRegionColorAt(x: number, z: number): THREE.Color {
  // Le sol de la zone du boss doit être entièrement en sable
  const distToBoss = Math.hypot(x - BOSS_ZONE.cx, z - BOSS_ZONE.cz);
  if (distToBoss < BOSS_ZONE.radius + 6.0) {
    return _regionColor.copy(BOSS_SAND_COLOR);
  }

  computeBiomeWeights(x, z);

  // Plaques de terrain : chaque biome alterne entre ses deux teintes sur des zones de
  // quelques dizaines d'unités, ce qui remplace l'aplat uniforme par un sol vivant.
  const patch = patchNoise(x, z);

  let r = 0, g = 0, b = 0;
  for (let i = 0; i < BIOMES.length; i++) {
    const w = groundWeights[i];
    if (w < 0.0015) continue;
    const main = BIOMES[i].groundColor;
    const alt = BIOMES[i].groundColorAlt;
    r += (main.r + (alt.r - main.r) * patch) * w;
    g += (main.g + (alt.g - main.g) * patch) * w;
    b += (main.b + (alt.b - main.b) * patch) * w;
  }

  // Grain fin par-dessus les plaques, pour éviter que les facettes du terrain paraissent
  // lisses. Entièrement déterministe : tous les joueurs voient le même sol en multijoueur,
  // ce qu'un tirage aléatoire ne garantirait pas.
  const mottle = 1
    + Math.sin(x * 0.62) * Math.cos(z * 0.47) * 0.06
    + Math.sin((x + z) * 0.21) * 0.035;

  return _regionColor.setRGB(r * mottle, g * mottle, b * mottle);
}

/** Bruit déterministe borné à [0, 1], à plusieurs échelles, sans allocation. */
function patchNoise(x: number, z: number): number {
  const n =
    Math.sin(x * 0.128 + Math.cos(z * 0.107) * 2.1) * 0.50 +
    Math.sin(z * 0.171 + Math.cos(x * 0.074) * 1.7) * 0.34 +
    Math.sin((x + z) * 0.312) * 0.16;
  return n * 0.5 + 0.5;
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
