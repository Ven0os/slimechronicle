// @ts-nocheck
/**
 * État mécaniques de classe autoritaire (hôte) + réplication world-update.
 */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { ConvergenceEffects } from '@/systems/convergenceEffects';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { isServerAuthority } from './net_combat';
import { getPlayerByPeerId } from './net_combat';
import { NetAuthority, serverNowMs } from './net_authority';
import { dealDamageToEnemy } from '@/gameplay/combat/damage_helpers';

type PacifierState = { shotIndex: number };
type EclipseState = {
  empoweredLeft: number;
  cataclysmUntil: number;
  nextIsSun: number;
  sun: number;
  moon: number;
};
type MageState = { paradoxKills: number };
type WarriorState = { parryBlocked: number };

type ClassMechState = {
  pacifier?: PacifierState;
  eclipse?: EclipseState;
  mage?: MageState;
  warrior?: WarriorState;
  version: number;
};

const byPlayer = Object.create(null) as Record<string, ClassMechState>;
let serverTick = 0;

function ensure(playerId: string): ClassMechState {
  const id = String(playerId);
  if (!byPlayer[id]) {
    byPlayer[id] = { version: 0 };
  }
  return byPlayer[id];
}

function ensurePacifier(s: ClassMechState): PacifierState {
  if (!s.pacifier) s.pacifier = { shotIndex: 0 };
  return s.pacifier;
}

function ensureEclipse(s: ClassMechState): EclipseState {
  if (!s.eclipse) {
    s.eclipse = {
      empoweredLeft: 0,
      cataclysmUntil: 0,
      nextIsSun: 1,
      sun: 0,
      moon: 0,
    };
  }
  return s.eclipse;
}

function ensureMage(s: ClassMechState): MageState {
  if (!s.mage) s.mage = { paradoxKills: 0 };
  return s.mage;
}

function playerIdOf(player: { userData?: { id?: string } } | null): string | null {
  if (!player) return null;
  if (player === Globals.player) return String(STATE.multiplayer.id);
  if (player.userData?.id) return String(player.userData.id);
  return null;
}

function readPlayerIntoAuth(playerId: string, player: Record<string, unknown>) {
  const s = ensure(playerId);
  if (player.className === 'pacifier') {
    const p = ensurePacifier(s);
    p.shotIndex = (player._convergenceShotIndex as number) || p.shotIndex;
  }
  if (player.className === 'eclipse' && player.eclipse) {
    const e = player.eclipse as { sun: number; moon: number; nextIsSun: boolean };
    const es = ensureEclipse(s);
    es.sun = e.sun ?? es.sun;
    es.moon = e.moon ?? es.moon;
    es.nextIsSun = e.nextIsSun ? 1 : 0;
    es.empoweredLeft = (player._empoweredAttacksLeft as number) ?? es.empoweredLeft;
    es.cataclysmUntil = (player._cataclysmHasteUntil as number) ?? es.cataclysmUntil;
  }
  if (player.className === 'mage') {
    const m = ensureMage(s);
    m.paradoxKills = (STATE.passives?._paradoxKillCount as number) ?? m.paradoxKills;
  }
}

function applyAuthToPlayer(player: Record<string, unknown>, snap: ClassMechState) {
  if (!player || !snap) return;
  if (snap.pacifier && player.className === 'pacifier') {
    player._convergenceShotIndex = snap.pacifier.shotIndex;
  }
  if (snap.eclipse && player.className === 'eclipse') {
    player._empoweredAttacksLeft = snap.eclipse.empoweredLeft;
    player._cataclysmHasteUntil = snap.eclipse.cataclysmUntil;
    if (!player.eclipse) player.eclipse = { sun: 0, moon: 0, nextIsSun: true, active: false };
    const ec = player.eclipse as { sun: number; moon: number; nextIsSun: boolean };
    ec.sun = snap.eclipse.sun;
    ec.moon = snap.eclipse.moon;
    ec.nextIsSun = snap.eclipse.nextIsSun === 1;
  }
  if (snap.mage && player.className === 'mage') {
    if (!STATE.passives) STATE.passives = {};
    STATE.passives._paradoxKillCount = snap.mage.paradoxKills;
  }
}

