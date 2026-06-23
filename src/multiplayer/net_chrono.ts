// @ts-nocheck
/**
 * État Chronoregent autoritaire (hôte = serveur).
 * Prismes, faisceau, ticks de dégâts — clients envoient des intents uniquement.
 */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { Network } from './network';
import {
  getPlayerByPeerId,
  isServerAuthority,
  isVisualOnlyMode,
} from './net_combat';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { tickChronoTemporalBurns } from '@/gameplay/classes/chrono/temporalBurn';

/** @typedef {{ id: string, x: number, z: number, timer: number, maxTimer: number, version: number }} ChronoLensSnap */
/** @typedef {{ isBeaming: number, aimX: number, aimZ: number, lenses: ChronoLensSnap[] }} ChronoPlayerSnap */

const authByPlayer = Object.create(null);

function ensureAuth(playerId) {
  const id = String(playerId);
  if (!authByPlayer[id]) {
    authByPlayer[id] = {
      lenses: [],
      isBeaming: false,
      aimX: 0,
      aimZ: 1,
      beamTickTimer: 0,
      lensSeq: 0,
      lastLensIntentSeq: -1,
      lastBeamIntentSeq: -1,
    };
  }
  return authByPlayer[id];
}

function vec3FromSnap(x, z) {
  return new THREE.Vector3(x, 0, z).normalize();
}

function getChronoPlayer(playerId) {
  return getPlayerByPeerId(playerId);
}

function isChronoPlayer(p) {
  return p && p.className === 'chronoregulator';
}

function pruneExpiredLenses(auth) {
  auth.lenses = auth.lenses.filter((l) => l.timer > 0);
}

function serializeLenses(lenses) {
  return lenses.map((l) => ({
    id: l.id,
    x: parseFloat(l.pos.x.toFixed(2)),
    z: parseFloat(l.pos.z.toFixed(2)),
    timer: parseFloat(l.timer.toFixed(2)),
    maxTimer: parseFloat((l.maxTimer || l.timer).toFixed(2)),
    version: l.version || 1,
  }));
}

function syncAuthLensesFromPlayer(playerId, player) {
  const auth = ensureAuth(playerId);
  auth.lenses = serializeLenses(player.lenses || []);
}

function applyAuthLensesToPlayer(player, auth) {
  if (!player || typeof player.syncLensesFromNetwork !== 'function') return;
  player.syncLensesFromNetwork(auth.lenses);
}

function resolveExtraPrismLensFlag(player) {
  if (!player) return 0;
  if (player._netExtraPrismLens != null) return player._netExtraPrismLens ? 1 : 0;
  if (player.isLocalPlayer?.()) {
    const p = STATE.passives as Record<string, number> | undefined;
    return (p?.extraPrismLens as number) ? 1 : 0;
  }
  return 0;
}

function applyExtraPrismLensFlag(player, flag) {
  if (!player || flag == null) return;
  player._netExtraPrismLens = flag === 1;
}

function applyBeamStateToPlayer(player, auth) {
  if (!player) return;
  const dir = vec3FromSnap(auth.aimX, auth.aimZ);
  player.netAimDir = dir;
  if (player.mesh && auth.isBeaming) {
    player.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    player.netRotation = player.mesh.rotation.y;
  }
  if (auth.isBeaming && !player.isBeaming && typeof player.startDistortionBeamNetwork === 'function') {
    player.startDistortionBeamNetwork();
  } else if (!auth.isBeaming && player.isBeaming && typeof player.stopDistortionBeamNetwork === 'function') {
    player.stopDistortionBeamNetwork();
  }
}

