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
        
        if (dist < 10.0 && dist > 4.0 && Math.random() < 0.15) this.attackWarlockShackles(target);
        else if (dist < 6.0 && Math.random() < 0.12) this.attackWarlockTeleport(target);
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
            
            // Premium projectile geometry (faceted cosmic runic prism)
            const projGeo = new THREE.CylinderGeometry(0, 0.13, 0.55, 4); 
            projGeo.rotateX(Math.PI / 2); // align along Z
            const projMat = new THREE.MeshStandardMaterial({ 
                color: 0x1a052e, 
                emissive: 0x9d4edd, 
                emissiveIntensity: 3.5,
                metalness: 0.9,
                roughness: 0.1
            });
            const proj = new Projectile(projGeo, projMat, startPos, dir, cfg.speed, cfg.damage, 'enemy', 0xbd00ff, true);
            
            // Add dual concentric orbiting rings rotating in opposite directions
            const innerRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.24, 0.015, 3, 12),
                new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.9, roughness: 0.2 })
            );
            innerRing.rotation.x = Math.PI / 2;
            proj.mesh.add(innerRing);

            const outerRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.34, 0.015, 3, 16),
                new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.9, roughness: 0.2 })
            );
            outerRing.rotation.y = Math.PI / 2;
            proj.mesh.add(outerRing);

            // Add 3 small floating crystals orbiting the core
            const crystalGeo = new THREE.OctahedronGeometry(0.06);
            const crystalMat = new THREE.MeshBasicMaterial({ color: 0xe0aaff });
            const crystals = [];
            for (let i = 0; i < 3; i++) {
                const crystal = new THREE.Mesh(crystalGeo, crystalMat);
                const angle = (i / 3) * Math.PI * 2;
                crystal.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0);
                proj.mesh.add(crystal);
                crystals.push(crystal);
            }

            // Animate rings and crystals in the update loop via userData hook
            proj.mesh.userData = {
                animate: (dt) => {
                    const time = Date.now() * 0.005;
                    innerRing.rotation.z += dt * 6;
                    outerRing.rotation.x -= dt * 4;
                    // Orbiting crystals
                    crystals.forEach((c, idx) => {
                        const customAngle = (idx / 3) * Math.PI * 2 + time * 5;
                        c.position.set(Math.cos(customAngle) * 0.42, Math.sin(customAngle) * 0.42, Math.sin(time * 8 + idx) * 0.1);
                    });
                }
            };

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

    attackWarlockShackles(target) {
        this.enemy.isChanneling = true;
        this.enemy.animState = 'cast_beam'; // Leans forward and channels
        const cfg = {
            damage: 5, // tick damage
            heal: 5, // heal amount
            duration: 3.0,
            cooldown: 8.0,
            sound: 'warlock_curse'
        };

        if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound);
        createDamageText("LIEN DU NÉANT !", this.enemy.position, '#bd00ff');

        // Spawn link visual
        createSkillVisual('shackles_link', this.enemy.position, cfg.duration, 0xbd00ff, {
            source: this.enemy,
            target: target
        });

        let ticks = 0;
        const maxTicks = 6;
        const intervalId = setInterval(() => {
            if (this.enemy.dead || !this.enemy.isChanneling) {
                clearInterval(intervalId);
                this.enemy.isChanneling = false;
                if (!this.enemy.dead) this.enemy.animState = 'idle';
                return;
            }

            // Check distance
            const dist = this.enemy.position.distanceTo(target.position);
            if (dist > 13.0) {
                clearInterval(intervalId);
                return;
            }

            // Deal damage to target and heal warlock
            this.enemy.dealPlayerDamage(target, cfg.damage, { isAbility: true });
            
            // Heal warlock (capped at max Hp)
            if (!this.enemy.dead && !(this.enemy._antiHealUntil && Date.now() < this.enemy._antiHealUntil)) {
                this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + cfg.heal);
                createDamageText(`+${cfg.heal}`, this.enemy.position, '#2ecc71');
                spawnParticles(this.enemy.position, 0x2ecc71, 3);
            } else if (!this.enemy.dead) {
                createDamageText('ANTI-SOIN', this.enemy.position, '#ff2d55');
            }

            ticks++;
            if (ticks >= maxTicks) {
                clearInterval(intervalId);
                this.enemy.isChanneling = false;
                this.enemy.animState = 'idle';
            }
        }, 500);

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
