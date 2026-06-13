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
            passive: { name: "Peau de Fer", desc: "−12 % dégâts reçus en plus de la Défense.\n\nVos sorts et attaques scalent sur la Défense.\n\nChaque blocage en Parade charge une explosion." },
            space: { name: "Frappe Sismique", desc: "Bond au sol.\nDégâts de zone et repousse les ennemis." },
            shift: { name: "Cri de Guerre", desc: "Soin personnel.\nRepousse les ennemis proches." },
            e: { name: "Parade", desc: "Posture défensive.\nBloque 75 % des dégâts pendant 3 s." }
        },
        mage: {
            passive: { name: "Surcharge", desc: "Chaque sort réduit les autres temps de recharge." },
            space: { name: "Arcane Barrage", desc: "Tire 3 projectiles téléguidés.\nDégâts magiques." },
            shift: { name: "Chronostase", desc: "Zone de ralentissement.\nInflige des dégâts aux ennemis figés." },
            e: { name: "Transfert", desc: "Téléportation instantanée.\nExplosion au point de départ." }
        },
        sentinel: {
            passive: { name: "Aura Solaire", desc: "Aura de soutien autour du lanceur.\nBonus offensifs aux alliés proches." },
            space: { name: "Rayon Stellaire", desc: "Charge 1 s, puis laser en ligne.\nDégâts massifs." },
            shift: { name: "Champ de Lumière", desc: "Lance sacrée au sol.\nZone persistante : dégâts périodiques et soin du lanceur." },
            e: { name: "Égide Divine", desc: "Moulinet sacré.\nSoin important et bouclier." }
        },
        blade: {
            passive: { name: "Soif de Sang", desc: "+1 % dégâts par % de PV manquant." },
            space: { name: "Toupie Létale", desc: "Tourbillon de lames autour de soi.\nDégâts de zone." },
            shift: { name: "Ombre Véloce", desc: "Dash rapide à travers les ennemis.\nDégâts au passage." },
            e: { name: "Tsunami", desc: "Plonge sous le sol.\nVague d'eau à l'impact : dégâts de zone." }
        },
        pacifier: {
            passive: { name: "Bouclier de Sang", desc: "Le soin excédentaire est converti en bouclier." },
            space: { name: "Saut Vampirique", desc: "Saut et écrasement.\nÉtourdit les ennemis · vol de vie de zone." },
            shift: { name: "Verdict Sanguin", desc: "Dégâts instantanés.\nApplique une marque pendant 6 s." },
            e: { name: "Frénésie", desc: "Active le pistolet.\nTirs rapides à chance de critique accrue." }
        },
        eclipse: {
            passive: { name: "Balance Astrale", desc: "Alterne les balayages Solaires et Lunaires en mêlée.\nSoleil : DoT de feu · Lune : drain de vie." },
            space: { name: "Fulgurance Solaire", desc: "Dash rapide à travers les ennemis en infligeant des dégâts de feu.\nImmunité pendant la course." },
            shift: { name: "Pic de Lune", desc: "Écrase l'arme au sol.\nEmpale et ralentit les ennemis en mêlée." },
            e: { name: "Cataclysme", desc: "Explosion massive.\nDégâts de zone · aspire les ennemis proches." }
        },
        chronoregulator: {
            passive: { name: "Surcharge Chronologique", desc: "Maintenez le clic pour canaliser le rayon.\nFracture monte jusqu'à 100 %.\n\nRelâchez entre 85–95 % : explosion de rupture.\nCompétences : −30 Fracture." },
            space: { name: "Lentille de Focalisation", desc: "Prisme au sol.\nLe rayon se divise en cône · Fracture ×0,5 à travers la lentille." },
            shift: { name: "Déphasage Moléculaire", desc: "Grenade en arc : explosion de zone.\nInstabilité chronologique 4 s.\n\nCible marquée : Fracture ÷4 au rayon." },
            e: { name: "Convergence Temporelle", desc: "Durée 6 s · +10 % vitesse.\nRayon sans Fracture ni surchauffe.\n\nAttire les cibles marquées.\nRéactive E pour l'explosion finale.\n\nRecharge : 17 s." }
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
    gameOptions: {
        enemyHpMult: 1.0,
        enemyDmgMult: 1.0,
        enemySpawnRate: 1.0,
        xpMult: 1.0,
        playerHpMult: 1.0,
        playerDmgMult: 1.0,
        startLevel: 1
    },
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
        defense: 10,
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
        titanDefBonus: 0,
    },
    
    multiplayer: {
        active: false,
        isHost: false,
        id: null,
        remotePlayers: {}
    }
};