// @ts-nocheck
import { PlayerBase } from '../player_base';
import { CONFIG, STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createDamageText, createSkillVisual, createTelegraph, spawnParticles } from '../../visual/effects';
import { Network } from '../../multiplayer/network';
import { Globals } from '../../core/globals';
import { ConstellationEngine } from '../../systems/constellationEngine';
import { CHRONO_ASCENDANT, CHRONO_BEAM, CHRONO_FRACTURE, CHRONO_SKILLS } from './chrono/constants';
import { getBeamHitInfo, getBeamRays, rayHitsLens } from './chrono/beamHelpers';
import { updateChronoFractureUI } from './chrono/fractureUi';
import { ChronoDephasingGrenade } from './chrono/grenadeProjectile';

const CHRONO_COLOR = () => CONFIG.colors.chronoregulator;

export class Chronoregulator extends PlayerBase {
  constructor() {
    super('chronoregulator');
    this.createClassModel();
    this.applyClassStats();

    this.fractureGauge = 0;
    this.fractureSilence = 0;
    this.overheatTriggered = false;
    this.isBeaming = false;
    this.beamVisuals = [];
    this.beamTickTimer = 0;
    this.beamFocusId = null;
    this.beamFocusTime = 0;
    this.beamDamageLog = [];
    this.lenses = [];
    this.isConverging = false;
    this.convergenceTimer = 0;
    this.convergenceHitCount = 0;
    this.animState = { rightArmOverride: false };
  }

