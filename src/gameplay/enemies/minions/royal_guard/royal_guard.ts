// @ts-nocheck
import * as THREE from 'three';
import { BaseEnemy } from '../../base_enemy';
import { AIBrain } from '../../ai_brain';
import { STATE } from '@/core/config';
import { ENEMY_ATTACKS } from '@/core/enemy_attacks_config';
import { AudioSys } from '@/core/ressources'; 
import { RoyalGuardModel } from './royal_guard_model';
import { RoyalGuardSkills } from './royal_guard_skills';

export class RoyalGuard extends BaseEnemy {
    constructor(position, id = null) {
        super('royal_guard', position, id);
        this.hp = 180 + (STATE.level * 20);
        this.maxHp = this.hp;
        this.speed = 5.5; 
        this.scaleVal = 1.3; 
        this.radius = 1.0; 

        this.ai = new AIBrain(this);
        this.animState = 'idle';
        this.moveSpeed = 0;
        this.config = ENEMY_ATTACKS.royal_guard;
        
        this.model = new RoyalGuardModel(this);
        this.skills = new RoyalGuardSkills(this);

        // SON ENTREE
        if (this.config.spawn && this.config.spawn.sound) {
            setTimeout(() => { if(AudioSys.play) AudioSys.play(this.config.spawn.sound, 0.6); }, 200);
        }
    }
    
    update(dt) {
        super.update(dt);
        if(this.dead) return;
        this.model.updateAnim(dt);
        
        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            const target = this.getClosestTarget();
            if (this.isAttacking) {
            } else if (target) {
                let moveDir = this.ai.update(dt, target);
                moveDir = this.ai.avoidance(moveDir);
                if (moveDir.length() > 0.1) {
                    this.position.add(moveDir.multiplyScalar(this.speed * STATE.timeScale * dt));
                    this.lookAt(this.position.x + moveDir.x, this.position.y, this.position.z + moveDir.z);
                    this.moveSpeed = 1;
                } else {
                    this.moveSpeed = 0;
                }
                this.skills.checkAttackTrigger(target, dt);
            }
        }
    }
}