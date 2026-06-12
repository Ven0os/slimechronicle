// @ts-nocheck
import * as THREE from 'three';
import { BaseEnemy } from '../../base_enemy';
import { AIBrain } from '../../ai_brain';
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { ENEMY_ATTACKS } from '@/core/enemy_attacks_config';
import { AudioSys } from '@/core/ressources'; 
import { spawnParticles, createSkillVisual } from '@/visual/effects';
import { SentinelModel } from './sentinel_model';
import { SentinelSkills } from './sentinel_skills';

export class Sentinel extends BaseEnemy {
    constructor(position, id = null) {
        super('sentinel', position, id);
        this.hp *= 2.5; 
        this.maxHp = this.hp;
        this.speed = 2.8; 
        this.scaleVal = 1.4;
        this.radius = 1.2; 
        this.ai = new AIBrain(this);
        this.animState = 'idle';
        this.moveSpeed = 0;
        this.config = ENEMY_ATTACKS.sentinel;
        
        this.model = new SentinelModel(this);
        this.skills = new SentinelSkills(this);

        // --- ANIMATION D'APPARITION (Météore) ---
        this.isSpawning = true;
        this.spawnTimer = 0;
        this.targetY = this.position.y;
        this.position.y += 25; 
    }

    update(dt) {
        // --- LOGIQUE SPAWN ---
        if (this.isSpawning) {
            this.spawnTimer += dt;
            const gravity = 50.0;
            this.position.y -= gravity * dt; 

            if (this.position.y <= this.targetY) {
                this.position.y = this.targetY;
                this.isSpawning = false;
                createSkillVisual('shockwave', this.position, 6.0, 0xaaaaaa);
                spawnParticles(this.position, 0x888888, 30); 
                if (this.config.spawn && this.config.spawn.sound) {
                    if(AudioSys.play) AudioSys.play(this.config.spawn.sound, 1.0);
                }
            }
            return; 
        }

        super.update(dt); 
        if (this.dead) return;
        if(this.mesh) this.mesh.scale.set(this.scaleVal, this.scaleVal, this.scaleVal);

        const target = this.getClosestTarget();
        this.updateMoveSpeed(dt);
        this.model.updateAnim(dt);

        if (this.hudGroup && Globals.camera) {
            this.hpBar.scale.x = Math.max(0, this.hp / this.maxHp);
            this.hudGroup.lookAt(Globals.camera.position); 
        }

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            if (this.isAttacking) { } 
            else if (target) {
                let moveDir = this.ai.update(dt, target);
                moveDir = this.ai.applyMiniBossPursuit(moveDir);
                moveDir = this.ai.avoidance(moveDir);
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
            this.moveSpeed = THREE.MathUtils.lerp(this.moveSpeed, dist / dt, dt * 5); 
        } else {
            this.moveSpeed = 0;
        }
        this.lastPos = currentPos;
    }
}