// @ts-nocheck
import * as THREE from 'three';
import { BaseEnemy } from '../enemies/base_enemy';
import { Globals, addEnemy, removeEnemy } from '../../core/globals';
import { STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual } from '../../visual/effects';
import { KingSlime } from '../enemies/boss/king_slime';
import { buildKingSlimeModel } from '../enemies/boss/king_slime_model';
import { BOSS_ZONE } from '../world/worldZones';
import { Network } from '../../multiplayer/network';

// --- HELPERS POUR LES DECALS DE RITUEL SUR LE SOL (FONT AWESOME) ---

function createClueDecal(romanNumeral, symbol, colorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    function draw() {
        ctx.clearRect(0, 0, 256, 256);
        
        // PAS DE CERCLE ET PAS DE GLOW - TEXTE PLAT POUR SUBTILITÉ
        // Chiffre Romain (en haut)
        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(romanNumeral, 128, 70);
        
        // Icône Font Awesome (en bas)
        ctx.font = '900 90px "Font Awesome 6 Free"';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(symbol, 128, 165);
    }
    
    draw();
    
    const texture = new THREE.CanvasTexture(canvas);
    
    if (document.fonts && typeof document.fonts.ready === 'object') {
        document.fonts.ready.then(() => {
            draw();
            texture.needsUpdate = true;
        });
    }

    // Opacité faible (0.07) pour que les indices s'intègrent discrètement au sol de l'arène
    const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true, 
        side: THREE.DoubleSide, 
        depthWrite: false,
        opacity: 0.07
    });
    
    const geo = new THREE.PlaneGeometry(3.0, 3.0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.05;
    return mesh;
}

// --- GÉNÉRATION DÉTERMINISTE DE LA SÉQUENCE ---

function getDeterministicSequence(seedVal) {
    const symbols = [
        { symbol: '\uf06d', color: '#ff4500', index: 0, name: 'Fire' },   // Nord
        { symbol: '\uf043', color: '#00bfff', index: 1, name: 'Water' },  // Est
        { symbol: '\uf0e7', color: '#ffd700', index: 2, name: 'Bolt' },   // Sud
        { symbol: '\uf06c', color: '#32cd32', index: 3, name: 'Leaf' }    // Ouest
    ];
    
    let seed = seedVal;
    function random() {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }
    
    const result = [...symbols];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const temp = result[i];
        result[i] = result[j];
        result[j] = temp;
    }
    return result;
}

// --- CLASSE PILIER DE RITUEL ---

export class BossPillar extends BaseEnemy {
    constructor(symbolInfo, position, master) {
        super('boss_pillar', position);
        this.symbolInfo = symbolInfo;
        this.master = master;
        
        this.hp = 9999999;
        this.maxHp = this.hp;
        this.speed = 0;
        this.isBoss = false;
        this.pushable = false;
        this.radius = 1.6;
        this.activated = false;
        this.visible = true;

        this.buildModel();

        if (Globals.scene) Globals.scene.add(this);
    }

