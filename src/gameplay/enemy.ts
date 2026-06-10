// @ts-nocheck
import { BaseEnemy } from './enemies/base_enemy';
import { KingSlime } from './enemies/boss/king_slime';
import { SlimeLord } from './enemies/boss/slime_lord';
import { Sentinel } from './enemies/minions/sentinel/sentinel';
import { Rogue } from './enemies/minions/rogue/rogue';
import { Warlock } from './enemies/minions/warlock/warlock';
import { RoyalGuard } from './enemies/minions/royal_guard/royal_guard';
import { Corrupted } from './enemies/minions/corrupted/corrupted';

// Factory pattern: Centralise la création des ennemis
export class Enemy extends BaseEnemy {
    constructor(type, position, id = null) {
        // --- BOSS ---\
        if (type === 'king') return new KingSlime(position, id);
        if (type === 'slime_lord') return new SlimeLord(position, id);

        // --- ENEMIES CLASSIQUES ---\
        if (type === 'royal_guard') return new RoyalGuard(position, id);
        if (type === 'sentinel' || type === 'iron') return new Sentinel(position, id);
        if (type === 'warlock' || type === 'mage' || type === 'blue' || type === 'fire') return new Warlock(position, id);
        if (type === 'corrupted') return new Corrupted(position, id);
        
        // Par défaut: Assassin (Rogue) - Rapide et au corps à corps
        return new Rogue(position, id);
    }
}