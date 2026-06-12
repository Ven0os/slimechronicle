// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { createDamageText, createTelegraph, createSkillVisual } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { damagePlayer, getAllLivingPlayers } from '@/multiplayer/net_combat';

export class SentinelSkills {
    constructor(enemy) {
        this.enemy = enemy;
    }

    checkAttackTrigger(target, dt) {
        if (this.enemy.attackCooldown > 0) return;
        const dist = this.enemy.position.distanceTo(target.position);
        if (dist < 3.0) {
            if (Math.random() < 0.35) this.attackSmash(target);
            else if (Math.random() < 0.35) this.attackShieldBash(target);
        }
        else if (dist > 7.0 && dist < 13.0 && Math.random() < 0.18) {
            this.attackCharge(target);
        }
    }

    attackSmash(target) {
        this.enemy.lookAt(target.position.x, this.enemy.position.y, target.position.z);
        this.enemy.isAttacking = true;
        this.enemy.animState = 'windup_smash';
        const cfg = this.enemy.config.smash;

        this.spawnTelegraphNetwork(this.enemy.position, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            this.enemy.animState = 'strike_smash';
            setTimeout(() => { 
                if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
                createSkillVisual('shockwave', this.enemy.position, cfg.radius, 0x95a5a6);
                getAllLivingPlayers().forEach((t) => {
                    if (this.enemy.position.distanceTo(t.position) < cfg.radius) {
                        const push = t.position.clone().sub(this.enemy.position).normalize().multiplyScalar(cfg.pushForce);
                        push.y = 0;
                        this.enemy.dealPlayerDamage(t, cfg.damage, { knockback: push });
                    }
                });
                createDamageText("ÉCRASEMENT", this.enemy.position, '#e74c3c');
                setTimeout(() => { this.enemy.animState = 'idle'; this.enemy.isAttacking = false; }, 300);
            }, 100); 
        });
        this.enemy.attackCooldown = cfg.cooldown;
    }

    attackCharge(target) {
        this.enemy.lookAt(target.position.x, this.enemy.position.y, target.position.z);
        this.enemy.isAttacking = true;
        this.enemy.animState = 'windup_charge';
        const cfg = this.enemy.config.charge;

        createDamageText("!", this.enemy.position.clone().add(new THREE.Vector3(0, 2.5, 0)), '#ff0000');
        if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
        
        setTimeout(() => {
            if(this.enemy.dead) return;
            this.enemy.animState = 'charge_loop';
            const startSpeed = cfg.speedStart; 
            const endSpeed = cfg.speedEnd;    
            const maxDuration = 1.2;
            let elapsed = 0;
            let chargeDir = target.position.clone().sub(this.enemy.position).normalize();
            chargeDir.y = 0;
            
            const interval = setInterval(() => {
                if(this.enemy.dead || elapsed >= maxDuration) { clearInterval(interval); this.stopCharge(); return; }
                elapsed += 0.05;
                const currentSpeed = THREE.MathUtils.lerp(startSpeed, endSpeed, elapsed / maxDuration);
                this.enemy.position.add(chargeDir.clone().multiplyScalar(currentSpeed * 0.05));
                
                getAllLivingPlayers().forEach((t) => {
                    if (this.enemy.position.distanceTo(t.position) < cfg.hitRadius) {
                        const push = chargeDir.clone().multiplyScalar(cfg.pushForce);
                        push.y = 0;
                        this.enemy.dealPlayerDamage(t, cfg.damage, { knockback: push, stunDuration: cfg.stunDuration });
                        createDamageText("PERCUTÉ", t.position, '#e67e22');
                        if (cfg.soundImpact && AudioSys.play) AudioSys.play(cfg.soundImpact);
                        clearInterval(interval);
                        this.stopCharge();
                    }
                });
            }, 50);
        }, 800); 
        this.enemy.attackCooldown = cfg.cooldown;
    }

    stopCharge() {
        this.enemy.animState = 'idle';
        this.enemy.isAttacking = false;
        this.enemy.attackCooldown = 1.5; 
        if(this.enemy.model && this.enemy.model.parts && this.enemy.model.parts.torso) this.enemy.model.parts.torso.rotation.x = 0;
    }

    attackShieldBash(target) {
        this.enemy.lookAt(target.position.x, this.enemy.position.y, target.position.z);
        this.enemy.isAttacking = true;
        this.enemy.animState = 'windup_bash';
        const cfg = this.enemy.config.shieldBash;

        const dir = target.position.clone().sub(this.enemy.position).normalize();
        const angle = Math.atan2(dir.x, dir.z);
        const offsetPos = this.enemy.position.clone().add(dir.multiplyScalar(2.0));

        this.spawnTelegraphNetwork(offsetPos, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            this.enemy.animState = 'strike_bash';
            if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
            if (target.position.distanceTo(this.enemy.position) < cfg.range) {
                const toP = target.position.clone().sub(this.enemy.position).normalize();
                const facing = this.enemy.getWorldDirection(new THREE.Vector3());
                if (toP.dot(facing) > 0.5) {
                    const push = toP.clone().multiplyScalar(cfg.pushForce);
                    push.y = 0;
                    this.enemy.dealPlayerDamage(target, cfg.damage, { knockback: push, stunDuration: cfg.stunDuration });
                    createDamageText("STUN", target.position, '#3498db');
                }
            }
            setTimeout(() => { this.enemy.animState = 'idle'; this.enemy.isAttacking = false; }, 200);
        }, angle);
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
