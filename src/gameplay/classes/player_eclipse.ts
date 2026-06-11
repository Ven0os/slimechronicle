// @ts-nocheck
import { PlayerBase } from '../player_base';
import { CONFIG, STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createSkillVisual, createDamageText, spawnParticles } from '../../visual/effects';
import { Network } from '../../multiplayer/network';
import { Globals, GameActions } from '../../core/globals';
import { ConstellationEngine } from '../../systems/constellationEngine';
import { ConvergenceEffects } from '../../systems/convergenceEffects';
import { PassiveKeystoneHooks } from '../../systems/passiveKeystoneHooks';
import { Projectile } from '../entities';
import { dealDamageToEnemy } from '../combat/damage_helpers';
import { canApplyGameplay, canDealDamageDirectly, sendSkillIntent, shouldSendSkillIntent } from '../../multiplayer/net_authority';

export class Eclipse extends PlayerBase {
    // ... (Reste du code inchangé) ...
    constructor() {
        super('eclipse');
        this.eclipse = { sun: 0, moon: 0, nextIsSun: true, active: false };
        this.createClassModel();
        this.applyClassStats();
        this.invulnerable = false;
        this.isCasting = false;
    }

    createClassModel() {
        // ... (Reste du code inchangé) ...
        // --- PALETTE DE COULEURS "COSMIC FANTASY" ---
        const voidMat = new THREE.MeshStandardMaterial({ 
            color: 0x0a0a10, // Noir bleuté profond
            roughness: 0.2, 
            metalness: 0.8,
            name: 'original'
        });
        
        const armorMat = new THREE.MeshStandardMaterial({
            color: 0x222233, // Métal sombre
            roughness: 0.4,
            metalness: 0.6,
            name: 'original'
        });

        const goldMat = new THREE.MeshStandardMaterial({ 
            color: 0xffaa00, // Or riche
            roughness: 0.2, 
            metalness: 1.0,
            emissive: 0x552200,
            name: 'original'
        });

        const sunEmissive = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0xffddaa,
            emissiveIntensity: 1.0,
            roughness: 0.1,
            name: 'original'
        });
        
        const moonEmissive = new THREE.MeshStandardMaterial({ 
            color: 0xaa88ff, 
            emissive: 0x4400aa,
            emissiveIntensity: 1.5,
            roughness: 0.1,
            name: 'original'
        });

        this.mesh = new THREE.Group();
        this.bodyGroup.add(this.mesh);

        // --- CORPS PRINCIPAL ---
        this.body = new THREE.Group();
        this.body.position.y = 1.0;
        this.mesh.add(this.body);

        // 1. Jambes / Robe Armurée (Bas)
        // Jupe centrale
        const skirtMain = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 8, 1, true), voidMat);
        skirtMain.position.y = -0.45;
        this.body.add(skirtMain);
        
        // Plaques d'armure sur la robe (Hanches)
        const hipPlateGeo = new THREE.BoxGeometry(0.3, 0.5, 0.1);
        for(let i=0; i<4; i++) {
            const plate = new THREE.Mesh(hipPlateGeo, armorMat);
            plate.position.y = -0.2;
            const angle = (i / 4) * Math.PI * 2;
            plate.position.x = Math.cos(angle) * 0.35;
            plate.position.z = Math.sin(angle) * 0.35;
            plate.lookAt(0, -0.2, 0);
            this.body.add(plate);
        }

        // 2. Torse (Plastron Divin)
        const torsoGeo = new THREE.CylinderGeometry(0.3, 0.25, 0.6, 8);
        const torso = new THREE.Mesh(torsoGeo, armorMat);
        this.body.add(torso);
        
        // Coeur d'énergie (Fusion)
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), goldMat);
        core.position.set(0, 0, 0.25);
        this.body.add(core);

        // Col / Gorget montant
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.3, 8, 1, true, 0, Math.PI), goldMat);
        collar.position.set(0, 0.3, 0);
        collar.rotation.y = -Math.PI/2; // Ouvert devant
        this.body.add(collar);

        // 3. Tête (Casque sans visage)
        this.headGroup = new THREE.Group();
        this.headGroup.position.y = 0.5;
        this.body.add(this.headGroup);

        // Capuche/Casque
        const helmet = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), voidMat);
        this.headGroup.add(helmet);
        
        // Visière lumineuse (Fente verticale)
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.25), sunEmissive);
        visor.position.set(0, 0, 0.15);
        this.headGroup.add(visor);

        // Halo Double (Soleil et Lune)
        this.haloSun = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.015, 8, 32), goldMat);
        this.haloMoon = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.015, 8, 32), moonEmissive);
        this.haloSun.rotation.x = Math.PI/2; this.haloMoon.rotation.x = Math.PI/2; // A plat au dessus
        this.haloSun.rotation.y = 0.2; this.haloMoon.rotation.y = -0.2; // Tilt
        this.haloSun.position.y = 0.35; this.haloMoon.position.y = 0.35;
        this.headGroup.add(this.haloSun);
        this.headGroup.add(this.haloMoon);

        // 4. Epaulières Massives
        const pauldronGeo = new THREE.SphereGeometry(0.25, 8, 8, 0, Math.PI);
        
        const pL = new THREE.Mesh(pauldronGeo, goldMat);
        pL.position.set(0.4, 0.25, 0);
        pL.rotation.z = -0.2;
        this.body.add(pL);

        const pR = new THREE.Mesh(pauldronGeo, armorMat);
        pR.position.set(-0.4, 0.25, 0);
        pR.rotation.z = 0.2;
        this.body.add(pR);

        // 5. AILES D'ÉNERGIE (Levitation)
        // On crée 6 lames d'énergie flottantes dans le dos
        this.wings = new THREE.Group();
        this.wings.position.set(0, 0.2, -0.3);
        this.body.add(this.wings);

        const wingBladeGeo = new THREE.ConeGeometry(0.08, 1.2, 4);
        wingBladeGeo.translate(0, 0.6, 0); // Pivot à la base
        wingBladeGeo.rotateX(-0.2); // Courbure arrière

        for(let i=0; i<3; i++) {
            // Aile Gauche (Solaire)
            const wL = new THREE.Mesh(wingBladeGeo, sunEmissive.clone());
            wL.position.set(0.1, 0, 0);
            wL.rotation.z = -0.5 - (i * 0.4); // Éventail
            wL.rotation.y = 0.2;
            wL.scale.setScalar(0.8 + (i*0.1));
            this.wings.add(wL);

            // Aile Droite (Lunaire)
            const wR = new THREE.Mesh(wingBladeGeo, moonEmissive.clone());
            wR.position.set(-0.1, 0, 0);
            wR.rotation.z = 0.5 + (i * 0.4); // Éventail
            wR.rotation.y = -0.2;
            wR.scale.setScalar(0.8 + (i*0.1));
            this.wings.add(wR);
        }

        // --- ARME : GLAIVE DE L'ÉCLIPSE (Double Lame) ---
        this.weaponGroup = new THREE.Group();
        this.weaponGroup.position.set(0.6, 0, 0.3);
        this.body.add(this.weaponGroup);

        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2), armorMat);
        this.weaponGroup.add(staff);

        // Lame Soleil (Haut)
        const bladeSun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.02), sunEmissive);
        bladeSun.position.y = 1.2;
        bladeSun.scale.set(1, 1, 2); // Large
        this.weaponGroup.add(bladeSun);
        // Ornement lame
        const decoSun = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 16), goldMat);
        decoSun.position.y = 1.0;
        this.weaponGroup.add(decoSun);

        // Lame Lune (Bas)
        const bladeMoon = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.1, 0.6, 4), moonEmissive);
        bladeMoon.position.y = -1.2;
        bladeMoon.rotation.x = Math.PI;
        this.weaponGroup.add(bladeMoon);
        // Croissant bas
        const decoMoon = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 16, Math.PI), armorMat);
        decoMoon.position.y = -1.0;
        decoMoon.rotation.z = Math.PI/2;
        this.weaponGroup.add(decoMoon);
        
        // Sauvegarde des propriétés originales pour le reset
        this.mesh.traverse(c => {
            if(c.isMesh && c.material) {
                c.userData.baseColor = c.material.color.getHex();
                c.userData.baseEmissive = c.material.emissive ? c.material.emissive.getHex() : 0x000000;
                c.userData.baseEmissiveIntensity = c.material.emissiveIntensity || 1.0;
                c.userData.baseRoughness = c.material.roughness;
                c.userData.baseMetalness = c.material.metalness;
            }
        });
    }

    // Gestion du mouvement bloqué lors des animations critiques
    update(dt) {
        if (this.isCasting) {
             this.speed = 0; // Le joueur est enraciné
        } else {
             this.speed = STATE.stats.speed; 
        }
        super.update(dt);
    }

    updateClassPassives(dt) {
        if(!this.eclipse.active && this.eclipse.sun >= 100 && this.eclipse.moon >= 100) {
            this.eclipse.active = true;
            createDamageText("ÉCLIPSE TOTALE", this.position, '#ffffff');
            createSkillVisual('shockwave', this.position, 6, 0xffffff);
        }

        const resourceEl = document.getElementById('class-resource');
        if (resourceEl) {
            const sunColor = this.eclipse.sun >= 100 ? '#ffcc00' : '#ffa800'; 
            const moonColor = this.eclipse.moon >= 100 ? '#a3b1cc' : '#5dade2'; 
            const nextText = this.eclipse.nextIsSun ? '<span style="color:#ffcc00; font-weight:700;">SOLAIRE</span>' : '<span style="color:#a3b1cc; font-weight:700;">LUNAIRE</span>';
            
            let html = '';
            if (this.eclipse.active) {
                html = `<div style="color:#ffffff; font-family:'Cinzel', serif; font-size:10px; font-weight:700; text-align:center; animation: pulse 1s infinite ease-in-out; text-shadow: 0 0 12px #ffaa00; width:100%; letter-spacing:2px;"><i class="fas fa-yin-yang"></i> ✦ ASCENSION ✦</div>`;
            } else {
                html = `
                    <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-family:'Cinzel', serif; font-size:9px; font-weight:700; color:rgba(255,255,255,0.6);">
                            <span>ALIGNEMENT</span>
                            <span>${nextText}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; gap:12px; width:100%;">
                            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                                <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:700; color:${sunColor};">
                                    <span>☀ SOLEIL</span>
                                    <span>${Math.floor(this.eclipse.sun)}%</span>
                                </div>
                                <div style="width:100%; height:3px; background:rgba(0,0,0,0.5); border-radius:1.5px; overflow:hidden;">
                                    <div style="width:${Math.min(100, this.eclipse.sun)}%; height:100%; background:${sunColor}; box-shadow:0 0 4px ${sunColor};"></div>
                                </div>
                            </div>
                            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                                <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:700; color:${moonColor};">
                                    <span>☾ LUNE</span>
                                    <span>${Math.floor(this.eclipse.moon)}%</span>
                                </div>
                                <div style="width:100%; height:3px; background:rgba(0,0,0,0.5); border-radius:1.5px; overflow:hidden;">
                                    <div style="width:${Math.min(100, this.eclipse.moon)}%; height:100%; background:${moonColor}; box-shadow:0 0 4px ${moonColor};"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            resourceEl.innerHTML = html;
            resourceEl.style.display = 'block';
        }
    }

    animateCharacter(dt) {
        super.animateCharacter(dt);
        
        const t = Date.now() * 0.001;

        // 1. Lévitation (Respiration verticale)
        this.body.position.y = 1.0 + Math.sin(t * 1.5) * 0.15;
        this.body.rotation.x = Math.sin(t * 0.5) * 0.05; // Léger tangage

        // 2. Animation des Halos (Rotation opposée)
        if(this.haloSun && this.haloMoon) {
            this.haloSun.rotation.z = t * 0.5;
            this.haloMoon.rotation.z = -t * 0.5;
            // Pulsation d'épaisseur
            const s = 1 + Math.sin(t*5)*0.05;
            this.haloSun.scale.set(s,s,s);
        }

        // 3. Animation des Ailes (Battement lent)
        if(this.wings) {
            this.wings.children.forEach((wing, i) => {
                // Les ailes pulsent et bougent légèrement
                const baseRot = (i % 2 === 0) ? -0.5 - (Math.floor(i/2)*0.4) : 0.5 + (Math.floor(i/2)*0.4);
                const flap = Math.sin(t * 2.0 + i) * 0.1;
                wing.rotation.z = baseRot + flap;
                
                // Effet de brillance variable
                if(wing.material.emissiveIntensity) {
                    wing.material.emissiveIntensity = 1.0 + Math.sin(t * 3 + i)*0.5;
                }
            });
        }

        // 4. Arme flottante
        if(this.weaponGroup) {
            this.weaponGroup.position.y = Math.sin(t * 2 + 1) * 0.05;
        }
    }

    performAttack() {
        if(this.isCasting) return; // Empêche d'attaquer si en train de cast

        this.faceMouse(); 
        const haste = ConvergenceEffects.getEclipseAttackSpeedMult(this);
        this.attackCooldown = (this.attackMaxCooldown * (STATE.stats.attackSpeedMod || 1)) / haste;
        this.isAttacking = true;
        AudioSys.sfx.mage.cast(); 

        // Animation d'attaque: coup de glaive
        const startRot = this.weaponGroup.rotation.clone();
        this.weaponGroup.rotation.x = -1.5; 
        this.weaponGroup.rotation.z = -0.5;

        setTimeout(() => { 
            this.weaponGroup.rotation.x = 0; 
            this.weaponGroup.rotation.z = 0;
            setTimeout(() => this.isAttacking = false, 250);
        }, 150);

        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0; dir.normalize();

        if (shouldSendSkillIntent()) {
            sendSkillIntent({ intent: 'eclipse-attack', dir, pos: this.position.clone() });
        } else if (STATE.multiplayer.active && this.isLocalPlayer()) {
            Network.send({ type: 'net-action', action: 'attack-range', id: STATE.multiplayer.id, pos: this.position, dir: dir, color: CONFIG.colors.eclipse, class: 'eclipse' });
        }

        const empowered = canDealDamageDirectly() && ConvergenceEffects.consumeEmpoweredAttack(this);
        const empPreview = !canDealDamageDirectly() && (this._empoweredAttacksLeft || 0) > 0;
        if (empowered || empPreview) createDamageText('DUALITÉ+', this.position, '#ffcc00');

        const empMult = (empowered || empPreview) ? 1.3 : 1;

        const fireSun = empowered || this.eclipse.nextIsSun;
        const fireMoon = empowered || !this.eclipse.nextIsSun;

        if (fireSun) {
            // SOLEIL
            const proj = new Projectile(
                new THREE.SphereGeometry(0.35, 8, 8), 
                new THREE.MeshStandardMaterial({color: 0xffdd88, emissive:0xffaa00, emissiveIntensity:2}), 
                this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 
                dir, 0.7, STATE.stats.atk * empMult, 'player', 0xffffff
            );
            
            const originalUpdate = proj.update.bind(proj);
            proj.update = (dt) => {
                originalUpdate(dt);
                if (!Globals.scene.children.includes(proj.mesh)) { 
                     if (!canApplyGameplay()) return;
                     Globals.enemies.forEach(e => {
                         if(e.position.distanceTo(proj.mesh.position) < 2.5) {
                             const burnDmg = STATE.stats.atk * 0.2 * empMult;
                             setTimeout(() => { if(!e.dead && canApplyGameplay()) { dealDamageToEnemy(e, burnDmg, { pos: e.position, noCrit: true, skillKey: 'primary' }); createDamageText("FEU", e.position, '#ffa500'); ConvergenceEffects.applyCataclysmVulnerability(e); } }, 500);
                         }
                    });
                }
            };
            Globals.projectiles.push(proj);
            this.eclipse.sun = Math.min(100, this.eclipse.sun + 10);
            if (!empowered) this.eclipse.nextIsSun = false;

        }
        if (fireMoon) {
            // LUNE
            const proj = new Projectile(
                new THREE.TorusGeometry(0.25, 0.08, 8, 16), 
                new THREE.MeshStandardMaterial({color: 0x220044, emissive:0x440088, emissiveIntensity:1}), 
                this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 
                dir, 0.7, STATE.stats.atk * 1.2 * empMult, 'player', 0xaa00ff
            );
            proj.mesh.rotation.x = Math.PI/2;
            
            const originalUpdateMoon = proj.update.bind(proj);
            proj.update = (dt) => {
                originalUpdateMoon(dt);
                if (!Globals.scene.children.includes(proj.mesh)) {
                    if(Math.random() < 0.5) { 
                         this.heal(STATE.stats.atk * 0.1 * empMult);
                         createDamageText("+HP", this.position, '#00ff00');
                    }
                }
            };
            Globals.projectiles.push(proj);
            this.eclipse.moon = Math.min(100, this.eclipse.moon + 10);
            if (!empowered) this.eclipse.nextIsSun = true;
        }
    }

    useSkill(key) {
        if(this.cooldowns[key] > 0 || this.isCasting) return;
        this.faceMouse();
        const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);
        this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);
        ConstellationEngine.onSkillUsed(key);
        
        if(key === 'space') { 
            // --- ÉCLAT SOLAIRE (Ricochet) ---
            AudioSys.sfx.mage.cast(); 
            this.invulnerable = true;
            createDamageText("IMMUNE", this.position, '#ffffff');
            setTimeout(() => { this.invulnerable = false; }, 250);

            this.eclipse.sun = Math.min(100, this.eclipse.sun + 30);
            const startPos = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
            spawnParticles(startPos, 0xffffff, 10);
            
            const solar = PassiveKeystoneHooks.getSolarFlareMods();
            const maxBounces = 5 + solar.extraBounces;
            let bouncesLeft = maxBounces;
            let currentPos = startPos.clone();
            let hitEnemies = []; 
            let damage = ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 2.5, { skill: true, skillKey: 'space' });

            const doBounce = (pos, delay) => {
                if (bouncesLeft <= 0) return;
                let target = null;
                let minDist = 15.0; 
                Globals.enemies.forEach(e => {
                    if (e.dead || hitEnemies.includes(e.id)) return;
                    const d = pos.distanceTo(e.position);
                    if (d < minDist) { minDist = d; target = e; }
                });

                if (target) {
                    hitEnemies.push(target.id);
                    bouncesLeft--;
                    const dist = target.position.distanceTo(pos);
                    const speed = 40.0; 
                    const travelTime = (dist / speed) * 1000;

                    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4), new THREE.MeshBasicMaterial({color: 0xffffff}));
                    orb.position.copy(pos);
                    Globals.scene.add(orb);

                    let elapsed = 0;
                    const animInterval = setInterval(() => {
                        elapsed += 16;
                        const t = Math.min(1, elapsed / travelTime);
                        orb.position.lerpVectors(pos, target.position.clone().add(new THREE.Vector3(0,1,0)), t);
                        if(t >= 1) {
                            clearInterval(animInterval);
                            Globals.scene.remove(orb);
                            dealDamageToEnemy(target, damage, { pos: target.position });
                            createDamageText(Math.floor(damage), target.position, '#ffffff');
                            spawnParticles(target.position, 0xffffff, 5);
                            for (let t = 1; t <= solar.dotTicks; t++) {
                                setTimeout(() => {
                                    if (!target.dead) {
                                        dealDamageToEnemy(target, damage * solar.dotMult, { pos: target.position, noCrit: true });
                                        createDamageText('BRÛLURE', target.position, '#ffaa00');
                                    }
                                }, t * 1000);
                            }
                            damage *= 0.5; 
                            doBounce(target.position, 0); 
                        }
                    }, 16);
                } else if (bouncesLeft === maxBounces) {
                    const p = new Projectile(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({color:0xffffff}), pos, dir, 1.0, damage, 'player', 0xffffff);
                    Globals.projectiles.push(p);
                }
            };
            doBounce(currentPos, 0);

        } else if (key === 'shift') { 
            // --- PIC DE LUNE ---
            AudioSys.sfx.warrior.smash(); 
            this.weaponGroup.position.y += 0.5;
            setTimeout(() => this.weaponGroup.position.y -= 0.5, 300);

            const targetPos = this.position.clone().add(dir.clone().multiplyScalar(4));
            const spikeGeo = new THREE.ConeGeometry(1.5, 6, 8);
            const spikeMat = new THREE.MeshStandardMaterial({color: 0x110033, emissive: 0x4400aa, roughness: 0.1});
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.copy(targetPos);
            spike.position.y = -3; 
            
            this.addLocalVisual(spike, 1.0, (m, t, maxT) => {
                if (t < 0.2) m.position.y = -3 + (t/0.2) * 3; 
                else if (t > 0.8) { m.position.y = (1 - (t-0.8)/0.2) * 3 - 3; m.material.opacity = (1 - t); }
                m.rotation.y += 0.1;
            });
            
            const rune = new THREE.Mesh(new THREE.RingGeometry(0.5, 3, 32), new THREE.MeshBasicMaterial({color:0xaa00ff, side:THREE.DoubleSide, transparent:true, opacity:0.8}));
            rune.rotation.x = -Math.PI/2;
            rune.position.copy(targetPos).add(new THREE.Vector3(0, 0.1, 0));
            this.addLocalVisual(rune, 1.0, (m, t) => m.scale.multiplyScalar(1.02));

            const lunar = PassiveKeystoneHooks.getLunarSpikeMods();
            Globals.enemies.forEach(e => {
                if(e.position.distanceTo(targetPos) <= lunar.radius) {
                    dealDamageToEnemy(e, ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 3.0 * lunar.dmgMult, { skill: true, skillKey: 'shift' }), { pos: e.position });
                    e.position.y += 2.0;
                    if (e.speed != null) e.speed *= lunar.slowFactor;
                    createDamageText("EMPALE!", e.position, '#aa00ff');
                }
            });
            this.eclipse.moon = Math.min(100, this.eclipse.moon + 20);

        } else if (key === 'e') { 
            // --- CATACLYSME / ASCENSION ---
            AudioSys.sfx.warrior.smash();
            ConvergenceEffects.onEclipseCataclysm(this);
            let dmgMultiplier = 1.0;
            let applyEffects = false;
            
            if (this.eclipse.active) {
                // ASCENSION CÉLESTE (Mode Ultime Cinématique)
                dmgMultiplier = 2.5; 
                applyEffects = true;
                
                // 1. BLOQUER LE MOUVEMENT + CINÉMATIQUE
                this.isCasting = true; 
                createDamageText("APOCALYPSE", this.position, '#ffffff');
                
                // Active le mode sombre
                if(GameActions && GameActions.setAmbiance) GameActions.setAmbiance('dark');

                const startY = 0; // Position neutre locale
                const liftHeight = 4.0;
                const liftDur = 2000; // Animation de 2s
                const startTime = Date.now();
                const originalFov = Globals.camera.fov;
                
                const ascensionAnim = () => {
                    const elapsed = Date.now() - startTime;
                    if(elapsed >= liftDur) {
                        // FIN ANIMATION - RESET COMPLET
                        this.mesh.position.y = startY; 
                        this.mesh.rotation.y = 0;
                        this.isCasting = false; 
                        
                        // Reset Caméra & Ambiance
                        Globals.camera.fov = originalFov;
                        Globals.camera.updateProjectionMatrix();
                        if(GameActions && GameActions.setAmbiance) GameActions.setAmbiance('normal');
                        Globals.scene.position.set(0,0,0);
                        
                        // Reset Couleurs & Matériaux
                        this.mesh.traverse(c => {
                            if(c.isMesh && c.userData.baseColor !== undefined) {
                                c.material.color.setHex(c.userData.baseColor);
                                c.material.emissive.setHex(c.userData.baseEmissive);
                                c.material.emissiveIntensity = c.userData.baseEmissiveIntensity;
                                c.material.roughness = c.userData.baseRoughness;
                                c.material.metalness = c.userData.baseMetalness;
                            }
                        });
                        return;
                    }
                    
                    const p = elapsed / liftDur;

                    // A. Mouvement Joueur (Ascension fluide et redescente contrôlée)
                    if(p < 0.8) {
                         // Montée + Lévitation
                         this.mesh.position.y = startY + (Math.sin(p * Math.PI) * liftHeight);
                         this.mesh.rotation.y += 0.2; 
                    } else {
                         // Descente douce (Landing)
                         // On utilise une interpolation linéaire simple pour garantir le retour à startY
                         const landP = (p - 0.8) / 0.2; // 0 à 1
                         const currentY = startY + (Math.sin(0.8 * Math.PI) * liftHeight); // Hauteur à 0.8
                         this.mesh.position.y = THREE.MathUtils.lerp(currentY, startY, landP);
                    }

                    // B. Effet Noir et Blanc "Silhouette"
                    // On force les matériaux pour qu'ils soient plats (Basic-like)
                    let targetColor;
                    let intensity = 0;
                    
                    if (p < 0.5) {
                        // Phase Blanche
                        targetColor = 0xffffff;
                        intensity = p * 4.0;
                    } else {
                        // Phase Noire
                        targetColor = 0x000000;
                        intensity = (1.0 - p) * 1.0; 
                    }

                    this.mesh.traverse(c => {
                        if(c.isMesh && c.material) {
                            c.material.color.setHex(targetColor);
                            c.material.emissive.setHex(targetColor);
                            c.material.emissiveIntensity = intensity;
                            // Astuce pour "Silhouette" : On enlève le relief
                            c.material.roughness = 1.0; 
                            c.material.metalness = 0.0;
                        }
                    });

                    // C. Caméra Cinématique (Zoom Doux)
                    // On évite l'effet "avancer/reculer" trop fort. Juste un léger focus.
                    if (p < 0.9) {
                        // Zoom in léger (75 -> 55)
                        Globals.camera.fov = THREE.MathUtils.lerp(originalFov, originalFov - 15, p/0.9);
                    } else {
                        // Retour rapide à la normale
                        Globals.camera.fov = THREE.MathUtils.lerp(originalFov - 15, originalFov, (p-0.9)/0.1);
                    }
                    Globals.camera.updateProjectionMatrix();

                    // Shake modéré
                    if(p > 0.5) {
                        Globals.scene.position.set(
                            (Math.random()-0.5) * 0.2,
                            (Math.random()-0.5) * 0.2,
                            (Math.random()-0.5) * 0.2
                        );
                    }

                    requestAnimationFrame(ascensionAnim);
                };
                ascensionAnim();

                // 2. EFFET VISUEL PILIER
                const pillarGeo = new THREE.CylinderGeometry(2, 2, 60, 16, 1, true);
                const pillarMat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent:true, opacity:0, side:THREE.DoubleSide, blending: THREE.AdditiveBlending});
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.copy(this.position);
                
                this.addLocalVisual(pillar, 2.0, (m, t, maxT) => {
                    const p = t/maxT;
                    const progress = 1 - p;

                    if(progress < 0.2) m.material.opacity = progress * 4;
                    else m.material.opacity = (1 - progress);
                    
                    // Transition lente Noir / Blanc
                    if(progress > 0.5) {
                         m.material.color.setHex(0x000000); 
                         m.material.blending = THREE.NormalBlending;
                    } else {
                         m.material.color.setHex(0xffffff); 
                         m.material.blending = THREE.AdditiveBlending;
                    }
                    m.scale.setScalar(1 + progress*2);
                });

                this.eclipse.active = false;
                this.eclipse.sun = 0;
                this.eclipse.moon = 0;
            } else {
                createDamageText("CATACLYSME", this.position, '#ffffff');
                this.eclipse.active = false;
                this.eclipse.sun = 0;
                this.eclipse.moon = 0;
            }

            // Dégâts différés
            setTimeout(() => {
                createSkillVisual('shockwave', this.position, 15, 0xffffff);
                PassiveKeystoneHooks.applyVoidPull(this.position, 14);
                const explosion = new THREE.Mesh(new THREE.SphereGeometry(15), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.8}));
                explosion.position.copy(this.position);
                this.addLocalVisual(explosion, 0.6, (m, t) => { 
                    m.scale.setScalar(1 + (0.5-t)); 
                    m.material.opacity = t; 
                    if(Math.floor(t*10)%2 === 0) m.material.color.setHex(0x000000);
                    else m.material.color.setHex(0xffffff);
                });

                Globals.enemies.forEach(e => {
                    if(e.position.distanceTo(this.position) < 15) {
                        const vuln = ConvergenceEffects.getCataclysmVulnMult(e);
                        const baseDmg = ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 3.0 * dmgMultiplier * vuln * (1 + PassiveKeystoneHooks.getCataclysmChargeBonus()), { skill: true, skillKey: 'e' });
                        dealDamageToEnemy(e, baseDmg, { pos: e.position });
                        e.pushBack(this.position, 15);
                        if (applyEffects) {
                            setTimeout(() => { if(!e.dead) { dealDamageToEnemy(e, baseDmg * 0.2, { pos: e.position, noCrit: true }); createDamageText("BRÛLURE", e.position, '#ffa500'); } }, 500);
                            setTimeout(() => { if(!e.dead) { dealDamageToEnemy(e, baseDmg * 0.2, { pos: e.position, noCrit: true }); createDamageText("NÉCROSE", e.position, '#aa00ff'); } }, 1500);
                            e.speed *= 0.2;
                            setTimeout(() => { if(e && !e.dead) e.speed *= 5.0; }, 4000);
                        }
                    }
                });
            }, 1700); 
        }
    }
}