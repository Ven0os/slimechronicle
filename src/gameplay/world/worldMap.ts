// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { BOSS_ZONE, SAFE_ZONE_RADIUS } from './worldZones';

export function createThemedWorldMap(): void {
  const y = 0.04;

  const safe = new THREE.Mesh(
    new THREE.CircleGeometry(SAFE_ZONE_RADIUS, 48),
    new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  safe.rotation.x = -Math.PI / 2;
  safe.position.y = y;
  Globals.scene.add(safe);

  const safeRing = new THREE.Mesh(
    new THREE.RingGeometry(SAFE_ZONE_RADIUS - 0.35, SAFE_ZONE_RADIUS, 64),
    new THREE.MeshBasicMaterial({ color: 0xa8f0b0, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  safeRing.rotation.x = -Math.PI / 2;
  safeRing.position.y = y + 0.01;
  Globals.scene.add(safeRing);

  const bossPatch = new THREE.Mesh(
    new THREE.CircleGeometry(BOSS_ZONE.radius, 40),
    new THREE.MeshBasicMaterial({ color: BOSS_ZONE.ground, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  bossPatch.rotation.x = -Math.PI / 2;
  bossPatch.position.set(BOSS_ZONE.cx, y, BOSS_ZONE.cz);
  Globals.scene.add(bossPatch);

  const bossRing = new THREE.Mesh(
    new THREE.RingGeometry(BOSS_ZONE.radius - 0.6, BOSS_ZONE.radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.set(BOSS_ZONE.cx, y + 0.02, BOSS_ZONE.cz);
  Globals.scene.add(bossRing);

  createSafeHubMarker();
}

export function createSafeHubMarker(): void {
  const group = new THREE.Group();
  group.position.set(0, 0, 6);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.5, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.4, roughness: 0.5 }),
  );
  base.position.y = 0.25;
  group.add(base);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: 0x48c9b0, emissive: 0x1abc9c, emissiveIntensity: 0.8 }),
  );
  crystal.position.y = 1.1;
  group.add(crystal);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xa8f0b0, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  group.userData.isHub = true;
  Globals.scene.add(group);
  Globals.safeHubMarker = group;
}
