// @ts-nocheck
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { ConvergenceEffects } from '@/systems/convergenceEffects';
import { PassiveKeystoneHooks } from '@/systems/passiveKeystoneHooks';
import { createDamageText } from '@/visual/effects';
import { Network } from '@/multiplayer/network';

/** La barrière corrompue absorbe les dégâts sans recevoir de coups critiques. */
export function enemyHasCorruptBarrier(enemy) {
    return enemy && enemy.barrierHp > 0;
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
    if (PassiveKeystoneHooks.isEnemyMarked(enemy)) {
        scaled = baseDmg * 1.35;
    }

    const { dmg, isCrit, isMegaCrit } = computeDamageToEnemy(enemy, scaled, opts);
    const pos = opts.pos || enemy.position;

    if (isMegaCrit) {
        createDamageText('MÉGA CRIT!', pos, '#ff0066');
        if (AudioSys?.sfx?.crit) AudioSys.sfx.crit();
    } else if (isCrit) {
        createDamageText('CRIT!', pos, '#ff0');
        PassiveKeystoneHooks.onCritApplyHemorrhage(enemy, dmg);
        if (opts.onCrit && typeof opts.onCrit === 'function') opts.onCrit();
    }

    if (STATE.multiplayer.active && !STATE.multiplayer.isHost) {
        createDamageText(Math.floor(dmg), pos);
        Network.send({ type: 'request-damage', enemyId: enemy.netId, amount: dmg });
    } else if (opts.onHitEnemy) {
        opts.onHitEnemy(enemy, dmg);
    } else {
        enemy.takeDamage(dmg);
    }

    return { dmg, isCrit };
}