    buildModel() {
        this.pillarGroup = new THREE.Group();
        this.add(this.pillarGroup);

        const matStone = new THREE.MeshStandardMaterial({ 
            color: 0xc4a47a, // Même grès que le trône
            roughness: 0.95, 
            metalness: 0.1,
            flatShading: true
        });
        
        // Socle
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), matStone);
        base.position.y = 0.2;
        base.castShadow = true;
        base.receiveShadow = true;
        this.pillarGroup.add(base);

        // Obélisque principal (3 blocs empilés cassés)
        const blockHeights = [1.2, 1.2, 1.0];
        let currentY = 0.4;
        
        for (let j = 0; j < 3; j++) {
            const h = blockHeights[j];
            const w = 1.0 - j * 0.1;
            const blockGeo = new THREE.BoxGeometry(w, h, w);
            const block = new THREE.Mesh(blockGeo, matStone);
            
            block.position.y = currentY + h / 2;
            
            if (j > 0) {
                block.position.x = (Math.random() - 0.5) * 0.08;
                block.position.z = (Math.random() - 0.5) * 0.08;
                block.rotation.y = (Math.random() - 0.5) * 0.12;
                block.rotation.z = (Math.random() - 0.5) * 0.04;
                block.rotation.x = (Math.random() - 0.5) * 0.04;
            }
            
            block.castShadow = true;
            block.receiveShadow = true;
            this.pillarGroup.add(block);
            
            currentY += h;
        }

        // Gravats au pied
        for (let k = 0; k < 2; k++) {
            const debrisGeo = new THREE.BoxGeometry(0.3 + Math.random() * 0.2, 0.2 + Math.random() * 0.1, 0.3 + Math.random() * 0.2);
            const debris = new THREE.Mesh(debrisGeo, matStone);
            const angle = Math.random() * Math.PI * 2;
            const dist = 0.9 + Math.random() * 0.2;
            debris.position.set(Math.cos(angle) * dist, 0.1, Math.sin(angle) * dist);
            debris.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
            debris.castShadow = true;
            this.pillarGroup.add(debris);
        }

        // Rune gravée sur le pilier (Font Awesome)
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 128;
        faceCanvas.height = 128;
        const faceCtx = faceCanvas.getContext('2d');
        
        const drawFace = () => {
            faceCtx.clearRect(0, 0, 128, 128);
            faceCtx.font = '900 70px "Font Awesome 6 Free"';
            faceCtx.textAlign = 'center';
            faceCtx.textBaseline = 'middle';
            faceCtx.fillStyle = '#ffffff';
            faceCtx.fillText(this.symbolInfo.symbol, 64, 64);
        };
        
        drawFace();
        
        const faceTex = new THREE.CanvasTexture(faceCanvas);
        
        if (document.fonts && typeof document.fonts.ready === 'object') {
            document.fonts.ready.then(() => {
                drawFace();
                faceTex.needsUpdate = true;
            });
        }
        
        this.runeMaterial = new THREE.MeshBasicMaterial({ 
            map: faceTex, 
            transparent: true, 
            side: THREE.DoubleSide,
            color: 0x555555 // Gris de base
        });
        
        const faceDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), this.runeMaterial);
        faceDecal.position.set(0, 2.0, 0.52);
        this.pillarGroup.add(faceDecal);

        this.pointLight = new THREE.PointLight(0xffffff, 0.0, 8);
        this.pointLight.position.y = 2.0;
        this.pillarGroup.add(this.pointLight);
    }

    activate() {
        if (this.activated || this.master.isSummoning) return;
        
        if (STATE.multiplayer.active) {
            if (STATE.multiplayer.isHost) {
                this.master.onPillarActivated(this);
            } else {
                Network.send({ type: 'request-pillar-activate', symbolIndex: this.symbolInfo.index });
            }
        } else {
            this.master.onPillarActivated(this);
        }
    }

    setGlow(active) {
        this.activated = active;
        if (active) {
            this.runeMaterial.color.setHex(0xffffff); // Devient blanc
            this.pointLight.intensity = 2.5;
            spawnParticles(this.position.clone().add(new THREE.Vector3(0, 2.0, 0)), 0xffffff, 20);
        } else {
            this.runeMaterial.color.setHex(0x555555);
            this.pointLight.intensity = 0.0;
        }
    }

    takeDamage(amount, source) {
        this.activate();
    }

    pushBack() { return; }
    applyStun() { return; }

    onDestroy() {
    }
}

// --- COORDINATEUR GLOBAL ET LE ROI AFFALÉ ---

export class RoyalSeal extends BaseEnemy {
    constructor(position, id = null) {
        super('royal_seal', position, id);

        if (position) this.position.copy(position);

        if (!STATE.bossProgress) STATE.bossProgress = {};
        const ng = STATE.bossProgress['king'] || 0;

        // Stats du sceau invisible
        this.hp = 9999999;
        this.maxHp = this.hp;
        this.speed = 0; 
        this.isBoss = false; 
        this.pushable = false; 
        this.radius = 0.0; 

        // Variables de rituel
        this.correctSequence = getDeterministicSequence(123 + STATE.level + ng * 17);
        this.currentStep = 0;
        this.isSummoning = false;
        this.cinematicTimer = 0.0;
        this.hasRoared = false;
        this.hasSlammed = false;

        this.bossGroup = null;
        this.bossParts = null;
        this.bossMaterials = null;
        this.clueDecals = [];
        
        // Construction du modèle
        this.buildModel();
        
        // Piliers
        this.pillars = [];
        this.spawnPillars();

        this.visible = true;
        if(Globals.scene) Globals.scene.add(this);
    }

