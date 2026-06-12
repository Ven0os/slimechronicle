// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { createDamageText, createTelegraph, createSkillVisual } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { damagePlayer, getAllLivingPlayers } from '@/multiplayer/net_combat';

export class RoyalGuardSkills {
    constructor(enemy) {
        this.enemy = enemy;
    }

    checkAttackTrigger(target, dt) {
        if (this.enemy.attackCooldown > 0) return;
        const dist = this.enemy.position.distanceTo(target.position);
        if (dist < 2.5) {
            if (Math.random() < 0.7) this.attackSlash(target);
            else this.attackStomp(target);
        }
    }

    attackSlash(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'windup_slash';
        this.enemy.lookAt(target.position.x, this.enemy.position.y, target.position.z);
        const cfg = this.enemy.config.slash;

        const dir = target.position.clone().sub(this.enemy.position).normalize();
        const offset = this.enemy.position.clone().add(dir.multiplyScalar(1.5));
        const angle = Math.atan2(dir.x, dir.z);

        this.spawnTelegraphNetwork(offset, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            this.enemy.animState = 'strike_slash';
            if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
            createSkillVisual('slash', this.enemy.position, 2.5, cfg.telegraph.color, dir);
            
            if (target.position.distanceTo(this.enemy.position) < cfg.range) {
                const toP = target.position.clone().sub(this.enemy.position).normalize();
                if (toP.dot(dir) > 0.5) {
                    const push = dir.clone().multiplyScalar(cfg.pushForce);
                    push.y = 0;
                    this.enemy.dealPlayerDamage(target, cfg.damage, { knockback: push });
                }
            }
            setTimeout(() => { this.enemy.animState = 'idle'; this.enemy.isAttacking = false; }, 300);
        }, angle);
        this.enemy.attackCooldown = cfg.cooldown;
    }

    attackStomp(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'windup_stomp';
        const cfg = this.enemy.config.stomp;

        this.spawnTelegraphNetwork(this.enemy.position, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            this.enemy.mesh.position.y = 0; 
            if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
            createSkillVisual('shockwave', this.enemy.position, cfg.radius, cfg.telegraph.color);
            
            getAllLivingPlayers().forEach((t) => {
                if (this.enemy.position.distanceTo(t.position) < cfg.radius) {
                    const push = t.position.clone().sub(this.enemy.position).normalize().multiplyScalar(cfg.pushForce);
                    push.y = 0;
                    this.enemy.dealPlayerDamage(t, cfg.damage, { knockback: push, stunDuration: cfg.stunDuration });
                    createDamageText("STOMP", t.position, '#ffaa00');
                }
            });
            setTimeout(() => { this.enemy.animState = 'idle'; this.enemy.isAttacking = false; }, 400);
        });
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