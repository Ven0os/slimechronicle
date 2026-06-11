// @ts-nocheck
import { BaseEnemy } from '../base_enemy';
import { Globals, addEnemy, removeEnemy, GameActions } from '../../../core/globals';
import { STATE, CONFIG } from '../../../core/config';
import { ENEMY_ATTACKS } from '../../../core/enemy_attacks_config';
import { AudioSys } from '../../../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual, createTelegraph } from '../../../visual/effects';
import { Network } from '../../../multiplayer/network';
import { damagePlayer, getAllLivingPlayers } from '../../../multiplayer/net_combat';
import { Projectile } from '../../entities';
import { UI } from '../../../visual/ui';
import { RoyalGuard } from '../minions/royal_guard/royal_guard';

// --- IMPORTS MODULAIRES ---
import { buildKingSlimeModel } from './king_slime_model';
import { KingSlimeAnimator } from './king_slime_animations';

export class KingSlime extends BaseEnemy {
    constructor(position, id = null) {
        super('king', position, id);

        // --- STATS SCALING ---
        const baseHp = 7000;
        // On utilise bossProgress s'il existe, sinon fallback sur ngLevel
        const ng = (STATE.bossProgress && STATE.bossProgress['king']) || STATE.ngLevel || 0;
        
        this.hp = baseHp * Math.pow(1.12, STATE.level - 1) * (1 + ng * 0.4);
        this.maxHp = this.hp;

        this.speed = 3.5;
        this.isBoss = true;
        this.bossPhase = 1;
        this.actionTimer = 2.0;
        this.radius = 3.0;
        this.scaleVal = 3.2;

        // --- VISUALS ---
        this.parts = {};
        this.materials = {};
        this.activeMeteors = [];
        this.activeSpikes = [];
        this.effectsGroup = null;

        // --- ANIMATION MANAGER ---
        this.animState = 'idle';
        this.animator = null;

        // --- AI BRAIN ---
        this.comboQueue = [];
        this.lastTargetDist = 0;
        this.enrageMode = false;
        this.isAttacking = false;
        this.isCinematic = false;

        // --- CONFIG ---
        this.config = ENEMY_ATTACKS.king_slime;

        this.buildModel();
        this.setupHealthBar();

        if (this.config.spawn && this.config.spawn.sound) {
            setTimeout(() => { if (AudioSys.play) AudioSys.play(this.config.spawn.sound, 1.2); }, 500);
        }
    }

    buildModel() {
        if (this.mesh) this.remove(this.mesh);

        const modelData = buildKingSlimeModel(this.scaleVal);

        this.mesh = modelData.mesh;
        this.parts = modelData.parts;
        this.materials = modelData.materials;

        this.add(this.mesh);
        Globals.scene.add(this);

        this.animator = new KingSlimeAnimator(this);
    }

    setupHealthBar() {
        let bossHud = document.getElementById('boss-hud');
        if (!bossHud) {
            bossHud = document.createElement('div');
            bossHud.id = 'boss-hud';
            bossHud.style.cssText = `
                position: absolute; top: 80px; left: 50%; transform: translateX(-50%);
                width: 600px; display: none; flex-direction: column; alignItems: center; z-index: 1000;
            `;
            document.body.appendChild(bossHud);
        }

        if (!document.getElementById('boss-hp-fill')) {
            bossHud.innerHTML = `
                <div id="boss-name" style="color:#ffd700; font-family:'Cinzel', serif; font-size:24px; text-shadow:0 0 10px #000; margin-bottom:5px; font-weight:bold;">ROI SLIME</div>
                <div style="width:100%; height:24px; background:#330000; border:2px solid #ffd700; border-radius:4px; overflow:hidden; box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);">
                    <div id="boss-hp-fill" style="width:100%; height:100%; background:linear-gradient(90deg, #ff0000, #ff8800); transition: width 0.2s;"></div>
                </div>
            `;
        } else {
            const nameEl = document.getElementById('boss-name');
            if (nameEl) {
                nameEl.innerText = "ROI SLIME";
                nameEl.style.color = "#ffd700";
            }
        }

        bossHud.style.display = 'flex';
        this.updateBossUI();
    }