    buildModel() {
        // Positionnement du Trône par rapport au centre de la zone de boss
        const tx = Math.cos(5 * Math.PI / 4) * (BOSS_ZONE.radius - 3.5);
        const tz = Math.sin(5 * Math.PI / 4) * (BOSS_ZONE.radius - 3.5);
        this.relativeOffset = new THREE.Vector3(BOSS_ZONE.cx + tx, 0, BOSS_ZONE.cz + tz).sub(this.position);
        
        // La rotation du trône (face à l'entrée)
        this.throneRotation = 5 * Math.PI / 4 + Math.PI - Math.PI / 2;
        // Correction de rotation : le boss fait face à +Z, donc il doit être tourné à throneRotation + Math.PI / 2 pour faire face à la même direction que le trône
        const bossRotY = this.throneRotation + Math.PI / 2;

        // 1. Modèle d'Aethelgard
        const modelData = buildKingSlimeModel(3.2, true);
        this.bossGroup = modelData.mesh;
        this.bossParts = modelData.parts;
        this.bossMaterials = modelData.materials;

        // Positionné dans le siège du trône - Y abaissé à -1.6 pour reposer à plat sur le siège
        this.bossGroup.position.copy(this.relativeOffset);
        this.bossGroup.position.y = -1.6;
        this.bossGroup.rotation.y = bossRotY;

        // Pose "Assis sur le trône - reposé"
        this.bossParts.head.rotation.x = 0.8;
        this.bossParts.head.rotation.y = 0.1;
        this.bossParts.head.rotation.z = 0.15;
        
        this.bossParts.body.rotation.x = -0.35;
        this.bossParts.body.rotation.y = -0.05;
        
        // Bras droit dans le vide, relâché vers le bas et prêt à prendre l'épée au sol
        this.bossParts.armR.rotation.x = 0.8;
        this.bossParts.armR.rotation.y = -0.2;
        this.bossParts.armR.rotation.z = 0.3;
        
        // Bras gauche posé de façon détendue sur l'unique accoudoir (gauche)
        this.bossParts.armL.rotation.x = -0.4;
        this.bossParts.armL.rotation.y = 0.2;
        this.bossParts.armL.rotation.z = -0.8;
        
        // Jambes pliées aux hanches et pliées aux genoux (shins)
        this.bossParts.legL.rotation.x = -1.4;
        this.bossParts.legL.rotation.y = 0.1;
        if (this.bossParts.shinL) this.bossParts.shinL.rotation.x = 1.4;
        
        this.bossParts.legR.rotation.x = -1.4;
        this.bossParts.legR.rotation.y = -0.1;
        if (this.bossParts.shinR) this.bossParts.shinR.rotation.x = 1.4;

        // Épée posée au sol à droite du trône (calculée localement par rapport à la rotation)
        const fwd = new THREE.Vector3(Math.sin(bossRotY), 0, Math.cos(bossRotY)).normalize();
        const right = new THREE.Vector3(Math.cos(bossRotY), 0, -Math.sin(bossRotY)).normalize();
        
        const swordPos = this.relativeOffset.clone()
            .addScaledVector(right, 1.8) // 1.8 unités vers sa droite (là où l'accoudoir est cassé)
            .addScaledVector(fwd, 0.4);   // 0.4 unités vers l'avant
        swordPos.y = 0.15;

        this.swordGroup = this.bossParts.swordInfo;
        this.swordGroup.position.copy(swordPos);
        this.swordGroup.rotation.set(0.15, bossRotY + 0.1, Math.PI / 2); // Couchée sur le flanc, alignée sur le boss
        this.swordGroup.scale.setScalar(3.2); // Mise à l'échelle du boss (3.2) pour qu'elle soit bien visible au sol
        this.add(this.swordGroup);
        this.swordPickedUp = false;

        // --- MATÉRIAUX ASSOMBRI POUR LE SOMMEIL AFK ---
        if (this.bossMaterials.amber) {
            this.bossMaterials.amber.color.setHex(0x332211);
            this.bossMaterials.amber.emissive.setHex(0x000000);
            this.bossMaterials.amber.emissiveIntensity = 0.0;
        }
        if (this.bossMaterials.gold) {
            this.bossMaterials.gold.color.setHex(0x554433);
            this.bossMaterials.gold.emissive.setHex(0x000000);
            this.bossMaterials.gold.emissiveIntensity = 0.0;
        }
        if (this.bossMaterials.clothRed) {
            this.bossMaterials.clothRed.color.setHex(0x221111);
        }
        if (this.bossMaterials.energy) {
            this.bossMaterials.energy.emissiveIntensity = 0.0;
            this.bossMaterials.energy.color.setHex(0x112211);
            this.bossMaterials.energy.emissive.setHex(0x000000);
        }

        this.add(this.bossGroup);

        // 2. Incrustation des 4 indices séparés à des endroits différents de l'arène
        const cluePositions = [
            new THREE.Vector3(BOSS_ZONE.cx + 15, 0.05, BOSS_ZONE.cz - 9),
            new THREE.Vector3(BOSS_ZONE.cx + 9, 0.05, BOSS_ZONE.cz + 15),
            new THREE.Vector3(BOSS_ZONE.cx - 15, 0.05, BOSS_ZONE.cz + 9),
            new THREE.Vector3(BOSS_ZONE.cx - 9, 0.05, BOSS_ZONE.cz - 15)
        ];

        const romanNumerals = ['I', 'II', 'III', 'IV'];

        for (let i = 0; i < 4; i++) {
            const stepInfo = this.correctSequence[i];
            const decal = createClueDecal(romanNumerals[i], stepInfo.symbol, stepInfo.color);
            decal.position.copy(cluePositions[i]);
            Globals.scene.add(decal);
            this.clueDecals.push(decal);
        }
    }

