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

// --- WORLD DESIGN (couche d'identité, n'écrase pas les biomes) ---
export const ARENA = {
  id: 'arena',
  cx: 8,
  cz: -12,
  coreRadius: 28,
  radius: 42,
};

export const WORLD_ZONES = [
  { id: 'arena', cx: 8, cz: -12, radius: 42, falloff: 16, density: 0.22, r: 0.28, g: 0.42, b: 0.18, strength: 0.22 },
  { id: 'forest', cx: 18, cz: 48, radius: 38, falloff: 14, density: 0.82, r: 0.07, g: 0.26, b: 0.09, strength: 0.28 },
  { id: 'ruins', cx: -38, cz: -18, radius: 36, falloff: 14, density: 0.62, r: 0.38, g: 0.32, b: 0.26, strength: 0.30 },
  { id: 'rocky', cx: 55, cz: 55, radius: 32, falloff: 12, density: 0.72, r: 0.22, g: 0.25, b: 0.30, strength: 0.26 },
  { id: 'corrupted', cx: -62, cz: -62, radius: 28, falloff: 12, density: 0.52, r: 0.22, g: 0.08, b: 0.16, strength: 0.34 },
  // Rose sakura + verts clairs (SE de l'arène)
  { id: 'sakura_grove', cx: 58, cz: -48, radius: 48, falloff: 20, density: 0.78, r: 0.95, g: 0.72, b: 0.82, strength: 0.42 },
] as const;

/** Camp japonais — rive nord du lac (plus de maisons). */
export const SAKURA_CAMP = {
  id: 'sakura_camp',
  cx: 58,
  cz: -48,
  radius: 8,
  combatClearRadius: 18,
};

/** Lac ovale au sud du camp. Le pont (taiko-bashi) le traverse selon l'axe Z. */
export const SAKURA_LAKE = {
  cx: 58,
  cz: -64,
  rx: 14,
  rz: 8.2,
  waterY: -0.28,
  bridgeHalf: 8.7,
  bridgeHalfWidth: 1.42,
  deckY: 0.14,
  bridgeArch: 2.05,
};

export function sakuraLakeU(x: number, z: number): number {
  const dx = (x - SAKURA_LAKE.cx) / SAKURA_LAKE.rx;
  const dz = (z - SAKURA_LAKE.cz) / SAKURA_LAKE.rz;
  return dx * dx + dz * dz;
}

export function isOnSakuraBridge(x: number, z: number): boolean {
  return Math.abs(z - SAKURA_LAKE.cz) <= SAKURA_LAKE.bridgeHalf
    && Math.abs(x - SAKURA_LAKE.cx) < SAKURA_LAKE.bridgeHalfWidth;
}

/** Couloir pont + torii : rien ne doit boucher la sortie. */
export function isNearSakuraCrossing(x: number, z: number): boolean {
  const along = z - SAKURA_LAKE.cz;
  const across = Math.abs(x - SAKURA_LAKE.cx);
  return Math.abs(along) <= SAKURA_LAKE.bridgeHalf + 5.5 && across < 4.4;
}

export function sakuraBridgeWalkY(z: number): number {
  const t = (z - SAKURA_LAKE.cz) / SAKURA_LAKE.bridgeHalf;
  const tt = Math.max(-1, Math.min(1, t));
  return SAKURA_LAKE.deckY + SAKURA_LAKE.bridgeArch * (1 - tt * tt) + 0.04;
}

export function isInSakuraLake(x: number, z: number): boolean {
  return sakuraLakeU(x, z) < 1 && !isOnSakuraBridge(x, z);
}

export const WORLD_PATHS = [
  { pts: [[68, 68], [40, 28], [12, 0]], width: 3.2, falloff: 4.6 },
  { pts: [[0, -8], [-22, -14], [-48, -28]], width: 3.0, falloff: 4.2 },
  { pts: [[8, 8], [14, 32], [20, 52]], width: 2.8, falloff: 4.0 },
  { pts: [[-42, -32], [-55, -50], [-68, -68]], width: 2.6, falloff: 3.8 },
  { pts: [[20, 0], [38, 28], [52, 48]], width: 2.8, falloff: 4.0 },
  // Arène → Torii d'entrée → Camp sakura → Sanctuaire / jardin
  { pts: [[18, -18], [32, -28], [44, -38], [58, -48]], width: 3.6, falloff: 5.2 },
  { pts: [[58, -48], [70, -58], [78, -50]], width: 2.8, falloff: 4.0 },
  { pts: [[58, -48], [46, -42], [38, -36]], width: 2.6, falloff: 3.8 },
];

