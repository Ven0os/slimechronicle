// @ts-nocheck
import * as THREE from 'three';
import { BaseEnemy } from '../../base_enemy';
import { AIBrain } from '../../ai_brain';
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { ENEMY_ATTACKS } from '@/core/enemy_attacks_config';
import { AudioSys } from '@/core/ressources';
import { spawnParticles } from '@/visual/effects';
import { RogueModel } from './rogue_model';
import { RogueSkills } from './rogue_skills';

export class Rogue extends BaseEnemy {
    constructor(position, id = null) {
        super('rogue', position, id);

        this.hp *= 0.9;
        this.maxHp = this.hp;
        this.speed = 6.0;
        this.scaleVal = 1.0;
        this.radius = 0.8; 

        this.ai = new AIBrain(this);
        this.animState = 'idle';
        this.moveSpeed = 0;
        
        this.config = ENEMY_ATTACKS.rogue;
        
        // Initialisation des sous-systèmes
        this.model = new RogueModel(this);
        this.skills = new RogueSkills(this);

        // --- ANIMATION D'APPARITION ---
        this.isSpawning = true;
        this.spawnTimer = 0;
        if(this.mesh) this.mesh.scale.set(0, 0, 0);
        
        if (this.config.spawn && this.config.spawn.sound) {
            if(AudioSys.play) AudioSys.play(this.config.spawn.sound, 0.6);
        }
        spawnParticles(this.position, 0x555555, 10);
    }

    update(dt) {
        // --- LOGIQUE SPAWN ---
        if (this.isSpawning) {
            this.spawnTimer += dt;
            const duration = 0.6;
            
            if (this.spawnTimer < duration) {
                const progress = this.spawnTimer / duration;
                const easeOut = 1 - Math.pow(1 - progress, 3);
                this.mesh.rotation.y += dt * 15 * (1 - progress); 
                const scale = easeOut * this.scaleVal;
                this.mesh.scale.set(scale, scale, scale);
                if(Math.random() < 0.3) spawnParticles(this.position, 0x888888, 1);
            } else {
                this.mesh.scale.set(this.scaleVal, this.scaleVal, this.scaleVal);
                this.mesh.rotation.y = 0; 
                this.isSpawning = false;
                spawnParticles(this.position, 0x333333, 15);
            }
            return;
        }

        super.update(dt); 
        if (this.dead) return;
        if(this.mesh && this.animState !== 'teleport_cast' && this.animState !== 'teleport_appear') {
            this.mesh.scale.set(this.scaleVal, this.scaleVal, this.scaleVal);
        }

        const target = this.getClosestTarget();
        this.updateMoveSpeed(dt);
        
        // Mise à jour visuelle via le modèle
        this.model.updateAnim(dt);

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            if (this.isAttacking) { } 
            else if (target) {
                let moveDir = this.ai.update(dt, target);
                moveDir = this.ai.applyMiniBossPursuit(moveDir);
                moveDir = this.ai.avoidance(moveDir);
                if (moveDir.length() > 0.01) {
                    this.position.add(moveDir.multiplyScalar(this.speed * STATE.timeScale * dt));
                    this.lookAt(this.position.x + moveDir.x, this.position.y, this.position.z + moveDir.z);
                }
                // Vérification des attaques via le module Skills
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