    spawnPillars() {
        const pillarSymbols = [
            { symbol: '\uf06d', color: '#ff4500', index: 0, name: 'Fire' },   // Nord
            { symbol: '\uf043', color: '#00bfff', index: 1, name: 'Water' },  // Est
            { symbol: '\uf0e7', color: '#ffd700', index: 2, name: 'Bolt' },   // Sud
            { symbol: '\uf06c', color: '#32cd32', index: 3, name: 'Leaf' }    // Ouest
        ];

        const cx = BOSS_ZONE.cx;
        const cz = BOSS_ZONE.cz;
        const radius = 11.0;

        const positions = [
            new THREE.Vector3(cx, 0, cz - radius),         // Nord
            new THREE.Vector3(cx + radius, 0, cz),         // Est
            new THREE.Vector3(cx, 0, cz + radius),         // Sud
            new THREE.Vector3(cx - radius, 0, cz)          // Ouest
        ];

        for (let i = 0; i < 4; i++) {
            const pillar = new BossPillar(pillarSymbols[i], positions[i], this);
            this.pillars.push(pillar);
            addEnemy(pillar);
        }
    }

    onPillarActivated(pillar) {
        const expectedSymbol = this.correctSequence[this.currentStep].symbol;
        
        if (pillar.symbolInfo.symbol === expectedSymbol) {
            pillar.setGlow(true);
            if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
                Network.send({ type: 'pillar-glow', symbolIndex: pillar.symbolInfo.index, glow: true });
            }
            if (AudioSys.play) AudioSys.play('magic_cast', 0.85);
            this.currentStep++;

            if (this.currentStep === 4) {
                if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
                    this.startSummoningCinematic();
                    if (STATE.multiplayer.active) {
                        Network.send({ type: 'start-boss-cinematic' });
                    }
                }
            }
        } else {
            this.currentStep = 0;
            for (let p of this.pillars) {
                p.setGlow(false);
            }
            if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
                Network.send({ type: 'pillar-glow-reset' });
            }
            if (AudioSys.play) AudioSys.play('ui_error', 0.85);
            
            spawnParticles(new THREE.Vector3(BOSS_ZONE.cx, 0.5, BOSS_ZONE.cz), 0xff0000, 35);
            
            if (Globals.player) {
                createDamageText("ORDRE INCORRECT - RÉINITIALISATION", Globals.player.position.clone().add(new THREE.Vector3(0, 3, 0)), '#ff3333', 2.0);
            }
        }
    }

    startSummoningCinematic() {
        if (this.isSummoning) return;
        this.isSummoning = true;
        this.cinematicTimer = 0.0;
        STATE.cinematicActive = true;
        
        for (let decal of this.clueDecals) {
            decal.visible = false;
        }
        if (this.labelSprite) this.labelSprite.visible = false;

        createDamageText("AETHELGARD S'ÉVEILLE...", new THREE.Vector3(BOSS_ZONE.cx, 5, BOSS_ZONE.cz), '#ffaa00', 4.0);
    }

    update(dt) {
        super.update(dt);
        
        if (this.isSummoning) {
            this.cinematicTimer += dt;
            this.updateCinematic(this.cinematicTimer);
        }
    }

    updateCinematic(t) {
        const duration = 7.0;
        if (t >= duration) {
            this.finalizeSummon();
            return;
        }

        const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
        const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
        const easeInOutQuad = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

        const tx = Math.cos(5 * Math.PI / 4) * (BOSS_ZONE.radius - 3.5);
        const tz = Math.sin(5 * Math.PI / 4) * (BOSS_ZONE.radius - 3.5);
        const thronePos = new THREE.Vector3(BOSS_ZONE.cx + tx, 0, BOSS_ZONE.cz + tz);
        
        if (!Globals.cameraOverride) {
            Globals.cameraOverride = {
                position: new THREE.Vector3(),
                lookAt: new THREE.Vector3()
            };
            this.startCamPos = Globals.camera.position.clone();
            this.startCamLookAt = Globals.player ? Globals.player.position.clone() : new THREE.Vector3(BOSS_ZONE.cx, 0, BOSS_ZONE.cz);
            this.currentLookAt = this.startCamLookAt.clone();
        }

        const targetCamPos = new THREE.Vector3(BOSS_ZONE.cx - 3, 5, BOSS_ZONE.cz - 3);
        const targetLookAt = new THREE.Vector3(BOSS_ZONE.cx + tx, 2.3, BOSS_ZONE.cz + tz);

        // Correction de rotation : le boss fait face à +Z, donc il doit être tourné à throneRotation + Math.PI / 2
        const bossRotY = this.throneRotation + Math.PI / 2;

        // Ondulations passives et respiration pour le rendre vivant
        const breathe = Math.sin(t * 2.5) * 0.025;
        const microSway = Math.cos(t * 1.5) * 0.015;

        // --- Phase 1 : Zoom caméra et grondement (0.0s - 2.0s) ---
        if (t < 2.0) {
            const pct = t / 2.0;
            const easedPct = easeInOutCubic(pct);
            Globals.cameraOverride.position.lerpVectors(this.startCamPos, targetCamPos, easedPct);
            this.currentLookAt.lerpVectors(this.startCamLookAt, targetLookAt, easedPct);
            Globals.cameraOverride.lookAt.copy(this.currentLookAt);

            const pulse = Math.sin(t * 6) * 0.15;
            if (this.bossMaterials.energy) {
                this.bossMaterials.energy.emissiveIntensity = pulse > 0 ? pulse * 0.2 : 0;
            }
            
            // Le boss est assis de face
            this.bossGroup.rotation.y = bossRotY;
            
            // Micro-mouvements de respiration de sommeil
            this.bossParts.body.rotation.x = -0.35 + breathe;
            this.bossParts.head.rotation.x = 0.8 + breathe * 0.5;
            this.bossParts.head.rotation.y = 0.1 + microSway;
            
            if (this.bossParts.capeSegments) {
                this.bossParts.capeSegments.forEach((seg, idx) => {
                    seg.rotation.x = 0.15 + Math.sin(t * 2.0 - idx * 0.3) * 0.03;
                });
            }
        }
        // --- Phase 2 : Allumage yeux, rugissement et tremblement (2.0s - 4.5s) ---
        else if (t < 4.5) {
            const pct = (t - 2.0) / 2.5;
            const easedPct = easeInOutCubic(pct);
            
            Globals.cameraOverride.position.copy(targetCamPos);
            Globals.cameraOverride.lookAt.copy(targetLookAt);

            // Waking up energy lueur: transition douce de sombre AFK à active Phase 1
            if (this.bossMaterials.energy) {
                this.bossMaterials.energy.color.lerpColors(new THREE.Color(0x112211), new THREE.Color(0x5e3c1a), easedPct);
                this.bossMaterials.energy.emissive.lerpColors(new THREE.Color(0x000000), new THREE.Color(0x2d1705), easedPct);
                this.bossMaterials.energy.emissiveIntensity = THREE.MathUtils.lerp(0.0, 0.3, easedPct);
            }
            if (this.bossMaterials.amber) {
                this.bossMaterials.amber.color.lerpColors(new THREE.Color(0x332211), new THREE.Color(0x6e4e2b), easedPct);
                this.bossMaterials.amber.emissive.lerpColors(new THREE.Color(0x000000), new THREE.Color(0x2b1c0a), easedPct);
                this.bossMaterials.amber.emissiveIntensity = THREE.MathUtils.lerp(0.0, 0.2, easedPct);
            }
            if (this.bossMaterials.gold) {
                this.bossMaterials.gold.color.lerpColors(new THREE.Color(0x554433), new THREE.Color(0x7a6348), easedPct);
                this.bossMaterials.gold.emissive.lerpColors(new THREE.Color(0x000000), new THREE.Color(0x1a0f00), easedPct);
                this.bossMaterials.gold.emissiveIntensity = THREE.MathUtils.lerp(0.0, 0.05, easedPct);
            }
            if (this.bossMaterials.clothRed) {
                this.bossMaterials.clothRed.color.lerpColors(new THREE.Color(0x221111), new THREE.Color(0x3d2323), easedPct);
            }

            if (!this.hasRoared) {
                if (AudioSys.play) AudioSys.play('boss_roar', 1.8);
                this.hasRoared = true;
            }

            // Tremblement de caméra et micro-shudders du boss dus au réveil d'énergie
            const shake = 0.08 * (1.0 - pct);
            Globals.cameraOverride.position.x += (Math.random() - 0.5) * shake;
            Globals.cameraOverride.position.y += (Math.random() - 0.5) * shake;
            Globals.cameraOverride.position.z += (Math.random() - 0.5) * shake;

            const tremor = Math.sin(t * 40) * 0.012 * (1.0 - pct);

            // Il redresse sa tête et son corps tout en restant assis de façon organique
            this.bossParts.head.rotation.x = THREE.MathUtils.lerp(0.8, 0.0, easedPct) + tremor;
            this.bossParts.head.rotation.y = THREE.MathUtils.lerp(0.1, 0.0, easedPct);
            this.bossParts.head.rotation.z = THREE.MathUtils.lerp(0.15, 0.0, easedPct) + tremor * 0.5;
            
            // Le torse respire lourdement pendant le rugissement
            const roarBreath = Math.sin(t * 8.0) * 0.03 * pct;
            this.bossParts.body.rotation.x = THREE.MathUtils.lerp(-0.35, 0.0, easedPct) + roarBreath;
            this.bossParts.body.rotation.y = -0.05 + microSway;

            if (this.bossParts.capeSegments) {
                this.bossParts.capeSegments.forEach((seg, idx) => {
                    seg.rotation.x = 0.2 + Math.sin(t * 5.0 - idx * 0.4) * 0.08;
                });
            }
            
            // Reste de face assis
            this.bossGroup.rotation.y = bossRotY;
        }
        // --- Phase 3 : Debout du trône, rotation vers l'avant, levée d'épée et onde de choc (4.5s - 7.0s) ---
        else {
            const pct = (t - 4.5) / 2.5;
            Globals.cameraOverride.position.copy(targetCamPos);
            Globals.cameraOverride.lookAt.copy(targetLookAt);

            const fwd = new THREE.Vector3(Math.sin(bossRotY), 0, Math.cos(bossRotY)).normalize();

            // Animer le bras droit pour aller chercher l'épée au sol
            if (pct < 0.36) { // De t = 4.5s à 5.4s (Prise de l'épée au sol)
                const armPct = pct / 0.36;
                const easedArmPct = easeInOutCubic(armPct);
                
                // Reste assis
                this.bossGroup.position.copy(this.relativeOffset);
                this.bossGroup.position.y = -1.6;

                // Le bras descend vers la poignée avec une courbe organique et un léger tremblement d'approche
                const reachTremor = Math.sin(t * 30) * 0.008 * (1.0 - armPct);
                this.bossParts.armR.rotation.x = THREE.MathUtils.lerp(0.8, 1.2, easedArmPct) + reachTremor;
                this.bossParts.armR.rotation.y = THREE.MathUtils.lerp(-0.2, 0.0, easedArmPct);
                this.bossParts.armR.rotation.z = THREE.MathUtils.lerp(0.3, 0.6, easedArmPct) + reachTremor * 0.5;

                // Les jambes et l'autre bras restent dans la pose assise avec de légères vibrations de tension
                const tension = Math.sin(t * 15) * 0.005;
                this.bossParts.legL.rotation.x = -1.4 + tension;
                this.bossParts.legR.rotation.x = -1.4 - tension;
                if (this.bossParts.shinL) this.bossParts.shinL.rotation.x = 1.4;
                if (this.bossParts.shinR) this.bossParts.shinR.rotation.x = 1.4;
                
                this.bossParts.armL.rotation.x = -0.4 + tension;
                this.bossParts.armL.rotation.y = 0.2;
                this.bossParts.armL.rotation.z = -0.8;
                
                this.bossParts.body.rotation.x = tension;
            } else { // Après t = 5.4s (Se lève avec l'épée et avance)
                const liftPct = (pct - 0.36) / (1 - 0.36);
                const easedLiftPct = easeInOutQuad(liftPct);
                
                // Se lève et avance de façon dynamique (léger saut de force)
                const jumpForce = Math.sin(liftPct * Math.PI) * 0.15;
                this.bossGroup.position.copy(this.relativeOffset).addScaledVector(fwd, easedLiftPct * 2.2);
                this.bossGroup.position.y = THREE.MathUtils.lerp(-1.6, 0.0, easedLiftPct) + jumpForce;

                // Jambes se redressent de façon organique (le torse bascule d'abord en avant)
                this.bossParts.legL.rotation.x = THREE.MathUtils.lerp(-1.4, 0.0, easedLiftPct);
                this.bossParts.legR.rotation.x = THREE.MathUtils.lerp(-1.4, 0.0, easedLiftPct);
                if (this.bossParts.shinL) this.bossParts.shinL.rotation.x = THREE.MathUtils.lerp(1.4, 0.0, easedLiftPct);
                if (this.bossParts.shinR) this.bossParts.shinR.rotation.x = THREE.MathUtils.lerp(1.4, 0.0, easedLiftPct);

                // Transfert de poids : le torse penche en avant puis se redresse fièrement
                const weightShift = Math.sin(liftPct * Math.PI) * 0.16;
                this.bossParts.body.rotation.x = THREE.MathUtils.lerp(0.0, -0.08, easedLiftPct) + weightShift;
                this.bossParts.body.rotation.y = Math.sin(liftPct * Math.PI) * 0.08;

                // Le bras gauche balance en contrepoids naturel
                this.bossParts.armL.rotation.x = THREE.MathUtils.lerp(-0.4, 0.1, easedLiftPct);
                this.bossParts.armL.rotation.y = THREE.MathUtils.lerp(0.2, 0.0, easedLiftPct);
                this.bossParts.armL.rotation.z = THREE.MathUtils.lerp(-0.8, -0.2, easedLiftPct);

                if (!this.swordPickedUp) {
                    this.bossParts.armR.children[2].add(this.swordGroup);
                    this.swordGroup.position.set(0, -0.22, 0.05); // Collée à la main (entre les griffes)
                    this.swordGroup.rotation.set(Math.PI / 2, 0, 0);
                    this.swordGroup.scale.setScalar(1.0); // Reset scale to 1.0 (matching hand parent scale)
                    this.swordPickedUp = true;
                    if (AudioSys.play) AudioSys.play('magic_cast', 1.0); // Son de ramassage magique
                }

                // Il lève le bras très haut avec l'épée vers le ciel, l'épée vibre
                const swordVibrate = Math.sin(t * 50) * 0.01 * (1.0 - liftPct);
                this.bossParts.armR.rotation.x = THREE.MathUtils.lerp(1.2, Math.PI / 1.2, easeInOutCubic(liftPct)) + swordVibrate;
                this.bossParts.armR.rotation.y = THREE.MathUtils.lerp(0.0, 0.0, liftPct);
                this.bossParts.armR.rotation.z = THREE.MathUtils.lerp(0.6, -0.3, easeInOutCubic(liftPct)) + swordVibrate;

                // La cape s'envole en arrière avec l'onde de choc
                if (this.bossParts.capeSegments) {
                    this.bossParts.capeSegments.forEach((seg, idx) => {
                        seg.rotation.x = THREE.MathUtils.lerp(0.2, 0.7 + Math.sin(t * 8.0 - idx * 0.4) * 0.12, liftPct);
                    });
                }
            }

            if (!this.hasSlammed) {
                if (AudioSys.play) {
                    AudioSys.play('boss_spawn', 1.0);
                    AudioSys.play('earth_smash', 1.5);
                }
                const feetPos = thronePos.clone().addScaledVector(fwd, 1.0);
                createSkillVisual('shockwave', feetPos, 16.0, 0xffaa00); // Shockwave ambre/orange
                spawnParticles(feetPos, 0xffaa00, 150);
                this.hasSlammed = true;
            }
        }
    }

    finalizeSummon() {
        // Nettoyage de la caméra cinématique
        Globals.cameraOverride = null;
        STATE.cinematicActive = false;

        const spawnPos = new THREE.Vector3();
        this.bossGroup.getWorldPosition(spawnPos);
        spawnPos.y = 0.0; 

        createSkillVisual('explosion', spawnPos, 22.0, 0xffd700); 
        spawnParticles(spawnPos, 0xffaa00, 200);
        if(AudioSys.play) AudioSys.play('boss_roar', 1.5);
        
        STATE.isBossFight = true;

        // PAS DE KNOCKBACK DU JOUEUR ICI.

        // Spawn de l'entité active de combat (uniquement par l'hôte)
        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            const ng = STATE.bossProgress['king'] || 0;
            const boss = new KingSlime(spawnPos);
            
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
            
            // Assigner l'orientation finale sur le GROUP global boss.rotation.y (pas boss.mesh.rotation.y !)
            boss.rotation.y = this.throneRotation + Math.PI / 2;
            
            addEnemy(boss);
            STATE.bossSpawned = true; 

            if (STATE.multiplayer.active) {
                Network.send({ type: 'boss-spawn', bossType: 'king' });
            }
        }

        // Spawner la barrière d'arène
        spawnBossArenaBarrier();

        // Nettoyage des Piliers
        for (let p of this.pillars) {
            p.dead = true;
            p.onDestroy();
            Globals.scene.remove(p);
            removeEnemy(p);
        }
        this.pillars = [];

        // Nettoyage des indices au sol
        for (let decal of this.clueDecals) {
            Globals.scene.remove(decal);
        }
        this.clueDecals = [];

        // Supprimer du gestionnaire menhirs interactifs
        const menhirIdx = Globals.menhirs.indexOf(this);
        if (menhirIdx > -1) {
            Globals.menhirs.splice(menhirIdx, 1);
        }

        // Suppression de cet objet coordinateur et retrait de Globals.enemies pour stopper la boucle update !
        this.dead = true;
        Globals.scene.remove(this);
        removeEnemy(this); // FIX : Supprime de Globals.enemies pour empêcher le spawn de 50 boss !
    }

    pushBack() { return; }
    applyStun() { return; }
}

