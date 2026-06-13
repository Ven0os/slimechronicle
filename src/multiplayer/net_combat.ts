// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { Network } from './network';
import { computeDamageToEnemy } from '@/gameplay/combat/damage_helpers';
import { createDamageText } from '@/visual/effects';

let visualOnlyDepth = 0;

/** Hôte ou solo : seule instance qui applique la logique gameplay. */
export function isServerAuthority() {
    return !STATE.multiplayer.active || STATE.multiplayer.isHost;
}

/** Exécute du code visuel distant sans appliquer de dégâts locaux. */
export function runVisualOnly(fn) {
    visualOnlyDepth++;
    try {
        return fn();
    } finally {
        visualOnlyDepth--;
    }
}

export function isVisualOnlyMode() {
    return visualOnlyDepth > 0;
}

export function findEnemyByNetId(netId) {
    if (!netId) return null;
    return Globals.enemies.find((e) => e.netId === netId) || null;
}

export function getRemotePlayerId(player) {
    if (!player) return null;
    for (const id in STATE.multiplayer.remotePlayers) {
        if (STATE.multiplayer.remotePlayers[id] === player) return id;
    }
    if (player.userData && player.userData.id) return player.userData.id;
    return null;
}

export function getPlayerByPeerId(peerId) {
    if (!peerId) return null;
    if (String(peerId) === String(STATE.multiplayer.id)) return Globals.player;
    return STATE.multiplayer.remotePlayers[peerId] || null;
}

export function getAllLivingPlayers() {
    const targets = [];
    if (Globals.player && !Globals.player.dead && Globals.player.visible !== false) {
        targets.push(Globals.player);
    }
    for (const id in STATE.multiplayer.remotePlayers) {
        const p = STATE.multiplayer.remotePlayers[id];
        if (p && !p.dead && p.visible !== false) targets.push(p);
    }
    return targets;
}

/** Dégâts de zone — touche tous les joueurs dans le rayon. */
export function damageAllPlayersInRadius(center, radius, amount, opts = {}) {
    if (!isServerAuthority() || isVisualOnlyMode()) return;
    getAllLivingPlayers().forEach((t) => {
        if (center.distanceTo(t.position) < radius) damagePlayer(t, amount, opts);
    });
}

/** Dégâts en cône / faisceau depuis une origine. */
export function damagePlayersInBeam(origin, dir, length, amount, dotThreshold = 0.9, opts = {}) {
    if (!isServerAuthority() || isVisualOnlyMode()) return;
    const beamDir = dir.clone();
    beamDir.y = 0;
    if (beamDir.lengthSq() < 0.001) return;
    beamDir.normalize();

    getAllLivingPlayers().forEach((t) => {
        const toP = t.position.clone().sub(origin);
        toP.y = 0;
        const dist = toP.length();
        if (dist < length && dist > 0 && toP.normalize().dot(beamDir) > dotThreshold) {
            damagePlayer(t, amount, opts);
        }
    });
}

/**
 * Applique des dégâts à un joueur depuis l'autorité serveur.
 * Envoie damage-player au client ciblé si nécessaire.
 */
export function damagePlayer(player, amount, opts = {}) {
    if (!player || player.dead || amount <= 0) return;
    const dmgMult = (STATE.gameOptions && STATE.gameOptions.enemyDmgMult !== undefined) ? STATE.gameOptions.enemyDmgMult : 1.0;
    amount *= dmgMult;

    if (isVisualOnlyMode()) return;
    if (!isServerAuthority()) return;

    const knockback = opts.knockback;
    const applyKnockback = (p) => {
        if (knockback && p.knockback) p.knockback.add(knockback);
    };

    if (player === Globals.player) {
        player.takeDamage(amount);
        applyKnockback(player);
        return;
    }

    const remoteId = getRemotePlayerId(player);
    if (remoteId) {
        const payload = {
            type: 'damage-player',
            targetId: remoteId,
            amount,
        };
        if (knockback) {
            payload.knockback = { x: knockback.x, y: knockback.y, z: knockback.z };
        }
        if (opts.stunDuration && player.applyStun) {
            payload.stunDuration = opts.stunDuration;
        }
        Network.send(payload);
    }
}

/** Dégâts de zone autour d'une position — cible le joueur le plus proche dans le rayon. */
export function damageClosestPlayerInRadius(center, radius, amount, opts = {}) {
    if (!isServerAuthority() || isVisualOnlyMode()) return;

    const targets = [];
    if (Globals.player && !Globals.player.dead && Globals.player.visible) targets.push(Globals.player);
    for (const id in STATE.multiplayer.remotePlayers) {
        const p = STATE.multiplayer.remotePlayers[id];
        if (p && !p.dead && p.visible) targets.push(p);
    }

    let closest = null;
    let minD = Infinity;
    targets.forEach((t) => {
        const d = center.distanceTo(t.position);
        if (d < radius && d < minD) {
            minD = d;
            closest = t;
        }
    });

    if (closest) damagePlayer(closest, amount, opts);
}

/**
 * Valide et applique une demande de dégâts joueur→ennemi (client → hôte).
 */
export function handleRequestDamage(data) {
    if (!STATE.multiplayer.isHost) return;

    const enemy = findEnemyByNetId(data.enemyId);
    if (!enemy || enemy.dead) return;

    const playerId = String(data.playerId || data.id || '');
    const attacker = getPlayerByPeerId(playerId);
    const attackerPos = attacker
        ? attacker.position
        : data.pos
            ? new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z)
            : null;

    if (!attackerPos) return;

    const dist = attackerPos.distanceTo(enemy.position);
    const maxRange = data.maxRange ?? 25;
    if (dist > maxRange) return;

    const tick = data.tick ?? NetClassState.getServerTick();
    const eventKey = makeDamageEventKey(playerId, data.enemyId, data.skillKey || 'primary', tick);
    if (!registerDamageEvent(eventKey)) return;

    let opts = { ...(data.opts || {}) };

    if (attacker?.className === 'pacifier') {
        const shotIdx = NetClassState.authorizePacifierShot(playerId);
        opts = {
            ...opts,
            megaCrit: ConvergenceEffects.isMegaCritShot(shotIdx),
            noCrit: false,
        };
    }

    let amount = data.amount;
    if (data.baseDmg != null) {
        const { dmg } = computeDamageToEnemy(enemy, data.baseDmg, opts);
        amount = dmg;
    }

    const maxAllowed = data.baseDmg != null
        ? data.baseDmg * 8
        : (enemy.maxHp || 500) * 2;
    amount = Math.max(0, Math.min(amount, maxAllowed));

    if (amount <= 0) return;
    enemy.takeDamage(amount, {
        isRanged: !!(data.opts?.isRanged || data.opts?.ranged),
    });
}
