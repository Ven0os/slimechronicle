// @ts-nocheck
import { BaseEnemy } from '../base_enemy';
import { Globals, addEnemy, GameActions } from '../../../core/globals';
import { STATE } from '../../../core/config';
import { AudioSys } from '../../../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual, createTelegraph } from '../../../visual/effects';
import { Network } from '../../../multiplayer/network';
import { damagePlayer, getAllLivingPlayers, damagePlayersInBeam } from '../../../multiplayer/net_combat';
import { buildSlimeLordModel } from './slime_lord_model';
import { SlimeLordAnimator } from './slime_lord_animations';

export class SlimeLord extends BaseEnemy {
    constructor(position, id = null) {
        super('slime_lord', position, id);

        const baseHp = 3500; 
        const ng = (STATE.bossProgress && STATE.bossProgress['slime_lord']) || 0;
        
        this.hp = baseHp * Math.pow(1.15, STATE.level - 1) * (1 + ng * 0.4);
        this.maxHp = this.hp;

        this.speed = 2.0; 
        this.isBoss = true;
        this.bossPhase = 1;
        this.actionTimer = 1.5;
        this.radius = 2.5;
        this.scaleVal = 2.5;

        this.parts = {};
        this.materials = {};
        this.activeOrbs = [];
        
        this.animState = 'idle';
        this.animator = null;
        this.isAttacking = false;
        this.isCinematic = false; // Pour l'invulnérabilité
        this.teleportCooldown = 0;

        this.buildModel();
        this.setupHealthBar();
    }

    buildModel() {
        if (this.mesh) this.remove(this.mesh);
        const modelData = buildSlimeLordModel(this.scaleVal);
        this.mesh = modelData.mesh;
        this.parts = modelData.parts;
        this.materials = modelData.materials;
        this.add(this.mesh);
        Globals.scene.add(this);
        this.animator = new SlimeLordAnimator(this);
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
            bossHud.innerHTML = `
                <div id="boss-name" style="color:#ffd700; font-family:'Cinzel', serif; font-size:24px; text-shadow:0 0 10px #000; margin-bottom:5px; font-weight:bold;">ROI SLIME</div>
                <div style="width:100%; height:24px; background:#330000; border:2px solid #ffd700; border-radius:4px; overflow:hidden; box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);">
                    <div id="boss-hp-fill" style="width:100%; height:100%; background:linear-gradient(90deg, #ff0000, #ff8800); transition: width 0.2s;"></div>
                </div>
            `;
        } 

        const nameEl = document.getElementById('boss-name');
        const bar = document.getElementById('boss-hp-fill');
        