    updateBossUI() {
        const bar = document.getElementById('boss-hp-fill');
        if (bar) {
            const safeMax = this.maxHp > 0 ? this.maxHp : 1;
            const pct = Math.max(0, Math.min(100, (this.hp / safeMax) * 100));
            bar.style.width = pct + '%';

            if (this.bossPhase === 3) bar.style.background = 'linear-gradient(90deg, #4b0082, #8a2be2)';
            else if (this.bossPhase === 2) bar.style.background = 'linear-gradient(90deg, #ff4400, #aa0000)';
            else bar.style.background = 'linear-gradient(90deg, #ff0000, #ff8800)';
        }
    }

    update(dt) {
        super.update(dt);
        if (this.dead) return;

        this.updateBossUI();

        if (this.animator) {
            if (!this.isCinematic) this.animator.update(dt);
            else this.updateCinematicAnim(dt);
        }

        this.updateMeteors(dt);
        this.updateSpikes(dt);
        this.handlePhaseLogic(dt);

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            if (this.isAttacking || this.isCinematic) {
                if (this.currentAttack === 'jump') this.updateJumpPhysics(dt);
                return;
            }
            this.updateAI(dt);
        }
    }

    updateAI(dt) {
        const target = this.getClosestTarget();
        if (!target) return;

        this.actionTimer -= dt;
        const dist = this.position.distanceTo(target.position);

        if (!this.isAttacking && !this.isCinematic) {
            const targetPos = target.position.clone();
            targetPos.y = this.position.y;
            this.lookAt(targetPos);
        }

        if (this.actionTimer > 0.5 && dist > 6.0) {
            const dir = target.position.clone().sub(this.position).normalize();
            this.position.add(dir.multiplyScalar(this.speed * dt));
        }

        if (this.actionTimer <= 0) {
            this.decideNextAction(target, dist);
            const baseCd = this.bossPhase === 3 ? 1.0 : 2.0;
            this.actionTimer = baseCd + Math.random() * 0.5;
        }
    }

    decideNextAction(target, dist) {
        if (this.comboQueue.length > 0) {
            const action = this.comboQueue.shift();
            this.executeAction(action, target);
            return;
        }

        const rand = Math.random();
        const minions = Globals.enemies.filter(e => e.type === 'royal_guard').length;
        if (this.bossPhase < 3 && minions < 2 && rand < 0.2) {
            return this.executeAction('summon', target);
        }

        if (this.bossPhase === 3) {
            if (rand < 0.2) return this.executeAction('cataclysm', target);
            if (dist > 15) return this.queueCombo(['jump', 'cleave']);
            return this.executeAction('cleave', target);
        }

        if (dist > 15) {
            if (rand < 0.5) return this.executeAction('jump', target);
            return this.executeAction('rain', target);
        }

        if (dist < 10) {
            if (rand < 0.5) return this.executeAction('cleave', target);
            if (rand < 0.8) return this.executeAction('spikes', target);
            return this.executeAction('rain', target);
        }

        if (rand < 0.5) return this.executeAction('rain', target);
        return this.executeAction('spikes', target);
    }

    queueCombo(actions) {
        this.comboQueue = actions;
        const first = this.comboQueue.shift();
        this.executeAction(first, this.getClosestTarget());
    }

    executeAction(type, target) {
        if (!target) return;
        this.isAttacking = true;
        switch (type) {
            case 'jump': this.startJump(target); break;
            case 'cleave': this.startCleave(target); break;
            case 'spikes': this.startSpikes(target); break;
            case 'rain': this.startRain(target); break;
            case 'summon': this.startSummon(target); break;
            case 'cataclysm': this.startCataclysm(target); break;
        }
    }

    startCleave(target) {
        this.currentAttack = 'cleave';
        this.animState = 'windup_cleave';
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
        const telegraphPos = this.position.clone().add(forward.multiplyScalar(5.0));
        const angle = Math.atan2(forward.x, forward.z);
        this.spawnTelegraph(telegraphPos, 'cone', 14.0, 0.8, 0xffaa00, () => {
            this.animState = 'strike_cleave';
            if (AudioSys.play) AudioSys.play('sword_swing', 1.2);
            createSkillVisual('slash', this.position.clone().add(new THREE.Vector3(0, 2.5, 0)).add(forward.multiplyScalar(3)), 10.0, 0xffff00, forward);
            this.applyDamageCone(forward, 12.0, 0.4, 60);
            setTimeout(() => { this.isAttacking = false; this.animState = 'idle'; }, 500);
        }, angle);
    }

    startRain(target) {
        this.currentAttack = 'rain'; this.animState = 'cast_spell';
        createDamageText("MÉTÉORES !", this.position, '#ff5500');
        if (AudioSys.play) AudioSys.play('king_laugh', 1.0);

        let meteors = 6 + (this.bossPhase * 2);
        let count = 0;

        const interval = setInterval(() => {
            if (this.dead || count >= meteors) { clearInterval(interval); this.isAttacking = false; this.animState = 'idle'; return; }
            const offset = new THREE.Vector3((Math.random() - 0.5) * 15, 0, (Math.random() - 0.5) * 15);
            const impactPos = Globals.player.position.clone().add(offset);
            impactPos.y = 0.3; 
            this.spawnTelegraph(impactPos, 'circle', 4.0, 1.5, 0xff5500, () => { });
            setTimeout(() => { this.spawnMeteorMesh(impactPos); }, 1000);
            count++;
        }, 400);
    }

    startJump(target) {
        this.currentAttack = 'jump'; this.animState = 'windup_jump';
        const lead = target.position.clone().sub(this.position).normalize().multiplyScalar(2.0);
        this.jumpStartPos = this.position.clone();
        this.jumpTargetPos = target.position.clone().add(lead);
        if (this.jumpTargetPos.distanceTo(this.jumpStartPos) > 30) this.jumpTargetPos = this.jumpStartPos.clone().add(lead.multiplyScalar(15));
        this.jumpTime = 0; this.jumpDuration = 1.2;
        createDamageText("SAUT !", this.position, '#ffa500');
        this.spawnTelegraph(this.jumpTargetPos, 'circle', 8.0, this.jumpDuration, 0xff0000);
        if (AudioSys.play) AudioSys.play('king_jump_start', 1.0);
    }

    startSpikes(target) {
        this.currentAttack = 'spikes'; this.animState = 'windup_jump';
        createDamageText("SÉISME !", this.position, '#8B4513');
        this.spawnTelegraph(this.position, 'circle', 18.0, 2.25, 0x8B4513, () => {
            this.animState = 'strike_cleave';
            if (AudioSys.play) AudioSys.play('earth_smash', 1.2);
            createSkillVisual('shockwave', this.position, 18.0, 0x5c4033);
            for (let i = 0; i < 30; i++) {
                const r = Math.random() * 16;
                const a = Math.random() * Math.PI * 2;
                const p = this.position.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
                this.spawnSpikeMesh(p); spawnParticles(p, 0x8B4513, 6);
            }
            this.applyAreaDamage(this.position, 18.0, 45, 30);
            setTimeout(() => { this.isAttacking = false; this.animState = 'idle'; }, 500);
        });
    }

    startSummon(target) {
        this.currentAttack = 'summon'; this.animState = 'cast_spell';
        createDamageText("INVOCATION !", this.position, '#00ffff');
        if (AudioSys.play) AudioSys.play('king_laugh', 1.0);
        setTimeout(() => {
            for (let i = 0; i < 2; i++) {
                const offset = new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
                const spawnPos = this.position.clone().add(offset);
                const guard = new RoyalGuard(spawnPos); addEnemy(guard); spawnParticles(spawnPos, 0x00ffff, 20);
            }
            this.isAttacking = false; this.animState = 'idle';
        }, 1500);
    }

    startCataclysm(target) {
        this.currentAttack = 'cataclysm';
        this.animState = 'cast_spell';
        createDamageText("APOCALYPSE...", this.position, '#8a2be2', 3.0);

        const castTime = this.config.cataclysm.castTime || 4.0;
        const radius = this.config.cataclysm.radius || 35.0;
        const color = 0x4b0082;

        this.spawnTelegraph(this.position, 'circle', radius, castTime, color, () => {
            createSkillVisual('explosion', this.position, radius, color);
            if (AudioSys.play) AudioSys.play('boss_roar', 2.0);
            this.applyAreaDamage(this.position, radius, 120, 100);
            this.fireVoidBalls();
            if (this.effectsGroup) { this.mesh.remove(this.effectsGroup); this.effectsGroup = null; }
            this.mesh.position.y = 0;
            setTimeout(() => { this.isAttacking = false; this.animState = 'idle'; }, 1000);
        });

        this.effectsGroup = new THREE.Group();
        this.mesh.add(this.effectsGroup);
        const voidGeo = new THREE.SphereGeometry(2, 32, 32);
        const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const blackHole = new THREE.Mesh(voidGeo, voidMat);
        blackHole.position.y = 6;
        this.effectsGroup.add(blackHole);
        const ringGeo = new THREE.TorusGeometry(3, 0.1, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x8a2be2, transparent: true, opacity: 0.8 });
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        const ring2 = new THREE.Mesh(ringGeo, ringMat); ring2.rotation.x = Math.PI / 2;
        this.effectsGroup.add(ring1); this.effectsGroup.add(ring2);

        const startTime = Date.now();
        const animInterval = setInterval(() => {
            if (this.dead || !this.isAttacking || this.currentAttack !== 'cataclysm') {
                clearInterval(animInterval);
                if (this.effectsGroup) { this.mesh.remove(this.effectsGroup); this.effectsGroup = null; }
                this.mesh.position.y = 0;
                return;
            }
            const elapsed = Date.now() - startTime;
            const t = elapsed / (castTime * 1000);
            this.mesh.position.y = Math.sin(t * Math.PI) * 3.0;
            if (this.effectsGroup) {
                ring1.rotation.y += 0.1;
                ring2.rotation.x += 0.1;
                const scale = 1 + t * 2;
                blackHole.scale.setScalar(scale);
                ring1.scale.setScalar(scale);
                ring2.scale.setScalar(scale);
            }
            if (t > 0.5 && Globals.camera) {
                Globals.camera.position.x += (Math.random() - 0.5) * 0.1;
            }
        }, 16);
    }

    fireVoidBalls() {
        for (let i = 0; i < 4; i++) {
            setTimeout(() => {
                if (this.dead) return;
                const targetBase = Globals.player ? Globals.player.position.clone() : this.position.clone();
                const offset = new THREE.Vector3((Math.random() - 0.5) * 15, 0, (Math.random() - 0.5) * 15);
                const impactPos = targetBase.add(offset);
                this.spawnVoidBall(impactPos);
            }, i * 400);
        }
    }

    spawnVoidBall(targetPos) {
        const geo = new THREE.SphereGeometry(2.0, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0x8a2be2,
            emissiveIntensity: 5.0,
            roughness: 0.1
        });
        const ball = new THREE.Mesh(geo, mat);
        ball.position.set(targetPos.x, 40, targetPos.z);
        ball.velocity = new THREE.Vector3(0, -40, 0);
        ball.userData = { isVoidBall: true };
        Globals.scene.add(ball);
        this.activeMeteors.push(ball);
    }

    triggerEpicPhase3() {
        this.isCinematic = true;
        this.animState = 'idle';
        createDamageText("FORME FINALE !!!", this.position, '#ff0000', 4.0);
        if (AudioSys.play) AudioSys.play('boss_roar', 1.0);

        this.effectsGroup = new THREE.Group();
        this.mesh.add(this.effectsGroup);

        const ringGeo = new THREE.TorusGeometry(3.5, 0.1, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        const ring2 = new THREE.Mesh(ringGeo, ringMat); ring2.rotation.x = Math.PI / 3;
        const ring3 = new THREE.Mesh(ringGeo, ringMat); ring3.rotation.x = -Math.PI / 3;
        this.effectsGroup.add(ring1); this.effectsGroup.add(ring2); this.effectsGroup.add(ring3);

        let timer = 0;
        const duration = 3.0;
        const cinematicInt = setInterval(() => {
            if (this.dead) { clearInterval(cinematicInt); return; }
            timer += 0.05;
            this.mesh.position.y = Math.sin(timer * 2) * 0.5 + 2.0;
            ring1.rotation.y += 0.1;
            ring2.rotation.y += 0.1;
            ring3.rotation.y += 0.1;
            this.effectsGroup.rotation.z += 0.02;
            this.mesh.position.x = (Math.random() - 0.5) * 0.3;
            this.mesh.position.z = (Math.random() - 0.5) * 0.3;
            if (timer >= duration) {
                clearInterval(cinematicInt);
                this.mesh.remove(this.effectsGroup);
                this.effectsGroup = null;
                this.endEpicPhase3();
            }
        }, 50);
    }

    updateCinematicAnim(dt) {
        const lerpRot = (obj, axis, val) => { if (obj) obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], val, dt * 5); };
        lerpRot(this.parts.armL, 'z', Math.PI / 3);
        lerpRot(this.parts.armR, 'z', -Math.PI / 3);
        lerpRot(this.parts.armL, 'x', 0);
        lerpRot(this.parts.armR, 'x', 0);
        lerpRot(this.parts.head, 'x', -0.8);
        lerpRot(this.parts.body, 'x', -0.2);
    }

    endEpicPhase3() {
        this.isCinematic = false;
        this.mesh.position.set(0, 0, 0);
        createSkillVisual('shockwave', this.position, 25.0, 0xff0000);
        if (AudioSys.play) AudioSys.play('earth_smash', 2.0);
        this.speed *= 1.5;
        this.actionTimer = 0.5;
        createDamageText("ANNIHILATION", this.position, '#ff0000');
    }

    spawnMeteorMesh(targetPos) {
        const geo = new THREE.DodecahedronGeometry(1.5);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xff4400, emissiveIntensity: 3.0 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(targetPos.x, 35, targetPos.z);
        mesh.velocity = new THREE.Vector3(0, -35, 0);
        mesh.userData = { isVoidBall: false };
        Globals.scene.add(mesh);
        this.activeMeteors.push(mesh);
    }

    spawnSpikeMesh(pos) {
        const h = 2.0 + Math.random() * 3.0;
        const geo = new THREE.ConeGeometry(0.5, h, 4);
        const mat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 1.0 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos); mesh.position.y = -h;
        mesh.userData = { targetY: h / 2, speed: 10.0, life: 1.5, state: 'up' };
        Globals.scene.add(mesh);
        this.activeSpikes.push(mesh);
    }

    updateMeteors(dt) {
        for (let i = this.activeMeteors.length - 1; i >= 0; i--) {
            const m = this.activeMeteors[i];
            if (!m.velocity) { Globals.scene.remove(m); this.activeMeteors.splice(i, 1); continue; }
            m.position.add(m.velocity.clone().multiplyScalar(dt));
            m.rotation.x += dt * 8; m.rotation.z += dt * 8;
            const isVoid = m.userData && m.userData.isVoidBall;
            const trailColor = isVoid ? 0x8a2be2 : 0xff5500;
            if (Math.random() < 0.8) spawnParticles(m.position, trailColor, 3);
            if (m.position.y <= 0.5) {
                const impactColor = isVoid ? 0x8a2be2 : 0xff5500;
                const particleColor = isVoid ? 0x4b0082 : 0xffaa00;
                const radius = isVoid ? 8.0 : 5.0;
                const dmg = isVoid ? 60 : 35;
                const knockback = isVoid ? 15 : 10;
                createSkillVisual('explosion', m.position, radius, impactColor);
                spawnParticles(m.position, particleColor, 30);
                if (AudioSys.play) AudioSys.play('earth_smash', isVoid ? 1.0 : 0.8);
                getAllLivingPlayers().forEach((t) => {
                    if (t.position.distanceTo(m.position) < radius) {
                        const kb = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(knockback);
                        damagePlayer(t, dmg, { knockback: kb });
                        createDamageText(dmg, t.position, impactColor);
                    }
                });
                Globals.scene.remove(m); if (m.geometry) m.geometry.dispose(); this.activeMeteors.splice(i, 1);
            }
        }
    }

    updateSpikes(dt) {
        for (let i = this.activeSpikes.length - 1; i >= 0; i--) {
            const s = this.activeSpikes[i];
            if (s.userData.state === 'up') {
                s.position.y = THREE.MathUtils.lerp(s.position.y, s.userData.targetY, dt * s.userData.speed);
                s.userData.life -= dt;
                if (s.userData.life <= 0) s.userData.state = 'down';
            } else {
                s.position.y = THREE.MathUtils.lerp(s.position.y, -5, dt * 5.0);
                if (s.position.y < -3) { Globals.scene.remove(s); if (s.geometry) s.geometry.dispose(); this.activeSpikes.splice(i, 1); }
            }
        }
    }

    updateJumpPhysics(dt) {
        this.jumpTime += dt;
        const t = this.jumpTime / this.jumpDuration;
        if (t < 0.2) this.animState = 'windup_jump';
        else if (t < 1.0) {
            this.animState = 'air_jump';
            const flightT = (t - 0.2) / 0.8;
            const h = Math.sin(flightT * Math.PI) * 18.0;
            this.position.lerpVectors(this.jumpStartPos, this.jumpTargetPos, flightT);
            this.position.y = h;
        } else {
            this.position.copy(this.jumpTargetPos); this.position.y = 0;
            this.mesh.position.y = 0; this.mesh.rotation.x = 0; this.mesh.rotation.z = 0;
            if (this.parts && this.parts.body) this.parts.body.rotation.set(0, 0, 0);
            this.applyAreaDamage(this.position, 8.0, 50, 20);
            createSkillVisual('shockwave', this.position, 9.0, 0xffaa00);
            if (AudioSys.play) AudioSys.play('king_land', 1.5);
            spawnParticles(this.position, 0x8B4513, 40);
            this.isAttacking = false; this.animState = 'idle';
        }
    }

    applyDamageCone(dir, range, angleThreshold, damage) {
        const scaled = damage * (1 + this.bossPhase * 0.2);
        getAllLivingPlayers().forEach((t) => {
            const dist = t.position.distanceTo(this.position);
            const toPlayer = t.position.clone().sub(this.position).normalize();
            if (dist < range && toPlayer.dot(dir) > angleThreshold) {
                damagePlayer(t, scaled, { knockback: dir.clone().multiplyScalar(20), stunDuration: 0.8 });
                createDamageText("SLASH!", t.position, '#ff0000');
            }
        });
    }

    applyAreaDamage(center, radius, damage, pushForce) {
        getAllLivingPlayers().forEach((t) => {
            if (t.position.distanceTo(center) < radius) {
                const kbDir = t.position.clone().sub(center).normalize();
                if (kbDir.length() === 0) kbDir.set(1, 0, 0);
                damagePlayer(t, damage, { knockback: kbDir.multiplyScalar(pushForce) });
            }
        });
    }

    spawnTelegraph(pos, shape, size, duration, color, onComplete, rotY = 0) {
        const t = createTelegraph(pos, shape, size, duration, color, onComplete, rotY);
        this.trackTelegraph(t);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'telegraph-spawn', pos: { x: pos.x, y: pos.y, z: pos.z }, shape, size, duration, color, rotationY: rotY });
        }
    }

    handlePhaseLogic(dt) {
        const hpPct = this.hp / this.maxHp;
        let newPhase = this.bossPhase;
        if (this.bossPhase === 1 && hpPct <= 0.6) newPhase = 2;
        if (this.bossPhase === 2 && hpPct <= 0.2) newPhase = 3;
        if (newPhase !== this.bossPhase) this.changePhase(newPhase);
    }

    changePhase(phase) {
        this.bossPhase = phase;
        if (phase === 2) {
            spawnParticles(this.position, 0xff8800, 50);
            if (AudioSys.play) AudioSys.play('boss_roar', 1.2);
            createDamageText("MODE OFFENSIF", this.position, '#ff8800', 3.0);
            if (this.materials.energy) {
                this.materials.energy.color.setHex(0xffaa00);
                this.materials.energy.emissive.setHex(0xff4400);
            }
        }
        else if (phase === 3) {
            if (this.materials.energy) {
                this.materials.energy.color.setHex(0xff0000);
                this.materials.energy.emissive.setHex(0xff0000);
            }
            if (this.materials.gold) this.materials.gold.color.setHex(0x330000);
            this.triggerEpicPhase3();
        }
    }

    takeDamage(amount) {
        if (this.isCinematic) { createDamageText("INVULNÉRABLE", this.position, '#888888'); return; }
        this.hp -= amount;
        createDamageText(Math.floor(amount), this.position);
        if (this.hp <= 0 && !this.dead) this.die();
        if (this.mesh) {
            if (this.flashTimeout) clearTimeout(this.flashTimeout);
            this.mesh.traverse((c) => { if (c.isMesh && c.material) { if (!c.userData.baseEmissive) c.userData.baseEmissive = c.material.emissive ? c.material.emissive.getHex() : 0x000000; c.material.emissive.setHex(0xffffff); } });
            this.flashTimeout = setTimeout(() => {
                if (this.dead) return;
                if (this.materials) {
                    if (this.materials.gold) this.materials.gold.emissive.setHex(0xaa6600);
                    if (this.materials.darkMetal) this.materials.darkMetal.emissive.setHex(0x000000);
                    if (this.materials.clothRed) this.materials.clothRed.emissive.setHex(0x000000);
                    let energyColor = 0x00ff00;
                    if (this.bossPhase === 2) energyColor = 0xff4400;
                    if (this.bossPhase === 3) energyColor = 0xff0000;
                    if (this.materials.energy) this.materials.energy.emissive.setHex(energyColor);
                }
            }, 80);
        }
    }
    pushBack(force) { return; }
    applyStun(duration) { return; }

    die() {
        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) { super.die(); return; }

        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.style.display = 'none';

        this.activeMeteors.forEach(m => Globals.scene.remove(m));
        this.activeMeteors = [];
        this.activeSpikes.forEach(s => Globals.scene.remove(s));
        this.activeSpikes = [];
        if (this.effectsGroup) this.mesh.remove(this.effectsGroup);

        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'prismatic-trigger' });
            Network.send({ type: 'boss-cleared' });
        }
        if (UI.showPrismaticReward) UI.showPrismaticReward();

        if (Globals.player.dead) {
            const specMsg = document.getElementById('spectate-msg');
            if (specMsg) specMsg.style.display = 'none';
            const btn = document.getElementById('btn-respawn');
            if (btn) { btn.style.display = 'block'; btn.disabled = false; btn.innerText = "RESSUSCITER"; }
        }

        // --- CORRECTION CRITIQUE : Suppression des changements d'état global ---
        // On ne touche PLUS à STATE.bossSpawned ni STATE.ngLevel ici.
        // C'est checkBossVictory() dans main.js qui le fera en détectant la mort.

        super.die();
    }
}