export const NetClassState = {
  tick(dt: number) {
    if (!isServerAuthority()) return;
    serverTick += 1;

    const players: Array<[string, Record<string, unknown>]> = [];
    if (Globals.player) players.push([String(STATE.multiplayer.id), Globals.player]);
    for (const id in STATE.multiplayer.remotePlayers) {
      const p = STATE.multiplayer.remotePlayers[id];
      if (p) players.push([id, p]);
    }

    for (const [id, p] of players) {
      readPlayerIntoAuth(id, p);
      if (p.className === 'blade') {
        ConvergenceEffects.syncBladeThirstCrit(p);
      }
    }
  },

  getServerTick() {
    return serverTick;
  },

  /** Snapshot compact pour world-update. */
  getSnapshot(playerId: string, player: Record<string, unknown>) {
    if (!player?.className) return null;
    readPlayerIntoAuth(playerId, player);
    const s = ensure(playerId);
    s.version += 1;

    const out: Record<string, unknown> = { v: s.version };
    if (player.className === 'pacifier' && s.pacifier) {
      out.pacifier = { si: s.pacifier.shotIndex };
    }
    if (player.className === 'eclipse' && s.eclipse) {
      out.eclipse = {
        el: s.eclipse.empoweredLeft,
        cu: s.eclipse.cataclysmUntil,
        ns: s.eclipse.nextIsSun,
        sun: s.eclipse.sun,
        moon: s.eclipse.moon,
      };
    }
    if (player.className === 'mage' && s.mage) {
      out.mage = { pk: s.mage.paradoxKills };
    }
    return out;
  },

  applySnapshot(player: Record<string, unknown>, snap: Record<string, unknown> | null | undefined) {
    if (!player || !snap) return;
    const s = ensure(playerIdOf(player) || 'local');
    if (typeof snap.v === 'number' && snap.v < s.version) return;

    if (snap.pacifier) {
      ensurePacifier(s).shotIndex = snap.pacifier.si ?? 0;
    }
    if (snap.eclipse) {
      const es = ensureEclipse(s);
      es.empoweredLeft = snap.eclipse.el ?? 0;
      es.cataclysmUntil = snap.eclipse.cu ?? 0;
      es.nextIsSun = snap.eclipse.ns ?? 1;
      es.sun = snap.eclipse.sun ?? 0;
      es.moon = snap.eclipse.moon ?? 0;
    }
    if (snap.mage) {
      ensureMage(s).paradoxKills = snap.mage.pk ?? 0;
    }
    s.version = snap.v ?? s.version;
    applyAuthToPlayer(player, s);
  },

  /** Hôte : autorise un tir Pacificateur, retourne index AVANT incrément (pour mega crit). */
  authorizePacifierShot(playerId: string): number {
    const s = ensure(playerId);
    const p = ensurePacifier(s);
    const idx = p.shotIndex;
    p.shotIndex += 1;
    s.version += 1;
    const player = getPlayerByPeerId(playerId);
    if (player) player._convergenceShotIndex = p.shotIndex;
    return idx;
  },

  /** Preview côté client depuis état répliqué. */
  getPacifierShotIndex(player: { _convergenceShotIndex?: number }): number {
    return (player?._convergenceShotIndex as number) || 0;
  },

  /** Hôte : consomme une attaque renforcée Éclipse. */
  consumeEmpoweredAttack(playerId: string): boolean {
    const s = ensure(playerId);
    const es = ensureEclipse(s);
    if (es.empoweredLeft <= 0) return false;
    es.empoweredLeft -= 1;
    s.version += 1;
    const player = getPlayerByPeerId(playerId);
    if (player) player._empoweredAttacksLeft = es.empoweredLeft;
    return true;
  },

  onEclipseCataclysm(playerId: string, player: Record<string, unknown>) {
    const s = ensure(playerId);
    const es = ensureEclipse(s);
    es.empoweredLeft = 6;
    es.cataclysmUntil = serverNowMs() + 5000;
    s.version += 1;
    if (player) {
      player._empoweredAttacksLeft = 6;
      player._cataclysmHasteUntil = es.cataclysmUntil;
    }
    ConvergenceEffects.onEclipseCataclysm(player);
  },

  getEclipseAttackSpeedMult(player: { _cataclysmHasteUntil?: number }): number {
    if (!player?._cataclysmHasteUntil || serverNowMs() > player._cataclysmHasteUntil) return 1;
    return ConstellationEngine.isApexPassiveActive('celestialConvergence', 'eclipse') ? 1.5 : 1;
  },

  /** Hôte : compteur kills paradoxe mage. */
  onParadoxKill(playerId: string) {
    if (!ConstellationEngine.isApexPassiveActive('paradoxOverload', 'mage')) return;
    const s = ensure(playerId);
    const m = ensureMage(s);
    m.paradoxKills += 1;
    s.version += 1;
    if (!STATE.passives) STATE.passives = {};
    STATE.passives._paradoxKillCount = m.paradoxKills;
    if (m.paradoxKills % 5 !== 0) return;
    ConvergenceEffects.onParadoxKill(getPlayerByPeerId(playerId));
  },

  /** Hôte : résout une attaque mêlée générique depuis intent. */
  resolveMeleeHit(
    playerId: string,
    pos: THREE.Vector3,
    dir: THREE.Vector3,
    range: number,
    baseDmg: number,
    dotThreshold = 0.4,
  ) {
    if (!isServerAuthority()) return;
    if (!Globals.enemies) return;
    const flatDir = dir.clone();
    flatDir.y = 0;
    if (flatDir.lengthSq() < 0.001) return;
    flatDir.normalize();

    for (const e of Globals.enemies) {
      if (e.dead) continue;
      const toE = e.position.clone().sub(pos);
      toE.y = 0;
      const dist = toE.length();
      if (dist > range) continue;
      toE.normalize();
      if (toE.dot(flatDir) < dotThreshold) continue;
      dealDamageToEnemy(e, baseDmg, {
        pos: e.position,
        maxRange: range + 2,
      });
    }
  },

  reset() {
    for (const k of Object.keys(byPlayer)) delete byPlayer[k];
    serverTick = 0;
  },

  /** Hôte : traite skill-intent générique. */
  handleSkillIntent(data: Record<string, unknown>) {
    if (!isServerAuthority()) return;
    const playerId = String(data.id);
    const player = getPlayerByPeerId(playerId);
    if (!player) return;

    const dir = data.dir
      ? new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z)
      : new THREE.Vector3(0, 0, 1);
    dir.y = 0;
    if (dir.lengthSq() > 0.001) dir.normalize();

    const pos = data.pos
      ? new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z)
      : player.position;

    const intent = data.intent as string;
    const skillKey = (data.skillKey as string) || 'primary';

    if (intent === 'basic-attack' || intent === 'attack-melee') {
      if (player.className === 'warrior') {
        this.resolveMeleeHit(playerId, pos, dir, 4.5, ConstellationEngine.calcWarriorSkillDamage('primary'));
      } else if (player.className === 'pacifier') {
        this.resolveMeleeHit(playerId, pos, dir, 3.5, STATE.stats.atk * 1.5);
      } else if (player.className === 'blade') {
        this.resolveMeleeHit(playerId, pos, dir, 3.5, player.getBladeDamage?.('primary', 1) ?? STATE.stats.atk);
      }
      return;
    }

    if (intent === 'attack-range' && player.className === 'pacifier') {
      this.resolvePacifierShot(playerId, pos, dir);
      return;
    }

    if (intent === 'eclipse-attack') {
      this.resolveEclipseBasicAttack(playerId, player, pos, dir);
      return;
    }

    NetAuthority.logAuthViolation('client_gameplay_authority', `Unhandled skill-intent: ${intent}`, { skillKey });
  },

  resolvePacifierShot(playerId: string, pos: THREE.Vector3, dir: THREE.Vector3) {
    if (!Globals.enemies) return;
    const maxDist = 20;
    const shotIdx = this.authorizePacifierShot(playerId);
    const megaCrit = ConvergenceEffects.isMegaCritShot(shotIdx);
    const pDmg = ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 1.8, { skill: false });

    const flatDir = dir.clone();
    flatDir.y = 0;
    flatDir.normalize();

    let closestHit = null;
    let closestDist = maxDist;

    for (const e of Globals.enemies) {
      if (e.dead) continue;
      const ex = e.position.x - pos.x;
      const ez = e.position.z - pos.z;
      const dist = Math.sqrt(ex * ex + ez * ez);
      if (dist >= maxDist) continue;
      const projectedDist = ex * flatDir.x + ez * flatDir.z;
      if (projectedDist <= 0) continue;
      const perpDistSq = Math.max(0, dist * dist - projectedDist * projectedDist);
      if (Math.sqrt(perpDistSq) < 1.5 && dist < closestDist) {
        closestDist = dist;
        closestHit = e;
      }
    }

    if (closestHit) {
      dealDamageToEnemy(closestHit, pDmg, {
        pos: closestHit.position,
        megaCrit,
        maxRange: maxDist + 2,
        skillKey: 'primary',
      });
    }
  },

  resolveEclipseBasicAttack(
    playerId: string,
    player: Record<string, unknown>,
    pos: THREE.Vector3,
    dir: THREE.Vector3,
  ) {
    const empowered = this.consumeEmpoweredAttack(playerId);
    const empMult = empowered ? 1.3 : 1;
    const s = ensure(playerId);
    const eState = ensureEclipse(s);

    const fireSun = empowered || eState.nextIsSun === 1;
    const fireMoon = empowered || eState.nextIsSun === 0;

    if (fireSun) {
      this.resolveMeleeHit(playerId, pos, dir, 3.5, STATE.stats.atk * empMult, 0.4);
      eState.sun = Math.min(100, eState.sun + 10);
      if (!empowered) eState.nextIsSun = 0;
    }
    if (fireMoon) {
      this.resolveMeleeHit(playerId, pos, dir, 3.5, STATE.stats.atk * 1.2 * empMult, 0.4);
      eState.moon = Math.min(100, eState.moon + 10);
      if (!empowered) eState.nextIsSun = 1;
    }
    s.version += 1;
    applyAuthToPlayer(player, s);
  },
};

export default NetClassState;
