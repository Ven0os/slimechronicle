// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { createDamageText, spawnParticles, createSkillVisual, createTelegraph } from '../../../../visual/effects';
import { Network } from '@/multiplayer/network';
import { damagePlayer, damagePlayersInBeam, getAllLivingPlayers } from '@/multiplayer/net_combat';
import { Projectile } from '../../../entities';

export class WarlockSkills {
    constructor(enemy) {
        this.enemy = enemy;
    }

    checkAttackTrigger(target, dt) {
        if (this.enemy.attackCooldown > 0 || !target) return;
        const dist = this.enemy.position.distanceTo(target.position);
        if (dist < 6.0 && Math.random() < 0.12) this.attackWarlockTeleport(target);
        else if (dist < 10.0 && Math.random() < 0.14) this.attackWarlockZone(target);
        else if (dist < 14.0 && Math.random() < 0.12) this.attackWarlockBeam(target);
        else if (dist < 16.0 && Math.random() < 0.22) this.attackWarlockBolt(target);
    }

    attackWarlockBolt(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'cast_bolt';
        const cfg = this.enemy.config.bolt; 

        if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
        spawnParticles(this.enemy.position, 0x00ffff, 5);
        setTimeout(() => {
            if (this.enemy.dead) return;
            const dir = target.position.clone().sub(this.enemy.position).normalize();
            const startPos = this.enemy.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(dir.clone().multiplyScalar(0.5));
            
            // Premium projectile geometry (sphere core)
            const projGeo = new THREE.SphereGeometry(0.18, 16, 16);
            const projMat = new THREE.MeshStandardMaterial({ color: 0x240046, emissive: 0x9d4edd, emissiveIntensity: 3.0 });
            const proj = new Projectile(projGeo, projMat, startPos, dir, cfg.speed, cfg.damage, 'enemy', 0xbd00ff);
            
            // Add a floating orbiting gold ring and smaller glowing crystal shards around the main orb
            const orbRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.32, 0.03, 4, 16), 
                new THREE.MeshStandardMaterial({
                    color: 0xffb703,
                    metalness: 0.9,
                    roughness: 0.1,
                    emissive: 0xffaa00,
                    emissiveIntensity: 0.5
                })
            );
            orbRing.rotation.x = Math.PI / 2;
            proj.mesh.add(orbRing);
            
            const shardL = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
            shardL.position.set(-0.36, 0, 0);
            proj.mesh.add(shardL);

            const shardR = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
            shardR.position.set(0.36, 0, 0);
            proj.mesh.add(shardR);

            proj.sourceEnemy = this.enemy;
            proj.isAbility = true;
            Globals.projectiles.push(proj);

            this.enemy.isAttacking = false;
            this.enemy.animState = 'idle';
        }, cfg.castTime * 1000); 
        this.enemy.attackCooldown = cfg.cooldown; 
    }

    attackWarlockZone(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'cast_zone';
        const cfg = this.enemy.config.voidZone; 

        const zonePos = target.position.clone();
        zonePos.y = 0;
        this.spawnTelegraphNetwork(zonePos, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            // Spawns meteor first, which on impact creates the vortex spikes and does damage!
            createSkillVisual('meteor', zonePos, cfg.radius, 0x8e44ad, () => {
                createSkillVisual('vortex', zonePos, cfg.radius, 0x8e44ad);
                if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
                getAllLivingPlayers().forEach((t) => {
                    if (zonePos.distanceTo(t.position) < cfg.radius) {
                        const pull = zonePos.clone().sub(t.position).normalize().multiplyScalar(cfg.pullForce || 0);
                        pull.y = 0;
                        this.enemy.dealPlayerDamage(t, cfg.damage, {
                            knockback: pull,
                            stunDuration: cfg.stunDuration,
                            isAbility: true,
                        });
                    }
                });
            });
            this.enemy.isAttacking = false;
            this.enemy.animState = 'idle';
        });
        this.enemy.attackCooldown = cfg.cooldown; 
    }

    attackWarlockBeam(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'cast_beam';
        createDamageText("CANALISATION !", this.enemy.position, '#8e44ad');
        const cfg = this.enemy.config.beam; 
        const dir = target.position.clone().sub(this.enemy.position).normalize();
        dir.y = 0;
        const offsetPos = this.enemy.position.clone().add(dir.clone().multiplyScalar(cfg.length/2));

        this.spawnTelegraphNetwork(offsetPos, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            createSkillVisual('beam', this.enemy.position.clone().add(new THREE.Vector3(0,1,0)), cfg.length, 0xff00ff, dir);
            if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
            const beamDir = dir.clone();
            beamDir.y = 0;
            if (beamDir.lengthSq() >= 0.001) {
                beamDir.normalize();
                getAllLivingPlayers().forEach((t) => {
                    const toP = t.position.clone().sub(this.enemy.position);
                    toP.y = 0;
                    const dist = toP.length();
                    if (dist < cfg.length && dist > 0 && toP.normalize().dot(beamDir) > 0.9) {
                        this.enemy.dealPlayerDamage(t, cfg.damage, { isAbility: true, isRanged: true });
                    }
                });
            }
            this.enemy.isAttacking = false;
            this.enemy.animState = 'idle';
        }, Math.atan2(dir.x, dir.z));
        this.enemy.attackCooldown = cfg.cooldown; 
    }

    attackWarlockTeleport(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'teleport';
        const cfg = this.enemy.config.teleport; 
        if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 

        spawnParticles(this.enemy.position, 0x00ffff, 10);
        setTimeout(() => {
            const escapeDir = this.enemy.position.clone().sub(target.position).normalize();
            escapeDir.applyAxisAngle(new THREE.Vector3(0,1,0), (Math.random()-0.5));
            const newPos = this.enemy.position.clone().add(escapeDir.multiplyScalar(cfg.dist));
            newPos.x = Math.max(-40, Math.min(40, newPos.x));
            newPos.z = Math.max(-40, Math.min(40, newPos.z));
            this.enemy.position.copy(newPos);
            this.enemy.mesh.scale.setScalar(this.enemy.scaleVal);
            spawnParticles(this.enemy.position, 0x00ffff, 10);
            this.enemy.isAttacking = false;
            this.enemy.animState = 'idle';
        }, cfg.castTime * 1000); 
        this.enemy.attackCooldown = cfg.cooldown; 
    }

    spawnTelegraphNetwork(pos, shape, size, duration, color, onComplete, rotationY = 0) {
        const t = createTelegraph(pos, shape, size, duration, color, onComplete, rotationY);
        this.enemy.trackTelegraph(t);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'telegraph-spawn', pos: { x: pos.x, y: pos.y, z: pos.z }, shape: shape, size: size, duration: duration, color: color, rotationY: rotationY });
        }
    }
}