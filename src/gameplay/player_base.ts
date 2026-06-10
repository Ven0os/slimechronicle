// @ts-nocheck
import { Globals } from '../core/globals';
import { STATE, CONFIG } from '../core/config';
import { UI } from '../visual/ui';
import { Input } from '../core/input';
import { AudioSys } from '../core/ressources';
import { createDamageText, spawnParticles } from '../visual/effects';
import { Network } from '../multiplayer/network';
import { NetSkills } from '../multiplayer/net_skills';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { isInSafeZone, pushOutOfSafeZone } from './world/worldZones';
import { CLASS_STATS_CONFIG, createDefaultSkillCdMods, createDefaultSkillMods } from '@/data/classStatsConfig';
import { BuffBar } from '@/ui/buffBar'; 

export class PlayerBase extends THREE.Group {
    constructor(className) {
        super();
        this.className = className;
        this.isRemote = (Globals.creatingRemotePlayer === true);
        this.bodyGroup = new THREE.Group(); 
        this.add(this.bodyGroup);
        Globals.scene.add(this);
        
        this.hp = 100; 
        this.maxHp = 100; 
        this.speed = 15.0; 
        this.dead = false;
        this.radius = 0.6; 
        
        this.cooldowns = { space: 0, shift: 0, e: 0 };
        this.maxCooldowns = { space: 5, shift: 8, e: 12 }; 
        this.attackCooldown = 0;
        this.attackMaxCooldown = 0.5;
        this.isAttacking = false;
        this.animTime = 0;
        this.isMoving = false;
        this.stepTimer = 0; 
        this.buffs = [];
        this.debuffs = [];
        this.localVisuals = []; 
        this.knockback = new THREE.Vector3();
        
        this.isStunned = false;
        this.stunTimer = 0;
        this.stunVisualGroup = null; 
        
        this.isIntangible = false;
        this.intangibleTimer = 0;
        
        this.netRotation = 0; 

        setTimeout(() => {
            if (this.useSkill !== PlayerBase.prototype.useSkill) {
                const childUseSkill = this.useSkill.bind(this);
                this.useSkill = (key) => {
                    if (UI.isMenuOpen()) return;
                    if (this.isStunned) return;
                    const chronoFinale = key === 'e'
                        && this.className === 'chronoregulator'
                        && this.isConverging;
                    if (!chronoFinale && this.cooldowns[key] > 0) return;
                    const wasCasting = this.isCasting || false;
                    childUseSkill(key);
                    
                    // --- PASSIF PAS ÉTHÉRÉ (CHARGES MULTIPLES 1 PAR 1) ---
                    // On cherche UNE seule instance disponible
                    if (STATE.passives && STATE.passives.etherSteps && STATE.passives.etherSteps.length > 0) {
                        // On trouve le premier item qui n'est pas en cooldown
                        const readyStep = STATE.passives.etherSteps.find(step => (step.rt_cooldown || 0) <= 0);
                        
                        if (readyStep) {
                            // On déclenche l'effet
                            this.isIntangible = true;
                            this.intangibleTimer = 1.0; 
                            createDamageText("INTANGIBLE", this.position, "#aaddff");
                            
                            // On met JUSTE cet item en cooldown (ex: 10s)
                            readyStep.rt_cooldown = 10.0; 
                        }
                    }

                    if (this.isLocalPlayer()) {
                        ConstellationEngine.onSkillUsed(key);
                        const isOnCd = this.cooldowns[key] > 0;
                        if (!wasCasting && isOnCd) {
                            this.broadcastSkillNetwork(key);
                        }
                    }
                };
            }
        }, 0);
    }

    isLocalPlayer() {
        if (this.isRemote) return false;
        if (this.userData && this.userData.isRemote) return false;
        if (Globals.player) return (this === Globals.player);
        return true;
    }

    createClassModel() { console.warn("createClassModel non implémenté"); }