export const LANDMARK_SITES = [
  { id: 'giant_tree', subtype: 'giant_tree', x: 22, z: 52, s: 3.8 },
  { id: 'ancient_altar', subtype: 'altar', x: -42, z: -22, s: 2.2 },
  { id: 'crystal_spire', subtype: 'crystal', x: -58, z: -70, s: 2.4 },
  { id: 'stone_monument', subtype: 'monument', x: 58, z: 48, s: 2.6 },
  { id: 'broken_portal', subtype: 'portal', x: -28, z: -8, s: 2.0 },
  { id: 'fallen_colossus', subtype: 'statue', x: -16, z: -30, s: 2.3 },
  { id: 'mystic_grove', subtype: 'grove', x: 6, z: 36, s: 1.8 },
  { id: 'watch_cliff', subtype: 'watch', x: 72, z: 32, s: 2.8 },
  { id: 'ancient_sakura', subtype: 'ancient_sakura', x: 76, z: -78, s: 2.4 },
];

export const DECO_CLUSTERS = [
  { kind: 'forest', x: 20, z: 50, radius: 22, count: 18 },
  { kind: 'forest', x: -8, z: 55, radius: 16, count: 12 },
  { kind: 'forest', x: 38, z: 22, radius: 14, count: 10 },
  { kind: 'ruins', x: -40, z: -20, radius: 20, count: 10 },
  { kind: 'ruins', x: -22, z: -38, radius: 14, count: 7 },
  { kind: 'rocky', x: 58, z: 52, radius: 18, count: 12 },
  { kind: 'rocky', x: 42, z: 70, radius: 12, count: 8 },
  { kind: 'corrupted', x: -60, z: -58, radius: 16, count: 10 },
  { kind: 'sakura', x: 58, z: -48, radius: 32, count: 28 },
  { kind: 'sakura', x: 74, z: -34, radius: 18, count: 14 },
  { kind: 'sakura', x: 80, z: -52, radius: 16, count: 16 },
  { kind: 'sakura', x: 44, z: -62, radius: 16, count: 12 },
];

export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isInArenaCore(x: number, z: number): boolean {
  return Math.hypot(x - ARENA.cx, z - ARENA.cz) < ARENA.coreRadius;
}

export function isInSakuraCamp(x: number, z: number): boolean {
  return Math.hypot(x - SAKURA_CAMP.cx, z - SAKURA_CAMP.cz) < SAKURA_CAMP.radius;
}

export function isInSakuraGrove(x: number, z: number): boolean {
  return getWorldZoneAt(x, z) === 'sakura_grove';
}

export function getWorldZoneAt(x: number, z: number): string {
  let bestId = 'wild';
  let bestScore = Infinity;
  for (const zone of WORLD_ZONES) {
    const d = Math.hypot(x - zone.cx, z - zone.cz);
    const score = d / zone.radius;
    if (score < bestScore) {
      bestScore = score;
      bestId = zone.id;
    }
  }
  return bestScore < 1.35 ? bestId : 'wild';
}

