// @ts-nocheck
import { CHRONO_BEAM, CHRONO_SKILLS } from './constants';

export type ChronoLens = {
  id?: string;
  pos: THREE.Vector3;
  radius: number;
  timer: number;
};

export type BeamRay = {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  split: boolean;
  prismDepth: number;
};

export type BeamTrunkSegment = {
  from: THREE.Vector3;
  to: THREE.Vector3;
};

export type BeamRouteResult = {
  trunk: BeamTrunkSegment[];
  rays: BeamRay[];
};

/** Nombre de rayons lentille sans / avec Prisme Supplémentaire. */
export const LENS_SPLIT_COUNT_DEFAULT = 3;
export const LENS_SPLIT_COUNT_EXTRA_PRISM = 4;

/**
 * Distribution angulaire normalisée (× spread).
 * 3 rayons : [-1, 0, +1]  → ex. −20°, 0°, +20°
 * 4 rayons : [-1, −0.25, +0.25, +1] → ex. −12°, −3°, +3°, +12°
 * Même ouverture extérieure ; les deux rayons centraux se chevauchent fortement.
 */
export function getLensRayAngleOffsets(rayCount: number): number[] {
  if (rayCount >= LENS_SPLIT_COUNT_EXTRA_PRISM) return [-1, -0.25, 0.25, 1];
  if (rayCount === LENS_SPLIT_COUNT_DEFAULT) return [-1, 0, 1];
  if (rayCount === 2) return [-1, 1];
  return [0];
}

export function getLensSplitRayCount(hasExtraPrism: boolean): number {
  return hasExtraPrism ? LENS_SPLIT_COUNT_EXTRA_PRISM : LENS_SPLIT_COUNT_DEFAULT;
}

export function rotateDirXZ(dir: THREE.Vector3, angle: number): THREE.Vector3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new THREE.Vector3(dir.x * c - dir.z * s, 0, dir.x * s + dir.z * c).normalize();
}

export function rayHitsLens(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  lens: { pos: THREE.Vector3; radius: number },
): boolean {
  const toLens = lens.pos.clone().sub(origin);
  const proj = toLens.dot(dir);
  if (proj < 0.5 || proj > CHRONO_BEAM.range) return false;
  const perp = toLens.clone().sub(dir.clone().multiplyScalar(proj));
  return perp.length() <= lens.radius + 0.3;
}

export function lensHitDistance(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  lens: { pos: THREE.Vector3 },
): number {
  const flatDx = lens.pos.x - origin.x;
  const flatDz = lens.pos.z - origin.z;
  return Math.max(0.5, flatDx * dir.x + flatDz * dir.z);
}

type LensEntry = { lens: ChronoLens; id: string };

function prepareActiveLenses(lenses: ChronoLens[]): LensEntry[] {
  return lenses
    .map((lens, index) => ({
      lens,
      id: lens.id ?? `lens_${index}`,
    }))
    .filter((e) => e.lens.timer > 0);
}

function findNearestLensOnRay(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  entries: LensEntry[],
  visited: Set<string>,
): { entry: LensEntry; dist: number } | null {
  let best: { entry: LensEntry; dist: number } | null = null;
  for (const entry of entries) {
    if (visited.has(entry.id)) continue;
    if (!rayHitsLens(origin, dir, entry.lens)) continue;
    const dist = lensHitDistance(origin, dir, entry.lens);
    if (!best || dist < best.dist) best = { entry, dist };
  }
  return best;
}

function rayKey(r: BeamRay): string {
  const o = r.origin;
  const d = r.dir;
  return `${o.x.toFixed(2)},${o.y.toFixed(2)},${o.z.toFixed(2)}|${d.x.toFixed(4)},${d.z.toFixed(4)}|${r.prismDepth}`;
}

