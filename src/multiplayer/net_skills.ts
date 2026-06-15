// @ts-nocheck
import { STATE } from '../core/config';
import { Globals } from '../core/globals';
import { AudioSys } from '../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual } from '../visual/effects';
import { Network } from './network';
import { runVisualOnly, isServerAuthority, getPlayerByPeerId } from './net_combat';
import { dealDamageToEnemy } from '@/gameplay/combat/damage_helpers';
import { NetClassState } from './net_class_state';
import { ConvergenceEffects } from '@/systems/convergenceEffects';

function safePlay(soundName) {
    if (AudioSys && AudioSys.sfx) {
        if (typeof AudioSys.sfx[soundName] === 'function') {
            AudioSys.sfx[soundName]();
        } else if (AudioSys.play) {
             AudioSys.play(soundName);
        }
    }
}

export const NetSkills = {
    // --- HOST LOGIC (Dégâts réels) ---
    applyRemoteSkillLogic: function(data, pos, dir) {
        if (!isServerAuthority()) return;

        const playerId = String(data.id);
        const flatDir = dir.clone();
        flatDir.y = 0;
        if (flatDir.lengthSq() > 0.001) flatDir.normalize();

        if (data.action === 'attack-melee') {
            if (data.class === 'warrior') {
                NetClassState.resolveMeleeHit(playerId, pos, flatDir, 4.5, 30 * 2.5, 0.4);
            } else if (data.class === 'pacifier') {
                NetClassState.resolveMeleeHit(playerId, pos, flatDir, 3.5, 20 * 1.5, 0.5);
            } else if (data.class === 'blade') {
                NetClassState.resolveMeleeHit(playerId, pos, flatDir, 3.0, 30, 0.4);
            } else if (data.class === 'eclipse') {
                const player = getPlayerByPeerId(playerId);
                if (player) {
                    NetClassState.resolveEclipseBasicAttack(playerId, player, pos, flatDir);
                }
            }
            return;
        }

        if (data.action === 'attack-range' && data.class === 'pacifier') {
            NetClassState.resolvePacifierShot(playerId, pos, flatDir);
            return;
        }

        if (data.action === 'skill' && data.class === 'warrior' && data.key === 'shift') {
            const player = getPlayerByPeerId(playerId);
            const seals = Array.isArray(data.extra?.runicSeals)
                ? data.extra.runicSeals.map((v) => Math.max(0, Number(v) || 0)).filter((v) => v > 0).slice(0, ConvergenceEffects.getRunicJudgmentMaxSeals())
                : ConvergenceEffects.consumeRunicJudgmentSeals(player);

            if (player && Array.isArray(data.extra?.runicSeals)) {
                ConvergenceEffects.setRunicJudgmentSealValues(player, []);
            }

            const targets = ConvergenceEffects.findRunicJudgmentTargets(pos, seals.length, 18);
            const releaseRatio = ConvergenceEffects.getRunicJudgmentReleaseRatio();
            seals.forEach((stored, index) => {
                const target = targets[index % Math.max(1, targets.length)];
                if (!target) return;
                const damage = stored * releaseRatio;
                dealDamageToEnemy(target, damage, {
                    pos: target.position,
                    skillKey: 'shift',
                    maxRange: 24,
                    isRanged: true,
                });
            });
            return;
        }

        if (data.action === 'skill' && data.class === 'sentinel' && data.key === 'space' && typeof data.chargeRatio === 'number') {
            const player = getPlayerByPeerId(playerId);
            if (player && typeof player.fireStellarBeam === 'function') {
                player.fireStellarBeam(flatDir, data.chargeRatio);
            }
            return;
        }

        if (data.class === 'warrior' && data.key === 'space') {
            const baseDmg = 30;
            Globals.enemies.forEach(e => {
                if (e.position.distanceTo(pos) <= 8) {
                    dealDamageToEnemy(e, baseDmg * 2.5, { pos: e.position, maxRange: 10 });
                    if (typeof e.pushBack === 'function') e.pushBack(pos.clone().sub(e.position).normalize().multiplyScalar(-10));
                }
            });
        }
    },

    // --- VISUAL FEEDBACK (CLIENT & HOST) ---
    triggerRemoteSkillVisual: function(data, remotePlayer) {
        const pos = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
        const dir = data.dir ? new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z) : new THREE.Vector3(0,0,1);

        if (remotePlayer && typeof remotePlayer.performAttack === 'function') {
            runVisualOnly(() => {
                if (remotePlayer.mesh) {
                    const angle = Math.atan2(dir.x, dir.z);
                    remotePlayer.mesh.rotation.y = angle;
                    remotePlayer.netRotation = angle;
                }

                if (data.class === 'chronoregulator') {
                    if (data.action === 'skill' && data.key === 'space') {
                        return;
                    }
                    if (data.action === 'attack-range') {
                        return;
                    }
                }

                if (data.class === 'sentinel' && data.action === 'skill' && data.key === 'space' && typeof data.chargeRatio === 'number') {
                    runVisualOnly(() => {
                        if (typeof remotePlayer.fireStellarBeam === 'function') {
                            remotePlayer.fireStellarBeam(dir, data.chargeRatio);
                        }
                    });
                    return;
                }

                if (data.action === 'attack-melee' || data.action === 'attack-range') {
                    remotePlayer.performAttack();
                } else if (data.action === 'skill') {
                    if (data.class === 'warrior' && data.key === 'shift' && Array.isArray(data.extra?.runicSeals)) {
                        ConvergenceEffects.setRunicJudgmentSealValues(remotePlayer, data.extra.runicSeals);
                    }
                    remotePlayer.useSkill(data.key);
                }
            });
        } 
        
        // IMPORTANT : AUCUN FALLBACK ICI
        // Si remotePlayer est null (ce qui arrive si l'ID est le mien), on ne joue RIEN.
        // Cela empêche l'écho visuel sur le joueur local.
    }
};
