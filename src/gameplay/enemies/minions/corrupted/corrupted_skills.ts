// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { createDamageText, createTelegraph } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { damagePlayer, damageAllPlayersInRadius } from '@/multiplayer/net_combat';

export class CorruptedSkills {
    constructor(enemy) {
        this.enemy = enemy;
    }

    checkAttackTrigger(target, dt) {
        if (this.enemy.attackCooldown > 0) return;
        const dist = this.enemy.position.distanceTo(target.position);

        if (dist < 2.8) this.attackCorruptSlash(target);
        else if (dist > 5.0 && dist < 10.0 && Math.random() < 0.1) this.attackCorruptPulse(target);
    }

    attackCorruptSlash(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'windup_corrupt';
        const cfg = this.enemy.config.slash;

        const dir = target.position.clone().sub(this.enemy.position).normalize();
        const angle = Math.atan2(dir.x, dir.z);
        const offsetPos = this.enemy.position.clone().add(dir.clone().multiplyScalar(cfg.range / 2));

        this.spawnTelegraphNetwork(offsetPos, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            this.enemy.animState = 'strike_corrupt';
            if (cfg.sound && AudioSys.play) AudioSys.play(cfg.sound);

            if (target.position.distanceTo(this.enemy.position) < cfg.range) {
                const toP = target.position.clone().sub(this.enemy.position).normalize();
                if (toP.dot(this.enemy.getWorldDirection(new THREE.Vector3())) > 0.45) {
                    const push = dir.clone().multiplyScalar(cfg.pushForce);
                    push.y = 0;
                    damagePlayer(target, cfg.damage, { knockback: push });
                    createDamageText('CORRUPTION', target.position, '#a855f7');
                }
            }

            setTimeout(() => {
                this.enemy.animState = 'idle';
                this.enemy.isAttacking = false;
            }, 300);
        }, angle);

        this.enemy.attackCooldown = cfg.cooldown;
    }

    attackCorruptPulse(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'cast_pulse';
        const cfg = this.enemy.config.corruptPulse;

        this.spawnTelegraphNetwork(this.enemy.position, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            if (cfg.sound && AudioSys.play) AudioSys.play(cfg.sound);

            damageAllPlayersInRadius(this.enemy.position, cfg.radius, cfg.damage);
            createDamageText('PULSE', this.enemy.position, '#a855f7');

            setTimeout(() => {
                this.enemy.animState = 'idle';
                this.enemy.isAttacking = false;
            }, 350);
        });

        this.enemy.attackCooldown = cfg.cooldown;
    }

    spawnTelegraphNetwork(pos, shape, size, duration, color, onComplete, rotationY = 0) {
        const t = createTelegraph(pos, shape, size, duration, color, onComplete, rotationY);
        this.enemy.trackTelegraph(t);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({
                type: 'telegraph-spawn',
                pos: { x: pos.x, y: pos.y, z: pos.z },
                shape,
                size,
                duration,
                color,
                rotationY,
            });
        }
    }
}