    applyClassStats(resetMode = false) {
        // --- MISE A JOUR DES STATS DE BASE (RESET) ---
        if (!this.isLocalPlayer()) {
            const remoteCfg = CLASS_STATS_CONFIG[this.className];
            if (remoteCfg) this.maxHp = remoteCfg.base.maxHp;
            if (resetMode) this.hp = this.maxHp;
            return;
        }

        if (!CONFIG.skillIcons[this.className]) return;
        const icons = CONFIG.skillIcons[this.className];
        const btnSpace = document.getElementById('icon-space'); if(btnSpace) btnSpace.innerHTML = icons[0];
        const btnShift = document.getElementById('icon-shift'); if(btnShift) btnShift.innerHTML = icons[1];
        const btnE = document.getElementById('icon-e'); if(btnE) btnE.innerHTML = icons[2];
        
        STATE.stats.skillMods = createDefaultSkillMods();
        STATE.stats.skillCdMods = createDefaultSkillCdMods();
        STATE.stats.titanBonus = 0;
        STATE.stats.def = 0;

        const classCfg = CLASS_STATS_CONFIG[this.className];
        if (classCfg) {
            const b = classCfg.base;
            STATE.stats.maxHp = b.maxHp;
            STATE.stats.atk = b.atk;
            STATE.stats.speed = b.speed;
            this.attackMaxCooldown = b.attackMaxCooldown;
            this.maxCooldowns = { ...b.cooldowns };
        }
        
        this.updateTooltips();
        
        // Si resetMode est true, on ne touche pas aux HP actuels ici (géré par recalculateStats)
        // Sinon (init), on remplit la vie.
        this.maxHp = STATE.stats.maxHp; 
        this.speed = STATE.stats.speed; 
        if(!resetMode) this.hp = this.maxHp;
        
        UI.updateHUD();
    }

    updateTooltips() {
        if (!this.isLocalPlayer()) return;
        if (!CONFIG.tooltips[this.className]) return;
        const t = CONFIG.tooltips[this.className];
        const setHtml = (sel, title, desc) => {
            const container = document.querySelector(sel);
            if (!container) return;
            const elTitle = container.querySelector('h4');
            const elDesc = container.querySelector('div');
            if(elTitle) elTitle.innerText = title;
            if(elDesc) elDesc.innerText = desc;
        };
        setHtml('#passive-tooltip', t.passive.name, t.passive.desc);
        setHtml('#tooltip-space', t.space.name, t.space.desc);
        setHtml('#tooltip-shift', t.shift.name, t.shift.desc);
        setHtml('#tooltip-e', t.e.name, t.e.desc);
    }

    applyStun(duration) {
        this.stunTimer = duration;
        if (!this.isStunned) {
            this.isStunned = true;
            this.isCasting = false; 
            this.isAttacking = false;
            
            if (!this.stunVisualGroup) {
                this.stunVisualGroup = new THREE.Group();
                this.stunVisualGroup.position.y = 2.2; 
                
                const starGeo = new THREE.OctahedronGeometry(0.15); 
                const starMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
                
                for(let i=0; i<3; i++) {
                    const star = new THREE.Mesh(starGeo, starMat);
                    const angle = (i / 3) * Math.PI * 2;
                    star.position.set(Math.cos(angle) * 0.4, 0, Math.sin(angle) * 0.4);
                    this.stunVisualGroup.add(star);
                }
                this.add(this.stunVisualGroup);
            }
            this.stunVisualGroup.visible = true;
        }
    }

    update(dt) {
        if(this.dead) return;

        // --- UPDATE COOLDOWNS CHARGES (Pas Éthéré) ---
        if (STATE.passives && STATE.passives.etherSteps) {
            STATE.passives.etherSteps.forEach(step => {
                if(step.rt_cooldown > 0) step.rt_cooldown -= dt;
            });
        }

        if (this.isStunned) {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) {
                this.isStunned = false;
                if (this.stunVisualGroup) this.stunVisualGroup.visible = false;
            } else {
                if (this.stunVisualGroup) {
                    this.stunVisualGroup.rotation.y += dt * 3; 
                    this.stunVisualGroup.children.forEach(star => {
                        star.rotation.y += dt * 2;
                        star.rotation.z += dt * 2;
                    });
                }
            }
        }
        
