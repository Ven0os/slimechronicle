// @ts-nocheck
import { Globals } from '../core/globals';
import { STATE, CONFIG } from '../core/config';
import { UI } from '../visual/ui';
import { Input } from '../core/input';
import { AudioSys } from '../core/ressources';
import { createDamageText, spawnParticles } from '../visual/effects';
import { disposeObject3D } from '../visual/meshMaterialUtils';
import { Network } from '../multiplayer/network';
import { NetSkills } from '../multiplayer/net_skills';
import { isServerAuthority } from '../multiplayer/net_combat';
import { dealDamageToEnemy } from './combat/damage_helpers';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { isInSafeZone, pushOutOfSafeZone, getGroundLevelAt, getPlayableRadiusAt, BOSS_ZONE } from './world/worldZones';
import { CLASS_STATS_CONFIG, createDefaultSkillCdMods, createDefaultSkillMods } from '@/data/classStatsConfig';
import { BuffBar } from '@/ui/buffBar'; 
import { dampFactor } from '@/core/smoothing';

// Scratch math objects to prevent GC pressure in hot game loops
const _moveInput = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _scratchDir = new THREE.Vector3();
const _pushDir = new THREE.Vector3();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _intersectPoint = new THREE.Vector3();

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
        this.verticalVelocity = 0; 
        
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
        STATE.stats.titanDefBonus = 0;

        const classCfg = CLASS_STATS_CONFIG[this.className];
        if (classCfg) {
            const b = classCfg.base;
            STATE.stats.maxHp = b.maxHp;
            STATE.stats.atk = b.atk;
            STATE.stats.defense = b.defense ?? 10;
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
            // Vector3 réutilisé : un clone par frame et par joueur distant partait au GC.
            if (!this.lastRemotePos) this.lastRemotePos = this.position.clone();
            const movedSq = this.position.distanceToSquared(this.lastRemotePos);
            this.lastRemotePos.copy(this.position);
            this.isMoving = movedSq > 0.0001;
            this.animateCharacter(dt);
            this.updateBuffs(dt);
            this.updateLocalVisuals(dt);
            this.updateCooldowns(dt);
            return; 
        }

        this.isMoving = false;
        
        if(this.knockback.length() > 0.1) {
            this.position.addScaledVector(this.knockback, dt);
            this.knockback.multiplyScalar(Math.pow(0.9, dt * 60));
            this.resolveCollisions();
        } else if (!STATE.isPaused && !this.isStunned && !UI.isMenuOpen() && !STATE.cinematicActive) { 
            _moveInput.set(0, 0, 0);
            if(Input.keys['KeyW']) _moveInput.z -= 1;
            if(Input.keys['KeyS']) _moveInput.z += 1;
            if(Input.keys['KeyA']) _moveInput.x -= 1;
            if(Input.keys['KeyD']) _moveInput.x += 1;

            if(_moveInput.lengthSq() > 0) {
                this.isMoving = true; 
                _moveInput.normalize();
                this.position.addScaledVector(_moveInput, this.speed * STATE.timeScale * dt); 
                this.resolveCollisions();

                const targetAngle = Math.atan2(_moveInput.x, _moveInput.z);
                this.netRotation = targetAngle; 
                
                _targetQuat.setFromAxisAngle(_upAxis, targetAngle);
                this.mesh.quaternion.slerp(_targetQuat, dampFactor(15, dt));
            }
        }

        // Gravity & vertical movement physics update (supporting spawn platform cliff at y = 4.0)
        const groundLevel = getGroundLevelAt(this.position);
        this.groundLevel = groundLevel;

        const isRecallChanneling = window.SafeZoneHub && window.SafeZoneHub.channelingTime > 0;

        if (!isRecallChanneling) {
            if (this.position.y > groundLevel || (this.verticalVelocity && this.verticalVelocity !== 0)) {
                this.verticalVelocity = (this.verticalVelocity || 0) - 25 * dt;
                this.position.y += this.verticalVelocity * dt;
            } else {
                this.verticalVelocity = 0;
                this.position.y = groundLevel;
            }
            if (this.position.y < groundLevel) {
                this.position.y = groundLevel;
                this.verticalVelocity = 0;
                if(this.knockback.y < 0) this.knockback.y = 0;
                
                // Effets de slam d'atterrissage après recall
                if (this.justRecalled) {
                    this.justRecalled = false;
                    AudioSys.play('king_land', 0.85);
                    spawnParticles(this.position.clone(), 0x00ffff, 30);
                    // Secousse de caméra légère
                    if (Globals.camera) {
                        const origY = Globals.camera.position.y;
                        Globals.camera.position.y -= 0.6;
                        setTimeout(() => Globals.camera.position.y = origY, 150);
                    }
                }
            }
        } else {
            this.verticalVelocity = 0;
        }

        this.updateCooldowns(dt);
        
        if(this.attackCooldown > 0) this.attackCooldown -= dt;
        
        if(STATE.mouseDown && this.attackCooldown <= 0 && !STATE.isPaused && !this.isStunned && !UI.isMenuOpen() && !STATE.cinematicActive) {
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

    // Cache des éléments DOM du HUD de cooldown (évite querySelector/getElementById à chaque frame)
    _getCooldownEls(k) {
        this._cdEls = this._cdEls || {};
        let els = this._cdEls[k];
        if (!els || !els.btn.isConnected) {
            const btn = document.querySelector(`.skill-icon#skill-${k}`);
            if (!btn) return null;
            els = { btn, text: document.getElementById(`cd-${k}`), overlay: null, hidden: false };
            this._cdEls[k] = els;
        }
        return els;
    }

    updateCooldowns(dt) {
        const isLocal = this.isLocalPlayer();
        // `for...in` évite le tableau + la closure alloués par Object.keys().forEach() à chaque frame.
        for (const k in this.cooldowns) {
            if(this.cooldowns[k] > 0) {
                this.cooldowns[k] -= dt;
                if (isLocal) this.updateCooldownUI(k);
            } else if (isLocal) {
                const els = this._getCooldownEls(k);
                if (els && !els.hidden) {
                    if (els.text) els.text.style.display = 'none';
                    if (els.overlay) els.overlay.style.height = '0%';
                    els.hidden = true;
                }
            }
        }
    }

    handleInputs(dt) {
        if (!this.isLocalPlayer()) return;
        if (STATE.mouseDown && this.attackCooldown <= 0 && !this.isCasting && !this.isStunned && !UI.isMenuOpen() && !STATE.cinematicActive) {
            this.triggerAttack();
        }
    }

    performAttack() { 
        if(this.isStunned || UI.isMenuOpen() || STATE.cinematicActive) return; 
        this.triggerAttack(); 
    }

    useSkill(key) {
        if (this.dead) return;
        if (this.isStunned || STATE.cinematicActive) return; 
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
            _scratchDir.set(0, 0, 1);
            if (this.mesh) _scratchDir.applyQuaternion(this.mesh.quaternion);
            else _scratchDir.applyQuaternion(this.quaternion); 
            _scratchDir.y = 0; _scratchDir.normalize();

            net.send({
                type: 'net-action',
                action: 'skill',
                id: STATE.multiplayer.id,
                key: key,
                class: this.className,
                pos: { x: this.position.x, y: this.position.y, z: this.position.z },
                dir: { x: _scratchDir.x, y: _scratchDir.y, z: _scratchDir.z },
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

        _scratchDir.set(0, 0, 1);
        if (this.mesh) _scratchDir.applyQuaternion(this.mesh.quaternion);
        else _scratchDir.applyQuaternion(this.quaternion);
        _scratchDir.y = 0; _scratchDir.normalize();
        
        const net = Network || window.Network;

        if (STATE.multiplayer.active && net) {
            const actionType = ['warrior', 'blade', 'sentinel', 'pacifier', 'eclipse'].includes(this.className) ? 'attack-melee' : 'attack-range';
            
            net.send({
                type: 'net-action',
                action: actionType,
                id: STATE.multiplayer.id,
                class: this.className,
                pos: { x: this.position.x, y: this.position.y, z: this.position.z },
                dir: { x: _scratchDir.x, y: _scratchDir.y, z: _scratchDir.z },
                color: CONFIG.colors[this.className],
                typeP: 'player'
            });
        }
    }

    updateCooldownUI(k) {
        if (!this.isLocalPlayer()) return;
        const els = this._getCooldownEls(k);
        if (!els) return;

        const pct = (this.cooldowns[k] / this.maxCooldowns[k]) * 100;
        if (!els.overlay || !els.overlay.isConnected) {
            let overlay = els.btn.querySelector('.cooldown-overlay');
            if(!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'cooldown-overlay';
                overlay.style.position = 'absolute'; overlay.style.bottom = '0'; overlay.style.left = '0';
                overlay.style.width = '100%'; overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
                els.btn.appendChild(overlay);
            }
            els.overlay = overlay;
        }
        els.overlay.style.height = pct + '%';
        els.hidden = false;
        if (els.text) {
            els.text.style.display = 'flex';
            const secs = Math.ceil(this.cooldowns[k]);
            // Écriture DOM seulement quand la valeur affichée change
            if (els.lastSecs !== secs) {
                els.lastSecs = secs;
                els.text.innerText = secs;
            }
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
            // Retour progressif des jambes au repos (évite le "pop" à l'arrêt du déplacement).
            const restLerp = dampFactor(10, dt);
            const settleLerp = dampFactor(5, dt);
            if(this.legL) this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, 0, restLerp);
            if(this.legR) this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0, restLerp);
            if(!this.isAttacking && this.weaponGroup) {
                this.weaponGroup.rotation.x = THREE.MathUtils.lerp(this.weaponGroup.rotation.x, 0, settleLerp);
                if(this.armL) this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, 0, settleLerp);
            }
            if(this.mesh) this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, 0, settleLerp);
        }
    }

    resolveCollisions() {
        if (!this.isLocalPlayer()) return;

        if (STATE.leftSafeZone) {
            const dx = this.position.x - 90;
            const dz = this.position.z - 90;
            const dist = Math.hypot(dx, dz);
            if (dist < 12.1) {
                _pushDir.set(dx, 0, dz);
                if (_pushDir.lengthSq() < 0.001) {
                    _pushDir.set(0, 0, -1);
                } else {
                    _pushDir.normalize();
                }
                // Activer un fort recul
                this.knockback.copy(_pushDir).multiplyScalar(25.0);
                this.position.x = 90 + _pushDir.x * 12.2;
                this.position.z = 90 + _pushDir.z * 12.2;
                
                // Léger pop vertical si le joueur est au sol pour marquer l'impact physique
                if (this.position.y < 1.0) {
                    this.verticalVelocity = 5.0;
                }
                
                // Effets visuels et sonores de recul
                spawnParticles(this.position.clone(), 0x00ffff, 8);
                AudioSys.play('water_slash', 0.5);
            }
        }

        if (STATE.leftSafeZone) {
            const dist = Math.hypot(this.position.x, this.position.z);
            const maxR = getPlayableRadiusAt(this.position.x, this.position.z);
            
            // Si le joueur est en dehors de la zone de l'île principale
            if (dist > maxR) {
                const distToSpawn = Math.hypot(this.position.x - 90, this.position.z - 90);
                const distToBoss = Math.hypot(this.position.x - BOSS_ZONE.cx, this.position.z - BOSS_ZONE.cz);
                
                // Et qu'il est en dehors de la zone du spawn (rayon 30) ET de la zone du boss (rayon 30)
                if (distToSpawn > 30 && distToBoss > 30) {
                    // On pousse le joueur vers la zone autorisée la plus proche (spawn, boss ou île)
                    const spawnDx = this.position.x - 90;
                    const spawnDz = this.position.z - 90;
                    const spawnClampX = 90 + (spawnDx / distToSpawn) * 30;
                    const spawnClampZ = 90 + (spawnDz / distToSpawn) * 30;
                    
                    const bossDx = this.position.x - BOSS_ZONE.cx;
                    const bossDz = this.position.z - BOSS_ZONE.cz;
                    const bossClampX = BOSS_ZONE.cx + (bossDx / distToBoss) * 30;
                    const bossClampZ = BOSS_ZONE.cz + (bossDz / distToBoss) * 30;
                    
                    const islandClampX = (this.position.x / dist) * maxR;
                    const islandClampZ = (this.position.z / dist) * maxR;
                    
                    const distToSpawnClamp = Math.hypot(this.position.x - spawnClampX, this.position.z - spawnClampZ);
                    const distToBossClamp = Math.hypot(this.position.x - bossClampX, this.position.z - bossClampZ);
                    const distToIslandClamp = Math.hypot(this.position.x - islandClampX, this.position.z - islandClampZ);
                    
                    const minDist = Math.min(distToSpawnClamp, distToBossClamp, distToIslandClamp);
                    if (minDist === distToSpawnClamp) {
                        this.position.x = spawnClampX;
                        this.position.z = spawnClampZ;
                    } else if (minDist === distToBossClamp) {
                        this.position.x = bossClampX;
                        this.position.z = bossClampZ;
                    } else {
                        this.position.x = islandClampX;
                        this.position.z = islandClampZ;
                    }
                }
            }
        }

        // Pendant le combat de boss, le joueur est confiné mathématiquement dans le cercle de l'arène
        if (STATE.isBossFight) {
            const dx = this.position.x - BOSS_ZONE.cx;
            const dz = this.position.z - BOSS_ZONE.cz;
            const dist = Math.hypot(dx, dz);
            if (dist > BOSS_ZONE.radius - this.radius) {
                const angle = Math.atan2(dz, dx);
                this.position.x = BOSS_ZONE.cx + Math.cos(angle) * (BOSS_ZONE.radius - this.radius);
                this.position.z = BOSS_ZONE.cz + Math.sin(angle) * (BOSS_ZONE.radius - this.radius);
            }
        }

        // Le test au carré évite une racine carrée par obstacle/ennemi et par frame :
        // seuls les cas réellement en contact la paient.
        if (Globals.obstacles) {
            for (const obs of Globals.obstacles) {
                const minDist = this.radius + obs.radius;
                const distSq = this.position.distanceToSquared(obs.position);
                if (distSq < minDist * minDist) {
                    this.separateFrom(obs.position, minDist, Math.sqrt(distSq));
                }
            }
        }
        
        if (Globals.enemies) {
            for (const enemy of Globals.enemies) {
                if (enemy.dead || enemy.isBoss || enemy.radius === 0) continue;
                const enemyRadius = enemy.radius !== undefined ? enemy.radius : 0.5; 
                const minDist = this.radius + enemyRadius;
                const distSq = this.position.distanceToSquared(enemy.position);
                if (distSq < minDist * minDist) {
                    this.separateFrom(enemy.position, minDist, Math.sqrt(distSq));
                }
            }
        }
    }

    // Repousse le joueur hors d'un cercle bloquant, sans allouer de Vector3.
    separateFrom(otherPos, minDist, dist) {
        _pushDir.subVectors(this.position, otherPos).normalize();
        if (_pushDir.lengthSq() === 0) _pushDir.set(1, 0, 0);
        this.position.addScaledVector(_pushDir, minDist - dist);
    }

    takeDamage(amount) {
        if(this.dead) return;

        if (this.isLocalPlayer() && isInSafeZone(this.position)) return;
        
        // --- IMMUNITÉ INTANGIBLE (Pas Éthéré) ---
        if(this.isIntangible) {
            createDamageText("ESQUIVÉ", this.position, "#aaddff");
            return;
        }

        amount = ConstellationEngine.absorbOverhealShield(this, amount);
        amount = ConstellationEngine.modifyDamageTaken(amount);

        if (this._abyssalVulnUntil && Date.now() < this._abyssalVulnUntil && this._abyssalVulnMult) {
            amount *= this._abyssalVulnMult;
        }

        if (amount > 0) {
            this.hp -= amount;

            // Annuler le Rappel si le joueur prend des dégâts
            if (this.isLocalPlayer() && window.SafeZoneHub) {
                window.SafeZoneHub.cancelRecallChanneling();
            }

            createDamageText("-" + Math.floor(amount), this.position, '#ff0000');
            this.flashColor(this.bodyGroup, 0xff0000);
            AudioSys.sfx.hit();
            
            // --- PASSIF ÉPINE DE FER (Renvoi) ---
            if (STATE.passives && STATE.passives.ironThorn && Globals.enemies) {
                const reflectDmg = amount * 0.15;
                if(reflectDmg >= 1) {
                    let closest = null;
                    let minDSq = Infinity;
                    for (const e of Globals.enemies) {
                        if (e.dead) continue; // ne pas renvoyer les dégâts sur un cadavre
                        const dSq = this.position.distanceToSquared(e.position);
                        if(dSq < minDSq) { minDSq = dSq; closest = e; }
                    }
                    
                    if (closest && minDSq < 25 && isServerAuthority()) {
                        dealDamageToEnemy(closest, reflectDmg, { pos: closest.position, noCrit: true, maxRange: 6 });
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
        if (this.className === 'sentinel') {
            amount *= ConstellationEngine.getHealAmpMult();
            amount = ConstellationEngine.applyOverhealShield(this, amount);
        }
        this.hp = Math.min(this.maxHp, this.hp + amount); 
        createDamageText("+" + Math.floor(amount), this.position, '#00ff00');
        if (this.isLocalPlayer()) UI.updateHUD();
    }

    die() {
        if(this.dead) return;
        this.dead = true;
        this.visible = false; 
        this.clearFlash();
        createDamageText("MORT", this.position, '#8a0b0b');
        AudioSys.sfx.hit(); 
        if (this.isLocalPlayer()) {
            const deathScreen = document.getElementById('death-screen');
            if(deathScreen) deathScreen.style.display = 'flex';

            if (STATE.isBossFight) {
                if (STATE.multiplayer.active) {
                    if (STATE.multiplayer.isHost) {
                        if (window.GameLogic && typeof window.GameLogic.triggerWipe === 'function') {
                            window.GameLogic.triggerWipe();
                        }
                    } else {
                        Network.send({ type: 'request-wipe' });
                    }
                } else {
                    if (window.GameLogic && typeof window.GameLogic.triggerWipe === 'function') {
                        window.GameLogic.triggerWipe();
                    }
                }
            }
        }
    }

    respawn() {
        this.dead = false; this.visible = true; this.hp = this.maxHp;
        this.buffs = []; this.debuffs = []; this.cooldowns = { space: 0, shift: 0, e: 0 };
        this.position.set(90, 4.0, 90);
        STATE.leftSafeZone = false;
        this.isStunned = false; 
        this.verticalVelocity = 0;
        // Sans ces remises à zéro, mourir pendant une attaque ou un cast laissait le
        // personnage bloqué hors de l'état idle après la réapparition.
        this.isAttacking = false;
        this.isCasting = false;
        this.attackCooldown = 0;
        this.isIntangible = false;
        this.intangibleTimer = 0;
        this.knockback.set(0, 0, 0);
        if (this.animState) this.animState.override = false;
        if(this.stunVisualGroup) this.stunVisualGroup.visible = false;
        
        if (this.isLocalPlayer()) {
            const deathScreen = document.getElementById('death-screen');
            if(deathScreen) deathScreen.style.display = 'none';
        }
        this.bodyGroup.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive && child.userData.baseEmissive !== undefined) {
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
        if (this.isLocalPlayer()) {
            this.updateBuffUI();
            if (window.SafeZoneHub) {
                window.SafeZoneHub.cancelRecallChanneling();
            }
        }
    }

    updateDebuffs(dt) {
        if (!this.debuffs?.length) return;
        for (let i = this.debuffs.length - 1; i >= 0; i--) {
            this.debuffs[i].timer -= dt;
            if (this.debuffs[i].timer <= 0) this.debuffs.splice(i, 1);
        }
    }

    updateBuffs(dt) {
        for(let i=this.buffs.length-1; i>=0; i--) {
            this.buffs[i].timer -= dt;
            if(this.buffs[i].timer <= 0) this.buffs.splice(i, 1);
        }
        this.updateDebuffs(dt);
        // Un seul rafraîchissement par frame : updateDebuffs en déclenchait un second.
        if (this.isLocalPlayer()) this.updateBuffUI();
    }

    updateBuffUI() {
        if (!this.isLocalPlayer()) return;
        BuffBar.render();
    }

    flashColor(obj, colorHex) {
        if (!obj) return;
        // Un seul timer pour tout le personnage : la version précédente armait un setTimeout
        // par mesh, soit plusieurs dizaines de timers à chaque coup reçu.
        if (!this._flashedMeshes) this._flashedMeshes = new Set();
        const flashed = this._flashedMeshes;

        obj.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
                if (child.userData.baseEmissive === undefined) {
                    const current = child.material.emissive.getHex();
                    if(current === colorHex) child.userData.baseEmissive = 0x000000;
                    else child.userData.baseEmissive = current;
                }
                child.material.emissive.setHex(colorHex);
                flashed.add(child);
            }
        });

        if (this._flashTimeout) clearTimeout(this._flashTimeout);
        this._flashTimeout = setTimeout(() => {
            this._flashTimeout = null;
            this.clearFlash();
        }, 100);
    }

    clearFlash() {
        if (this._flashTimeout) { clearTimeout(this._flashTimeout); this._flashTimeout = null; }
        if (!this._flashedMeshes) return;
        for (const child of this._flashedMeshes) {
            if (child.material && child.userData.baseEmissive !== undefined) {
                child.material.emissive.setHex(child.userData.baseEmissive);
            }
        }
        this._flashedMeshes.clear();
    }

    addLocalVisual(mesh, duration, updateFn) {
        Globals.scene.add(mesh);
        this.localVisuals.push({ mesh, duration, updateFn, maxDuration: duration });
    }

    updateLocalVisuals(dt) {
        for(let i = this.localVisuals.length - 1; i >= 0; i--) {
            const v = this.localVisuals[i];
            v.duration -= dt;
            if(v.updateFn) v.updateFn(v.mesh, v.duration, v.maxDuration, dt);
            if(v.duration <= 0) {
                Globals.scene.remove(v.mesh);
                disposeObject3D(v.mesh);
                this.localVisuals.splice(i, 1);
            }
        }
    }

    faceMouse() {
        if (!Globals.camera) return;
        if (!this.isLocalPlayer()) return;
        if (this.isStunned) return;
        if (UI.isMenuOpen()) return; 

        if (!STATE.raycaster) {
            STATE.raycaster = new THREE.Raycaster();
        }
        STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
        STATE.raycaster.ray.intersectPlane(_groundPlane, _intersectPoint);
        const dx = _intersectPoint.x - this.mesh.position.x;
        const dz = _intersectPoint.z - this.mesh.position.z;
        
        this.netRotation = Math.atan2(dx, dz);
        
        this.mesh.lookAt(_intersectPoint.x, this.mesh.position.y, _intersectPoint.z);
    }
    
    updateClassPassives(dt) {}
}