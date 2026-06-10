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

export function getBeamRays(
  hitOrigin: THREE.Vector3,
  dir: THREE.Vector3,
  lenses: Array<{ pos: THREE.Vector3; radius: number; timer: number }>,
  coneAmp = 1,
): Array<{ origin: THREE.Vector3; dir: THREE.Vector3; split: boolean }> {
  let activeLens = null;
  for (const lens of lenses) {
    if (lens.timer > 0 && rayHitsLens(hitOrigin, dir, lens)) {
      activeLens = lens;
      break;
    }
  }
  if (!activeLens) return [{ origin: hitOrigin.clone(), dir: dir.clone(), split: false }];

  const flatDx = activeLens.pos.x - hitOrigin.x;
  const flatDz = activeLens.pos.z - hitOrigin.z;
  const dist = Math.max(0.5, flatDx * dir.x + flatDz * dir.z);
  const lensOrigin = new THREE.Vector3(
    hitOrigin.x + dir.x * dist,
    hitOrigin.y,
    hitOrigin.z + dir.z * dist,
  );
  const spread = CHRONO_SKILLS.lens.cone * coneAmp;

  return [
    { origin: lensOrigin, dir: rotateDirXZ(dir, -spread), split: true },
    { origin: lensOrigin, dir: dir.clone(), split: true },
    { origin: lensOrigin, dir: rotateDirXZ(dir, spread), split: true },
  ];
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