// --- GESTION DE LA BARRIÈRE MAGIQUE DE L'ARÈNE ---

let activeBarrierMeshes = [];

export function spawnBossArenaBarrier() {
    if (!Globals.scene) return;
    
    removeBossArenaBarrier();

    const cx = BOSS_ZONE.cx;
    const cz = BOSS_ZONE.cz;
    const r = BOSS_ZONE.radius;

    // 1. Barrière magique visuelle (cylindre complet de rayon r)
    const barrierGeo = new THREE.CylinderGeometry(r - 0.1, r - 0.1, 7.0, 64, 1, true);
    const barrierMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.35, 
        emissive: 0x00ff00, 
        emissiveIntensity: 1.2,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    
    const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
    barrierMesh.position.set(cx, 3.5, cz);
    barrierMesh.name = 'boss_gate_barrier';
    Globals.scene.add(barrierMesh);
    activeBarrierMeshes.push(barrierMesh);

    // Les obstacles physiques ne sont plus nécessaires car le joueur est confiné mathématiquement dans l'arène.
    
    if (Globals.player) {
        createDamageText("L'ARÈNE SE FERME !", Globals.player.position.clone().add(new THREE.Vector3(0, 4, 0)), '#ff3333', 3.0);
    }
}

export function removeBossArenaBarrier() {
    if (Globals.scene) {
        for (let mesh of activeBarrierMeshes) {
            Globals.scene.remove(mesh);
        }
        const oldB = Globals.scene.getObjectByName('boss_gate_barrier');
        if (oldB) Globals.scene.remove(oldB);
    }
    activeBarrierMeshes = [];

    if (Globals.obstacles) {
        Globals.obstacles = Globals.obstacles.filter(obs => !obs.isBossBarrier);
    }
}