// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { createDamageText, spawnParticles, createTelegraph, createSkillVisual } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { damagePlayer } from '@/multiplayer/net_combat';
import { Projectile } from '../../../entities';

export class RogueSkills {
    constructor(enemy) {
        this.enemy = enemy;
    }

    checkAttackTrigger(target, dt) {
        if (this.enemy.attackCooldown > 0) return;
        const dist = this.enemy.position.distanceTo(target.position);
        
        if (dist < 2.2) this.attackStab(target);
        else if (dist > 7.0 && dist < 11.0 && Math.random() < 0.12) this.attackShadowStep(target);
        else if (dist > 5.0 && Math.random() < 0.05) this.attackFanOfKnives(target);
    }

    attackStab(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'windup_stab';
        const cfg = this.enemy.config.stab; 
        
        const dir = target.position.clone().sub(this.enemy.position).normalize();
        const angle = Math.atan2(dir.x, dir.z);
        const offsetPos = this.enemy.position.clone().add(dir.clone().multiplyScalar(cfg.range/2));

        this.spawnTelegraphNetwork(offsetPos, cfg.telegraph.type, cfg.telegraph.size, cfg.telegraph.duration, cfg.telegraph.color, () => {
            this.enemy.animState = 'strike_stab';
            spawnParticles(offsetPos, cfg.telegraph.color, 10);
            if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 
            
            if (target.position.distanceTo(this.enemy.position) < cfg.range) {
                const toP = target.position.clone().sub(this.enemy.position).normalize();
                if (toP.dot(this.enemy.getWorldDirection(new THREE.Vector3())) > 0.5) {
                    const push = dir.clone().multiplyScalar(cfg.pushForce);
                    push.y = 0;
                    this.enemy.dealPlayerDamage(target, cfg.damage, { knockback: push });
                    createDamageText("CRITIQUE", target.position, '#ff0000');
                }
            }
            setTimeout(() => { this.enemy.animState = 'idle'; this.enemy.isAttacking = false; }, 300);
        }, angle);
        this.enemy.attackCooldown = cfg.cooldown; 
    }

    attackFanOfKnives(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'windup_throw';
        const cfg = this.enemy.config.fanOfKnives;

        setTimeout(() => {
            this.enemy.animState = 'strike_throw';
            if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 

            const dir = target.position.clone().sub(this.enemy.position).normalize();
            dir.y = 0;
            const startAngle = -cfg.spread * (cfg.count - 1) / 2;
            
            for(let i=0; i<cfg.count; i++) {
                const spreadDir = dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), startAngle + i * cfg.spread);
                const daggerGeo = new THREE.ConeGeometry(0.06, 0.5, 4); 
                daggerGeo.rotateX(Math.PI / 2); 
                const daggerMat = new THREE.MeshStandardMaterial({
                    color: 0x39ff14,
                    metalness: 0.9,
                    roughness: 0.15,
                    emissive: 0x1ebd1e,
                    emissiveIntensity: 3.0
                });
                
                Globals.projectiles.push(new Projectile(
                    daggerGeo, daggerMat, this.enemy.position.clone().add(new THREE.Vector3(0,1,0)), 
                    spreadDir, cfg.speed, cfg.damage, 'enemy', 0x39ff14, true 
                ));
                const proj = Globals.projectiles[Globals.projectiles.length - 1];
                proj.sourceEnemy = this.enemy;
                proj.isRanged = true;
            }
            setTimeout(() => { this.enemy.animState = 'idle'; this.enemy.isAttacking = false; }, 300);
        }, cfg.windup * 1000); 
        this.enemy.attackCooldown = cfg.cooldown; 
    }

    attackShadowStep(target) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'teleport_cast';
        const cfg = this.enemy.config.shadowStep;
        
        if(cfg.sound && AudioSys.play) AudioSys.play(cfg.sound); 

        createDamageText("DISPARITION", this.enemy.position, '#555555');
        spawnParticles(this.enemy.position, 0x000000, 15);
        
        setTimeout(() => {
            const behindPos = target.position.clone().add(target.getWorldDirection(new THREE.Vector3()).multiplyScalar(-2.0));
            behindPos.x = Math.max(-40, Math.min(40, behindPos.x));
            behindPos.z = Math.max(-40, Math.min(40, behindPos.z));
            this.enemy.position.copy(behindPos);
            this.enemy.lookAt(target.position.x, this.enemy.position.y, target.position.z);
            this.enemy.animState = 'teleport_appear';
            spawnParticles(this.enemy.position, 0x000000, 15);
            setTimeout(() => {
                this.enemy.animState = 'strike_stab';
                createSkillVisual('shockwave', this.enemy.position, cfg.range, 0x000000);
                
                if (target.position.distanceTo(this.enemy.position) < cfg.range) {
                    this.enemy.dealPlayerDamage(target, cfg.damage, { stunDuration: cfg.stunDuration });
                    createDamageText("DOS !", target.position, '#cc0000');
                    if (cfg.soundImpact && AudioSys.play) AudioSys.play(cfg.soundImpact);
                }
                setTimeout(() => { this.enemy.animState = 'idle'; this.enemy.isAttacking = false; }, 400); 
            }, cfg.reappearDelay * 1000); 
        }, cfg.castTime * 1000); 
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