        if (nameEl) {
            nameEl.innerText = "SEIGNEUR DU VIDE";
            nameEl.style.color = "#9400d3"; 
            nameEl.style.textShadow = "0 0 10px #4b0082";
        }
        if (bar) {
            bar.style.background = 'linear-gradient(90deg, #4b0082, #9400d3)';
        }
        bossHud.style.display = 'flex';
    }

    update(dt) {
        super.update(dt);
        if (this.dead) return;

        const bar = document.getElementById('boss-hp-fill');
        if (bar) {
            const pct = Math.max(0, Math.min(100, (this.hp / this.maxHp) * 100));
            bar.style.width = pct + '%';
        }

        if (this.animator) this.animator.update(dt);
        this.handleProjectiles(dt);

        // Si en cinématique (Transition de phase), on skip l'IA et on joue des effets
        if (this.isCinematic) {
            this.updateCinematicEffects(dt);
            return; 
        }

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            if (this.isAttacking) return;
            this.updateAI(dt);
        }
    }

    updateCinematicEffects(dt) {
        // Effets visuels pendant l'invulnérabilité
        if (Math.random() < 0.3) {
            const offset = new THREE.Vector3((Math.random()-0.5)*3, (Math.random()-0.5)*3 + 2, (Math.random()-0.5)*3);
            spawnParticles(this.position.clone().add(offset), 0x9400d3, 1);
        }
        // Tremblement de caméra léger si le joueur est proche
        if (Globals.player && Globals.player.position.distanceTo(this.position) < 20) {
            // Globals.camera.position.y += (Math.random()-0.5) * 0.1; // (Optionnel si on veut du shake)
        }
    }

    updateAI(dt) {
        const target = this.getClosestTarget();
        if (!target) return;

        this.actionTimer -= dt;
        this.teleportCooldown -= dt;

        const targetPos = target.position.clone();
        targetPos.y = this.position.y;
        this.lookAt(targetPos);

        const dist = this.position.distanceTo(target.position);
        if (dist < 10 && !this.isAttacking) {
            const dir = this.position.clone().sub(target.position).normalize();
            this.position.add(dir.multiplyScalar(this.speed * dt));
        } else if (dist > 25) {
            const dir = target.position.clone().sub(this.position).normalize();
            this.position.add(dir.multiplyScalar(this.speed * dt));
        }

        if (this.actionTimer <= 0) {
            this.decideAttack(target, dist);
            this.actionTimer = 2.0 - (this.bossPhase * 0.3);
        }
    }

    decideAttack(target, dist) {
        const rand = Math.random();

        if (this.bossPhase === 3 && rand < 0.25) {
            this.attackBlackHole(target);
            return;
        }

        if (dist < 8 && this.teleportCooldown <= 0) {
            this.teleportAway(target);
            return;
        }

        if (rand < 0.4) this.attackVoidOrbs(target);
        else if (rand < 0.7) this.attackLaserSweep(target);
        else this.attackGravityWell(target);
    }

    // --- ATTAQUES ---

    teleportAway(target) {
        this.isAttacking = true;
        this.animState = 'channeling';
        createDamageText("DISPERSION", this.position, '#9400d3');
        spawnParticles(this.position, 0x9400d3, 30);
        if(AudioSys.play) AudioSys.play('boss_teleport', 1.0); 

        setTimeout(() => {
            // Le boss se repositionnait même vaincu pendant la dispersion.
            if (this.dead) return;

            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 10;
            const newPos = target.position.clone().add(new THREE.Vector3(Math.cos(angle)*dist, 0, Math.sin(angle)*dist));
            newPos.x = Math.max(-40, Math.min(40, newPos.x));
            newPos.z = Math.max(-40, Math.min(40, newPos.z));

            this.position.copy(newPos);
            spawnParticles(this.position, 0x9400d3, 30);
            
            this.isAttacking = false;
            this.animState = 'idle';
            this.teleportCooldown = 8.0;
        }, 800);
    }

    attackVoidOrbs(target) {
        this.isAttacking = true;
        this.animState = 'thrust';
        
        const dir = target.position.clone().sub(this.position).normalize();
        this.spawnTelegraph(this.position.clone().add(dir.multiplyScalar(10)), 'rect', 20, 1.0, 0x4b0082, () => {
            for(let i=-1; i<=1; i++) {
                const spreadDir = dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), i * 0.2);
                this.spawnOrb(this.position.clone().add(new THREE.Vector3(0, 2, 0)), spreadDir);
            }
            if(AudioSys.play) AudioSys.play('spell_cast', 1.0);
            this.isAttacking = false;
            this.animState = 'idle';
        }, 0, dir);
    }

    attackGravityWell(target) {
        this.isAttacking = true;
        this.animState = 'channeling';
        createDamageText("GRAVITÉ !", this.position, '#000000');

        const impactPos = target.position.clone();
        
        this.spawnTelegraph(impactPos, 'circle', 8.0, 1.5, 0x000000, () => {
            createSkillVisual('explosion', impactPos, 8.0, 0x4b0082); 
            getAllLivingPlayers().forEach((t) => {
                if (t.position.distanceTo(impactPos) < 8.0) {
                    const pull = impactPos.clone().sub(t.position).normalize().multiplyScalar(15);
                    damagePlayer(t, 40, { knockback: pull });
                }
            });
            this.isAttacking = false;
            this.animState = 'idle';
        });
    }

    attackLaserSweep(target) {
        this.isAttacking = true;
        this.animState = 'spin_attack';
        createDamageText("NÉANT...", this.position, '#ff00ff');

        const duration = 3.0;
        let elapsed = 0;
        
        const laserGeo = new THREE.CylinderGeometry(0.2, 0.2, 40, 8);
        laserGeo.rotateX(-Math.PI / 2); 
        laserGeo.translate(0, 0, 20); 
        const laserMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8 });
        const laser = new THREE.Mesh(laserGeo, laserMat);
        laser.position.y = 1.5;
        this.mesh.add(laser);

        const sweepInt = setInterval(() => {
            if(this.dead) {
                clearInterval(sweepInt);
                this.mesh.remove(laser);
                laserGeo.dispose();
                laserMat.dispose();
                return;
            }
            elapsed += 0.05;
            
            laser.rotation.y -= 0.15; 

            const angle = laser.rotation.y; 
            const laserDir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).applyQuaternion(this.quaternion);
            
            getAllLivingPlayers().forEach((t) => {
                const toPlayer = t.position.clone().sub(this.position).normalize();
                const angleDiff = laserDir.angleTo(toPlayer);
                if (angleDiff < 0.2 && t.position.distanceTo(this.position) < 40) {
                    damagePlayer(t, 2);
                }
            });

            if(elapsed >= duration) {
                clearInterval(sweepInt);
                this.mesh.remove(laser);
                laserGeo.dispose();
                laserMat.dispose();
                this.isAttacking = false;
                this.animState = 'idle';
            }
        }, 50);
    }

    attackBlackHole(target) {
        this.isAttacking = true;
        this.animState = 'channeling';
        createDamageText("SINGULARITÉ !", this.position, '#ffffff', 3.0);
        
        const center = new THREE.Vector3(0,0,0);
        
        this.spawnTelegraph(center, 'circle', 20.0, 3.0, 0x000000, () => {
            createSkillVisual('explosion', center, 20.0, 0x000000);
            getAllLivingPlayers().forEach((t) => {
                if (t.position.distanceTo(center) < 20.0) {
                    const kb = t.position.clone().normalize().multiplyScalar(30);
                    damagePlayer(t, 100, { knockback: kb });
                }
            });
            this.isAttacking = false;
            this.animState = 'idle';
        });
    }

    spawnOrb(pos, dir) {
        // Géométrie/matériau partagés entre tous les orbes (mêmes visuels, zéro fuite).
        if (!SlimeLord._orbGeo) {
            SlimeLord._orbGeo = new THREE.SphereGeometry(0.5);
            SlimeLord._orbMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x9400d3, emissiveIntensity: 2.0 });
        }
        const orb = new THREE.Mesh(SlimeLord._orbGeo, SlimeLord._orbMat);
        orb.position.copy(pos);
        orb.userData = { velocity: dir.multiplyScalar(15), life: 3.0 }; 
        Globals.scene.add(orb);
        this.activeOrbs.push(orb);
    }

    handleProjectiles(dt) {
        for(let i = this.activeOrbs.length - 1; i >= 0; i--) {
            const o = this.activeOrbs[i];
            o.position.add(o.userData.velocity.clone().multiplyScalar(dt));
            o.userData.life -= dt;
            
            let orbHit = false;
            getAllLivingPlayers().forEach((t) => {
                if (t.position.distanceTo(o.position) < 1.5) {
                    damagePlayer(t, 25);
                    orbHit = true;
                }
            });
            if (orbHit) {
                createSkillVisual('explosion', o.position, 2.0, 0x9400d3);
                Globals.scene.remove(o);
                this.activeOrbs.splice(i, 1);
                continue;
            }

            if(o.userData.life <= 0) {
                Globals.scene.remove(o);
                this.activeOrbs.splice(i, 1);
            }
        }
    }

    spawnTelegraph(pos, shape, size, duration, color, onComplete, rotY = 0) {
        createTelegraph(pos, shape, size, duration, color, onComplete, rotY);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'telegraph-spawn', pos, shape, size, duration, color, rotationY: rotY });
        }
    }

    takeDamage(amount) {
        if (this.isCinematic) {
            createDamageText("INVULNÉRABLE", this.position, '#888888');
            return;
        }

        this.hp -= amount;
        createDamageText(Math.floor(amount), this.position, '#aa00ff');
        
        // --- GESTION DES PHASES ÉPIQUES ---
        const pct = this.hp / this.maxHp;
        
        // Transition vers Phase 2 (60% HP)
        if (this.bossPhase === 1 && pct < 0.6) {
            this.triggerPhaseChange(2, "LE VIDE S'ÉTEND...", 0x4b0082);
        }
        // Transition vers Phase 3 (30% HP)
        else if (this.bossPhase === 2 && pct < 0.3) {
            this.triggerPhaseChange(3, "HORIZON DES ÉVÉNEMENTS", 0xff0000);
        }

        if (this.hp <= 0 && !this.dead) this.die();
        
        // CORRECTION FLASH : On vérifie si emissive existe avant de l'utiliser
        if (this.mesh) {
            this.mesh.traverse(c => {
                if (c.isMesh && c.material && c.material.emissive) {
                    // Sauvegarde la couleur originale si pas déjà fait
                    if (!c.userData.baseEmissive) {
                        c.userData.baseEmissive = c.material.emissive ? c.material.emissive.getHex() : 0x000000;
                    }
                    c.material.emissive.setHex(0xffffff); // Flash blanc
                    
                    // Reset rapide
                    setTimeout(() => {
                        if (c && c.material && c.material.emissive) {
                            c.material.emissive.setHex(c.userData.baseEmissive);
                        }
                    }, 50);
                }
            });
        }
    }

    // Nouvelle méthode pour gérer la transition épique
    triggerPhaseChange(newPhase, text, colorHex) {
        this.bossPhase = newPhase;
        this.isCinematic = true; // Rend invulnérable
        this.animState = 'phase_transition'; // Déclenche l'animation d'ascension
        
        createDamageText(text, this.position, '#ffffff', 3.0);
        createSkillVisual('shockwave', this.position, 15.0, colorHex);
        if(AudioSys.play) AudioSys.play('boss_roar', 1.5);

        // Explose les orbes actifs pour nettoyer l'écran
        this.activeOrbs.forEach(o => {
            createSkillVisual('explosion', o.position, 2.0, 0x9400d3);
            Globals.scene.remove(o);
        });
        this.activeOrbs = [];

        // Durée de la phase épique (3 secondes)
        setTimeout(() => {
            if (this.dead) return; // le boss peut mourir pendant la transition
            this.isCinematic = false;
            this.animState = 'idle';
            
            // Repousse le joueur à la fin de la transition
            createSkillVisual('explosion', this.position, 20.0, colorHex);
            getAllLivingPlayers().forEach((t) => {
                if (t.position.distanceTo(this.position) < 20) {
                    const dir = t.position.clone().sub(this.position).normalize();
                    damagePlayer(t, 10, { knockback: dir.multiplyScalar(20) });
                }
            });

            // Changement visuel permanent pour la phase
            if (newPhase === 3 && this.materials.neonViolet) {
                this.materials.neonViolet.color.setHex(0xff0000); 
                this.materials.neonViolet.emissive.setHex(0xff0000);
            }

        }, 3000);
    }

    die() {
        super.die();
        this.activeOrbs.forEach(o => Globals.scene.remove(o));
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.style.display = 'none';
        
        if (!STATE.bossProgress['slime_lord']) STATE.bossProgress['slime_lord'] = 0;
        STATE.bossProgress['slime_lord']++; 
    }
}