// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { createDamageText, spawnParticles, createSkillVisual } from '@/visual/effects';
import { Projectile } from '../../../entities';

export class ShamanSkills {
    constructor(enemy) {
        this.enemy = enemy;
    }

    checkAttackTrigger(target, dt) {
        if (this.enemy.attackCooldown > 0) return;

        // 1. Find allies in range (15m)
        const allies = this.getNearbyAllies(15.0);

        if (allies.length > 0) {
            const rand = Math.random();

            // 4/10 Heal (only if someone is actually damaged)
            const damagedAllies = allies.filter(e => e.hp < e.maxHp * 0.95);
            if (rand < 0.4 && damagedAllies.length > 0) {
                // Find ally with lowest HP percentage
                let lowestAlly = damagedAllies[0];
                damagedAllies.forEach(e => {
                    if (e.hp / e.maxHp < lowestAlly.hp / lowestAlly.maxHp) {
                        lowestAlly = e;
                    }
                });
                this.castHeal(lowestAlly);
                return;
            }

            // 5/10 Shield
            if (rand < 0.9) {
                const targetAlly = allies[Math.floor(Math.random() * allies.length)];
                this.castShield(targetAlly);
                return;
            }

            // 1/10 Damage Boost
            const targetAlly = allies[Math.floor(Math.random() * allies.length)];
            this.castBoost(targetAlly);
            return;
        }

        // 2. If no allies, target player
        if (target) {
            this.castRay(target);
        }
    }

    getNearbyAllies(range) {
        if (!Globals.enemies) return [];
        return Globals.enemies.filter(e => e !== this.enemy && !e.dead && !e.isBoss && e.type !== 'royal_seal' && this.enemy.position.distanceTo(e.position) <= range);
    }

    castHeal(targetAlly) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'cast_heal';
        this.enemy.lookAt(targetAlly.position.x, this.enemy.position.y, targetAlly.position.z);
        this.enemy.attackCooldown = 5.0;

        createDamageText("SOIN ALLIÉ !", this.enemy.position, '#2ecc71');
        if (AudioSys.play) AudioSys.play('warlock_curse', 0.6);

        // Immobilize target ally
        targetAlly.isChanneling = true;

        // Spawn green shackle link
        createSkillVisual('shackles_link', this.enemy.position, 2.0, 0x2ecc71, {
            source: this.enemy,
            target: targetAlly,
            color: 0x2ecc71
        });

        // Set up tick heal
        let ticks = 0;
        const maxTicks = 5;
        const healPerTick = targetAlly.maxHp * 0.1; // 10% max HP per tick, total 50% max HP

        const intervalId = setInterval(() => {
            if (this.enemy.dead || targetAlly.dead || !this.enemy.isAttacking) {
                clearInterval(intervalId);
                if (!targetAlly.dead) targetAlly.isChanneling = false;
                this.enemy.isAttacking = false;
                this.enemy.animState = 'idle';
                return;
            }

            // Apply heal tick
            targetAlly.hp = Math.min(targetAlly.maxHp, targetAlly.hp + healPerTick);
            createDamageText(`+${Math.floor(healPerTick)} HP`, targetAlly.position, '#2ecc71');
            spawnParticles(targetAlly.position, 0x2ecc71, 5);

            ticks++;
            if (ticks >= maxTicks) {
                clearInterval(intervalId);
                targetAlly.isChanneling = false;
                this.enemy.isAttacking = false;
                this.enemy.animState = 'idle';
            }
        }, 400); // 5 ticks over 2 seconds
    }

    castShield(targetAlly) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'cast_shield';
        this.enemy.lookAt(targetAlly.position.x, this.enemy.position.y, targetAlly.position.z);
        this.enemy.attackCooldown = 6.0;

        createDamageText("BOUCLIER !", this.enemy.position, '#3498db');

        setTimeout(() => {
            if (this.enemy.dead) return;
            if (!targetAlly.dead) {
                targetAlly.gnomeShieldTimer = 5.0; // 5s shield
                createSkillVisual('shockwave', targetAlly.position, 3.0, 0x3498db);
                createDamageText("BOUCLIER ACTIVÉ", targetAlly.position, '#3498db');
                if (AudioSys.play) AudioSys.play('war_cry', 0.5);
            }
            this.enemy.isAttacking = false;
            this.enemy.animState = 'idle';
        }, 600); // 0.6s cast windup
    }

    castBoost(targetAlly) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'cast_boost';
        this.enemy.lookAt(targetAlly.position.x, this.enemy.position.y, targetAlly.position.z);
        this.enemy.attackCooldown = 7.0;

        createDamageText("BOOST DÉGÂTS !", this.enemy.position, '#e74c3c');

        setTimeout(() => {
            if (this.enemy.dead) return;
            if (!targetAlly.dead) {
                targetAlly.gnomeDamageBoostTimer = 5.0; // 5s boost
                createSkillVisual('shockwave', targetAlly.position, 3.0, 0xe74c3c);
                createDamageText("+20% DÉGÂTS", targetAlly.position, '#e74c3c');
                if (AudioSys.play) AudioSys.play('war_cry', 0.5);
            }
            this.enemy.isAttacking = false;
            this.enemy.animState = 'idle';
        }, 600); // 0.6s cast windup
    }

    castRay(playerTarget) {
        this.enemy.isAttacking = true;
        this.enemy.animState = 'cast_ray';
        this.enemy.lookAt(playerTarget.position.x, this.enemy.position.y, playerTarget.position.z);
        this.enemy.attackCooldown = 2.5;

        if (AudioSys.play) AudioSys.play('shoot', 0.5);

        setTimeout(() => {
            if (this.enemy.dead) return;

            const dir = playerTarget.position.clone().sub(this.enemy.position).normalize();
            dir.y = 0;
            const startPos = this.enemy.position.clone().add(new THREE.Vector3(0, 0.8, 0)).add(dir.clone().multiplyScalar(0.4));

            // Standard small yellow magic sphere projectile
            const projGeo = new THREE.SphereGeometry(0.12, 8, 8);
            const projMat = new THREE.MeshBasicMaterial({
                color: 0xf1c40f
            });
            const proj = new Projectile(projGeo, projMat, startPos, dir, 0.45, 12, 'enemy', 0xf1c40f, true);
            proj.sourceEnemy = this.enemy;
            Globals.projectiles.push(proj);

            this.enemy.isAttacking = false;
            this.enemy.animState = 'idle';
        }, 500); // 0.5s cast windup
    }
}
