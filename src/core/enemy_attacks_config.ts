// @ts-nocheck
// Configuration centralisée des attaques ennemies
export const ENEMY_ATTACKS = {
    // --- ASSASSIN (ROGUE) ---
    rogue: {
        spawn: { sound: 'rogue_spawn' },
        stab: {
            damage: 25,
            range: 3.0,
            cooldown: 1.2,
            pushForce: 10,
            sound: 'sword_swing',
            telegraph: { type: 'rect', size: {x: 1, y: 3}, duration: 0.5, color: 0xff0000 }
        },
        fanOfKnives: {
            damage: 22,
            count: 3,
            spread: 0.3,
            speed: 0.6,
            cooldown: 3.0,
            windup: 0.4,
            sound: 'shoot'
        },
        shadowStep: {
            damage: 35,
            range: 3.0,
            cooldown: 5.0,
            castTime: 0.6,
            reappearDelay: 0.3,
            stunDuration: 0.8,
            sound: 'teleport',
            soundImpact: 'crit'
        }
    },

    // --- SENTINELLE (SENTINEL) ---
    sentinel: {
        spawn: { sound: 'sentinel_spawn' },
        smash: {
            damage: 45,
            radius: 5.0,
            pushForce: 20,
            cooldown: 2.0,
            sound: 'war_cry',
            soundImpact: 'earth_smash',
            telegraph: { type: 'circle', size: 5.0, duration: 1.0, color: 0xe74c3c }
        },
        charge: {
            damage: 30,
            speedStart: 40.0,
            speedEnd: 5.0,
            pushForce: 15,
            cooldown: 4.0,
            hitRadius: 2.5,
            stunDuration: 0.75,
            sound: 'sentinel_charge',
            soundImpact: 'sentinel_impact'
        },
        shieldBash: {
            damage: 20,
            range: 4.5,
            pushForce: 25,
            cooldown: 1.5,
            stunDuration: 0.5,
            sound: 'sentinel_bash',
            telegraph: { type: 'cone', size: 4.0, duration: 0.5, color: 0x3498db }
        }
    },

    // --- SORCIER (WARLOCK) ---
    warlock: {
        spawn: { sound: 'warlock_spawn' },
        bolt: {
            damage: 12,
            speed: 0.5,
            cooldown: 1.5,
            castTime: 0.5,
            sound: 'warlock_bolt'
        },
        voidZone: {
            damage: 30,
            radius: 6.0,
            pullForce: 8,
            cooldown: 4.0,
            stunDuration: 1.5,
            sound: 'warlock_curse',
            telegraph: { type: 'circle', size: 6.0, duration: 1.5, color: 0x550055 }
        },
        beam: {
            damage: 40,
            length: 15,
            width: 2,
            cooldown: 4.5,
            sound: 'warlock_beam', 
            telegraph: { type: 'rect', size: {x: 2, y: 15}, duration: 1.2, color: 0x4b0082 }
        },
        teleport: {
            dist: 8.0,
            cooldown: 5.0,
            castTime: 0.5,
            sound: 'warlock_teleport'
        }
    },

    // --- CORROMPU (barrière 50 % PV, non crittable) ---
    corrupted: {
        spawn: { sound: 'rogue_spawn' },
        slash: {
            damage: 22,
            range: 3.2,
            cooldown: 1.4,
            pushForce: 8,
            sound: 'sword_swing',
            telegraph: { type: 'rect', size: { x: 1.1, y: 3 }, duration: 0.55, color: 0xa855f7 },
        },
        corruptPulse: {
            damage: 18,
            radius: 5.0,
            cooldown: 3.5,
            sound: 'warlock_curse',
            telegraph: { type: 'circle', size: 5.0, duration: 1.0, color: 0x6b21a8 },
        },
    },

    // --- GARDE ROYAL (ROYAL GUARD) ---
    royal_guard: {
        spawn: { sound: 'guard_spawn' },
        slash: {
            damage: 25,
            range: 3.5,
            pushForce: 8,
            cooldown: 2.0,
            sound: 'guard_slash',
            telegraph: { type: 'rect', size: {x: 1.5, y: 3}, duration: 0.6, color: 0xffff00 }
        },
        stomp: {
            damage: 30,
            radius: 3.5,
            pushForce: 12,
            cooldown: 3.0,
            stunDuration: 1.5,
            sound: 'guard_stomp',
            telegraph: { type: 'circle', size: 3.5, duration: 0.8, color: 0xffaa00 }
        }
    },

    // --- KING SLIME (BOSS) ---
    king_slime: {
        spawn: { sound: 'boss_spawn' },
        // Phase 1 (100% - 50%)
        jump: {
            damage: 40,
            radius: 6.0,
            pushForce: 15,
            cooldown: 6.0,
            airTime: 1.0,
            stunDuration: 1.5,
            sound: 'king_jump_start',
            soundImpact: 'king_land',
            telegraph: { type: 'circle', size: 6.0, duration: 1.0, color: 0xff0000 }
        },
        cleave: { // Coup d'épée lourd
            damage: 50,
            range: 8.0, // Cône devant
            cooldown: 4.0,
            stunDuration: 1.0,
            pushForce: 10,
            sound: 'sword_swing',
            telegraph: { type: 'cone', size: 8.0, duration: 0.8, color: 0xffaa00 }
        },
        summon: { // Gardes Royaux
            count: 2,
            maxMinions: 4,
            cooldown: 20.0,
            sound: 'king_laugh'
        },
        rain: { // Pluie de Feu
            damage: 30,
            radius: 3.0,
            count: 6,
            range: 40.0,
            cooldown: 10.0,
            sound: 'magic_cast',
            telegraph: { type: 'circle', size: 3.0, duration: 1.5, color: 0xff5500 }
        },
        // Phase 2 (50% - 20%)
        spikes: { // Pics sortant du sol
            damage: 45,
            radius: 20.0, // 360 degrés autour
            pushForce: 25,
            cooldown: 12.0,
            stunDuration: 2.0,
            sound: 'earth_smash',
            telegraph: { type: 'circle', size: 20.0, duration: 1.2, color: 0x8B4513 }
        },
        // Phase 3 (Finale)
        cataclysm: { // Explosion massive + Boules du néant
            damage: 120, // Très mal
            radius: 35.0, // Immense zone
            cooldown: 25.0, // MOINS FRÉQUENT (C'était 18s)
            castTime: 4.0, // TEMPS DE PRÉPARATION (Laisse le temps de voir l'animation)
            stunDuration: 3.0,
            sound: 'boss_roar',
            telegraph: { type: 'circle', size: 35.0, duration: 4.0, color: 0x4b0082 } // Violet foncé
        }
    }
};