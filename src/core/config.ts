// @ts-nocheck
import { createDefaultSkillCdMods, createDefaultSkillMods } from '../data/classStatsConfig';

export const CONFIG = {
    colors: {
        warrior: 0x8e44ad, mage: 0x3498db, sentinel: 0xf1c40f, blade: 0x1abc9c, pacifier: 0x8a0b0b,
        eclipse: 0x2c3e50, chronoregulator: 0x48c9b0,
        enemy: { green: 0x2ecc71, blue: 0x3498db, red: 0xe74c3c, iron: 0x95a5a6, fire: 0xd35400, mage: 0x9b59b6, corrupt: 0x2c3e50 },
        ground: 0x111111, safeZone: 0x223322,
        skyNormal: 0x87CEEB, 
        skyDark: 0x050505,   
        groundNormal: 0x7cfc00 
    },
    skillIcons: {
        warrior: ['<i class="fas fa-gavel"></i>', '<i class="fas fa-bullhorn"></i>', '<i class="fas fa-shield-halved"></i>'], 
        mage: ['<i class="fas fa-wand-magic-sparkles"></i>', '<i class="fas fa-snowflake"></i>', '<i class="fas fa-users-viewfinder"></i>'], 
        sentinel: ['<i class="fas fa-sun"></i>', '<i class="fas fa-wind"></i>', '<i class="fas fa-hands-holding-circle"></i>'], 
        blade: ['<i class="fas fa-scythe"></i>', '<i class="fas fa-person-running"></i>', '<i class="fas fa-water"></i>'],
        pacifier: ['<i class="fas fa-heart-pulse"></i>', '<i class="fas fa-eye"></i>', '<i class="fas fa-crosshairs"></i>'],
        eclipse: ['<i class="fas fa-meteor"></i>', '<i class="fas fa-magnet"></i>', '<i class="fas fa-circle-notch"></i>'],
        chronoregulator: ['<i class="fas fa-gem"></i>', '<i class="fas fa-atom"></i>', '<i class="fas fa-rotate"></i>']
    },
    tooltips: {
        warrior: {
            passive: { name: "Peau de Fer", desc: "Réduit les dégâts de 12%. Bloquer charge une explosion." }, 
            space: { name: "Frappe Sismique", desc: "Bondit et écrase le sol. Dégâts massifs + Repousse." },
            shift: { name: "Cri de Guerre", desc: "Soin personnel et repousse les ennemis proches." },
            e: { name: "Parade", desc: "Posture défensive. Bloque 75% des dégâts pendant 3s." }
        },
        mage: {
            passive: { name: "Surcharge", desc: "Les sorts réduisent les autres cooldowns." },
            space: { name: "Arcane Barrage", desc: "Balayage magique : Tire 3 projectiles téléguidés." },
            shift: { name: "Chronostase", desc: "Fige les ennemis dans la zone et inflige des dégâts." },
            e: { name: "Transfert", desc: "Téléportation instantanée + Explosion au point de départ." }
        },
        sentinel: {
            passive: { name: "Aura Solaire", desc: "Présence divine qui inspire les alliés." },
            space: { name: "Rayon Stellaire", desc: "Charge (1s) puis tire un laser dévastateur." },
            shift: { name: "Champ de Lumière", desc: "Plante la lance : Zone de dégâts et de soin." },
            e: { name: "Égide Divine", desc: "Moulinet sacré : Soin important + Bouclier." }
        },
        blade: {
            passive: { name: "Soif de Sang", desc: "Plus les PV sont bas, plus les dégâts augmentent." },
            space: { name: "Toupie Létale", desc: "Tourbillon de lames. Dégâts autour de soi." },
            shift: { name: "Ombre Véloce", desc: "Dash fantôme rapide. Traverse et blesse les ennemis." },
            e: { name: "Tsunami", desc: "Plonge dans le sol et retombe en une vague d'eau massive." }
        },
        pacifier: {
            passive: { name: "Bouclier de Sang", desc: "Le soin excédentaire génère un bouclier." },
            space: { name: "Saut Vampirique", desc: "S'envole et s'écrase au sol. Stun + Vol de vie de zone." },
            shift: { name: "Verdict Sanguin", desc: "Claquement de doigts : Dégâts et applique une marque." },
            e: { name: "Frénésie", desc: "Recharge : Active le pistolet. Tirs rapides et critiques." }
        },
        eclipse: {
            passive: { name: "Balance Astrale", desc: "Alterne Soleil (DoT) et Lune (Burst/Slow)." },
            space: { name: "Éclat Solaire", desc: "Orbe ricochant sur 5 ennemis. (Immunité 0.25s)" },
            shift: { name: "Pic de Lune", desc: "Invocation massive qui empale les ennemis." },
            e: { name: "Cataclysme", desc: "Explosion massive (x2 degats en Ascension)" }
        },
        chronoregulator: {
            passive: { name: "Surcharge Chronologique", desc: "Maintenez le clic pour canaliser le Rayon de Distorsion. La Fracture monte jusqu'à la surchauffe (100%). Relâchez entre 85-95% : explosion de rupture. Compétences : -30 Fracture." },
            space: { name: "Lentille de Focalisation", desc: "Prisme au sol : le rayon se triple en cône. La Fracture monte 2× plus lentement à travers la lentille." },
            shift: { name: "Déphasage Moléculaire", desc: "Lance une grenade en arc : explosion de zone, Instabilité Chronologique (4s). Tant qu'une cible est marquée : Fracture ÷4 au rayon." },
            e: { name: "Convergence Temporelle", desc: "6 s de Convergence : +10% vitesse, rayon sans Fracture ni surchauffe, attire les marquées, ondes résiduelles. Réactive E pour l'explosion finale. CD 17 s." }
        }
    }
};

export const STATE = {
    class: null, 
    level: 1, 
    xp: 0, 
    xpToNext: 100, 
    skillPoints: 0,
    unlockedNodes: [],
    fragments: [], 
    enemiesKilled: 0,
    bossSpawned: false,
    isBossFight: false,
    bossProgress: { // Progression NG+ par boss
        'king': 0,
        'slime_lord': 0
    },
    ngLevel: 0, // Global (Legacy)
    timeScale: 1.0,
    isPaused: false,
    mouseDown: false,
    leftSafeZone: false,
    mouse: { x: 0, y: 0 },
    raycaster: null, 
    
    passives: {},

    stats: { 
        hp: 100, 
        maxHp: 100, 
        atk: 10, 
        def: 0, 
        speed: 15.0, 
        crit: 0.05, 
        critDmg: 1.5,
        cdMod: 1.0,
        attackSpeedMod: 1.0,
        regen: 0, 
        lifesteal: 0,
        xpMod: 1.0,
        skillMods: createDefaultSkillMods(),
        skillCdMods: createDefaultSkillCdMods(),
        titanBonus: 0,
    },
    
    multiplayer: {
        active: false,
        isHost: false,
        id: null,
        remotePlayers: {}
    }
};