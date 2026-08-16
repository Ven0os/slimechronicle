// @ts-nocheck

import { STATE } from '@/core/config';

import { AudioSys } from '@/core/ressources';

import { ConvergenceEffects } from '@/systems/convergenceEffects';

import { PassiveKeystoneHooks } from '@/systems/passiveKeystoneHooks';

import { createDamageText } from '@/visual/effects';

import { Network } from '@/multiplayer/network';

import { Globals } from '@/core/globals';

import { isServerAuthority, isVisualOnlyMode, findEnemyByNetId, getPlayerByPeerId } from '@/multiplayer/net_combat';

import { NetClassState } from '@/multiplayer/net_class_state';

import { NetAuthority, registerDamageEvent, makeDamageEventKey } from '@/multiplayer/net_authority';

import { applyDefenseReduction, getEnemyDefense } from '@/gameplay/combat/defense';

import {
  blocksCriticalHits,
  shouldApplyMarkedBonus,
  shouldApplyCataclysmVuln,
} from '@/gameplay/enemies/minions/mini_boss_combat';



/** Overshield Corrompu standard (non Mini-Boss) bloque les crits. */

export function enemyHasCorruptBarrier(enemy) {

    return blocksCriticalHits(enemy);

}



export function computeDamageToEnemy(enemy, baseDmg, opts = {}) {

    let dmg = baseDmg;

    let isCrit = false;

    let critMult = STATE.stats.critDmg;



    if (opts.megaCrit) {

        critMult *= ConvergenceEffects.getMegaCritMult();

    }

    if (opts.critDmgMult) {

        critMult *= opts.critDmgMult;

    }



    if (opts.forceCrit || opts.megaCrit) {

        dmg *= critMult;

        isCrit = true;

    } else if (!opts.noCrit && !enemyHasCorruptBarrier(enemy) && Math.random() < STATE.stats.crit) {

        dmg *= critMult;

        isCrit = true;

    }



    return { dmg, isCrit, isMegaCrit: !!opts.megaCrit && isCrit };

}



export function dealDamageToEnemy(enemy, baseDmg, opts = {}) {

    if (!enemy || enemy.dead) return { dmg: 0, isCrit: false };



    let scaled = baseDmg;
    const playerDmgMult = (STATE.gameOptions && STATE.gameOptions.playerDmgMult !== undefined) ? STATE.gameOptions.playerDmgMult : 1.0;
    scaled *= playerDmgMult;



    if (shouldApplyMarkedBonus(enemy) && PassiveKeystoneHooks.isEnemyMarked(enemy)) {
        scaled *= 1.35;
    }



    if (shouldApplyCataclysmVuln(enemy) && enemy._cataclysmVuln) {

        scaled *= ConvergenceEffects.getCataclysmVulnMult(enemy);

    }

    const enemyDef = getEnemyDefense(enemy);
    if (enemyDef > 0 && !opts.ignoreDefense) {
        scaled = applyDefenseReduction(scaled, enemyDef, { allowZero: true });
    }



    const { dmg, isCrit, isMegaCrit } = computeDamageToEnemy(enemy, scaled, opts);

    const pos = opts.pos || enemy.position;



    if (isMegaCrit) {

        if (!opts.suppressCritText) createDamageText('MÉGA CRIT!', pos, '#ff0066');

        if (AudioSys?.sfx?.crit) AudioSys.sfx.crit();

    } else if (isCrit) {

        if (!opts.suppressCritText) createDamageText(opts.critLabel || 'CRIT!', pos, opts.critColor || '#ff0');

        if (AudioSys?.sfx?.crit) AudioSys.sfx.crit();

        if (!enemy.isMiniBoss && !opts.skipPassiveHemorrhage) {

            PassiveKeystoneHooks.onCritApplyHemorrhage(enemy, dmg);

        }

        if (opts.onCrit && typeof opts.onCrit === 'function') opts.onCrit();

    }

    if (opts.applyHemorrhage) {
        PassiveKeystoneHooks.applyBladeBreakpointHemorrhage(enemy, dmg);
    }



    if (isVisualOnlyMode()) {

        NetAuthority.logAuthViolation('visual_damage_attempt', 'dealDamageToEnemy in visual-only mode');

        return { dmg: 0, isCrit: false };

    }



    if (STATE.multiplayer.active && !STATE.multiplayer.isHost) {

        createDamageText(Math.floor(dmg), pos);

        Network.send({

            type: 'request-damage',

            enemyId: enemy.netId,

            playerId: STATE.multiplayer.id,

            baseDmg: scaled,

            skillKey: opts.skillKey || 'primary',

            tick: NetClassState.getServerTick(),

            opts: {

                forceCrit: !!opts.forceCrit,

                megaCrit: !!opts.megaCrit,

                noCrit: !!opts.noCrit,

                critDmgMult: opts.critDmgMult,

                ignoreDefense: !!opts.ignoreDefense,

                applyHemorrhage: !!opts.applyHemorrhage,

                skipPassiveHemorrhage: !!opts.skipPassiveHemorrhage,

                bladeBreakpointSkillKey: opts.bladeBreakpointSkillKey,

                suppressCritText: !!opts.suppressCritText,

            },

            amount: dmg,

            maxRange: opts.maxRange ?? 25,

        });

    } else if (!isServerAuthority()) {

        return { dmg: 0, isCrit: false };

    } else if (opts.onHitEnemy) {

        opts.onHitEnemy(enemy, dmg);

    } else {

        enemy.takeDamage(dmg, { isRanged: !!(opts.isRanged || opts.ranged) });

    }



    return { dmg, isCrit };

}