export const NetChrono = {
  reset() {
    for (const k of Object.keys(authByPlayer)) delete authByPlayer[k];
  },

  /** Snapshot pour world-update (hôte). */
  getPlayerSnapshot(playerId, player) {
    if (!isChronoPlayer(player)) return null;
    const auth = ensureAuth(playerId);
    syncAuthLensesFromPlayer(playerId, player);
    auth.isBeaming = player.isBeaming ? 1 : 0;
    const aim = player.getAimDir ? player.getAimDir() : vec3FromSnap(auth.aimX, auth.aimZ);
    auth.aimX = parseFloat(aim.x.toFixed(3));
    auth.aimZ = parseFloat(aim.z.toFixed(3));
    return {
      isBeaming: auth.isBeaming,
      aimX: auth.aimX,
      aimZ: auth.aimZ,
      lenses: auth.lenses,
      extraPrismLens: resolveExtraPrismLensFlag(player),
    };
  },

  /** Applique l'état répliqué sur un joueur (client ou observateur). */
  applySnapshot(player, snap, isSelf = false) {
    if (!player || !snap || !isChronoPlayer(player)) return;
    applyExtraPrismLensFlag(player, snap.extraPrismLens);
    const auth = {
      isBeaming: snap.isBeaming === 1,
      aimX: snap.aimX ?? 0,
      aimZ: snap.aimZ ?? 1,
      lenses: snap.lenses || [],
    };
    applyAuthLensesToPlayer(player, auth);
    player.netAimDir = vec3FromSnap(auth.aimX, auth.aimZ);

    if (auth.isBeaming && !player.isBeaming) {
      if (typeof player.startDistortionBeamNetwork === 'function') player.startDistortionBeamNetwork();
    } else if (!auth.isBeaming && player.isBeaming) {
      if (typeof player.stopDistortionBeamNetwork === 'function') player.stopDistortionBeamNetwork();
    }

    if (isSelf && !isServerAuthority()) {
      player.fractureGauge = Math.min(player.getFractureCap?.() ?? 100, player.fractureGauge ?? 0);
    }
  },

  /** Client local → envoie intent prisme (clé réseau interne : lens-place). */
  sendLensPlaceIntent(dir) {
    if (!STATE.multiplayer.active || isServerAuthority()) return null;
    const seq = (NetChrono._localLensSeq = (NetChrono._localLensSeq || 0) + 1);
    Network.send({
      type: 'chrono-intent',
      id: STATE.multiplayer.id,
      intent: 'lens-place',
      seq,
      dir: { x: dir.x, y: 0, z: dir.z },
      pos: {
        x: Globals.player?.position.x,
        y: Globals.player?.position.y,
        z: Globals.player?.position.z,
      },
    });
    return seq;
  },

  sendBeamStartIntent(dir) {
    if (!STATE.multiplayer.active) return;
    const seq = (NetChrono._localBeamSeq = (NetChrono._localBeamSeq || 0) + 1);
    if (!isServerAuthority()) {
      Network.send({
        type: 'chrono-intent',
        id: STATE.multiplayer.id,
        intent: 'beam-start',
        seq,
        dir: { x: dir.x, y: 0, z: dir.z },
      });
    }
  },

  sendBeamStopIntent() {
    if (!STATE.multiplayer.active) return;
    const seq = (NetChrono._localBeamSeq = (NetChrono._localBeamSeq || 0) + 1);
    if (!isServerAuthority()) {
      Network.send({
        type: 'chrono-intent',
        id: STATE.multiplayer.id,
        intent: 'beam-stop',
        seq,
      });
    }
  },

  sendBeamAimIntent(dir) {
    if (!STATE.multiplayer.active || isServerAuthority()) return;
    Network.send({
      type: 'chrono-intent',
      id: STATE.multiplayer.id,
      intent: 'beam-aim',
      dir: { x: dir.x, y: 0, z: dir.z },
    });
  },

  /** Hôte : traite un intent entrant. */
  handleIntent(data) {
    if (!STATE.multiplayer.isHost) return;
    const playerId = String(data.id);
    const player = getChronoPlayer(playerId);
    if (!isChronoPlayer(player)) return;

    const auth = ensureAuth(playerId);
    const dir = data.dir
      ? new THREE.Vector3(data.dir.x, 0, data.dir.z).normalize()
      : vec3FromSnap(auth.aimX, auth.aimZ);

    if (data.intent === 'lens-place') {
      if (typeof data.seq === 'number' && data.seq <= auth.lastLensIntentSeq) return;
      auth.lastLensIntentSeq = data.seq ?? auth.lastLensIntentSeq + 1;
      if (player.cooldowns?.space > 0) return;
      player.netAimDir = dir;
      if (typeof player.spawnAuthoritativeLens === 'function') {
        player.spawnAuthoritativeLens({ serverId: `${playerId}_lens_${++auth.lensSeq}` });
      }
      player.cooldowns.space = (player.maxCooldowns?.space || 8)
        * ConstellationEngine.getSkillCdMult('space');
      syncAuthLensesFromPlayer(playerId, player);
      Network.send({ type: 'chrono-intent', ...data, relay: true });
      return;
    }

    if (data.intent === 'beam-start') {
      if (typeof data.seq === 'number' && data.seq <= auth.lastBeamIntentSeq) return;
      auth.lastBeamIntentSeq = data.seq ?? auth.lastBeamIntentSeq + 1;
      auth.aimX = dir.x;
      auth.aimZ = dir.z;
      auth.isBeaming = true;
      auth.beamTickTimer = 0;
      player.netAimDir = dir;
      if (!player.isBeaming && typeof player.startDistortionBeamNetwork === 'function') {
        player.startDistortionBeamNetwork();
      }
      Network.send({ type: 'chrono-intent', ...data, relay: true });
      return;
    }

    if (data.intent === 'beam-stop') {
      auth.isBeaming = false;
      if (player.isBeaming && typeof player.stopDistortionBeamNetwork === 'function') {
        player.stopDistortionBeamNetwork();
      }
      Network.send({ type: 'chrono-intent', ...data, relay: true });
      return;
    }

    if (data.intent === 'beam-aim') {
      auth.aimX = dir.x;
      auth.aimZ = dir.z;
      player.netAimDir = dir;
      if (player.mesh) {
        player.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        player.netRotation = player.mesh.rotation.y;
      }
    }
  },

  /** Hôte : met à jour l'état depuis client-input (position + aim + beaming). */
  ingestClientInput(playerId, data) {
    if (!STATE.multiplayer.isHost || !data.chrono) return;
    const player = getChronoPlayer(playerId);
    if (!isChronoPlayer(player)) return;
    const auth = ensureAuth(playerId);
    const c = data.chrono;
    if (c.aimX != null && c.aimZ != null) {
      auth.aimX = c.aimX;
      auth.aimZ = c.aimZ;
      player.netAimDir = vec3FromSnap(c.aimX, c.aimZ);
    }
    if (c.isBeaming != null) {
      const beaming = c.isBeaming === 1;
      if (beaming && !auth.isBeaming) {
        auth.isBeaming = true;
        auth.beamTickTimer = 0;
        if (!player.isBeaming && typeof player.startDistortionBeamNetwork === 'function') {
          player.startDistortionBeamNetwork();
        }
      } else if (!beaming && auth.isBeaming) {
        auth.isBeaming = false;
        if (player.isBeaming && typeof player.stopDistortionBeamNetwork === 'function') {
          player.stopDistortionBeamNetwork();
        }
      }
    }
    if (c.extraPrismLens != null) {
      applyExtraPrismLensFlag(player, c.extraPrismLens);
    }
  },

  /** Hôte : tick faisceau + prismes pour tous les Chronoregent actifs. */
  tick(dt) {
    if (!isServerAuthority() || isVisualOnlyMode()) return;

    const chronoPlayers = [];
    if (isChronoPlayer(Globals.player)) chronoPlayers.push([String(STATE.multiplayer.id), Globals.player]);
    for (const id in STATE.multiplayer.remotePlayers) {
      const p = STATE.multiplayer.remotePlayers[id];
      if (isChronoPlayer(p)) chronoPlayers.push([id, p]);
    }

    for (const [playerId, player] of chronoPlayers) {
      const auth = ensureAuth(playerId);
      pruneExpiredLenses(auth);

      if (player.lenses) {
        for (let i = player.lenses.length - 1; i >= 0; i--) {
          const lens = player.lenses[i];
          if (lens.timer > 0) lens.timer = Math.max(0, lens.timer - dt);
          if (lens.timer <= 0) {
            if (typeof player.removeLensEntry === 'function') player.removeLensEntry(lens);
            player.lenses.splice(i, 1);
          }
        }
      }
      syncAuthLensesFromPlayer(playerId, player);

      if (!player.isBeaming) {
        auth.beamTickTimer = 0;
        continue;
      }

      auth.isBeaming = true;
      const aim = player.getAimDir ? player.getAimDir() : vec3FromSnap(auth.aimX, auth.aimZ);
      auth.aimX = aim.x;
      auth.aimZ = aim.z;

      if (player.isLocalPlayer?.()) {
        player.addFracture?.(dt, player.getBeamHitOrigin?.(), aim);
      }

      const interval = player.getBeamTickInterval?.() ?? 0.34;
      auth.beamTickTimer -= dt;
      if (auth.beamTickTimer <= 0) {
        player.tickDistortionBeam?.();
        auth.beamTickTimer = interval;
      }

      if (player.isBeaming && typeof player.refreshBeamVisuals === 'function') {
        player.refreshBeamVisuals();
      }
    }

    tickChronoTemporalBurns(dt);
  },

  /** Client : met à jour visuels faisceau distants. */
  tickRemoteVisuals(dt) {
    for (const id in STATE.multiplayer.remotePlayers) {
      const p = STATE.multiplayer.remotePlayers[id];
      if (!isChronoPlayer(p) || p.isLocalPlayer?.()) continue;
      if (p.isBeaming && typeof p.refreshBeamVisuals === 'function') {
        p.refreshBeamVisuals();
        p.updateElectricBeamFx?.(dt);
      } else if (!p.isBeaming && p.beamVisuals?.length) {
        p.destroyBeamVisuals?.();
      }
    }
  },
};

export default NetChrono;
