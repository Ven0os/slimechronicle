// @ts-nocheck
import * as THREE from 'three';
import { BaseEnemy } from '../../base_enemy';
import { AIBrain } from '../../ai_brain';
import { STATE } from '@/core/config';
import { ENEMY_ATTACKS } from '@/core/enemy_attacks_config';
import { AudioSys } from '@/core/ressources'; 
import { spawnParticles, createSkillVisual } from '@/visual/effects';
import { WarlockModel } from './warlock_model';
import { WarlockSkills } from './warlock_skills';

export class Warlock extends BaseEnemy {
    constructor(position, id = null) {
        super('warlock', position, id);
        this.hp *= 1.2;
        this.maxHp = this.hp;
        this.speed = 4.5;
        this.scaleVal = 1.1;
        this.radius = 1.0; 
        this.ai = new AIBrain(this);
        this.animState = 'idle';
        this.moveSpeed = 0;
        this.config = ENEMY_ATTACKS.warlock;
        
        // Initialisation des modules
        this.model = new WarlockModel(this);
        this.skills = new WarlockSkills(this);

        // --- ANIMATION D'APPARITION (Rituel) ---
        this.isSpawning = true;
        this.spawnTimer = 0;
        
        // On le cache sous le sol
        this.targetY = this.position.y;
        this.position.y -= 3.0; 
        if(this.mesh) this.mesh.scale.set(0,0,0);

        if (this.config.spawn && this.config.spawn.sound) {
            if(AudioSys.play) AudioSys.play(this.config.spawn.sound, 0.7);
        }
    }

    update(dt) {
        // --- LOGIQUE SPAWN ---
        if (this.isSpawning) {
            this.spawnTimer += dt;
            const duration = 1.5; 
            const t = Math.min(this.spawnTimer / duration, 1);
            
            // Montée progressive du sol
            this.position.y = THREE.MathUtils.lerp(-3.0, this.targetY, t);
            
            // Echelle grandissante
            const scale = t * this.scaleVal;
            this.mesh.scale.set(scale, scale, scale);
            
            // Effet visuel : Particules spirales
            if(Math.random() < 0.4) {
                const angle = t * Math.PI * 4; // Spirale
                const r = 1.5 * (1-t);
                const pPos = this.position.clone().add(new THREE.Vector3(Math.cos(angle)*r, 0, Math.sin(angle)*r));
                spawnParticles(pPos, 0x8e44ad, 1);
            }

            if(t >= 1) {
                this.isSpawning = false;
                this.position.y = this.targetY;
                // Cercle d'invocation au sol à la fin
                createSkillVisual('shockwave', this.position, 3.0, 0x8e44ad);
            }
            return; // Bloque l'IA
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
            if (this.isAttacking || this.isChanneling) {
                if(target) this.lookAt(target.position.x, this.position.y, target.position.z);
            } 
            else if (target) {
                let moveDir = this.ai.update(dt, target);
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
            this.moveSpeed = THREE.MathUtils.lerp(this.moveSpeed, dist / dt, dt * 10);
        } else {
            this.moveSpeed = 0;
        }
        this.lastPos = currentPos;
    }
}