  createClassModel() {
    const teal = CHRONO_COLOR();
    const voidMat = new THREE.MeshStandardMaterial({
      color: 0x0a1628, roughness: 0.6, metalness: 0.3, name: 'bodyPart',
    });
    const robeMat = new THREE.MeshStandardMaterial({
      color: teal, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide, name: 'bodyPart',
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd93d, roughness: 0.25, metalness: 0.85, emissive: 0x332200, name: 'bodyPart',
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x7df9ff, emissive: 0x00aaff, emissiveIntensity: 1.8, roughness: 0.1, name: 'bodyPart',
    });

    this.mesh = new THREE.Group();
    this.bodyGroup.add(this.mesh);
    this.bodyMesh = new THREE.Group();
    this.mesh.add(this.bodyMesh);

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 1.1, 10, 1, true), robeMat);
    skirt.position.y = -0.35;
    this.bodyMesh.add(skirt);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.65, 10), voidMat);
    torso.position.y = 0.45;
    this.bodyMesh.add(torso);
    const clockRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 6, 24), goldMat);
    clockRing.rotation.x = Math.PI / 2;
    clockRing.position.y = 0.55;
    this.bodyMesh.add(clockRing);

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.95;
    this.bodyMesh.add(this.headGroup);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), voidMat);
    this.headGroup.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.08), coreMat);
    visor.position.set(0, 0.04, 0.17);
    this.headGroup.add(visor);

    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0.35, 0.55, 0.15);
    this.bodyMesh.add(this.weaponGroup);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.1, 6), goldMat);
    staff.rotation.z = -0.4;
    this.weaponGroup.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), coreMat);
    orb.position.set(0.15, 0.45, 0);
    this.weaponGroup.add(orb);
    this.chronoOrb = orb;
  }

  getAimDir() {
    if (!Globals.camera) return new THREE.Vector3(0, 0, 1);
    STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!STATE.raycaster.ray.intersectPlane(plane, hit)) {
      const d = new THREE.Vector3(0, 0, 1);
      if (this.mesh) d.applyQuaternion(this.mesh.quaternion);
      return d.normalize();
    }
    const dir = hit.clone().sub(this.position);
    dir.y = 0;
    return dir.length() > 0.01 ? dir.normalize() : new THREE.Vector3(0, 0, 1);
  }

  getEnemyId(enemy) {
    return enemy.netId || enemy.uuid || `${enemy.position.x}-${enemy.position.z}`;
  }

  getBeamVisualOrigin(out = new THREE.Vector3()) {
    if (this.chronoOrb) {
      this.chronoOrb.getWorldPosition(out);
      return out;
    }
    if (this.weaponGroup) {
      this.weaponGroup.getWorldPosition(out);
      out.y += 0.45;
      return out;
    }
    return this.getBeamHitOrigin(out);
  }

  getBeamHitOrigin(out = new THREE.Vector3()) {
    return out.copy(this.position).add(new THREE.Vector3(0, 1.05, 0));
  }

  getBeamTickInterval() {
    const atkSpd = STATE.stats.attackSpeedMod || 1;
    const effective = 1 + (atkSpd - 1) * CHRONO_BEAM.atkSpdImpact;
    return CHRONO_BEAM.tickBase * effective;
  }

  getFractureFillRate() {
    return CHRONO_FRACTURE.max / CHRONO_FRACTURE.fillTime;
  }

  getSkillFractureCost() {
    return STATE.passives?.anachronismeAmp ? 25 : CHRONO_FRACTURE.skillCost;
  }

  getAscendantMax() {
    return STATE.passives?.continuumMastery ? 0.65 : CHRONO_ASCENDANT.max;
  }

  getBeamTickDmgMult() {
    let mult = STATE.passives?.continuumBurst ? 1.12 : 1;
    if (STATE.passives?.ruptureSurge) mult *= 1.08;
    if (this.isConverging) mult *= 1 + CHRONO_SKILLS.convergence.beamDmgBonus;
    return mult;
  }

  getConvergenceDuration() {
    let dur = CHRONO_SKILLS.convergence.duration;
    if (STATE.passives?.continuumBurst) dur += 0.5;
    return dur;
  }

  getConvergenceResonanceRadius() {
    let r = CHRONO_SKILLS.convergence.resonanceRadius;
    if (STATE.passives?.continuumBurst) r += 0.5;
    return r;
  }

  getConvergenceFinaleRadius() {
    let r = CHRONO_SKILLS.convergence.finaleRadius;
    if (STATE.passives?.continuumMastery) r += 1;
    if (STATE.passives?.continuumBurst) r += 0.5;
    return r;
  }

  getMovementSpeedMult() {
    let mult = 1;
    if (this.isConverging) mult *= 1 + CHRONO_SKILLS.convergence.moveSpeedBonus;
    if (this.isBeaming) mult *= CHRONO_BEAM.moveMult;
    return mult;
  }

  getConvergencePullTarget(out = new THREE.Vector3()) {
    const hitOrigin = this.getBeamHitOrigin();
    const dir = this.getAimDir();
    if (this.isBeaming && Globals.enemies) {
      const { length, enemy } = getBeamHitInfo(hitOrigin, dir, Globals.enemies);
      if (enemy) return enemy.position.clone();
      return hitOrigin.clone().add(dir.clone().multiplyScalar(Math.max(2, length * 0.55)));
    }
    return out.copy(hitOrigin).add(dir.clone().multiplyScalar(6));
  }

  getOverheatBacklashMult() {
    return STATE.passives?.continuumMastery ? 0.75 : 1;
  }

  isInRuptureWindow() {
    return this.fractureGauge >= CHRONO_FRACTURE.ruptureMin
      && this.fractureGauge <= CHRONO_FRACTURE.ruptureMax;
  }

  dealMagicDamage(enemy, baseDmg, { skill = false, skillKey = 'primary' } = {}) {
    if (!enemy || enemy.dead) return 0;
    let dmg = ConstellationEngine.modifyDamageDealt(baseDmg, { skill, skillKey });
    if (enemy._temporalVuln?.timer > 0) dmg *= enemy._temporalVuln.mult || 1.2;

    if (STATE.multiplayer.active && !STATE.multiplayer.isHost) {
      createDamageText(Math.floor(dmg), enemy.position, '#7df9ff');
      Network.send({ type: 'request-damage', enemyId: enemy.netId, amount: dmg });
    } else {
      enemy.takeDamage(dmg);
    }
    return dmg;
  }

  isEnemyInstabilityMarked(enemy) {
    return enemy && (enemy._chronoInstabilityTimer || 0) > 0;
  }

  hasActiveInstabilityMark() {
    if (!Globals.enemies) return false;
    return Globals.enemies.some((e) => !e.dead && this.isEnemyInstabilityMarked(e));
  }

  applyInstabilityMark(enemy, durationSec) {
    if (!enemy || enemy.dead) return;
    enemy._chronoInstabilityTimer = durationSec;
    createDamageText('INSTABLE', enemy.position, '#f39c12');
  }

  emitResonanceWave(sourceEnemy, tickDmg) {
    const radius = this.getConvergenceResonanceRadius();
    const waveDmg = tickDmg * CHRONO_SKILLS.convergence.resonanceDmgMult;
    createSkillVisual('nova', sourceEnemy.position, radius, 0xffd93d, null);
    spawnParticles(sourceEnemy.position, 0xf39c12, 6);

    if (!Globals.enemies) return;
    for (const other of Globals.enemies) {
      if (other.dead || other === sourceEnemy) continue;
      if (other.position.distanceTo(sourceEnemy.position) <= radius + (other.radius || 0.5)) {
        this.dealMagicDamage(other, waveDmg, { skill: true, skillKey: 'e' });
      }
    }
  }

  updateConvergencePull(dt) {
    if (!this.isConverging || !Globals.enemies) return;
    const target = this.getConvergencePullTarget();
    const pullSpeed = CHRONO_SKILLS.convergence.pullSpeed;

    for (const enemy of Globals.enemies) {
      if (enemy.dead || !this.isEnemyInstabilityMarked(enemy)) continue;
      const pull = target.clone().sub(enemy.position);
      pull.y = 0;
      const dist = pull.length();
      if (dist < 0.35) continue;
      pull.normalize();
      enemy.position.add(pull.multiplyScalar(Math.min(pullSpeed * dt, dist * 0.35)));
    }
  }

  getEnemiesInCone(dir, range, minDot) {
    const hits = [];
    if (!Globals.enemies) return hits;

    for (const enemy of Globals.enemies) {
      if (enemy.dead) continue;
      const toEnemy = enemy.position.clone().sub(this.position);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist > range + (enemy.radius || 0.5)) continue;
      if (dist < 0.05) {
        hits.push(enemy);
        continue;
      }
      if (toEnemy.normalize().dot(dir) >= minDot) hits.push(enemy);
    }
    return hits;
  }

  recordBeamDamage(enemy, dmg) {
    if (!dmg || !enemy) return;
    const id = this.getEnemyId(enemy);
    this.beamDamageLog.push({ id, enemy, dmg, t: performance.now() });
    const cutoff = performance.now() - CHRONO_BEAM.logMs;
    this.beamDamageLog = this.beamDamageLog.filter((e) => e.t >= cutoff);
  }

  getAscendantMult() {
    const cap = this.getAscendantMax();
    return 1 + Math.min(cap, (this.beamFocusTime / CHRONO_ASCENDANT.ramp) * cap);
  }

  getActiveLens(origin, dir) {
    for (const lens of this.lenses) {
      if (lens.timer > 0 && rayHitsLens(origin, dir, lens)) return lens;
    }
    return null;
  }

  createBeamMesh(synced = false) {
    const electric = this.isConverging;
    const group = new THREE.Group();
    group.userData.electric = electric;

    if (electric) {
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 1, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 }),
      );
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 1, 6),
        new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.92 }),
      );
      const corona = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 1, 6),
        new THREE.MeshBasicMaterial({ color: 0x8866ff, transparent: true, opacity: 0.45 }),
      );
      const arcShell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.38, 1, 8),
        new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.18 }),
      );
      group.add(arcShell, corona, glow, core);
    } else {
      const color = CHRONO_COLOR();
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, 1, 6),
        new THREE.MeshBasicMaterial({ color: synced ? 0xffd93d : 0xffffff, transparent: true, opacity: 0.95 }),
      );
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.1, 1, 8),
        new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.8 }),
      );
      const halo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.26, 1, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32 }),
      );
      group.add(halo, glow, core);
    }

    Globals.scene.add(group);
    return group;
  }

  placeElectricArcs(start, end) {
    const delta = end.clone().sub(start);
    const len = delta.length();
    if (len < 0.35) return;

    const dir = delta.clone().normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const segments = Math.max(4, Math.floor(len / 0.9));
    const points = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = start.clone().lerp(end, t);
      if (i > 0 && i < segments) {
        p.add(right.clone().multiplyScalar((Math.random() - 0.5) * 0.42));
        p.y += (Math.random() - 0.5) * 0.08;
      }
      points.push(p);
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: Math.random() > 0.5 ? 0xc8f7ff : 0xe8f4ff,
      transparent: true,
      opacity: 0.75 + Math.random() * 0.2,
    });
    const arc = new THREE.Line(geo, mat);
    arc.userData.electric = true;
    Globals.scene.add(arc);
    this.beamVisuals.push(arc);
  }

  updateElectricBeamFx(dt) {
    if (!this.isConverging || !this.isBeaming) return;

    const flicker = 0.65 + Math.random() * 0.35;
    for (const visual of this.beamVisuals) {
      if (visual.userData?.electric && visual.children) {
        visual.children.forEach((child, idx) => {
          if (!child.material) return;
          const base = idx === visual.children.length - 1 ? 1 : 0.15 + idx * 0.22;
          child.material.opacity = base * flicker;
        });
      } else if (visual.isLine && visual.userData?.electric && visual.material) {
        visual.material.opacity = 0.55 + Math.random() * 0.45;
      }
    }

    if (Math.random() < 0.5) {
      const origin = this.getBeamHitOrigin();
      const dir = this.getAimDir();
      const sparkPos = origin.clone().add(dir.clone().multiplyScalar(1.5 + Math.random() * 8));
      spawnParticles(sparkPos, Math.random() > 0.5 ? 0xaee8ff : 0xffffff, 2);
    }
  }

  syncConvergenceElectricSound() {
    if (!this.isLocalPlayer()) return;
    if (this.isConverging && this.isBeaming) {
      AudioSys.sfx.chrono?.electricBeam?.();
    } else {
      AudioSys.sfx.chrono?.electricBeamStop?.();
    }
  }

  destroyBeamVisuals() {
    for (const mesh of this.beamVisuals) {
      Globals.scene.remove(mesh);
      mesh.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    }
    this.beamVisuals = [];
  }

  refreshBeamVisuals() {
    if (!this.isBeaming) {
      this.destroyBeamVisuals();
      return;
    }

    this.destroyBeamVisuals();
    const mainDir = this.getAimDir();
    const hitOrigin = this.getBeamHitOrigin();
    const staffOrigin = this.getBeamVisualOrigin();
    const coneAmp = STATE.passives?.continuumBurst ? 1.15 : 1;
    const rays = getBeamRays(hitOrigin, mainDir, this.lenses, coneAmp);

    if (staffOrigin.distanceTo(hitOrigin) > 0.12) {
      this.placeBeamSegment(staffOrigin, hitOrigin, false, 0.5);
    }

    if (rays.length > 1) {
      const lensPoint = rays[0].origin;
      if (hitOrigin.distanceTo(lensPoint) > 0.15) {
        this.placeBeamSegment(hitOrigin, lensPoint, false);
      }
      for (const ray of rays) {
        const { length } = getBeamHitInfo(ray.origin, ray.dir, Globals.enemies);
        const end = ray.origin.clone().add(ray.dir.clone().multiplyScalar(Math.max(1, length)));
        this.placeBeamSegment(ray.origin, end, true);
      }
    } else {
      const ray = rays[0];
      const { length } = getBeamHitInfo(ray.origin, ray.dir, Globals.enemies);
      const end = ray.origin.clone().add(ray.dir.clone().multiplyScalar(Math.max(1, length)));
      this.placeBeamSegment(ray.origin, end, false);
    }
  }

  placeBeamSegment(start, end, split, widthScale = 1) {
    const delta = end.clone().sub(start);
    const len = delta.length();
    if (len < 0.2) return;

    const mesh = this.createBeamMesh(split);
    const dir = delta.clone().normalize();
    mesh.position.copy(start).add(end).multiplyScalar(0.5);

    const up = new THREE.Vector3(0, 1, 0);
    if (dir.dot(up) > 0.999) {
      mesh.quaternion.identity();
    } else if (dir.dot(up) < -0.999) {
      mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    } else {
      mesh.quaternion.setFromUnitVectors(up, dir);
    }

    let w = (split ? 0.85 : 1) * widthScale;
    if (this.isConverging) w *= CHRONO_SKILLS.convergence.beamVisualScale;
    mesh.children.forEach((c) => c.scale.set(w, len, w));
    this.beamVisuals.push(mesh);

    if (this.isConverging) {
      this.placeElectricArcs(start, end);
      if (Math.random() < 0.65) this.placeElectricArcs(start, end);
    }
  }

  tickDistortionBeam() {
    if (!this.isBeaming) return;
    const hitOrigin = this.getBeamHitOrigin();
    const mainDir = this.getAimDir();
    const rays = getBeamRays(hitOrigin, mainDir, this.lenses, STATE.passives?.continuumBurst ? 1.15 : 1);
    const tickDt = this.getBeamTickInterval();
    const ascMult = this.getAscendantMult();
    const baseDmg = STATE.stats.atk * CHRONO_BEAM.tickDmg * ascMult * this.getBeamTickDmgMult();

    if (!this.isLocalPlayer() && STATE.multiplayer.active && !STATE.multiplayer.isHost) return;

    let hitAny = false;
    let focusEnemy = null;

    for (const ray of rays) {
      const { enemy } = getBeamHitInfo(ray.origin, ray.dir, Globals.enemies);
      if (!enemy) continue;
      hitAny = true;
      focusEnemy = enemy;

      let tickDmg = baseDmg;
      if (this.isEnemyInstabilityMarked(enemy)) {
        tickDmg *= 1 + CHRONO_SKILLS.dephasing.beamMarkedBonus;
      }

      const dealt = this.dealMagicDamage(enemy, tickDmg, { skillKey: 'primary' });
      this.recordBeamDamage(enemy, dealt);

      if (this.isConverging) {
        this.convergenceHitCount += 1;
        if (this.isEnemyInstabilityMarked(enemy)) {
          this.emitResonanceWave(enemy, tickDmg);
        }
      }
    }

    if (focusEnemy) {
      const fid = this.getEnemyId(focusEnemy);
      if (this.beamFocusId === fid) {
        this.beamFocusTime += tickDt;
      } else {
        this.beamFocusId = fid;
        this.beamFocusTime = tickDt;
      }
      if (this.beamFocusTime >= 1 && this.beamTickTimer <= 0.01) {
        if (Math.floor(this.beamFocusTime * 2) % 3 === 0) {
          createDamageText(`×${(ascMult * 100).toFixed(0)}%`, focusEnemy.position, '#ffd93d');
        }
      }
    } else {
      this.beamFocusId = null;
      this.beamFocusTime = 0;
    }

    if (this.isConverging && Math.random() < 0.6) {
      const sparkPos = hitOrigin.clone().add(mainDir.clone().multiplyScalar(2 + Math.random() * 6));
      spawnParticles(sparkPos, 0xaee8ff, 3);
    } else if (hitAny && Math.random() < 0.35) {
      spawnParticles(hitOrigin.clone().add(mainDir.clone().multiplyScalar(3)), CHRONO_COLOR(), 2);
    }
  }

  addFracture(dt, origin, dir) {
    if (!this.isBeaming || this.overheatTriggered || this.isConverging) return;
    if (this.fractureGauge >= CHRONO_FRACTURE.max) return;

    let rate = this.getFractureFillRate();
    if (this.getActiveLens(origin, dir)) rate *= 0.5;
    if (this.hasActiveInstabilityMark()) {
      rate /= CHRONO_SKILLS.dephasing.fractureDivisor;
    }
    this.fractureGauge = Math.min(CHRONO_FRACTURE.max, this.fractureGauge + rate * dt);

    if (this.fractureGauge >= CHRONO_FRACTURE.max) this.triggerOverheat();
  }

  triggerVoluntaryRupture() {
    const pos = this.position.clone();
    const { radius, dmgMult } = CHRONO_SKILLS.ruptureBurst;
    const surge = STATE.passives?.ruptureSurge ? 1.35 : 1;
    const dmg = STATE.stats.atk * dmgMult * surge * (this.fractureGauge / 100);

    createSkillVisual('nova', pos, radius, 0xffd93d, null);
    spawnParticles(pos, CHRONO_COLOR(), 18);
    createDamageText('RUPTURE', pos, '#ffd93d');

    if (Globals.enemies) {
      for (const e of Globals.enemies) {
        if (e.dead) continue;
        if (e.position.distanceTo(pos) <= radius) {
          this.dealMagicDamage(e, dmg, { skill: true, skillKey: 'rupture' });
        }
      }
    }

    this.fractureGauge = Math.max(0, this.fractureGauge - 45);
    this.fractureSilence = 0.25;
  }

  triggerOverheat() {
    if (!this.isBeaming || this.overheatTriggered || this.isConverging) return;
    this.overheatTriggered = true;

    const pos = this.position.clone();
    const { radius, dmgMult } = CHRONO_SKILLS.overheat;
    createSkillVisual('nova', pos, radius, 0xff4444, null);
    spawnParticles(pos, 0xff4444, 24);
    createDamageText('SURCHAUFFE!', pos, '#ff4444');

    const blastDmg = STATE.stats.atk * dmgMult;
    if (Globals.enemies) {
      for (const e of Globals.enemies) {
        if (e.dead) continue;
        if (e.position.distanceTo(pos) <= radius) {
          this.dealMagicDamage(e, blastDmg, { skill: true, skillKey: 'primary' });
        }
      }
    }

    this.stopDistortionBeam(true);
    this.fractureGauge = 0;
    this.fractureSilence = CHRONO_FRACTURE.silence;

    const backlash = Math.max(8, this.maxHp * CHRONO_SKILLS.overheat.backlashPct * this.getOverheatBacklashMult());
    this.takeDamage(backlash);
    AudioSys.sfx.hit();
  }

  startDistortionBeam() {
    if (this.isBeaming || this.fractureSilence > 0) return;
    this.overheatTriggered = false;
    this.faceMouse();
    this.isBeaming = true;
    this.isAttacking = true;
    this.animState.rightArmOverride = true;
    this.beamTickTimer = 0;

    if (this.isConverging) {
      this.syncConvergenceElectricSound();
    } else if (AudioSys.sfx?.sentinel?.laser) {
      AudioSys.sfx.sentinel.laser();
    } else {
      AudioSys.play('shoot');
    }

    if (STATE.multiplayer.active && Network) {
      Network.send({
        type: 'net-action',
        action: 'attack-range',
        id: STATE.multiplayer.id,
        class: this.className,
        pos: this.position,
        dir: this.getAimDir(),
        color: CHRONO_COLOR(),
        beam: true,
      });
    }

    this.refreshBeamVisuals();
    this.tickDistortionBeam();
    this.beamTickTimer = this.getBeamTickInterval();
  }

  stopDistortionBeam(fromOverheat = false) {
    if (!this.isBeaming && this.beamVisuals.length === 0) return;

    if (!fromOverheat && !this.isConverging && this.isBeaming && this.isInRuptureWindow()) {
      this.triggerVoluntaryRupture();
    }

    this.isBeaming = false;
    this.isAttacking = false;
    this.animState.rightArmOverride = false;
    this.beamFocusId = null;
    this.beamFocusTime = 0;
    if (this.armR) this.armR.rotation.x = 0;
    if (this.chronoOrb?.material) this.chronoOrb.material.emissiveIntensity = 1.8;
    this.destroyBeamVisuals();
    this.syncConvergenceElectricSound();
    this.attackCooldown = 0.15;
  }

  updateDistortionBeam(dt) {
    if (!this.isLocalPlayer()) return;

    const canBeam = STATE.mouseDown
      && !this.isStunned
      && !STATE.isPaused
      && !UI.isMenuOpen()
      && this.fractureSilence <= 0;

    if (!canBeam) {
      if (this.isBeaming) this.stopDistortionBeam(false);
      return;
    }

    if (!this.isBeaming) {
      if (this.attackCooldown <= 0) this.startDistortionBeam();
      return;
    }

    this.faceMouse();
    this.addFracture(dt, this.getBeamHitOrigin(), this.getAimDir());
    if (!this.isBeaming) return;

    this.beamTickTimer -= dt;
    if (this.beamTickTimer <= 0) {
      this.tickDistortionBeam();
      this.beamTickTimer = this.getBeamTickInterval();
    }

    if (this.isBeaming) {
      this.refreshBeamVisuals();
      this.updateElectricBeamFx(dt);
    }
    if (this.armR) this.armR.rotation.x = -0.95;
    if (this.chronoOrb?.material) {
      if (this.isConverging) {
        this.chronoOrb.material.emissiveIntensity = 4.5 + Math.sin(Date.now() * 0.03) * 0.8;
      } else {
        const heat = this.fractureGauge / CHRONO_FRACTURE.max;
        this.chronoOrb.material.emissiveIntensity = 2 + heat * 3 + Math.sin(Date.now() * 0.02) * 0.4;
      }
    }
  }

  performAttack() {
    if (this.isBeaming || this.fractureSilence > 0 || this.overheatTriggered) return;
    if (!STATE.mouseDown) return;
    this.startDistortionBeam();
  }

  takeDamage(amount) {
    if (this.dead) return;
    if (this.isIntangible) {
      createDamageText('ESQUIVÉ', this.position, '#aaddff');
      return;
    }

    amount = ConstellationEngine.modifyDamageTaken(amount);
    if (amount > 0) {
      this.hp -= amount;
      createDamageText('-' + Math.floor(amount), this.position, '#ff0000');
      this.flashColor(this.bodyGroup, 0xff0000);
      AudioSys.sfx.hit();
    }
    if (this.hp <= 0) {
      if (ConstellationEngine.tryLastBreath()) return;
      this.hp = 0;
      this.die();
    }
    if (this.isLocalPlayer()) UI.updateHUD();
  }

  spendFractureForSkill() {
    this.fractureGauge = Math.max(0, this.fractureGauge - this.getSkillFractureCost());
  }

  useSkill(key) {
    if (key === 'e' && this.isConverging) {
      this.endConvergence(true);
      return;
    }

    if (this.cooldowns[key] > 0) return;

    this.faceMouse();
    this.spendFractureForSkill();
    this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);
    this.broadcastSkillNetwork(key);

    if (key === 'space') this.skillFocusLens();
    else if (key === 'shift') this.skillMolecularDephasing();
    else if (key === 'e') this.skillTemporalConvergence();
  }

  skillFocusLens() {
    AudioSys.sfx.mage?.cast?.();
    const dir = this.getAimDir();
    const pos = this.position.clone().add(dir.clone().multiplyScalar(CHRONO_SKILLS.lens.placeDist));
    pos.y = 0.08;

    const geo = new THREE.CylinderGeometry(0.08, 0.2, 0.35, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7df9ff, emissive: CHRONO_COLOR(), emissiveIntensity: 1.2, transparent: true, opacity: 0.85,
    });
    const prism = new THREE.Mesh(geo, mat);
    prism.position.copy(pos);
    Globals.scene.add(prism);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(CHRONO_SKILLS.lens.radius - 0.1, CHRONO_SKILLS.lens.radius, 24),
      new THREE.MeshBasicMaterial({ color: CHRONO_COLOR(), transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.1, pos.z);
    Globals.scene.add(ring);

    this.lenses.push({
      pos: pos.clone(),
      radius: CHRONO_SKILLS.lens.radius,
      timer: CHRONO_SKILLS.lens.duration,
      mesh: prism,
      ring,
    });
    spawnParticles(pos, CHRONO_COLOR(), 12);
    createDamageText('LENTILLE', pos, '#7df9ff');
    this.addBuff('Lentille', CHRONO_SKILLS.lens.duration, 'fa-gem');
  }

  skillMolecularDephasing() {
    AudioSys.sfx.mage?.cast?.();
    const startPos = this.getBeamVisualOrigin();
    const dir = this.getAimDir();
    const grenade = new ChronoDephasingGrenade(this, startPos, dir);
    Globals.projectiles.push(grenade);
    createDamageText('LOBE', this.position, '#f39c12');
  }

  onDephasingGrenadeDetonate(pos) {
    const cfg = CHRONO_SKILLS.dephasing;
    let blastRadius = cfg.grenade.blastRadius;
    let markDuration = cfg.markDuration;
    if (STATE.passives?.freezeFieldAmp) {
      blastRadius += 2;
      markDuration += 2;
    }

    const blastDmg = STATE.stats.atk * cfg.grenade.blastDmgMult;
    if (Globals.enemies) {
      for (const enemy of Globals.enemies) {
        if (enemy.dead) continue;
        if (enemy.position.distanceTo(pos) > blastRadius + (enemy.radius || 0.5)) continue;
        this.dealMagicDamage(enemy, blastDmg, { skill: true, skillKey: 'shift' });
        this.applyInstabilityMark(enemy, markDuration);
      }
    }

    createDamageText('DÉPHASAGE', pos, '#f39c12');
    this.addBuff('Instabilité', markDuration, 'fa-atom');
  }

  skillTemporalConvergence() {
    AudioSys.sfx.mage?.cast?.();
    const burstPos = this.getBeamHitOrigin();
    createSkillVisual('nova', burstPos, 4.5, 0x66ddff, this.getAimDir());
    spawnParticles(burstPos, 0xaee8ff, 22);
    createDamageText('CONVERGENCE', this.position, '#aee8ff');
    AudioSys.sfx.chrono?.convergenceStart?.();
    this.beginConvergence();
  }

  beginConvergence() {
    const duration = this.getConvergenceDuration();

    this.isConverging = true;
    this.convergenceTimer = duration;
    this.convergenceHitCount = 0;
    this.overheatTriggered = false;
    this.addBuff('Convergence', duration, 'fa-rotate');

    if (!this.isBeaming && this.fractureSilence <= 0 && STATE.mouseDown) {
      this.startDistortionBeam();
    } else {
      this.syncConvergenceElectricSound();
    }
  }

  endConvergence(manual = false) {
    if (!this.isConverging) return;

    this.isConverging = false;
    this.convergenceTimer = 0;
    AudioSys.sfx.chrono?.electricBeamStop?.();
    AudioSys.sfx.chrono?.convergenceEnd?.();

    const cfg = CHRONO_SKILLS.convergence;
    const radius = this.getConvergenceFinaleRadius();
    const hitMult = 1 + this.convergenceHitCount * cfg.finalePerHitMult;
    const finaleDmg = STATE.stats.atk * cfg.finaleBaseDmgMult * hitMult;
    const center = this.isBeaming ? this.getConvergencePullTarget() : this.getBeamHitOrigin();

    createSkillVisual('nova', center, radius, 0x66ddff, null);
    spawnParticles(center, 0xaee8ff, manual ? 36 : 28);
    createDamageText(`×${this.convergenceHitCount}`, center, '#ffd93d');

    if (Globals.enemies) {
      for (const e of Globals.enemies) {
        if (e.dead) continue;
        if (e.position.distanceTo(center) > radius + (e.radius || 0.5)) continue;
        this.dealMagicDamage(e, finaleDmg, { skill: true, skillKey: 'e' });
      }
    }

    this.convergenceHitCount = 0;
    AudioSys.sfx.mage?.cast?.();
  }

  updateLenses(dt) {
    for (let i = this.lenses.length - 1; i >= 0; i--) {
      const l = this.lenses[i];
      l.timer -= dt;
      if (l.mesh) l.mesh.rotation.y += dt * 2;
      if (l.timer <= 0) {
        if (l.mesh) Globals.scene.remove(l.mesh);
        if (l.ring) Globals.scene.remove(l.ring);
        this.lenses.splice(i, 1);
      }
    }
  }

  updateInstabilityMarks(dt) {
    if (!Globals.enemies) return;
    for (const enemy of Globals.enemies) {
      if (!enemy._chronoInstabilityTimer) continue;
      enemy._chronoInstabilityTimer -= dt;
      if (enemy._chronoInstabilityTimer <= 0) {
        enemy._chronoInstabilityTimer = 0;
      }
    }
  }

  updateClassPassives(dt) {
    if (this.fractureSilence > 0) this.fractureSilence -= dt;
    updateChronoFractureUI(this.fractureGauge, this.fractureSilence, this.isLocalPlayer());
    this.updateLenses(dt);
    this.updateInstabilityMarks(dt);

    if (this.isConverging) {
      this.updateConvergencePull(dt);
      this.convergenceTimer -= dt;
      if (this.convergenceTimer <= 0) this.endConvergence(false);
    }

    const resourceEl = document.getElementById('class-resource');
    if (resourceEl && this.isLocalPlayer()) {
      resourceEl.style.display = 'none';
    }
  }

  applyMovementSpeed() {
    this.speed = STATE.stats.speed * this.getMovementSpeedMult();
  }

  update(dt) {
    this.updateDistortionBeam(dt);

    this.applyMovementSpeed();
    if (!this.isBeaming && this.beamVisuals.length > 0) {
      this.destroyBeamVisuals();
    }

    super.update(dt);

    this.applyMovementSpeed();
    if (!this.isBeaming && !STATE.mouseDown && this.beamVisuals.length > 0) {
      this.destroyBeamVisuals();
    }
  }

  animateCharacter(dt) {
    super.animateCharacter(dt);
    if (this.chronoOrb && !this.isBeaming) {
      this.chronoOrb.rotation.y += dt * 2;
      this.chronoOrb.material.emissiveIntensity = 1.2 + Math.sin(Date.now() * 0.004) * 0.5;
    }
  }
}