export function getDecoDensityAt(x: number, z: number): number {
  if (isInArenaCore(x, z)) return 0.08;
  let density = 0.32;
  let weight = 0.35;
  for (const zone of WORLD_ZONES) {
    const d = Math.hypot(x - zone.cx, z - zone.cz);
    const outer = zone.radius + zone.falloff;
    if (d > outer) continue;
    let t = 1;
    if (d > zone.radius) t = 1 - (d - zone.radius) / zone.falloff;
    density += zone.density * t;
    weight += t;
  }
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > 110) {
    const border = Math.min(1, (distFromCenter - 110) / 22);
    density += 0.55 * border;
    weight += border;
  }
  return Math.min(0.95, density / weight);
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-8) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function getPathDistanceAt(x: number, z: number): number {
  let best = 999;
  for (const path of WORLD_PATHS) {
    for (let i = 0; i < path.pts.length - 1; i++) {
      const d = distToSegment(x, z, path.pts[i][0], path.pts[i][1], path.pts[i + 1][0], path.pts[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

export function isNearPath(x: number, z: number, extra = 0): boolean {
  let best = 999;
  let limit = 3.2;
  for (const path of WORLD_PATHS) {
    for (let i = 0; i < path.pts.length - 1; i++) {
      const d = distToSegment(x, z, path.pts[i][0], path.pts[i][1], path.pts[i + 1][0], path.pts[i + 1][1]);
      if (d < best) {
        best = d;
        limit = path.width + extra;
      }
    }
  }
  return best < limit;
}

function applyZoneTint(color: THREE.Color, x: number, z: number): void {
  for (let i = 0; i < WORLD_ZONES.length; i++) {
    const zone = WORLD_ZONES[i];
    const d = Math.hypot(x - zone.cx, z - zone.cz);
    const outer = zone.radius + zone.falloff;
    if (d > outer) continue;
    let t = 1;
    if (d > zone.radius) t = 1 - (d - zone.radius) / zone.falloff;
    t *= zone.strength;
    color.r += (zone.r - color.r) * t;
    color.g += (zone.g - color.g) * t;
    color.b += (zone.b - color.b) * t;
  }
}

function applyPathTint(color: THREE.Color, x: number, z: number): void {
  let best = 999;
  let bestWidth = 3.0;
  let bestFall = 4.2;
  for (let p = 0; p < WORLD_PATHS.length; p++) {
    const path = WORLD_PATHS[p];
    for (let i = 0; i < path.pts.length - 1; i++) {
      const d = distToSegment(x, z, path.pts[i][0], path.pts[i][1], path.pts[i + 1][0], path.pts[i + 1][1]);
      if (d < best) {
        best = d;
        bestWidth = path.width;
        bestFall = path.falloff;
      }
    }
  }
  const outer = bestWidth + bestFall;
  if (best > outer) return;
  let t = 1;
  if (best > bestWidth) t = 1 - (best - bestWidth) / bestFall;
  t *= 0.55;
  color.r += (0.45 - color.r) * t;
  color.g += (0.34 - color.g) * t;
  color.b += (0.20 - color.b) * t;
}

function applyLakeTint(color: THREE.Color, x: number, z: number): void {
  const u = sakuraLakeU(x, z);
  if (u < 1) {
    color.r += (0.10 - color.r) * 0.82;
    color.g += (0.28 - color.g) * 0.82;
    color.b += (0.30 - color.b) * 0.82;
    return;
  }
  if (u < 1.22) {
    const t = 1 - (Math.sqrt(u) - 1) / (Math.sqrt(1.22) - 1);
    color.r += (0.32 - color.r) * 0.55 * t;
    color.g += (0.38 - color.g) * 0.55 * t;
    color.b += (0.24 - color.b) * 0.55 * t;
  }
}

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
  return 148 + borderNoise; // Coastal playable limit in shallow water
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

export function getTerrainHeightAt(pos: THREE.Vector3 | { x: number, z: number }): number {
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
  const shoreStart = 128 + borderNoise;
  const shoreEnd = 158 + borderNoise;
  
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

  // Lac sakura : cuvette continue (le pont est un mesh, pas une chaussée de terre)
  {
    const u = sakuraLakeU(x, z);
    if (u < 1) {
      const t = 1 - Math.sqrt(Math.max(0, u));
      finalHeight = -1.35 * t * t;
    } else if (u < 1.28) {
      const t = 1 - (Math.sqrt(u) - 1) / (Math.sqrt(1.28) - 1);
      finalHeight = finalHeight * (1 - t) + (-0.1) * t;
    }
  }
  
  return finalHeight;
}

export function getGroundLevelAt(pos: THREE.Vector3 | { x: number, z: number }): number {
  if (isOnSakuraBridge(pos.x, pos.z)) return sakuraBridgeWalkY(pos.z);
  return getTerrainHeightAt(pos);
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

  _regionColor.setRGB(r * mottle, g * mottle, b * mottle);
  applyZoneTint(_regionColor, x, z);
  applyPathTint(_regionColor, x, z);
  applyLakeTint(_regionColor, x, z);
  return _regionColor;
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
  // Prevent mob spawning in safe zone, boss zone, sakura camp, lake, or deep underwater
  return (
    isInSafeZone(pos) ||
    isInBossZone(pos) ||
    isInSakuraCamp(pos.x, pos.z) ||
    isInSakuraLake(pos.x, pos.z) ||
    getGroundLevelAt(pos) < -1.0
  );
}

export function isValidEventPos(pos: THREE.Vector3): boolean {
  return (
    !isInSafeZone(pos) &&
    !isInBossZone(pos) &&
    !isInSakuraCamp(pos.x, pos.z) &&
    !isInSakuraLake(pos.x, pos.z) &&
    getGroundLevelAt(pos) >= -1.0
  );
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
    const r = Math.random() * 138;
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
