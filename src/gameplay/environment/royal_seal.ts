// @ts-nocheck
import { BaseEnemy } from '../enemies/base_enemy';
import { Globals, addEnemy } from '../../core/globals';
import { STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual } from '../../visual/effects';
import { KingSlime } from '../enemies/boss/king_slime';

export class RoyalSeal extends BaseEnemy {
    constructor(position, id = null) {
        super('royal_seal', position, id);

        // SÉCURITÉ 1 : On force la position ici
        if (position) this.position.copy(position);

        // SÉCURITÉ 2 : Init bossProgress si manquant
        if (!STATE.bossProgress) STATE.bossProgress = {};
        
        // Récupération du NG+
        const ng = STATE.bossProgress['king'] || 0;

        // Stats
        this.hp = 250 + (STATE.level * 200) + (ng * 500); 
        this.maxHp = this.hp;
        this.speed = 0; 
        this.isBoss = false; 
        this.pushable = false; 
        this.radius = 1.8;

        // Variables d'animation
        this.time = 0;
        this.shakeTime = 0;
        this.isSummoning = false;

        // On renomme la propriété pour éviter les conflits avec BaseEnemy.mesh
        this.visuals = null;
        this.labelSprite = null;

        // Construction du visuel
        this.buildModel();
        
        // SÉCURITÉ 3 : Force la visibilité globale
        this.visible = true;
        if(Globals.scene) Globals.scene.add(this);
    }