        if (this.isIntangible) {
            this.intangibleTimer -= dt;
            if (this.intangibleTimer <= 0) {
                this.isIntangible = false;
                if (this.bodyGroup) this.bodyGroup.visible = true; 
            } else {
                if (this.bodyGroup) {
                    this.bodyGroup.visible = Math.floor(Date.now() / 50) % 2 === 0;
                }
            }
        } else {
            if (this.bodyGroup) this.bodyGroup.visible = true;
        }

        if (!this.isLocalPlayer()) {
            const dist = this.position.distanceTo(this.lastRemotePos || this.position);
            this.lastRemotePos = this.position.clone();
            this.isMoving = dist > 0.01;
            this.animateCharacter(dt);
            this.updateBuffs(dt);
            this.updateLocalVisuals(dt);
            this.updateCooldowns(dt);
            return; 
        }

        this.isMoving = false;
        
        if(this.knockback.length() > 0.1) {
            this.position.add(this.knockback.clone().multiplyScalar(dt));
            this.knockback.multiplyScalar(0.9);
            this.resolveCollisions();
        } else if (!STATE.isPaused && !this.isStunned && !UI.isMenuOpen()) { 
            const moveInput = new THREE.Vector3();
            if(Input.keys['KeyW']) moveInput.z -= 1;
            if(Input.keys['KeyS']) moveInput.z += 1;
            if(Input.keys['KeyA']) moveInput.x -= 1;
            if(Input.keys['KeyD']) moveInput.x += 1;

            if(moveInput.length() > 0) {
                this.isMoving = true; 
                moveInput.normalize();
                this.position.add(moveInput.clone().multiplyScalar(this.speed * STATE.timeScale * dt)); 
                this.resolveCollisions();

                const targetAngle = Math.atan2(moveInput.x, moveInput.z);
                this.netRotation = targetAngle; 
                
                const targetQuaternion = new THREE.Quaternion();
                targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
                this.mesh.quaternion.slerp(targetQuaternion, 15 * dt);
            }
        }

        if (this.position.y < 0) { this.position.y = 0; if(this.knockback.y < 0) this.knockback.y = 0; }

        this.updateCooldowns(dt);
        
        if(this.attackCooldown > 0) this.attackCooldown -= dt;
        
        if(STATE.mouseDown && this.attackCooldown <= 0 && !STATE.isPaused && !this.isStunned && !UI.isMenuOpen()) {
            this.performAttack();
        }

        this.updateBuffs(dt);
        this.updateClassPassives(dt);
        this.animateCharacter(dt); 
        this.updateLocalVisuals(dt);
        
