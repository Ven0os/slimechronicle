// @ts-nocheck
import { CHRONO_BEAM, CHRONO_SKILLS } from './constants';

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

function lensHitDistance(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  lens: { pos: THREE.Vector3 },
): number {
  const flatDx = lens.pos.x - origin.x;
  const flatDz = lens.pos.z - origin.z;
  return Math.max(0.5, flatDx * dir.x + flatDz * dir.z);
}

export function getBeamRays(
  hitOrigin: THREE.Vector3,
  dir: THREE.Vector3,
  lenses: Array<{ pos: THREE.Vector3; radius: number; timer: number }>,
  coneAmp = 1,
  refinedPrisms = false,
): Array<{ origin: THREE.Vector3; dir: THREE.Vector3; split: boolean; prismDepth: number }> {
  if (refinedPrisms) {
    return traceRefinedPrismRays(hitOrigin, dir, lenses, coneAmp, new Set(), 0);
  }

  let activeLens = null;
  for (const lens of lenses) {
    if (lens.timer > 0 && rayHitsLens(hitOrigin, dir, lens)) {
      activeLens = lens;
      break;
    }
  }
  if (!activeLens) {
    return [{ origin: hitOrigin.clone(), dir: dir.clone(), split: false, prismDepth: 0 }];
  }

  const dist = lensHitDistance(hitOrigin, dir, activeLens);
  const lensOrigin = new THREE.Vector3(
    hitOrigin.x + dir.x * dist,
    hitOrigin.y,
    hitOrigin.z + dir.z * dist,
  );
  const spread = CHRONO_SKILLS.lens.cone * coneAmp;

  return [
    { origin: lensOrigin, dir: rotateDirXZ(dir, -spread), split: true, prismDepth: 1 },
    { origin: lensOrigin, dir: dir.clone(), split: true, prismDepth: 1 },
    { origin: lensOrigin, dir: rotateDirXZ(dir, spread), split: true, prismDepth: 1 },
  ];
}

function traceRefinedPrismRays(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  lenses: Array<{ pos: THREE.Vector3; radius: number; timer: number }>,
  coneAmp: number,
  visited: Set<number>,
  depth: number,
): Array<{ origin: THREE.Vector3; dir: THREE.Vector3; split: boolean; prismDepth: number }> {
  let nearestIdx = -1;
  let nearestDist = Infinity;

  lenses.forEach((lens, i) => {
    if (lens.timer <= 0 || visited.has(i)) return;
    if (!rayHitsLens(origin, dir, lens)) return;
    const dist = lensHitDistance(origin, dir, lens);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIdx = i;
    }
  });

  if (nearestIdx < 0) {
    return [{ origin: origin.clone(), dir: dir.clone(), split: depth > 0, prismDepth: depth }];
  }

  const lens = lenses[nearestIdx];
  const lensOrigin = new THREE.Vector3(
    origin.x + dir.x * nearestDist,
    origin.y,
    origin.z + dir.z * nearestDist,
  );
  const nextVisited = new Set(visited);
  nextVisited.add(nearestIdx);
  const spread = CHRONO_SKILLS.lens.cone * coneAmp;
  const nextDepth = depth + 1;
  const subDirs = [
    rotateDirXZ(dir, -spread),
    dir.clone(),
    rotateDirXZ(dir, spread),
  ];

  const out: Array<{ origin: THREE.Vector3; dir: THREE.Vector3; split: boolean; prismDepth: number }> = [];
  for (const subDir of subDirs) {
    out.push(...traceRefinedPrismRays(lensOrigin, subDir, lenses, coneAmp, nextVisited, nextDepth));
  }
  return out;
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
