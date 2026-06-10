// @ts-nocheck
import { BaseEnemy } from '../enemies/base_enemy';
import { Globals, addEnemy } from '../../core/globals';
import { STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual } from '../../visual/effects';
import { SlimeLord } from '../enemies/boss/slime_lord';

export class VoidAltar extends BaseEnemy {
    constructor(position, id = null) {
        super('void_altar', position, id);

        // Stats
        const ng = STATE.bossProgress['slime_lord'] || 0;
        this.hp = 250 + (STATE.level * 150) + (ng * 300); 
        this.maxHp = this.hp;
        this.speed = 0; 
        this.isBoss = false; 
        this.pushable = false; 
        this.radius = 2.6;

        // Variables
        this.time = 0;
        this.shakeTime = 0;
        this.isSummoning = false;
        
        this.visuals = null;
        this.labelSprite = null;

        // Init
        this.buildModel();
        
        const ngText = ng > 0 ? `NG+${ng}` : "";
        this.labelSprite = this.createLabel(`${ngText}`);
        this.add(this.labelSprite);
        
        this.visible = true;
        if(Globals.scene) Globals.scene.add(this);
    }

    createLabel(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1024; canvas.height = 256;
        
        ctx.font = 'Bold 70px "Courier New"'; 
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        ctx.lineWidth = 6; ctx.strokeStyle = 'black';
        ctx.shadowColor = "#9400d3"; ctx.shadowBlur = 25;
        ctx.strokeText(text, canvas.width/2, canvas.height/2);
        
        ctx.fillStyle = '#e0b0ff'; // Mauve clair
        ctx.fillText(text, canvas.width/2, canvas.height/2);
        
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(canvas), 
            transparent: true, 
            depthTest: false 
        }));
        sprite.scale.set(10, 2.5, 1);
        sprite.position.set(0, 6.5, 0); 
        return sprite;
    }

    buildModel() {
        if (this.visuals) { this.remove(this.visuals); this.visuals = null; }

        this.visuals = new THREE.Group();
        this.visuals.scale.setScalar(1.3);
        
        // --- MATÉRIAUX ---
        const matObsidian = new THREE.MeshStandardMaterial({ 
            color: 0x050505, roughness: 0.2, metalness: 0.9 
        });
        const matVoidEnergy = new THREE.MeshBasicMaterial({ 
            color: 0x4b0082, transparent: true, opacity: 0.9 
        });
        const matNeon = new THREE.MeshBasicMaterial({ 
            color: 0x9400d3 
        });

        // 1. Socle du Vide (Géométrie fracturée)
        const baseGeo = new THREE.CylinderGeometry(2.2, 1.8, 0.5, 6);
        const base = new THREE.Mesh(baseGeo, matObsidian);
        base.position.y = 0.25;
        this.visuals.add(base);

        // 2. Piliers Flottants (Obélisques inversés)
        this.pillars = [];
        for(let i=0; i<4; i++) {
            const group = new THREE.Group();
            const angle = (i / 4) * Math.PI * 2;
            const r = 1.8;
            group.position.set(Math.cos(angle)*r, 2.0, Math.sin(angle)*r);
            group.lookAt(0, 3, 0); // Regarde vers le haut du centre

            const pGeo = new THREE.ConeGeometry(0.3, 2.5, 4);
            const p = new THREE.Mesh(pGeo, matObsidian);
            p.rotation.x = Math.PI; // Pointe vers le bas
            group.add(p);
            
            // Rune brillante sur le pilier
            const rune = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), matNeon);
            rune.position.z = 0.2;
            group.add(rune);

            this.visuals.add(group);
            this.pillars.push(group);
        }

        // 3. Cœur de Singularité (Sphère noire + Aura)
        this.coreGroup = new THREE.Group();
        this.coreGroup.position.y = 3.5;
        this.visuals.add(this.coreGroup);

        const blackHole = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        this.coreGroup.add(blackHole);
        this.core = blackHole;

        const aura = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), matVoidEnergy);
        this.coreGroup.add(aura);
        this.aura = aura;

        // 4. Anneaux Gyroscopiques
        this.rings = [];
        const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 8, 64), matNeon);
        this.coreGroup.add(r1); this.rings.push(r1);
        
        const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.03, 8, 64), matNeon);
        r2.rotation.x = Math.PI/2;
        this.coreGroup.add(r2); this.rings.push(r2);

        // 5. Lumière
        this.light = new THREE.PointLight(0x9400d3, 4, 15);
        this.light.position.y = 4.0;
        this.visuals.add(this.light);

        this.add(this.visuals);
    }

    update(dt) {
        super.update(dt);
        this.time += dt;
        
        if (this.visuals && !this.dead) {
            // Animation Flottante
            const hover = Math.sin(this.time * 1.5) * 0.2;
            this.coreGroup.position.y = 3.5 + hover;
            
            // Rotation des Anneaux (Complexe)
            const speed = this.isSummoning ? 10.0 : 1.0;
            this.rings[0].rotation.x += dt * speed;
            this.rings[0].rotation.y += dt * speed * 0.5;
            this.rings[1].rotation.y -= dt * speed;
            
            // Pulsation Aura
            const scale = 1.0 + Math.sin(this.time * 3) * 0.1;
            this.aura.scale.setScalar(scale);
            this.aura.rotation.z -= dt;

            // Piliers qui orbitent légèrement
            this.pillars.forEach((p, i) => {
                p.position.y = 2.0 + Math.sin(this.time + i) * 0.3;
            });

            // Shake et Label
            if (this.shakeTime > 0) {
                this.shakeTime -= dt;
                this.visuals.position.x = (Math.random()-0.5) * 0.2;
                this.visuals.position.z = (Math.random()-0.5) * 0.2;
            } else {
                this.visuals.position.set(0, 0, 0);
            }
            if(this.labelSprite) this.labelSprite.position.y = 6.5 + hover;
        }
    }

    takeDamage(amount) {
        if(this.dead || this.isSummoning) return;
        super.takeDamage(amount);
        
        this.shakeTime = 0.4;
        if(AudioSys.play) AudioSys.play('hit', 0.8, 1.5);
        spawnParticles(this.position.clone().add(new THREE.Vector3(0, 3, 0)), 0x9400d3, 10);
        
        // Changement de couleur critique
        if (this.hp / this.maxHp < 0.4) {
            this.light.color.setHex(0xff0000);
            this.rings.forEach(r => r.material.color.setHex(0xff0000));
        }
    }

    pushBack() { return; }
    applyStun() { return; }

    die() {
        if (this.dead || this.isSummoning) return;
        this.isSummoning = true;
        if(this.labelSprite) this.labelSprite.visible = false;

        createDamageText("LE NÉANT S'ÉVEILLE...", this.position.clone().add(new THREE.Vector3(0,5,0)), '#9400d3', 4.0);
        if(AudioSys.play) AudioSys.play('boss_spawn', 1.0); 

        // Animation d'Implosion
        let animTimer = 0;
        const duration = 4.0;

        const interval = setInterval(() => {
            animTimer += 0.05;
            const t = animTimer / duration;

            // Le cœur grossit de façon instable
            this.coreGroup.scale.setScalar(1 + t * 2 + Math.random()*0.2);
            
            // Les piliers sont aspirés vers le centre
            this.pillars.forEach(p => {
                p.lookAt(this.coreGroup.position);
                p.position.lerp(this.coreGroup.position, 0.01);
                p.scale.multiplyScalar(0.98);
            });

            // Particules d'aspiration (noires)
            if (Math.random() < 0.5) {
                const angle = Math.random() * Math.PI * 2;
                const r = 5.0;
                const p = this.position.clone().add(new THREE.Vector3(Math.cos(angle)*r, 3, Math.sin(angle)*r));
                spawnParticles(p, 0x000000, 1);
            }

            if (animTimer > duration) {
                clearInterval(interval);
                this.finalizeSummon();
            }
        }, 50);
    }

    finalizeSummon() {
        // Implosion finale (Flash noir)
        createSkillVisual('explosion', this.position, 25.0, 0x000000); 
        setTimeout(() => createSkillVisual('explosion', this.position, 20.0, 0x8a2be2), 300);
        
        spawnParticles(this.position, 0x4b0082, 250);
        if(AudioSys.play) AudioSys.play('boss_roar', 1.5); 

        STATE.isBossFight = true;

        // Knockback Aspiration/Expulsion
        if (Globals.player) {
            const dist = Globals.player.position.distanceTo(this.position);
            if (dist < 35) {
                const dir = Globals.player.position.clone().sub(this.position).normalize();
                dir.y = 0.2;
                
                // Repousse
                const pushInt = setInterval(() => {
                    if(!Globals.player) { clearInterval(pushInt); return; }
                    Globals.player.position.add(dir.clone().multiplyScalar(1.8));
                    if(Globals.player.position.y > 0.5) Globals.player.position.y = 0;
                }, 16);
                setTimeout(() => clearInterval(pushInt), 600);
                
                createDamageText("ONDE DE CHOC !", Globals.player.position.clone().add(new THREE.Vector3(0,3,0)), '#da70d6', 2.0);
            }
        }

        // Spawn Boss
        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            const boss = new SlimeLord(this.position.clone());
            addEnemy(boss);
            STATE.bossSpawned = true;
        }

        this.dead = true;
        Globals.scene.remove(this);
    }
}