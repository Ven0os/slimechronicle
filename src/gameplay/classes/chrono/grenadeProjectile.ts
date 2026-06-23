// @ts-nocheck
import { Globals } from '../../../core/globals';
import { AudioSys } from '../../../core/ressources';
import { spawnParticles, createSkillVisual } from '../../../visual/effects';
import { disposeObject3D } from '../../../visual/meshMaterialUtils';
import { CHRONO_SKILLS } from './constants';

export class ChronoDephasingGrenade {
  constructor(owner, startPos, aimDir) {
    this.owner = owner;
    this.exploded = false;
    this.trailTimer = 0;

    const cfg = CHRONO_SKILLS.dephasing.grenade;
    const geo = new THREE.SphereGeometry(0.24, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf39c12,
      emissive: 0xff8800,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.35,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(startPos);
    this.mesh.castShadow = true;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.04, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd93d, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = Math.PI / 2;
    this.mesh.add(ring);

    Globals.scene.add(this.mesh);

    this.velocity = aimDir.clone().multiplyScalar(cfg.launchSpeed);
    this.velocity.y = cfg.launchLift;
    this.gravity = cfg.gravity;
    this.fuse = cfg.fuseMax;
  }

  update(dt) {
    if (this.exploded) return;

    this.fuse -= dt;
    this.velocity.y -= this.gravity * dt;
    this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
    this.mesh.rotation.x += dt * 9;
    this.mesh.rotation.z += dt * 6;

    this.trailTimer += dt;
    if (this.trailTimer > 0.03) {
      spawnParticles(this.mesh.position.clone(), 0xf39c12, 2);
      this.trailTimer = 0;
    }

    if (Globals.obstacles) {
      for (const obs of Globals.obstacles) {
        const dx = this.mesh.position.x - obs.position.x;
        const dz = this.mesh.position.z - obs.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < obs.radius + 0.25) {
          this.explode();
          return;
        }
      }
    }

    if (this.mesh.position.y <= 0.22) {
      this.mesh.position.y = 0.22;
      this.explode();
      return;
    }

    if (this.fuse <= 0) this.explode();
  }

  explode() {
    if (this.exploded) return;
    this.exploded = true;

    const pos = this.mesh.position.clone();
    pos.y = 0.15;
    const radius = CHRONO_SKILLS.dephasing.grenade.blastRadius;

    createSkillVisual('nova', pos, radius, 0xf39c12, null);
    spawnParticles(pos, 0xf39c12, 20);
    AudioSys.play('eclipse_burst', 0.5, 0.12);

    if (this.owner?.onDephasingGrenadeDetonate) {
      this.owner.onDephasingGrenadeDetonate(pos);
    }

    this.destroy();
  }

  destroy() {
    if (this.mesh) {
      Globals.scene.remove(this.mesh);
      disposeObject3D(this.mesh);
      this.mesh = null;
    }
    const idx = Globals.projectiles.indexOf(this);
    if (idx > -1) Globals.projectiles.splice(idx, 1);
  }
}

/** @deprecated Alias — grenade Déphasage */
export const ChronoConvergenceGrenade = ChronoDephasingGrenade;
