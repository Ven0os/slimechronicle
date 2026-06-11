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

function lensPointAt(origin: THREE.Vector3, dir: THREE.Vector3, dist: number): THREE.Vector3 {
  return new THREE.Vector3(
    origin.x + dir.x * dist,
    origin.y,
    origin.z + dir.z * dist,
  );
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

/**
 * Résout le graphe de routage rayon/lentille de façon déterministe.
 * - Sans prismes affinés : 1 lentille max → split ×3 terminal.
 * - Avec prismes affinés : chaîne sur l'axe central uniquement ; splits latéraux terminaux.
 */
export function resolveBeamRoutes(
  hitOrigin: THREE.Vector3,
  dir: THREE.Vector3,
  lenses: ChronoLens[],
  coneAmp = 1,
  refinedPrisms = false,
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
    return resolveSingleLensRoutes(hitOrigin, mainDir, entries, coneAmp);
  }

  return resolveRefinedChainRoutes(hitOrigin, mainDir, entries, coneAmp);
}

/** Mode base : première lentille sur le rayon → 3 splits, pas de chaîne. */
function resolveSingleLensRoutes(
  hitOrigin: THREE.Vector3,
  mainDir: THREE.Vector3,
  entries: LensEntry[],
  coneAmp: number,
): BeamRouteResult {
  const hit = findNearestLensOnRay(hitOrigin, mainDir, entries, new Set());
  if (!hit) {
    return {
      trunk: [],
      rays: [{ origin: hitOrigin.clone(), dir: mainDir.clone(), split: false, prismDepth: 0 }],
    };
  }

  const lensOrigin = lensPointAt(hitOrigin, mainDir, hit.dist);
  const spread = CHRONO_SKILLS.lens.cone * coneAmp;
  const rays: BeamRay[] = [
    { origin: lensOrigin.clone(), dir: rotateDirXZ(mainDir, -spread), split: true, prismDepth: 1 },
    { origin: lensOrigin.clone(), dir: mainDir.clone(), split: true, prismDepth: 1 },
    { origin: lensOrigin.clone(), dir: rotateDirXZ(mainDir, spread), split: true, prismDepth: 1 },
  ];

  return {
    trunk: [{ from: hitOrigin.clone(), to: lensOrigin.clone() }],
    rays: dedupeBeamRays(rays),
  };
}

/**
 * Mode prismes affinés : chaîne sur le rayon central ; splits latéraux sans re-chaînement.
 * Max 3 lentilles visitées → au plus 2×3 splits + 1 rayon central final = 7 rayons.
 */
function resolveRefinedChainRoutes(
  hitOrigin: THREE.Vector3,
  mainDir: THREE.Vector3,
  entries: LensEntry[],
  coneAmp: number,
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

    const lensOrigin = lensPointAt(cursor, mainDir, hit.dist);
    trunk.push({ from: cursor.clone(), to: lensOrigin.clone() });
    visited.add(hit.entry.id);

    const nextDepth = depth + 1;
    // Splits latéraux : terminaux (ne traversent pas d'autres lentilles)
    rays.push({
      origin: lensOrigin.clone(),
      dir: rotateDirXZ(mainDir, -spread),
      split: true,
      prismDepth: nextDepth,
    });
    rays.push({
      origin: lensOrigin.clone(),
      dir: rotateDirXZ(mainDir, spread),
      split: true,
      prismDepth: nextDepth,
    });

    cursor = lensOrigin;
    depth = nextDepth;
  }

  // Rayon central final (continue après la dernière lentille ou sans lentille)
  rays.push({
    origin: cursor.clone(),
    dir: mainDir.clone(),
    split: depth > 0,
    prismDepth: depth,
  });

  return { trunk, rays: dedupeBeamRays(rays) };
}

/** @deprecated Préférer resolveBeamRoutes — conservé pour compatibilité. */
export function getBeamRays(
  hitOrigin: THREE.Vector3,
  dir: THREE.Vector3,
  lenses: ChronoLens[],
  coneAmp = 1,
  refinedPrisms = false,
): BeamRay[] {
  return resolveBeamRoutes(hitOrigin, dir, lenses, coneAmp, refinedPrisms).rays;
}

export function getBeamHitInfo(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  enemies: Array<{ dead?: boolean; position: THREE.Vector3; radius?: number }> | null,
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
    const hitRadius = CHRONO_BEAM.width + (e.radius || 0.5) * 0.55;
    if (perp.length() <= hitRadius && projLen < closestDist) {
      closestDist = projLen;
      hitEnemy = e;
      hitDist = projLen + (e.radius || 0.5) * 0.35;
    }
  }

  return { length: Math.min(hitDist, CHRONO_BEAM.range), enemy: hitEnemy };
}
