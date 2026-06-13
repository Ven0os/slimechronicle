// @ts-nocheck
import * as THREE from 'three';
import { BaseEnemy } from '../../base_enemy';
import { AIBrain } from '../../ai_brain';
import { STATE } from '@/core/config';
import { ENEMY_ATTACKS } from '@/core/enemy_attacks_config';
import { AudioSys } from '@/core/ressources'; 
import { spawnParticles, createSkillVisual } from '@/visual/effects';
import { ShamanModel } from './shaman_model';
import { ShamanSkills } from './shaman_skills';

export class Shaman extends BaseEnemy {
    constructor(position, id = null) {
        super('shaman', position, id);
        this.hp *= 0.9; // Support is slightly fragile
        this.maxHp = this.hp;
        this.speed = 3.2; // Slow waddling speed
        this.scaleVal = 0.9; // Small gnome scale
        this.radius = 0.6; // Small collision radius
        this.ai = new AIBrain(this);
        this.animState = 'idle';
        this.moveSpeed = 0;
        this.config = ENEMY_ATTACKS.shaman;
        
        // Modules init
        this.model = new ShamanModel(this);
        this.skills = new ShamanSkills(this);

        // --- SPAWN ANIMATION ---
        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            this.isSpawning = true;
            this.spawnTimer = 0;
            this.targetY = this.position.y;
            this.position.y -= 2.0; 
            if(this.mesh) this.mesh.scale.set(0, 0, 0);

            if (this.config && this.config.spawn && this.config.spawn.sound) {
                if(AudioSys.play) AudioSys.play(this.config.spawn.sound, 0.7);
            } else {
                if(AudioSys.play) AudioSys.play('warlock_spawn', 0.6);
            }
        } else {
            this.isSpawning = false;
        }
    }

    update(dt) {
        // --- LOGIQUE SPAWN ---
        if (this.isSpawning) {
            this.spawnTimer += dt;
            const duration = 1.0; 
            const t = Math.min(this.spawnTimer / duration, 1);
            
            this.position.y = THREE.MathUtils.lerp(-2.0, this.targetY, t);
            
            const scale = t * this.scaleVal;
            if (this.mesh) this.mesh.scale.set(scale, scale, scale);
            
            if(Math.random() < 0.3) {
                spawnParticles(this.position.clone().add(new THREE.Vector3((Math.random()-0.5)*0.5, 0.2, (Math.random()-0.5)*0.5)), 0x2ecc71, 1);
            }

            if(t >= 1) {
                this.isSpawning = false;
                this.position.y = this.targetY;
                createSkillVisual('shockwave', this.position, 1.5, 0x2ecc71);
            }
            return;
        }

        super.update(dt); 
        if (this.dead) return;
        if(this.mesh) this.mesh.scale.set(this.scaleVal, this.scaleVal, this.scaleVal);

        const target = this.getClosestTarget();
        this.updateMoveSpeed(dt);
        this.model.updateAnim(dt);

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            if (this.isAttacking || this.isChanneling) {
                // If healing, stay still and face target
                // Handled inside skills or model update
            } 
            else if (target) {
                // Shaman keeps a safe distance, doesn't rush directly into player unless alone and casting
                // Let's use AI brain to update direction
                let moveDir = this.ai.update(dt, target);
                moveDir = this.ai.applyMiniBossPursuit(moveDir);
                moveDir = this.ai.avoidance(moveDir);

                // Support preference: stay somewhat close to other allies, or back off from the player if they get too close
                const distToPlayer = this.position.distanceTo(target.position);
                if (distToPlayer < 7.0) {
                    // Back away from the player
                    const retreatDir = this.position.clone().sub(target.position).normalize();
                    retreatDir.y = 0;
                    moveDir.add(retreatDir.multiplyScalar(0.8)).normalize();
                }

                // Avoid backing into structures or other obstacles
                if (Globals.obstacles) {
                    for (const obs of Globals.obstacles) {
                        const distToObs = this.position.distanceTo(obs.position);
                        const avoidDist = (obs.radius || 1.5) + this.radius + 1.2;
                        if (distToObs < avoidDist) {
                            const avoidDir = this.position.clone().sub(obs.position).normalize();
                            avoidDir.y = 0;
                            if (avoidDir.lengthSq() === 0) {
                                avoidDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                            }
                            // Push away from the obstacle
                            moveDir.add(avoidDir.multiplyScalar(1.5)).normalize();
                        }
                    }
                }

                if (moveDir.length() > 0.1) {
                    this.position.add(moveDir.multiplyScalar(this.speed * STATE.timeScale * dt));
                    this.lookAt(this.position.x + moveDir.x, this.position.y, this.position.z + moveDir.z);
                }
                this.skills.checkAttackTrigger(target, dt);
            }
        }
    }

    updateMoveSpeed(dt) {
        const currentPos = this.position.clone();
        if(this.lastPos) {
            const dist = currentPos.distanceTo(this.lastPos);
            this.moveSpeed = THREE.MathUtils.lerp(this.moveSpeed, dist / dt, dt * 10);
        } else {
            this.moveSpeed = 0;
        }
        this.lastPos = currentPos;
    }
}