        if (Globals.camera && this.hpBar) {
            this.hpBar.scale.x = Math.max(0, this.hp / this.maxHp);
            this.hpBar.lookAt(Globals.camera.position);
            this.hpBarBg.lookAt(Globals.camera.position);
        }
    }

    updateCooldowns(dt) {
        Object.keys(this.cooldowns).forEach(k => {
            if(this.cooldowns[k] > 0) {
                this.cooldowns[k] -= dt;
                if (this.isLocalPlayer()) this.updateCooldownUI(k);
            } else if (this.isLocalPlayer()) {
                const cdText = document.getElementById(`cd-${k}`);
                if(cdText) cdText.style.display = 'none';
            }
        });
    }

    handleInputs(dt) {
        if (!this.isLocalPlayer()) return;
        if (STATE.mouseDown && this.attackCooldown <= 0 && !this.isCasting && !this.isStunned && !UI.isMenuOpen()) {
            this.triggerAttack();
        }
    }

    performAttack() { 
        if(this.isStunned || UI.isMenuOpen()) return; 
        this.triggerAttack(); 
    }

    useSkill(key) {
        if (this.dead) return;
        if (this.isStunned) return; 
        if (UI.isMenuOpen()) return; 
        if (this.cooldowns[key] > 0) return;
        this.cooldowns[key] = this.maxCooldowns[key];
        if (this.isLocalPlayer()) {
            UI.startCooldown(key, this.maxCooldowns[key]);
            this.broadcastSkillNetwork(key);
        }
    }

    broadcastSkillNetwork(key) {
        if (!this.isLocalPlayer()) return;
        const net = Network || window.Network;
        if (STATE.multiplayer.active && net) {
            const dir = new THREE.Vector3(0, 0, 1);
            if (this.mesh) dir.applyQuaternion(this.mesh.quaternion);
            else dir.applyQuaternion(this.quaternion); 
            dir.y = 0; dir.normalize();

            net.send({
                type: 'net-action',
                action: 'skill',
                id: STATE.multiplayer.id,
                key: key,
                class: this.className,
                pos: { x: this.position.x, y: this.position.y, z: this.position.z },
                dir: { x: dir.x, y: dir.y, z: dir.z },
                color: CONFIG.colors[this.className]
            });
        }
    }

    triggerAttack() {
        this.attackCooldown = this.attackMaxCooldown;
        this.isAttacking = true;
        setTimeout(() => this.isAttacking = false, 200);

        if (this.className === 'warrior') AudioSys.play('sword_swing');
        else if (this.className === 'blade') AudioSys.play('water_slash');
        else AudioSys.play('shoot');

        if (!this.isLocalPlayer()) return;

        const dir = new THREE.Vector3(0, 0, 1);
        if (this.mesh) dir.applyQuaternion(this.mesh.quaternion);
        else dir.applyQuaternion(this.quaternion);
        dir.y = 0; dir.normalize();
        
        const net = Network || window.Network;

        if (STATE.multiplayer.active && net) {
            const actionType = ['warrior', 'blade', 'sentinel', 'pacifier', 'eclipse'].includes(this.className) ? 'attack-melee' : 'attack-range';
            
            net.send({
                type: 'net-action',
                action: actionType,
                id: STATE.multiplayer.id,
                class: this.className,
                pos: { x: this.position.x, y: this.position.y, z: this.position.z },
                dir: { x: dir.x, y: dir.y, z: dir.z },
                color: CONFIG.colors[this.className],
                typeP: 'player'
            });
        }
    }

    updateCooldownUI(k) {
        if (!this.isLocalPlayer()) return;
        const btn = document.querySelector(`.skill-icon#skill-${k}`);
        if(btn) {
            const pct = (this.cooldowns[k] / this.maxCooldowns[k]) * 100;
            let overlay = btn.querySelector('.cooldown-overlay');
            if(!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'cooldown-overlay';
                overlay.style.position = 'absolute'; overlay.style.bottom = '0'; overlay.style.left = '0';
                overlay.style.width = '100%'; overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
                btn.appendChild(overlay);
            }
            overlay.style.height = pct + '%';
            const cdText = document.getElementById(`cd-${k}`);
            if(cdText) { cdText.style.display = 'flex'; cdText.innerText = Math.ceil(this.cooldowns[k]); }
        }
    }

    animateCharacter(dt) {
        this.animTime += dt * 10;
        
        if (this.isStunned) {
            if(this.bodyGroup) {
                this.bodyGroup.rotation.z = Math.sin(this.animTime * 0.5) * 0.15;
                this.bodyGroup.rotation.x = Math.cos(this.animTime * 0.3) * 0.15;
            }
            if(this.legL) this.legL.rotation.x = 0; 
            if(this.legR) this.legR.rotation.x = 0;
            return;
        } else {
            if(this.bodyGroup) {
                this.bodyGroup.rotation.z = 0;
                this.bodyGroup.rotation.x = 0;
            }
        }

        if (this.isMoving) {
            if(this.legL) this.legL.rotation.x = Math.sin(this.animTime) * 0.6;
            if(this.legR) this.legR.rotation.x = Math.sin(this.animTime + Math.PI) * 0.6;
            this.stepTimer += dt;
            if(this.stepTimer > 0.35) { AudioSys.sfx.step(); this.stepTimer = 0; }
            if(!this.isAttacking && this.weaponGroup) {
                this.weaponGroup.rotation.x = Math.sin(this.animTime) * 0.5;
                if(this.armL) this.armL.rotation.x = Math.sin(this.animTime + Math.PI) * 0.5;
            }
            if(this.mesh) this.mesh.position.y = Math.abs(Math.sin(this.animTime * 2)) * 0.1;
        } else {
            if(this.legL) this.legL.rotation.x = 0; 
            if(this.legR) this.legR.rotation.x = 0;
            if(!this.isAttacking && this.weaponGroup) {
                this.weaponGroup.rotation.x = THREE.MathUtils.lerp(this.weaponGroup.rotation.x, 0, dt * 5);
                if(this.armL) this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, 0, dt * 5);
            }
            if(this.mesh) this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, 0, dt * 5);
        }
    }

    resolveCollisions() {
        if (!this.isLocalPlayer()) return;

        if (STATE.leftSafeZone) {
            pushOutOfSafeZone(this.position);
        }

        const mapSize = 98; 
        if (this.position.x < -mapSize) this.position.x = -mapSize;
        if (this.position.x > mapSize) this.position.x = mapSize;
        if (this.position.z < -mapSize) this.position.z = -mapSize;
        if (this.position.z > mapSize) this.position.z = mapSize;

        if (Globals.obstacles) {
            for (const obs of Globals.obstacles) {
                const dist = this.position.distanceTo(obs.position);
                const minDist = this.radius + obs.radius;
                if (dist < minDist) {
                    const pushDir = this.position.clone().sub(obs.position).normalize();
                    if (pushDir.length() === 0) pushDir.set(1, 0, 0); 
                    const overlap = minDist - dist;
                    this.position.add(pushDir.multiplyScalar(overlap));
                }
            }
        }
        
        if (Globals.enemies) {
            for (const enemy of Globals.enemies) {
                if (enemy.dead || enemy.isBoss) continue;
                const dist = this.position.distanceTo(enemy.position);
                const enemyRadius = (enemy.radius || 0.5); 
                const minDist = this.radius + enemyRadius;
                if (dist < minDist) {
                    const pushDir = this.position.clone().sub(enemy.position).normalize();
                    if (pushDir.length() === 0) pushDir.set(1, 0, 0);
                    const overlap = minDist - dist;
                    this.position.add(pushDir.multiplyScalar(overlap));
                }
            }
        }
    }

    takeDamage(amount) {
        if(this.dead) return;

        if (this.isLocalPlayer() && isInSafeZone(this.position)) return;
        
        // --- IMMUNITÉ INTANGIBLE (Pas Éthéré) ---
        if(this.isIntangible) {
            createDamageText("ESQUIVÉ", this.position, "#aaddff");
            return;
        }

        amount = ConstellationEngine.modifyDamageTaken(amount);

        if (amount > 0) {
            this.hp -= amount;
            createDamageText("-" + Math.floor(amount), this.position, '#ff0000');
            this.flashColor(this.bodyGroup, 0xff0000);
            AudioSys.sfx.hit();
            
            // --- PASSIF ÉPINE DE FER (Renvoi) ---
            if (STATE.passives && STATE.passives.ironThorn && Globals.enemies) {
                const reflectDmg = amount * 0.15;
                if(reflectDmg >= 1) {
                    let closest = null;
                    let minD = 999;
                    Globals.enemies.forEach(e => {
                        const d = this.position.distanceTo(e.position);
                        if(d < minD) { minD = d; closest = e; }
                    });
                    
                    if(closest && minD < 5 && closest.takeDamage) {
                        closest.takeDamage(reflectDmg);
                        createDamageText("RETOUR: " + Math.floor(reflectDmg), closest.position, "#aaaaaa");
                    }
                }
            }
        }
        if(this.hp <= 0) {
            if (ConstellationEngine.tryLastBreath()) return;
            this.hp = 0;
            this.die();
        }
        if (this.isLocalPlayer()) UI.updateHUD();
    }

    heal(amount) {
        if (this.dead) return;
        this.hp = Math.min(this.maxHp, this.hp + amount); 
        createDamageText("+" + Math.floor(amount), this.position, '#00ff00');
        if (this.isLocalPlayer()) UI.updateHUD();
    }

    die() {
        if(this.dead) return;
        this.dead = true;
        this.visible = false; 
        createDamageText("MORT", this.position, '#8a0b0b');
        AudioSys.sfx.hit(); 
        if (this.isLocalPlayer()) {
            const deathScreen = document.getElementById('death-screen');
            if(deathScreen) deathScreen.style.display = 'flex';
        }
    }

    respawn() {
        this.dead = false; this.visible = true; this.hp = this.maxHp;
        this.buffs = []; this.debuffs = []; this.cooldowns = { space: 0, shift: 0, e: 0 };
        this.position.set(0, 0, 0);
        STATE.leftSafeZone = false;
        this.isStunned = false; 
        if(this.stunVisualGroup) this.stunVisualGroup.visible = false;
        
        if (this.isLocalPlayer()) {
            const deathScreen = document.getElementById('death-screen');
            if(deathScreen) deathScreen.style.display = 'none';
        }
        this.bodyGroup.traverse((child) => {
            if (child.isMesh && child.material && child.userData.baseEmissive !== undefined) {
                child.material.emissive.setHex(child.userData.baseEmissive);
            }
        });
        if (this.isLocalPlayer()) UI.updateHUD();
    }

    addBuff(name, duration, icon, options = {}) {
        this.buffs = this.buffs.filter(b => b.name !== name);
        this.buffs.push({ name, timer: duration, maxTimer: duration, icon, negative: !!options.negative });
        if (this.isLocalPlayer()) this.updateBuffUI();
    }

    addDebuff(name, duration, icon = 'fa-skull-crossbones', desc = '') {
        if (!this.debuffs) this.debuffs = [];
        this.debuffs = this.debuffs.filter(d => d.name !== name);
        this.debuffs.push({ name, timer: duration, maxTimer: duration, icon, desc });
        if (this.isLocalPlayer()) this.updateBuffUI();
    }

    updateDebuffs(dt) {
        if (!this.debuffs?.length) return;
        for (let i = this.debuffs.length - 1; i >= 0; i--) {
            this.debuffs[i].timer -= dt;
            if (this.debuffs[i].timer <= 0) this.debuffs.splice(i, 1);
        }
        if (this.isLocalPlayer()) this.updateBuffUI();
    }

    updateBuffs(dt) {
        for(let i=this.buffs.length-1; i>=0; i--) {
            this.buffs[i].timer -= dt;
            if(this.buffs[i].timer <= 0) this.buffs.splice(i, 1);
        }
        this.updateDebuffs(dt);
        if (this.isLocalPlayer()) this.updateBuffUI();
    }

    updateBuffUI() {
        if (!this.isLocalPlayer()) return;
        BuffBar.render();
    }

    flashColor(obj, colorHex) {
        obj.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
                if (child.userData.baseEmissive === undefined) {
                    const current = child.material.emissive.getHex();
                    if(current === colorHex) child.userData.baseEmissive = 0x000000;
                    else child.userData.baseEmissive = current;
                }
                child.material.emissive.setHex(colorHex);
                if(child.userData.flashTimeout) clearTimeout(child.userData.flashTimeout);
                child.userData.flashTimeout = setTimeout(() => {
                    if(child.material && child.userData.baseEmissive !== undefined) {
                        child.material.emissive.setHex(child.userData.baseEmissive);
                    }
                    child.userData.flashTimeout = null;
                }, 100);
            }
        });
    }

    addLocalVisual(mesh, duration, updateFn) {
        Globals.scene.add(mesh);
        this.localVisuals.push({ mesh, duration, updateFn, maxDuration: duration });
    }

    updateLocalVisuals(dt) {
        for(let i = this.localVisuals.length - 1; i >= 0; i--) {
            const v = this.localVisuals[i];
            v.duration -= dt;
            if(v.updateFn) v.updateFn(v.mesh, v.duration, v.maxDuration);
            if(v.duration <= 0) {
                Globals.scene.remove(v.mesh);
                if(v.mesh.geometry) v.mesh.geometry.dispose();
                this.localVisuals.splice(i, 1);
            }
        }
    }

    faceMouse() {
        if (!Globals.camera) return;
        if (!this.isLocalPlayer()) return;
        if (this.isStunned) return;
        if (UI.isMenuOpen()) return; 

        STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        STATE.raycaster.ray.intersectPlane(plane, intersection);
        const dx = intersection.x - this.mesh.position.x;
        const dz = intersection.z - this.mesh.position.z;
        
        this.netRotation = Math.atan2(dx, dz);
        
        this.mesh.lookAt(intersection.x, this.mesh.position.y, intersection.z);
    }
    
    updateClassPassives(dt) {}
}