/** Supprime les rayons identiques (origine + direction + profondeur). */
export function dedupeBeamRays(rays: BeamRay[]): BeamRay[] {
  const seen = new Set<string>();
  const out: BeamRay[] = [];
  for (const r of rays) {
    const key = rayKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

const MAX_REFINED_CHAIN = CHRONO_SKILLS.refinedLens.maxActive;

function buildLensSplitRays(
  lensPos: THREE.Vector3,
  mainDir: THREE.Vector3,
  spread: number,
  rayCount: number,
  prismDepth: number,
): BeamRay[] {
  const origin = lensPos.clone();
  const offsets = getLensRayAngleOffsets(rayCount);
  return offsets.map((off) => ({
    origin: origin.clone(),
    dir: rotateDirXZ(mainDir, spread * off),
    split: true,
    prismDepth,
  }));
}

/**
 * Splits latéraux Apex : 2 ou 4 rayons selon lensSplitCount (jamais codé en dur à 3).
 */
function buildRefinedLateralSplitRays(
  lensPos: THREE.Vector3,
  mainDir: THREE.Vector3,
  spread: number,
  lensSplitCount: number,
  prismDepth: number,
): BeamRay[] {
  const lateralRayCount = lensSplitCount >= LENS_SPLIT_COUNT_EXTRA_PRISM
    ? LENS_SPLIT_COUNT_EXTRA_PRISM
    : 2;
  return buildLensSplitRays(lensPos, mainDir, spread, lateralRayCount, prismDepth);
}

/**
 * Splits terminaux (mode base) : 3 ou 4 rayons selon lensSplitCount.
 */
function buildTerminalLensSplitRays(
  lensPos: THREE.Vector3,
  mainDir: THREE.Vector3,
  spread: number,
  lensSplitCount: number,
  prismDepth: number,
): BeamRay[] {
  return buildLensSplitRays(lensPos, mainDir, spread, lensSplitCount, prismDepth);
}

/**
 * Résout le graphe de routage rayon/lentille de façon déterministe.
 * lensSplitCount pilote tous les splits (base et Apex) — jamais de boucle fixe à 3.
 */
export function resolveBeamRoutes(
  hitOrigin: THREE.Vector3,
  dir: THREE.Vector3,
  lenses: ChronoLens[],
  coneAmp = 1,
  refinedPrisms = false,
  lensSplitCount = LENS_SPLIT_COUNT_DEFAULT,
): BeamRouteResult {
  const mainDir = dir.clone().normalize();
  const entries = prepareActiveLenses(lenses);

  if (entries.length === 0) {
    return {
      trunk: [],
      rays: [{ origin: hitOrigin.clone(), dir: mainDir.clone(), split: false, prismDepth: 0 }],
    };
  }

  if (!refinedPrisms) {
    return resolveSingleLensRoutes(hitOrigin, mainDir, entries, coneAmp, lensSplitCount);
  }

  return resolveRefinedChainRoutes(hitOrigin, mainDir, entries, coneAmp, lensSplitCount);
}

/** Mode base : première lentille → lensSplitCount splits terminaux. */
function resolveSingleLensRoutes(
  hitOrigin: THREE.Vector3,
  mainDir: THREE.Vector3,
  entries: LensEntry[],
  coneAmp: number,
  lensSplitCount = LENS_SPLIT_COUNT_DEFAULT,
): BeamRouteResult {
  const hit = findNearestLensOnRay(hitOrigin, mainDir, entries, new Set());
  if (!hit) {
    return {
      trunk: [],
      rays: [{ origin: hitOrigin.clone(), dir: mainDir.clone(), split: false, prismDepth: 0 }],
    };
  }

  const lensPos = hit.entry.lens.pos.clone();
  const spread = CHRONO_SKILLS.lens.cone * coneAmp;
  const rays = buildTerminalLensSplitRays(lensPos, mainDir, spread, lensSplitCount, 1);

  return {
    trunk: [{ from: hitOrigin.clone(), to: lensPos.clone() }],
    rays: dedupeBeamRays(rays),
  };
}

/**
 * Mode Apex (prismes affinés) : chaîne centrale + splits latéraux à chaque lentille.
 * Sans passif : 2 latéraux + 1 central final = 3 rayons (1 lentille).
 * Avec Prisme Supplémentaire : 4 latéraux (distribution −12/−3/+3/+12), pas de central
 * supplémentaire sur une seule lentille ; chaîne multi-lentilles conserve le central final.
 */
function resolveRefinedChainRoutes(
  hitOrigin: THREE.Vector3,
  mainDir: THREE.Vector3,
  entries: LensEntry[],
  coneAmp: number,
  lensSplitCount = LENS_SPLIT_COUNT_DEFAULT,
): BeamRouteResult {
  const trunk: BeamTrunkSegment[] = [];
  const rays: BeamRay[] = [];
  const visited = new Set<string>();

  let cursor = hitOrigin.clone();
  let depth = 0;
  const spread = CHRONO_SKILLS.lens.cone * coneAmp;

  while (depth < MAX_REFINED_CHAIN) {
    const hit = findNearestLensOnRay(cursor, mainDir, entries, visited);
    if (!hit) break;

    const lensPos = hit.entry.lens.pos.clone();
    trunk.push({ from: cursor.clone(), to: lensPos.clone() });
    visited.add(hit.entry.id);

    const nextDepth = depth + 1;
    rays.push(...buildRefinedLateralSplitRays(lensPos, mainDir, spread, lensSplitCount, nextDepth));

    cursor = lensPos;
    depth = nextDepth;
  }

  const hasExtraPrism = lensSplitCount >= LENS_SPLIT_COUNT_EXTRA_PRISM;
  const singleLensWithExtraPrism = hasExtraPrism && depth === 1;
  const needsCentralExitRay = depth > 0 && !singleLensWithExtraPrism;

  if (needsCentralExitRay) {
    rays.push({
      origin: cursor.clone(),
      dir: mainDir.clone(),
      split: true,
      prismDepth: depth,
    });
  }

  return { trunk, rays: dedupeBeamRays(rays) };
}

/** @deprecated Préférer resolveBeamRoutes — conservé pour compatibilité. */
export function getBeamRays(
  hitOrigin: THREE.Vector3,
  dir: THREE.Vector3,
  lenses: ChronoLens[],
  coneAmp = 1,
  refinedPrisms = false,
  lensSplitCount = LENS_SPLIT_COUNT_DEFAULT,
): BeamRay[] {
  return resolveBeamRoutes(hitOrigin, dir, lenses, coneAmp, refinedPrisms, lensSplitCount).rays;
}

export function getBeamHitInfo(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  enemies: Array<{ dead?: boolean; position: THREE.Vector3; radius?: number }> | null,
  widthScale = 1,
): { length: number; enemy: unknown | null } {
  let hitDist = CHRONO_BEAM.range;
  let hitEnemy = null;
  let closestDist = Infinity;
  const flatOrigin = new THREE.Vector3(origin.x, 0, origin.z);

  if (!enemies) return { length: hitDist, enemy: null };

  for (const e of enemies) {
    if (e.dead) continue;
    const enemyFlat = new THREE.Vector3(e.position.x, 0, e.position.z);
    const toEnemy = enemyFlat.sub(flatOrigin);
    const projLen = toEnemy.dot(dir);
    if (projLen < 0.05 || projLen > CHRONO_BEAM.range) continue;
    const perp = toEnemy.clone().sub(dir.clone().multiplyScalar(projLen));
    const hitRadius = CHRONO_BEAM.width * Math.max(0.2, widthScale) + (e.radius || 0.5) * 0.55;
    if (perp.length() <= hitRadius && projLen < closestDist) {
      closestDist = projLen;
      hitEnemy = e;
      hitDist = projLen + (e.radius || 0.5) * 0.35;
    }
  }

  return { length: Math.min(hitDist, CHRONO_BEAM.range), enemy: hitEnemy };
}
