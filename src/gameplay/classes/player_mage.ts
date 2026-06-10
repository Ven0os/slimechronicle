// @ts-nocheck
import { PlayerBase } from '../player_base';
import { CONFIG, STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createSkillVisual, createDamageText, spawnParticles } from '../../visual/effects';
import { Network } from '../../multiplayer/network';
import { Globals, GameActions } from '../../core/globals';
import { ConstellationEngine } from '../../systems/constellationEngine';
import { PassiveKeystoneHooks } from '../../systems/passiveKeystoneHooks';
import { Projectile } from '../entities';

export class Mage extends PlayerBase {
    constructor() {
        super('mage');
        this.createClassModel();
        this.applyClassStats();
        
        // Variables d'état
        this.isHovering = true;
        this.hoverTime = 0;
        this.baseY = 1.0; 
        this.isCasting = false; // Bloque le mouvement (uniquement pour les gros sorts)
        this.originalSpeed = this.speed;
        
        // États d'animation
        this.animState = {
            rightArmOverride: false, // Empêche l'anim de marche de toucher au bras droit
            bodyRotationOverride: 0 // Pour tordre le buste pendant les casts
        };
    }

    createClassModel() {
        // --- PALETTE ARCANE & OR ---
        const robeColor = CONFIG.colors.mage; 
        const deepBlue = 0x050011; 
        const arcaneCyan = 0x00ffff; 
        const mysticGold = 0xffaa00; 
        
        // Matériaux identifiés par 'bodyPart' pour être animés sans faire planter l'UI
        const fabricMat = new THREE.MeshStandardMaterial({ 
            color: robeColor, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide, name: 'bodyPart'
        });
        const darkFabricMat = new THREE.MeshStandardMaterial({ 
            color: deepBlue, roughness: 0.8, name: 'bodyPart'
        });
        const goldMat = new THREE.MeshStandardMaterial({ 
            color: mysticGold, roughness: 0.3, metalness: 0.9, emissive: 0x331100, name: 'bodyPart'
        });
        const runeMat = new THREE.MeshBasicMaterial({ 
            color: arcaneCyan, transparent: true, opacity: 0.8, side: THREE.DoubleSide, name: 'bodyPart'
        });
        const glowingCrystal = new THREE.MeshStandardMaterial({
            color: 0x00ffff, emissive: 0x0088ff, emissiveIntensity: 2.0, roughness: 0.1, metalness: 0.5, name: 'bodyPart'
        });

        this.mesh = new THREE.Group();
        this.mesh.position.y = this.baseY; 
        this.bodyGroup.add(this.mesh);

        // --- CORPS : Robe Grand Archimage ---
        this.bodyMesh = new THREE.Group();
        this.mesh.add(this.bodyMesh);

        // Jupe complexe (3 couches)
        const skirtInner = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 1.2, 12, 1, true), darkFabricMat);
        skirtInner.position.y = -0.4;
        this.bodyMesh.add(skirtInner);
        
        const skirtMainGeo = new THREE.CylinderGeometry(0.28, 0.6, 1.1, 12, 1, true, 0.5, 5.5);
        const skirtMain = new THREE.Mesh(skirtMainGeo, fabricMat);
        skirtMain.position.y = -0.38;
        this.bodyMesh.add(skirtMain);

        const skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 4, 12), goldMat);
        skirtTrim.rotation.x = Math.PI/2;
        skirtTrim.position.y = -0.8;
        skirtTrim.scale.set(1.4, 1.4, 1);
        this.bodyMesh.add(skirtTrim);

        // Torse
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 12), fabricMat);
        torso.position.y = 0.5;
        this.bodyMesh.add(torso);

        const chestPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.3, 6), darkFabricMat);
        chestPlate.position.set(0, 0.65, 0.05);
        this.bodyMesh.add(chestPlate);
        
        const amulet = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glowingCrystal);
        amulet.position.set(0, 0.7, 0.28);
        this.bodyMesh.add(amulet);

        // Epaulières Flottantes
        this.shoulders = new THREE.Group();
        this.bodyMesh.add(this.shoulders);

        const crystalGeo = new THREE.ConeGeometry(0.1, 0.4, 4);
        const sL = new THREE.Mesh(crystalGeo, glowingCrystal);
        sL.position.set(0.45, 0.9, 0); sL.rotation.z = -0.3;
        this.shoulders.add(sL);
        
        const sR = new THREE.Mesh(crystalGeo, glowingCrystal);
        sR.position.set(-0.45, 0.9, 0); sR.rotation.z = 0.3;
        this.shoulders.add(sR);
        
        const sSupL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), goldMat);
        sSupL.position.set(0.35, 0.8, 0); this.shoulders.add(sSupL);
        const sSupR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), goldMat);
        sSupR.position.set(-0.35, 0.8, 0); this.shoulders.add(sSupR);

        // Tête & Capuche Mystique
        this.headGroup = new THREE.Group();
        this.headGroup.position.y = 1.0;
        this.bodyMesh.add(this.headGroup);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), darkFabricMat);
        this.headGroup.add(head);

        const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.1), glowingCrystal);
        eyes.position.set(0, 0.05, 0.18);
        this.headGroup.add(eyes);

        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.4, 8, 1, true, -1, 2), fabricMat);
        collar.rotation.y = Math.PI; collar.position.y = 0.1;
        this.headGroup.add(collar);
        
        this.halo = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.35, 32), runeMat);
        this.halo.position.set(0, 0.5, 0); this.halo.rotation.x = -Math.PI/2;
        this.headGroup.add(this.halo);

        // ARME (Main Droite)
        this.armR = new THREE.Group();
        this.armR.position.set(-0.4, 0.7, 0);
        this.bodyMesh.add(this.armR);

        const armRMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4), fabricMat);
        armRMesh.rotation.z = 0.5; armRMesh.position.y = -0.2;
        this.armR.add(armRMesh);

        this.staffGroup = new THREE.Group();
        this.staffGroup.position.set(-0.15, -0.4, 0.4);
        this.staffGroup.rotation.x = 0.5;
        this.armR.add(this.staffGroup);
        
        const staffPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 2.5), new THREE.MeshStandardMaterial({color:0x333333, name:'bodyPart'}));
        this.staffGroup.add(staffPole);
        
        this.staffHead = new THREE.Group();
        this.staffHead.position.y = 1.3;
        this.staffGroup.add(this.staffHead);
        
        const coreOrb = new THREE.Mesh(new THREE.SphereGeometry(0.1), glowingCrystal);
        this.staffHead.add(coreOrb);
        
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.01, 8, 32), goldMat);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.01, 8, 32), goldMat);
        ring1.rotation.y = 0.5; ring2.rotation.x = 0.5;
        this.staffHead.add(ring1); this.staffHead.add(ring2);
        this.staffRings = [ring1, ring2];

        // MAIN GAUCHE & GRIMOIRE
        this.armL = new THREE.Group();
        this.armL.position.set(0.4, 0.7, 0);
        this.bodyMesh.add(this.armL);
        
        const armLMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4), fabricMat);
        armLMesh.rotation.z = -0.5; armLMesh.position.y = -0.2;
        this.armL.add(armLMesh);
        
        this.bookGroup = new THREE.Group();
        this.bookGroup.position.set(0.5, 0, 0.3);
        this.bodyMesh.add(this.bookGroup);
        
        const bookCover = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.08), new THREE.MeshStandardMaterial({color: 0x4a2c20, name:'bodyPart'}));
        this.bookGroup.add(bookCover);
        const bookPages = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.06), new THREE.MeshStandardMaterial({color: 0xffffee, name:'bodyPart'}));
        bookPages.position.z = 0.02; this.bookGroup.add(bookPages);
        this.bookGroup.rotation.y = -0.5; this.bookGroup.rotation.z = 0.2;

        this.aura = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 32), runeMat);
        this.aura.rotation.x = -Math.PI/2; this.aura.position.y = -1.0;
        this.mesh.add(this.aura);

        // Reset matériaux
        this.mesh.traverse(c => {
            if(c.isMesh && c.material) {
                c.userData.baseColor = c.material.color.getHex();
                if(c.material.emissive) c.userData.baseEmissive = c.material.emissive.getHex();
                if(c.material.emissiveIntensity) c.userData.baseEmissiveIntensity = c.material.emissiveIntensity;
                if(c.material.roughness) c.userData.baseRoughness = c.material.roughness;
                if(c.material.metalness) c.userData.baseMetalness = c.material.metalness;
            }
        });
    }

    animateCharacter(dt) {
        super.animateCharacter(dt);
        const t = Date.now() * 0.001;

        // Lévitation (toujours active)
        this.hoverTime += dt;
        this.mesh.position.y = this.baseY + Math.sin(this.hoverTime * 1.5) * 0.15;
        
        // Inclinaison du corps lors du mouvement (si pas override)
        if (this.animState.bodyRotationOverride === 0) {
            this.bodyMesh.rotation.x = Math.sin(this.hoverTime * 0.5) * 0.05;
            this.bodyMesh.rotation.y = 0; // Reset rotation Y
        } else {
            // Applique l'override
            this.bodyMesh.rotation.y = this.animState.bodyRotationOverride;
        }

        // Animations accessoires
        if(this.halo) this.halo.rotation.z -= dt * 0.5;
        if(this.aura) {
            this.aura.rotation.z += dt * 0.2;
            const s = 1 + Math.sin(t * 2) * 0.05;
            this.aura.scale.set(s,s,s);
            this.aura.material.opacity = 0.5 + Math.sin(t*3)*0.2;
        }
        if(this.staffRings) {
            this.staffRings[0].rotation.x += dt * 1.0;
            this.staffRings[0].rotation.y += dt * 0.5;
            this.staffRings[1].rotation.x -= dt * 1.5;
        }
        if(this.bookGroup) {
            this.bookGroup.position.y = Math.sin(t * 2 + 1) * 0.1;
            this.bookGroup.rotation.z = 0.2 + Math.sin(t) * 0.05;
        }
        if(this.shoulders) {
             this.shoulders.children.forEach(c => {
                 if(c.material && c.material.emissiveIntensity !== undefined) {
                     c.material.emissiveIntensity = 1.5 + Math.sin(t * 5) * 0.5;
                 }
             });
        }
    }

    update(dt) {
        if (this.isCasting) {
             this.speed = 0; // Bloque le mouvement uniquement pendant l'ultime
        } else {
             this.speed = STATE.stats.speed; 
        }
        super.update(dt);
    }

    updateClassPassives(dt) {
        const resourceEl = document.getElementById('class-resource');
        if (resourceEl) {
            const cdr = Math.floor((1.0 - ConstellationEngine.getSkillCdMult('space')) * 100);
            resourceEl.innerHTML = `<div style="color:#3498db; font-weight:bold; text-shadow:0 0 5px #00ffff;">✦ ARCHIMAGE (CDR): ${cdr}%</div>`;
            resourceEl.style.display = 'block';
        }
    }

    // --- AUTO-ATTAQUE FLUIDE (Non bloquante) ---
    performAttack() {
        if(this.isAttacking) return;
        
        this.faceMouse(); 
        this.attackCooldown = this.attackMaxCooldown * (STATE.stats.attackSpeedMod || 1);
        
        this.isAttacking = true; 
        this.animState.rightArmOverride = true;
        
        AudioSys.sfx.mage.cast();

        const duration = 400; // ms
        const startTime = Date.now();
        
        // ANIMATION FLUIDE : Swing diagonal + Torsion buste
        const attackAnim = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= duration) {
                // Fin de l'anim
                this.isAttacking = false;
                this.animState.rightArmOverride = false;
                this.animState.bodyRotationOverride = 0; // Reset buste
                this.armR.rotation.x = 0;
                this.armR.rotation.z = 0;
                this.bodyMesh.rotation.y = 0;
                return;
            }

            const p = elapsed / duration;
            // Phase 1 : Armement (0 -> 0.3)
            // Phase 2 : Lancer (0.3 -> 0.6)
            // Phase 3 : Recovery (0.6 -> 1.0)

            if (p < 0.3) {
                // Recul du bras et du buste
                const prog = p / 0.3;
                this.armR.rotation.x = -0.5 * prog;
                this.armR.rotation.z = 0.2 * prog;
                this.animState.bodyRotationOverride = -0.3 * prog;
            } else if (p < 0.6) {
                // Projection violente vers l'avant
                const prog = (p - 0.3) / 0.3;
                this.armR.rotation.x = -0.5 + (-1.5 * prog); // Va jusqu'à -2.0
                this.armR.rotation.z = 0.2 - (0.5 * prog);
                this.animState.bodyRotationOverride = -0.3 + (0.6 * prog); // Tourne vers l'opposé
            } else {
                // Retour calme
                const prog = (p - 0.6) / 0.4;
                this.armR.rotation.x = THREE.MathUtils.lerp(-2.0, 0, prog);
                this.armR.rotation.z = THREE.MathUtils.lerp(-0.3, 0, prog);
                this.animState.bodyRotationOverride = THREE.MathUtils.lerp(0.3, 0, prog);
            }

            requestAnimationFrame(attackAnim);
        };
        attackAnim();

        // Projectile synchronisé avec le moment "fort" (à 30% de l'anim)
        setTimeout(() => {
            if (!Globals.camera) return;
            STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            STATE.raycaster.ray.intersectPlane(plane, intersection);
            
            const dir = intersection.clone().sub(this.position).normalize();
            dir.y = 0;

            if(STATE.multiplayer.active) {
                Network.send({ type: 'net-action', action: 'attack-range', id: STATE.multiplayer.id, pos: this.position, dir: dir, color: CONFIG.colors.mage, class: 'mage' });
            }

            const projGeo = new THREE.IcosahedronGeometry(0.35, 1); 
            const projMat = new THREE.MeshStandardMaterial({ 
                color: CONFIG.colors.mage, 
                emissive: CONFIG.colors.mage,
                emissiveIntensity: 2
            });
            const startPos = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
            
            const proj = new Projectile(projGeo, projMat, startPos, dir, 0.6, STATE.stats.atk, 'player', CONFIG.colors.mage);
            spawnParticles(startPos, CONFIG.colors.mage, 8);
            Globals.projectiles.push(proj);
        }, duration * 0.3);
    }

    useSkill(key) {
        if(this.cooldowns[key] > 0 || this.isCasting) return;
        this.faceMouse();
        const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);
        this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);
        ConstellationEngine.onSkillUsed(key);

        if(key === 'space') { 
            // --- ARCANE BARRAGE (Balayage Smooth) ---
            AudioSys.sfx.mage.cast(); 
            this.animState.rightArmOverride = true;
            this.animState.bodyRotationOverride = 0; // Reset pour être sûr

            if (!Globals.camera) return;
            STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            STATE.raycaster.ray.intersectPlane(plane, intersection);
            const targetDir = intersection.clone().sub(this.position).normalize();
            targetDir.y = 0;

            const duration = 400;
            const start = Date.now();

            const sweepAnim = () => {
                const elapsed = Date.now() - start;
                if(elapsed >= duration) {
                    this.animState.rightArmOverride = false;
                    this.armR.rotation.x = 0;
                    this.armR.rotation.y = 0;
                    return;
                }
                const p = elapsed / duration;
                
                // Mouvement horizontal large + léger soulevé
                // x: hauteur, y: latéral
                this.armR.rotation.x = -Math.sin(p * Math.PI) * 0.5; // Lève et baisse
                this.armR.rotation.y = THREE.MathUtils.lerp(-1.0, 1.0, p); // Balayage de gauche à droite
                
                requestAnimationFrame(sweepAnim);
            };
            sweepAnim();

            const bonusCritRate = STATE.stats.crit * 3;
            const isSuperCrit = Math.random() < bonusCritRate;
            const skillDmg = STATE.stats.atk * 0.75 * (isSuperCrit ? 1.5 : 1.0); 
            if(isSuperCrit) createDamageText("ARCANE SURGE!", this.position, '#00ffff');

            // Tirs en rafale synchronisés avec le balayage
            const spread = PassiveKeystoneHooks.getArcaneBarrageSpread() * 0.15;
            const extra = PassiveKeystoneHooks.getArcaneBarrageExtraProjectiles();
            const shots = [];
            for (let i = -1; i <= 1; i++) shots.push(i);
            if (extra > 0) shots.push(0);
            for (const i of shots) {
                setTimeout(() => {
                    const d = targetDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), i*spread); 
                    const pGeo = new THREE.DodecahedronGeometry(isSuperCrit ? 0.45 : 0.3); 
                    const pMat = new THREE.MeshStandardMaterial({
                        color: isSuperCrit ? 0xffffff : 0x3498db,
                        emissive: 0x00ffff,
                        emissiveIntensity: 1
                    }); 
                    const p = new Projectile(pGeo, pMat, this.position.clone().add(new THREE.Vector3(0,1.8,0)), d, 0.9, skillDmg, 'player', 0x3498db);
                    Globals.projectiles.push(p);
                    spawnParticles(this.position.clone().add(new THREE.Vector3(0,1.5,0)), 0x00ffff, 3);
                }, (Math.abs(i)+2)*60);
            }

        } else if (key === 'shift') { 
            // --- CHRONOSTASE (Smash Smooth) ---
            AudioSys.sfx.mage.freeze();
            this.isCasting = true; // Bloque
            createDamageText("CHRONOSTASE", this.position, '#00ffff');

            const animDur = 800; 
            const startTime = Date.now();
            const startY = 1.0;
            const originalFov = Globals.camera.fov;

            const smashAnim = () => {
                const elapsed = Date.now() - startTime;
                if(elapsed >= animDur) {
                    this.isCasting = false;
                    this.mesh.position.y = startY;
                    this.armR.rotation.x = 0;
                    Globals.camera.fov = originalFov;
                    Globals.camera.updateProjectionMatrix();
                    this.triggerStasisEffect();
                    return;
                }

                const p = elapsed / animDur;

                // 1. Montée majestueuse
                if (p < 0.5) {
                    const riseP = p / 0.5;
                    this.mesh.position.y = startY + (Math.sin(riseP * Math.PI/2) * 2.0); // Monte à 2m
                    this.armR.rotation.x = -2.5 * riseP; // Lève le bâton très haut
                } 
                // 2. Chute Violente (Impact)
                else {
                    const fallP = (p - 0.5) / 0.5; // 0 -> 1
                    // Easing "InBack" pour donner de la lourdeur
                    this.mesh.position.y = THREE.MathUtils.lerp(startY + 2.0, startY, fallP * fallP); 
                    this.armR.rotation.x = THREE.MathUtils.lerp(-2.5, 0.5, fallP); // Frappe le sol
                }

                // Zoom Caméra
                if (p > 0.8) {
                    Globals.camera.fov = THREE.MathUtils.lerp(originalFov, originalFov - 5, (p-0.8)/0.2);
                }
                Globals.camera.updateProjectionMatrix();

                requestAnimationFrame(smashAnim);
            };
            smashAnim();

        } else if (key === 'e') { 
            // --- TRANSFERT (Blink Fluide) ---
            AudioSys.sfx.mage.teleport();
            const oldPos = this.position.clone();
            
            // Animation : Disparition (Scale down) -> TP -> Réapparition (Scale up)
            // On ne bloque pas le mouvement mais on anime le mesh
            const blinkDur = 300;
            const startBlink = Date.now();
            
            // Clone visuel au départ
            const cloneGeo = new THREE.CylinderGeometry(0.3, 0.6, 1.4, 12);
            const clone = new THREE.Mesh(cloneGeo, new THREE.MeshBasicMaterial({color:0x3498db, wireframe:true, transparent:true, opacity:0.5}));
            clone.position.copy(oldPos).add(new THREE.Vector3(0,0.8,0));
            this.addLocalVisual(clone, 0.5, (m, t) => { 
                m.material.opacity = 0.5 - (t/0.5)*0.5; 
                m.scale.multiplyScalar(1.05);
            });
            createSkillVisual('explosion', oldPos, 3, 0x3498db); 

            // Téléportation logique immédiate (gameplay)
            if (Globals.camera) {
                STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const intersection = new THREE.Vector3();
                STATE.raycaster.ray.intersectPlane(plane, intersection);
                const blinkDir = intersection.clone().sub(this.position).normalize();
                this.position.add(blinkDir.multiplyScalar(8)); 
            }

            // Animation sur le mesh (Scale 0 -> 1)
            const appearAnim = () => {
                const elapsed = Date.now() - startBlink;
                if(elapsed >= blinkDur) {
                    this.bodyMesh.scale.set(1,1,1);
                    return;
                }
                const p = elapsed / blinkDur;
                // Effet élastique de réapparition
                const s = p < 0.5 ? p * 2 : 1.0 + Math.sin(p * Math.PI * 4) * 0.1; 
                this.bodyMesh.scale.set(s, s, s);
                requestAnimationFrame(appearAnim);
            };
            this.bodyMesh.scale.set(0,0,0); // Disparaît
            appearAnim();
            
            // Dégâts au point de départ
            const blink = PassiveKeystoneHooks.getBlinkMasteryMods();
            let killed = false;
            Globals.enemies.forEach(e => { 
                if(e.position.distanceTo(oldPos) <= blink.radius) {
                    const dmg = ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 2.5 * blink.dmgMult, { skill: true, skillKey: 'e' });
                    const hpBefore = e.hp;
                    e.takeDamage(dmg);
                    if (e.dead || (hpBefore > 0 && e.hp <= 0)) killed = true;
                    this.heal(dmg * blink.healRatio); 
                    createDamageText("SIPHON", e.position, '#00ff00');
                }
            });
            if (killed) PassiveKeystoneHooks.onBlinkExplosionKill(this);
        }
    }

    triggerStasisEffect() {
        const stasis = PassiveKeystoneHooks.getDeepStasisMods();
        createSkillVisual('shockwave', this.position, stasis.radius, 0x00ffff); 
        
        const rune = new THREE.Mesh(new THREE.RingGeometry(stasis.radius - 1, stasis.radius, 32), new THREE.MeshBasicMaterial({color:0x00ffff, side:THREE.DoubleSide, transparent:true, opacity:0.8}));
        const innerRune = new THREE.Mesh(new THREE.CircleGeometry(stasis.radius, 32), new THREE.MeshBasicMaterial({color:0x00ffff, transparent:true, opacity:0.05}));
        rune.rotation.x = -Math.PI/2; innerRune.rotation.x = -Math.PI/2;
        const pos = this.position.clone().add(new THREE.Vector3(0, 0.05, 0));
        rune.position.copy(pos); innerRune.position.copy(pos);
        
        this.addLocalVisual(rune, 3.0, (m, t, maxT) => {
            m.rotation.z += 0.02;
            const scale = 1 - (t/maxT);
            m.scale.setScalar(1 + Math.sin(t*10)*0.02);
            if(t > maxT - 0.5) m.material.opacity = (maxT-t)*2;
        }); 
        this.addLocalVisual(innerRune, 3.0, (m) => {});
        
        Globals.enemies.forEach(e => {
            if(e.position.distanceTo(this.position) <= stasis.radius) {
                if (e._stasisOrigSpeed == null) e._stasisOrigSpeed = e.speed;
                e.speed = e._stasisOrigSpeed * stasis.slowFactor;
                e.takeDamage(ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 1.8, { skill: true, skillKey: 'shift' })); 
                spawnParticles(e.position, 0x00ffff, 15); 
                setTimeout(() => { if(e && !e.dead) { e.speed = e._stasisOrigSpeed ?? e.speed; e._stasisOrigSpeed = null; } }, stasis.duration); 
            }
        });
    }
}