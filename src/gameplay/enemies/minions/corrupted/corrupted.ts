// @ts-nocheck

import * as THREE from 'three';

import { BaseEnemy } from '../../base_enemy';

import { AIBrain } from '../../ai_brain';

import { Globals } from '@/core/globals';

import { STATE } from '@/core/config';

import { ENEMY_ATTACKS } from '@/core/enemy_attacks_config';

import { AudioSys } from '@/core/ressources';

import { createDamageText } from '@/visual/effects';

import { CorruptedModel } from './corrupted_model';

import { CorruptedSkills } from './corrupted_skills';



export class Corrupted extends BaseEnemy {

    constructor(position, id = null) {

        super('corrupted', position, id);



        this.hp *= 1.25;

        this.maxHp = this.hp;

        this.maxBarrierHp = this.maxHp * 0.5;

        this.barrierHp = this.maxBarrierHp;



        this.speed = 4.2;

        this.scaleVal = 1.22;
        this.type = 'corrupted';

        this.radius = 1.0;



        this.ai = new AIBrain(this);

        this.animState = 'idle';

        this.moveSpeed = 0;

        this.config = ENEMY_ATTACKS.corrupted;



        this.model = new CorruptedModel(this);

        this.skills = new CorruptedSkills(this);



        this.isSpawning = true;

        this.spawnTimer = 0;

        if (this.mesh) this.mesh.scale.set(0, 0, 0);



        if (this.config.spawn?.sound && AudioSys.play) {

            AudioSys.play(this.config.spawn.sound, 0.7);

        }

    }



    takeDamage(amount) {

        let hpDamage = amount;



        if (this.barrierHp > 0) {

            const absorbed = Math.min(this.barrierHp, hpDamage);

            this.barrierHp -= absorbed;

            hpDamage -= absorbed;



            if (absorbed > 0) {

                createDamageText(Math.floor(absorbed), this.position, '#a855f7');

            }

        }



        if (hpDamage > 0) {

            super.takeDamage(hpDamage);

        }

    }



    update(dt) {

        if (this.isSpawning) {

            this.spawnTimer += dt;

            const duration = 0.5;



            if (this.spawnTimer < duration) {

                const progress = this.spawnTimer / duration;

                const easeOut = 1 - Math.pow(1 - progress, 3);

                const scale = easeOut * this.scaleVal;

                this.mesh.scale.set(scale, scale, scale);

            } else {

                this.mesh.scale.set(this.scaleVal, this.scaleVal, this.scaleVal);

                this.isSpawning = false;

            }

            return;

        }



        super.update(dt);

        if (this.dead) return;

        if (this.mesh) this.mesh.scale.set(this.scaleVal, this.scaleVal, this.scaleVal);



        const target = this.getClosestTarget();

        this.updateMoveSpeed(dt);

        this.model.updateAnim(dt);



        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {

            if (!this.isAttacking && target) {

                let moveDir = this.ai.update(dt, target);

                moveDir = this.ai.avoidance(moveDir);

                if (moveDir.length() > 0.01) {

                    this.position.add(moveDir.multiplyScalar(this.speed * STATE.timeScale * dt));

                    this.lookAt(this.position.x + moveDir.x, this.position.y, this.position.z + moveDir.z);

                }

                this.skills.checkAttackTrigger(target, dt);

            }

        }

    }



    updateMoveSpeed(dt) {

        const currentPos = this.position.clone();

        if (this.lastPos) {

            const dist = currentPos.distanceTo(this.lastPos);

            this.moveSpeed = THREE.MathUtils.lerp(this.moveSpeed, dist / dt, dt * 10);

        } else {

            this.moveSpeed = 0;

        }

        this.lastPos = currentPos;

    }

}