    createLabel(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        // Haute résolution pour éviter le flou
        canvas.width = 1024;
        canvas.height = 256;
        
        context.font = 'Bold 80px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Contour noir épais pour lisibilité
        context.lineWidth = 8;
        context.strokeStyle = 'black';
        context.shadowColor = "black";
        context.shadowBlur = 15;
        context.strokeText(text, canvas.width / 2, canvas.height / 2);
        
        // Texte Doré
        context.fillStyle = '#ffd700';
        context.shadowBlur = 0;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }); // depthTest false pour voir à travers les murs si besoin
        const sprite = new THREE.Sprite(material);
        
        // Échelle du sprite dans le monde 3D
        sprite.scale.set(10, 2.5, 1);
        sprite.position.set(0, 5.5, 0); // Positionné bien au-dessus du modèle
        
        return sprite;
    }

    buildModel() {
        // Nettoyage radical
        if (this.visuals) {
            this.remove(this.visuals);
            this.visuals = null;
        }
        if (this.labelSprite) {
            this.remove(this.labelSprite);
            this.labelSprite = null;
        }

        // Création du groupe visuel
        this.visuals = new THREE.Group();
        this.visuals.scale.setScalar(1.5);
        this.visuals.position.y = -0.2; // Correction hauteur visuelle

        // --- MATÉRIAUX ---
        const matGold = new THREE.MeshStandardMaterial({ 
            color: 0xffd700, roughness: 0.2, metalness: 1.0, emissive: 0xaa6600, emissiveIntensity: 0.2 
        });
        const matStone = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a2a, roughness: 0.8 
        });
        const matCrystal = new THREE.MeshPhysicalMaterial({ 
            color: 0x00ffff, transmission: 0.9, opacity: 0.8, transparent: true, roughness: 0.1, metalness: 0.1, 
            emissive: 0x00ffff, emissiveIntensity: 0.5 
        });
        const matRune = new THREE.MeshBasicMaterial({
            color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.6
        });
        
        // Matériau émissif (lave) pour les fissures
        const matCrack = new THREE.MeshStandardMaterial({ 
            color: 0x000000, 
            emissive: 0xff4400, // Orange feu
            emissiveIntensity: 2.0 
        });

        // 1. Piédestal
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 8), matStone);
        base.position.y = 0.2;
        base.castShadow = true;
        this.visuals.add(base);

        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.8, 8), matStone);
        pillar.position.y = 0.8;
        pillar.castShadow = true;
        this.visuals.add(pillar);

        // --- Groupe de Fissures ---
        this.cracksGroup = new THREE.Group();
        this.visuals.add(this.cracksGroup);
        this.cracksGroup.visible = false; 

        for(let i=0; i<8; i++) {
            const crackGeo = new THREE.BoxGeometry(0.6 + Math.random()*0.4, 0.05, 0.02);
            const crack = new THREE.Mesh(crackGeo, matCrack);
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.05; 
            const height = 0.4 + Math.random() * 0.8;

            crack.position.set(Math.cos(angle)*radius, height, Math.sin(angle)*radius);
            crack.lookAt(0, height, 0); 
            crack.rotation.z = (Math.random() - 0.5) * 2;
            this.cracksGroup.add(crack);
        }

        // 2. Cercle Runique
        this.runeRing = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.2, 32), matRune);
        this.runeRing.rotation.x = -Math.PI / 2;
        this.runeRing.position.y = 0.05;
        this.visuals.add(this.runeRing);

        // 3. Coussin
        const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x8b0000 }));
        cushion.position.y = 1.3;
        this.visuals.add(cushion);

        // 4. Groupe Couronne
        this.crownGroup = new THREE.Group();
        this.crownGroup.position.y = 2.2;
        this.visuals.add(this.crownGroup);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 32), matGold);
        ring.rotation.x = Math.PI / 2;
        this.crownGroup.add(ring);

        for(let i=0; i<8; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 4), matGold);
            const angle = (i / 8) * Math.PI * 2;
            spike.position.set(Math.cos(angle)*0.5, 0.3, Math.sin(angle)*0.5);
            spike.rotation.x = 0.2; 
            spike.rotation.y = -angle;
            this.crownGroup.add(spike);
        }

        // 5. Cristal
        this.crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), matCrystal);
        this.crystal.position.y = 2.2;
        this.visuals.add(this.crystal);

        // 6. Lumière
        this.light = new THREE.PointLight(0xffaa00, 2, 10);
        this.light.position.y = 3.0;
        this.visuals.add(this.light);

        // SÉCURITÉ 4 : On attache le groupe visuel à l'entité principale
        this.add(this.visuals);

        // SÉCURITÉ 5 : Désactivation Frustum Culling
        this.visuals.traverse((child) => {
            child.frustumCulled = false;
        });

        // --- LABEL NG+ (Sprite Permanent) ---
        const ng = STATE.bossProgress['king'] || 0;
        const ngText = ng > 0 ? `NG+${ng}` : "";
        this.labelSprite = this.createLabel(`${ngText}`);
        this.add(this.labelSprite);
    }

    update(dt) {
        super.update(dt);
        this.time += dt;
        
        if (this.visuals && !this.dead) {
            // Animation standard...
            const rotSpeed = this.isSummoning ? 10.0 : 0.5;
            this.crownGroup.rotation.y += dt * rotSpeed;
            
            if (!this.isSummoning) {
                const floatY = Math.sin(this.time * 1.5) * 0.15;
                this.crownGroup.position.y = 2.2 + floatY;
                this.crystal.position.y = 2.2 + floatY; 
                this.crystal.rotation.x = this.time;
                this.crystal.rotation.z = this.time * 0.8;
                
                // Petit mouvement flottant du label aussi
                if(this.labelSprite) this.labelSprite.position.y = 5.5 + floatY * 0.5;
            } else {
                this.crystal.rotation.x += dt * 15;
                this.crystal.rotation.z += dt * 15;
            }

            this.runeRing.rotation.z = -this.time * 0.2;
            
            this.light.intensity = this.isSummoning ? 
                10 + Math.random() * 5 : 
                2 + Math.sin(this.time * 3) * 0.5;

            if (this.shakeTime > 0 || this.isSummoning) {
                if(this.shakeTime > 0) this.shakeTime -= dt;
                const shakeIntensity = this.isSummoning ? 0.2 : 0.15;
                this.visuals.position.x = (Math.random()-0.5) * shakeIntensity;
                this.visuals.position.z = (Math.random()-0.5) * shakeIntensity;
            } else {
                this.visuals.position.x = 0;
                this.visuals.position.z = 0;
                this.visuals.position.y = -0.2;
            }
        }
    }

    takeDamage(amount) {
        if(this.dead || this.isSummoning) return;
        super.takeDamage(amount);
        
        this.shakeTime = 0.3; 
        if(AudioSys.play) AudioSys.play('hit', 0.7, 0.5); 
        spawnParticles(this.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xffd700, 8);
        
        const hpPct = this.hp / this.maxHp;

        if (hpPct < 0.75) {
            this.cracksGroup.visible = true;
            const crackScale = 1.5 - hpPct; 
            this.cracksGroup.scale.setScalar(crackScale);
        }

        if (hpPct < 0.5) {
            this.crystal.material.color.setHex(0xff0000);
            this.crystal.material.emissive.setHex(0xff0000);
            this.light.color.setHex(0xff4400);
        }
    }

    pushBack() { return; }
    applyStun() { return; }

    die() {
        if (this.dead || this.isSummoning) return;
        this.isSummoning = true; 
        
        // On cache le label permanent pour laisser place au texte "SE BRISE"
        if(this.labelSprite) this.labelSprite.visible = false;

        createDamageText("LE SCEAU SE BRISE...", this.position.clone().add(new THREE.Vector3(0,5,0)), '#ff0000', 4.0);
        if(AudioSys.play) AudioSys.play('boss_spawn', 1.0); 

        let animTimer = 0;
        const duration = 5.0; 

        const interval = setInterval(() => {
            animTimer += 0.05; 
            const progress = animTimer / duration; 

            this.crownGroup.position.y += 0.05 + (progress * 0.05); 
            this.crystal.position.y = this.crownGroup.position.y;
            
            this.light.distance = 10 + (progress * 20); 
            this.light.intensity = 10 + (progress * 40); 
            
            spawnParticles(this.crownGroup.position.clone(), 0xffd700, 3);
            
            if(Math.random() < progress) {
                spawnParticles(this.position.clone().add(new THREE.Vector3((Math.random()-0.5)*4, 0.5, (Math.random()-0.5)*4)), 0xffff00, 1);
            }

            if (animTimer > duration) {
                clearInterval(interval);
                this.finalizeSummon();
            }
        }, 50);
    }

    finalizeSummon() {
        createSkillVisual('explosion', this.position, 20.0, 0xffd700); 
        spawnParticles(this.position, 0xffaa00, 200);
        if(AudioSys.play) AudioSys.play('boss_roar', 1.5);
        
        STATE.isBossFight = true;

        if (Globals.player) {
            const dist = Globals.player.position.distanceTo(this.position);
            const knockbackRadius = 30; 
            
            if (dist < knockbackRadius) {
                const pushDir = new THREE.Vector3()
                    .subVectors(Globals.player.position, this.position)
                    .normalize();
                
                pushDir.y = 0; 
                pushDir.normalize();

                let pushForce = 3.5; 
                const friction = 0.92; 
                
                const pushInterval = setInterval(() => {
                    if (!Globals.player || pushForce < 0.1) {
                        clearInterval(pushInterval);
                        return;
                    }
                    Globals.player.position.add(pushDir.clone().multiplyScalar(pushForce));
                    if (Globals.player.position.y > 0.5) Globals.player.position.y = 0;
                    pushForce *= friction;
                }, 16); 
            }
        }

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            const ng = STATE.bossProgress['king'] || 0;
            const boss = new KingSlime(this.position.clone());
            
            if (ng > 0) {
                const buffMult = 1 + (ng * 0.4); 
                boss.maxHp *= buffMult;
                boss.hp = boss.maxHp;
                if(boss.damage) boss.damage *= buffMult;
                boss.mesh.scale.multiplyScalar(1 + (ng * 0.1));
                if(boss.mesh.children[0] && boss.mesh.children[0].material) {
                    boss.mesh.children[0].material.emissive.setHex(0xff0000);
                }
            }
            
            addEnemy(boss);
            STATE.bossSpawned = true; 
        }

        this.dead = true;
        Globals.scene.remove(this);
    }
}