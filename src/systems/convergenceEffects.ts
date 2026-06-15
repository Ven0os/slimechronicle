// @ts-nocheck
/** Effets de Convergence stellaire (centre constellation) — gameplay uniquement. */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import * as THREE from 'three';
import { getPlayerDefense } from '@/gameplay/combat/defense';
import { CHRONO_FRACTURE, CHRONO_SKILLS } from '@/gameplay/classes/chrono/constants';
import {
  getFractureBeamSizeMult as computeFractureBeamSizeMult,
  getFractureDamageMult as computeFractureDamageMult,
  getFractureOverheatAt,
  getMaxFracture as resolveMaxFracture,
  isChronoFractureApexActive,
} from '@/gameplay/classes/chrono/fractureHelpers';
import { createDamageText, createSkillVisual, spawnParticles } from '@/visual/effects';
import { openEclipseCataclysmWindow } from '@/gameplay/classes/eclipse/eclipseRupture';

/** Passif Apex unique par classe — doit correspondre au nœud `{class}-apex`. */
export const APEX_PASSIVE_BY_CLASS: Record<string, string> = {
  warrior: 'runicColossus',
  mage: 'paradoxOverload',
  sentinel: 'solarInspiration',
  blade: 'eternalThirst',
  pacifier: 'bloodPact',
  eclipse: 'celestialConvergence',
  chronoregulator: 'continuumMastery',
};

export function isApexNodeUnlocked(classId = STATE.class): boolean {
  if (!classId) return false;
  return STATE.unlockedNodes?.includes(`${classId}-apex`) ?? false;
}

/** Apex Chronoregent actif : classe chrono + Apex débloqué ou passif continuumMastery ≥ 2. */
export function isChronoApexActive(): boolean {
  return isChronoFractureApexActive();
}

/** Rang effectif du passif Apex : 0 si nœud verrouillé, mauvaise classe, ou rang insuffisant. */
export function getApexPassiveRank(passiveKey: string, classId = STATE.class): number {
  const r = (STATE.passives?.[passiveKey] as number) || 0;
  if (r < 2) return 0;
  if (!classId || APEX_PASSIVE_BY_CLASS[classId] !== passiveKey) return 0;
  if (!isApexNodeUnlocked(classId)) return 0;
  return r;
}

function rank(key: string): number {
  const classId = Globals.player?.className || STATE.class;
  return getApexPassiveRank(key, classId);
}

function passives() {
  if (!STATE.passives) STATE.passives = {};
  return STATE.passives as Record<string, unknown>;
}

const PARADOX_STAT_KEYS = ['atk', 'maxHp', 'speed', 'crit', 'critDmg', 'defense', 'regen', 'lifesteal'] as const;
const HEMOCYCLE_MAX_MARKS = 6;
const HEMOCYCLE_STORE_RATIO = 0.2;
const HEMOCYCLE_TARGET_MAX_HP_RATIO = 0.01;
const HEMOCYCLE_LIFESTEAL_TO_DAMAGE = 0.5;
const RUNIC_JUDGMENT_MAX_SEALS = 5;
const RUNIC_JUDGMENT_STORE_RATIO = 2.5;
const RUNIC_JUDGMENT_RELEASE_RATIO = 1.5;
const BLADE_BREAKPOINT_HP_THRESHOLD = 0.1;
const BLADE_BREAKPOINT_MAX_MISSING_HP = 0.9;
const BLADE_BREAKPOINT_CRIT_PER_MISSING = 0.003;
const BLADE_BREAKPOINT_CRIT_DMG_PER_MISSING = 0.0066;
const BLADE_BREAKPOINT_CD_MS = 15000;
const BLADE_BREAKPOINT_EXEC_HEAL = 0.125;
const BLADE_BLOOD_THIRST_BASE_CAP = 1;
const BLADE_BLOOD_THIRST_APEX_RATE = 2;
const BLADE_BLOOD_THIRST_APEX_CAP = 1.2;

type HemocycleEnemy = {
  _hemocycleMarks?: number;
  _hemocycleStoredChunks?: number[];
  _hemocycleMarkVisuals?: THREE.Object3D[];
  mesh?: THREE.Object3D;
  position?: THREE.Vector3;
  radius?: number;
  maxHp?: number;
  dead?: boolean;
};

type RunicJudgmentSeal = { stored: number };

type RunicJudgmentPlayer = {
  className?: string;
  position?: THREE.Vector3;
  bodyGroup?: THREE.Object3D;
  mesh?: THREE.Object3D;
  _runicJudgmentSeals?: RunicJudgmentSeal[];
  _runicJudgmentVisualGroup?: THREE.Group;
  _runicJudgmentVisualCount?: number;
  _runicJudgmentOrbitTime?: number;
};

type BladeBreakpointPlayer = {
  hp: number;
  maxHp: number;
  className?: string;
  cooldowns?: Record<string, number>;
  heal?: (n: number) => void;
  position?: THREE.Vector3;
  _bladeBreakpointCdUntil?: number;
  _bladeBreakpointSkillKey?: string;
  _bladeBreakpointSkillUntil?: number;
  _bladeBreakpointExecutionUsed?: boolean;
};

function isHemocycleActive(player?: { className?: string } | null): boolean {
  const classId = player?.className || Globals.player?.className || STATE.class;
  return classId === 'pacifier' && getApexPassiveRank('bloodPact', classId) >= 2;
}

function getHemocycleChunks(enemy: HemocycleEnemy): number[] {
  if (!enemy._hemocycleStoredChunks) enemy._hemocycleStoredChunks = [];
  return enemy._hemocycleStoredChunks;
}

function getHemocycleStored(enemy: HemocycleEnemy | null | undefined): number {
  if (!enemy) return 0;
  return getHemocycleChunks(enemy).reduce((sum, val) => sum + val, 0);
}

function calcHemocycleStoredChunk(enemy: HemocycleEnemy, dealtDamage: number): number {
  const damageStored = Math.max(0, dealtDamage) * HEMOCYCLE_STORE_RATIO;
  const maxHpBonus = Math.max(0, enemy.maxHp || 0) * HEMOCYCLE_TARGET_MAX_HP_RATIO;
  return damageStored + maxHpBonus;
}

function disposeHemocycleObject(obj: THREE.Object3D) {
  obj.traverse((child: THREE.Object3D & { geometry?: { dispose?: () => void }; material?: unknown }) => {
    child.geometry?.dispose?.();
    const mat = child.material;
    if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
    else mat?.dispose?.();
  });
}

function clearHemocycleVisuals(enemy: HemocycleEnemy | null | undefined) {
  if (!enemy?._hemocycleMarkVisuals?.length) return;
  for (const obj of enemy._hemocycleMarkVisuals) {
    obj.parent?.remove(obj);
    disposeHemocycleObject(obj);
  }
  enemy._hemocycleMarkVisuals = [];
}

function createHemocycleDrop(index: number, count: number, enemy: HemocycleEnemy): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff345f,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff6b8a,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), mat);
  orb.scale.set(0.85, 1.1, 0.85);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 10), mat);
  tip.rotation.x = Math.PI;
  tip.position.y = -0.095;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), glowMat);

  group.add(glow, orb, tip);
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(1, count);
  const radius = Math.max(0.55, (enemy.radius || 1) * 0.72);
  const height = Math.max(0.95, (enemy.radius || 1) * 1.35) + (index % 2) * 0.12;
  group.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  group.userData.hemocycleDrop = true;
  return group;
}

function refreshHemocycleVisuals(enemy: HemocycleEnemy | null | undefined) {
  if (!enemy) return;
  clearHemocycleVisuals(enemy);
  const marks = Math.min(HEMOCYCLE_MAX_MARKS, Math.max(0, Math.floor(enemy._hemocycleMarks || 0)));
  if (!marks || !enemy.mesh) return;
  enemy._hemocycleMarkVisuals = [];
  for (let i = 0; i < marks; i++) {
    const drop = createHemocycleDrop(i, marks, enemy);
    enemy.mesh.add(drop);
    enemy._hemocycleMarkVisuals.push(drop);
  }
}

function syncHemocycleFocus(player: Record<string, unknown> | null | undefined, enemy?: HemocycleEnemy | null) {
  if (!player) return;
  const marks = enemy ? Math.min(HEMOCYCLE_MAX_MARKS, Math.max(0, enemy._hemocycleMarks || 0)) : 0;
  player._hemocycleFocusMarks = marks;
  player._hemocycleFocusStored = enemy ? getHemocycleStored(enemy) : 0;
}

function isRunicJudgmentActive(player?: { className?: string } | null): boolean {
  const classId = player?.className || Globals.player?.className || STATE.class;
  return classId === 'warrior' && getApexPassiveRank('runicColossus', classId) >= 2;
}

function getRunicSeals(player: RunicJudgmentPlayer | null | undefined): RunicJudgmentSeal[] {
  if (!player) return [];
  if (!player._runicJudgmentSeals) player._runicJudgmentSeals = [];
  player._runicJudgmentSeals = player._runicJudgmentSeals
    .map((seal) => ({ stored: Math.max(0, Number(seal?.stored) || 0) }))
    .filter((seal) => seal.stored > 0)
    .slice(0, RUNIC_JUDGMENT_MAX_SEALS);
  return player._runicJudgmentSeals;
}

function disposeRunicObject(obj: THREE.Object3D) {
  obj.traverse((child: THREE.Object3D & { geometry?: { dispose?: () => void }; material?: unknown }) => {
    child.geometry?.dispose?.();
    const mat = child.material;
    if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
    else mat?.dispose?.();
  });
}

function createRunicSealVisual(index: number, count: number, stored: number): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xd4af37,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffd86b,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), mat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 24), mat);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), glowMat);
  ring.rotation.x = Math.PI / 2;
  group.add(glow, core, ring);

  const angle = (Math.PI * 2 * index) / Math.max(1, count);
  const radius = 1.0;
  const y = 1.25 + Math.sin(index * 1.7) * 0.12;
  group.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  group.userData.runicSealStored = stored;
  return group;
}

function clearRunicJudgmentVisuals(player: RunicJudgmentPlayer | null | undefined) {
  const group = player?._runicJudgmentVisualGroup;
  if (!group) return;
  group.parent?.remove(group);
  disposeRunicObject(group);
  player._runicJudgmentVisualGroup = undefined;
  player._runicJudgmentVisualCount = 0;
}

function refreshRunicJudgmentVisuals(player: RunicJudgmentPlayer | null | undefined) {
  if (!player) return;
  const seals = getRunicSeals(player);
  const root = player.bodyGroup || player.mesh;
  if (!root || !seals.length) {
    clearRunicJudgmentVisuals(player);
    return;
  }

  if (!player._runicJudgmentVisualGroup) {
    player._runicJudgmentVisualGroup = new THREE.Group();
    player._runicJudgmentVisualGroup.name = 'runicJudgmentSeals';
    root.add(player._runicJudgmentVisualGroup);
  } else if (player._runicJudgmentVisualGroup.parent !== root) {
    player._runicJudgmentVisualGroup.parent?.remove(player._runicJudgmentVisualGroup);
    root.add(player._runicJudgmentVisualGroup);
  }

  const group = player._runicJudgmentVisualGroup;
  while (group.children.length) {
    const child = group.children.pop();
    if (child) disposeRunicObject(child);
  }
  seals.forEach((seal, index) => group.add(createRunicSealVisual(index, seals.length, seal.stored)));
  player._runicJudgmentVisualCount = seals.length;
}

export const ConvergenceEffects = {
  isChronoApexActive,

  // ——— Pacificateur : Hémocycle ———
  applyPacifierConvergenceStats() {
    const p = passives();
    if (p._pacifierBaseCritDmg != null) {
      STATE.stats.critDmg = p._pacifierBaseCritDmg as number;
      delete p._pacifierBaseCritDmg;
    }
  },

  isPacifierHemocycleActive(player?: { className?: string } | null): boolean {
    return isHemocycleActive(player);
  },

  getHemocycleMaxMarks(): number {
    return HEMOCYCLE_MAX_MARKS;
  },

  getHemocycleBloodPistolDamageMult(player?: { className?: string } | null): number {
    if (!isHemocycleActive(player)) return 1;
    return 1 + Math.max(0, STATE.stats.lifesteal || 0) * HEMOCYCLE_LIFESTEAL_TO_DAMAGE;
  },

  isHemocycleReady(enemy: HemocycleEnemy | null | undefined, player?: { className?: string } | null): boolean {
    if (!enemy || !isHemocycleActive(player)) return false;
    return (enemy._hemocycleMarks || 0) >= HEMOCYCLE_MAX_MARKS;
  },

  applyHemocycleMark(enemy: HemocycleEnemy | null | undefined, dealtDamage: number, player?: Record<string, unknown> | null) {
    if (!enemy || enemy.dead || !isHemocycleActive(player as { className?: string } | null) || dealtDamage <= 0) {
      return { marks: 0, stored: 0, ready: false };
    }

    if ((enemy._hemocycleMarks || 0) >= HEMOCYCLE_MAX_MARKS) {
      syncHemocycleFocus(player, enemy);
      return { marks: enemy._hemocycleMarks || 0, stored: getHemocycleStored(enemy), ready: true };
    }

    const chunks = getHemocycleChunks(enemy);
    enemy._hemocycleMarks = Math.min(HEMOCYCLE_MAX_MARKS, (enemy._hemocycleMarks || 0) + 1);
    chunks.push(calcHemocycleStoredChunk(enemy, dealtDamage));
    while (chunks.length > enemy._hemocycleMarks) chunks.shift();
    refreshHemocycleVisuals(enemy);
    syncHemocycleFocus(player, enemy);

    spawnParticles(enemy.position, 0xff345f, 4);
    if (enemy._hemocycleMarks >= HEMOCYCLE_MAX_MARKS) {
      createDamageText('6/6 MARQUES', enemy.position, '#ff6b8a');
      createSkillVisual('shockwave', enemy.position, 1.8, 0xff345f);
    }

    return {
      marks: enemy._hemocycleMarks,
      stored: getHemocycleStored(enemy),
      ready: enemy._hemocycleMarks >= HEMOCYCLE_MAX_MARKS,
    };
  },

  consumeHemocycle(enemy: HemocycleEnemy | null | undefined, player?: Record<string, unknown> | null): number[] {
    if (!enemy || !isHemocycleActive(player as { className?: string } | null)) return [];
    if ((enemy._hemocycleMarks || 0) < HEMOCYCLE_MAX_MARKS) {
      syncHemocycleFocus(player, enemy);
      return [];
    }

    const chunks = getHemocycleChunks(enemy).filter((v) => v > 0);
    enemy._hemocycleMarks = 0;
    enemy._hemocycleStoredChunks = [];
    clearHemocycleVisuals(enemy);
    syncHemocycleFocus(player, null);

    createDamageText('HÉMOCYCLE', enemy.position, '#ff4d6d');
    createSkillVisual('explosion', enemy.position, 1.65, 0xff0033);
    spawnParticles(enemy.position, 0xff345f, 18);
    return chunks;
  },

  getHemocycleSummary(player?: Record<string, unknown> | null) {
    const marks = Math.min(HEMOCYCLE_MAX_MARKS, Math.max(0, (player?._hemocycleFocusMarks as number) || 0));
    const stored = Math.max(0, (player?._hemocycleFocusStored as number) || 0);
    return {
      marks,
      stored,
      max: HEMOCYCLE_MAX_MARKS,
      ready: marks >= HEMOCYCLE_MAX_MARKS,
    };
  },

  clearPacifierHemocycleState(player?: Record<string, unknown> | null) {
    syncHemocycleFocus(player, null);
    Globals.enemies?.forEach((enemy: HemocycleEnemy) => {
      enemy._hemocycleMarks = 0;
      enemy._hemocycleStoredChunks = [];
      clearHemocycleVisuals(enemy);
    });
  },

  /** @deprecated Hémocycle remplace l'ancien compteur Méga-Crit. */
  getPacifierShotIndex(player: { _convergenceShotIndex?: number }): number {
    if (STATE.multiplayer.active) {
      return (player?._convergenceShotIndex as number) || 0;
    }
    const idx = player?._convergenceShotIndex || 0;
    if (player) player._convergenceShotIndex = idx + 1;
    return idx;
  },

  /** @deprecated Hémocycle ne force plus de Méga-Crit. */
  isMegaCritShot(shotIndex: number): boolean {
    return false;
  },

  getMegaCritMult(): number {
    return 1.5;
  },

  /** @deprecated Conservé pour compatibilité HUD ancien. */
  getPacifierShotsUntilMegaCrit(player: { _convergenceShotIndex?: number }): number {
    return 0;
  },

  // ——— Guerrier : Jugement Runique ———
  isRunicJudgmentActive(player?: { className?: string } | null): boolean {
    return isRunicJudgmentActive(player);
  },

  getRunicJudgmentMaxSeals(): number {
    return RUNIC_JUDGMENT_MAX_SEALS;
  },

  getRunicJudgmentReleaseRatio(): number {
    return RUNIC_JUDGMENT_RELEASE_RATIO;
  },

  getRunicJudgmentSealValues(player?: RunicJudgmentPlayer | null): number[] {
    return getRunicSeals(player).map((seal) => seal.stored);
  },

  setRunicJudgmentSealValues(player: RunicJudgmentPlayer | null | undefined, values: number[] = []) {
    if (!player) return;
    player._runicJudgmentSeals = values
      .map((stored) => ({ stored: Math.max(0, Number(stored) || 0) }))
      .filter((seal) => seal.stored > 0)
      .slice(0, RUNIC_JUDGMENT_MAX_SEALS);
    refreshRunicJudgmentVisuals(player);
  },

  addRunicJudgmentSeal(player: RunicJudgmentPlayer | null | undefined, blockedDamage: number) {
    if (!player || !isRunicJudgmentActive(player) || blockedDamage <= 0) {
      return { count: 0, totalStored: 0, max: RUNIC_JUDGMENT_MAX_SEALS };
    }
    const seals = getRunicSeals(player);
    if (seals.length >= RUNIC_JUDGMENT_MAX_SEALS) {
      return this.getRunicJudgmentSummary(player);
    }

    const stored = blockedDamage * RUNIC_JUDGMENT_STORE_RATIO;
    seals.push({ stored });
    refreshRunicJudgmentVisuals(player);
    if (player.position) {
      createDamageText(`SCEAU ${seals.length}/${RUNIC_JUDGMENT_MAX_SEALS}`, player.position, '#ffd86b');
      spawnParticles(player.position, 0xd4af37, 8);
    }
    return this.getRunicJudgmentSummary(player);
  },

  consumeRunicJudgmentSeals(player: RunicJudgmentPlayer | null | undefined): number[] {
    if (!player || !isRunicJudgmentActive(player)) return [];
    const values = getRunicSeals(player).map((seal) => seal.stored);
    player._runicJudgmentSeals = [];
    refreshRunicJudgmentVisuals(player);
    if (values.length && player.position) {
      createDamageText('JUGEMENT RUNIQUE', player.position, '#ffd86b');
      createSkillVisual('shockwave', player.position, 4.5, 0xd4af37);
      spawnParticles(player.position, 0xd4af37, 20);
    }
    return values;
  },

  getRunicJudgmentSummary(player?: RunicJudgmentPlayer | null) {
    const seals = getRunicSeals(player);
    const totalStored = seals.reduce((sum, seal) => sum + seal.stored, 0);
    return {
      count: seals.length,
      totalStored,
      max: RUNIC_JUDGMENT_MAX_SEALS,
      perfectReady: seals.length === RUNIC_JUDGMENT_MAX_SEALS,
      nextDamage: totalStored * RUNIC_JUDGMENT_RELEASE_RATIO,
    };
  },

  findRunicJudgmentTargets(origin: THREE.Vector3, count: number, range = 18): Array<unknown> {
    if (!origin || count <= 0) return [];
    const enemies = (Globals.enemies || [])
      .filter((e) => e && !e.dead && e.position?.distanceTo(origin) <= range)
      .sort((a, b) => a.position.distanceTo(origin) - b.position.distanceTo(origin));
    if (!enemies.length) return [];
    return Array.from({ length: count }, (_, index) => enemies[index % enemies.length]);
  },

  tickRunicJudgmentVisuals(player: RunicJudgmentPlayer | null | undefined, dt = 0) {
    if (!player || !isRunicJudgmentActive(player)) {
      clearRunicJudgmentVisuals(player);
      return;
    }
    const seals = getRunicSeals(player);
    if (player._runicJudgmentVisualCount !== seals.length) {
      refreshRunicJudgmentVisuals(player);
    }
    const group = player._runicJudgmentVisualGroup;
    if (!group) return;
    player._runicJudgmentOrbitTime = (player._runicJudgmentOrbitTime || 0) + dt;
    group.rotation.y += dt * 1.6;
    group.children.forEach((child, index) => {
      child.rotation.y -= dt * 2.2;
      const pulse = 1 + Math.sin((player._runicJudgmentOrbitTime || 0) * 5 + index) * 0.08;
      child.scale.setScalar(pulse);
    });
  },

  clearRunicJudgmentState(player?: RunicJudgmentPlayer | null) {
    if (!player) return;
    player._runicJudgmentSeals = [];
    clearRunicJudgmentVisuals(player);
  },

  /** @deprecated Jugement Runique remplace l'ancien renvoi de Parade. */
  calcParryReflectDamage(blocked: number): number {
    return 0;
  },

  // ——— Mage : Récompense paradoxale ———
  onParadoxKill(player = Globals.player) {
    if (rank('paradoxOverload') < 2 || !player) return;
    const p = passives();
    const kills = ((p._paradoxKillCount as number) || 0) + 1;
    p._paradoxKillCount = kills;

    if (kills % 5 !== 0) return;

    const statKey = PARADOX_STAT_KEYS[Math.floor(Math.random() * PARADOX_STAT_KEYS.length)];
    const bonus = 0.0001 + Math.random() * 0.0008;
    const rewards = (p._paradoxRewards as Record<string, number>) || {};
    rewards[statKey] = (rewards[statKey] || 0) + bonus;
    p._paradoxRewards = rewards;

    if (statKey === 'maxHp') STATE.stats.maxHp = Math.floor(STATE.stats.maxHp * (1 + bonus));
    else if (statKey === 'atk') STATE.stats.atk *= 1 + bonus;
    else if (statKey === 'speed') STATE.stats.speed *= 1 + bonus;
    else STATE.stats[statKey] = (STATE.stats[statKey] || 0) + bonus;

    const label = statKey.toUpperCase();
    const pct = (bonus * 100).toFixed(3);
    createDamageText(`PARADOXE +${pct}%`, player.position, '#3498db');
    createSkillVisual('shockwave', player.position, 4, 0x3498db);
    spawnParticles(player.position, 0x00ffff, 16);
    if (window.UI) window.UI.toast(`${label} +${pct}% (récompense paradoxale)`);
  },

  reapplyParadoxRewards() {
    const rewards = passives()._paradoxRewards as Record<string, number> | undefined;
    if (!rewards || rank('paradoxOverload') < 2) return;
    for (const [key, val] of Object.entries(rewards)) {
      if (key === 'maxHp') STATE.stats.maxHp = Math.floor(STATE.stats.maxHp * (1 + val));
      else if (key === 'atk' || key === 'speed') STATE.stats[key] *= 1 + val;
      else STATE.stats[key] = (STATE.stats[key] || 0) + val;
    }
  },

  // ——— Blade : Point de Rupture ———
  syncBladeThirstCrit(player: { hp: number; maxHp: number; className?: string }) {
    if (!player || player.className !== 'blade' || rank('eternalThirst') < 2) return;
    const hpPct = player.hp / Math.max(1, player.maxHp);
    const missingPct = Math.min(BLADE_BREAKPOINT_MAX_MISSING_HP, Math.max(0, 1 - hpPct));
    const missingPoints = missingPct * 100;
    const critBonus = missingPoints * BLADE_BREAKPOINT_CRIT_PER_MISSING;
    const critDmgBonus = missingPoints * BLADE_BREAKPOINT_CRIT_DMG_PER_MISSING;
    const p = passives();
    const baseCrit = (p._bladeBaseCrit as number) ?? STATE.stats.crit;
    const baseCritDmg = (p._bladeBaseCritDmg as number) ?? STATE.stats.critDmg;
    if (p._bladeBaseCrit == null) {
      p._bladeBaseCrit = baseCrit;
      p._bladeBaseCritDmg = baseCritDmg;
    }
    STATE.stats.crit = baseCrit + critBonus;
    STATE.stats.critDmg = baseCritDmg + critDmgBonus;
  },

  resetBladeThirstCrit() {
    const p = passives();
    if (p._bladeBaseCrit != null) STATE.stats.crit = p._bladeBaseCrit as number;
    if (p._bladeBaseCritDmg != null) STATE.stats.critDmg = p._bladeBaseCritDmg as number;
    delete p._bladeBaseCrit;
    delete p._bladeBaseCritDmg;
  },

  getBladeBreakpointSummary(player?: BladeBreakpointPlayer | null) {
    const hpPct = player ? player.hp / Math.max(1, player.maxHp) : 1;
    const missingPct = Math.min(BLADE_BREAKPOINT_MAX_MISSING_HP, Math.max(0, 1 - hpPct));
    const missingPoints = missingPct * 100;
    const now = Date.now();
    const cdUntil = player?._bladeBreakpointCdUntil || 0;
    const cdRemaining = Math.max(0, (cdUntil - now) / 1000);
    const active = !!(player?._bladeBreakpointSkillKey && (player._bladeBreakpointSkillUntil || 0) > now);
    return {
      hpPct,
      missingPct,
      critBonus: missingPoints * BLADE_BREAKPOINT_CRIT_PER_MISSING,
      critDmgBonus: missingPoints * BLADE_BREAKPOINT_CRIT_DMG_PER_MISSING,
      threshold: BLADE_BREAKPOINT_HP_THRESHOLD,
      ready: rank('eternalThirst') >= 2 && hpPct <= BLADE_BREAKPOINT_HP_THRESHOLD && cdRemaining <= 0,
      cdRemaining,
      active,
      activeSkillKey: player?._bladeBreakpointSkillKey || null,
    };
  },

  tryConsumeBladeBreakpoint(player: BladeBreakpointPlayer | null | undefined, skillKey: string): boolean {
    if (!player || player.className !== 'blade' || rank('eternalThirst') < 2) return false;
    const summary = this.getBladeBreakpointSummary(player);
    if (!summary.ready) return false;
    const now = Date.now();
    player._bladeBreakpointCdUntil = now + BLADE_BREAKPOINT_CD_MS;
    player._bladeBreakpointSkillKey = skillKey;
    player._bladeBreakpointSkillUntil = now + 2200;
    player._bladeBreakpointExecutionUsed = false;
    if (player.position) {
      createDamageText('POINT DE RUPTURE', player.position, '#ff2d55');
      createSkillVisual('shockwave', player.position, 3.2, 0xff2d55);
      spawnParticles(player.position, 0xff2d55, 16);
    }
    return true;
  },

  getBladeBreakpointDamageOptions(player: BladeBreakpointPlayer | null | undefined, skillKey: string) {
    const now = Date.now();
    const active = !!(
      player
      && player._bladeBreakpointSkillKey === skillKey
      && (player._bladeBreakpointSkillUntil || 0) > now
    );
    if (!active) return {};
    return {
      forceCrit: true,
      applyHemorrhage: true,
      skipPassiveHemorrhage: true,
      bladeBreakpointSkillKey: skillKey,
      critLabel: 'RUPTURE!',
      critColor: '#ff2d55',
    };
  },

  onBladeBreakpointExecution(player: BladeBreakpointPlayer | null | undefined, skillKey: string): boolean {
    if (!player || player.className !== 'blade') return false;
    if (player._bladeBreakpointSkillKey !== skillKey) return false;
    if (player._bladeBreakpointExecutionUsed) return false;
    player._bladeBreakpointExecutionUsed = true;
    if (player.cooldowns) player.cooldowns[skillKey] = 0;
    const healAmount = Math.max(0, player.maxHp * BLADE_BREAKPOINT_EXEC_HEAL);
    player.heal?.(healAmount);
    if (player.position) {
      createDamageText('EXÉCUTION', player.position, '#ff2d55');
      spawnParticles(player.position, 0xff2d55, 18);
    }
    return true;
  },

  getBladeBreakpointExecutionHeal(player?: BladeBreakpointPlayer | null): number {
    return Math.max(0, (player?.maxHp || 0) * BLADE_BREAKPOINT_EXEC_HEAL);
  },

  getBladeBloodThirstSummary(player?: { hp?: number; maxHp?: number; className?: string } | null) {
    const hp = Math.max(0, player?.hp ?? 0);
    const maxHp = Math.max(1, player?.maxHp ?? 1);
    const hpPct = Math.max(0, Math.min(1, hp / maxHp));
    const missingPct = Math.max(0, 1 - hpPct);
    const apex = player?.className === 'blade' && rank('eternalThirst') >= 2;
    const rate = apex ? BLADE_BLOOD_THIRST_APEX_RATE : 1;
    const cap = apex ? BLADE_BLOOD_THIRST_APEX_CAP : BLADE_BLOOD_THIRST_BASE_CAP;
    const bonus = Math.min(cap, missingPct * rate);
    return {
      hpPct,
      missingPct,
      bonus,
      cap,
      rate,
      apex,
      capped: bonus >= cap,
    };
  },

  getBladeBloodThirstDamageMult(player?: { hp?: number; maxHp?: number; className?: string } | null): number {
    return 1 + this.getBladeBloodThirstSummary(player).bonus;
  },

  // ——— Chrono : Prismes affinés + Fracture ———
  hasRefinedPrisms(): boolean {
    return isChronoFractureApexActive();
  },

  getFractureMax(): number {
    return resolveMaxFracture();
  },

  getFractureOverheatThreshold(): number {
    return getFractureOverheatAt();
  },

  getFractureDamageMult(fractureGauge: number): number {
    return computeFractureDamageMult(fractureGauge);
  },

  getFractureBeamSizeMult(fractureGauge: number): number {
    return computeFractureBeamSizeMult(fractureGauge);
  },

  getPrismBeamDmgMult(prismDepth: number): number {
    if (!this.hasRefinedPrisms() || prismDepth <= 0) return 1;
    return Math.pow(0.8, prismDepth);
  },

  getMaxRefinedPrisms(): number {
    return this.hasRefinedPrisms() ? 3 : Infinity;
  },

  getLensBaseDuration(): number {
    return CHRONO_SKILLS.lens.baseDuration;
  },

  getLensApexExtension(): number {
    return CHRONO_SKILLS.refinedLens.apexExtension;
  },

  /** Durée initiale d'un nouveau prisme Apex : 5 s + 3,5 s = 8,5 s. */
  getRefinedLensFullDuration(): number {
    return this.getLensBaseDuration() + this.getLensApexExtension();
  },

  /** Durée affichée / initiale selon Apex. */
  getLensDuration(): number {
    return this.hasRefinedPrisms()
      ? this.getRefinedLensFullDuration()
      : this.getLensBaseDuration();
  },

  /**
   * Chaque prisme déjà actif gagne +3,5 s (empilable à chaque nouveau prisme posé).
   * Ne remplace pas la durée restante.
   */
  extendActiveRefinedLenses(lenses: Array<{ timer: number; maxTimer?: number }>) {
    if (!this.hasRefinedPrisms() || !lenses?.length) return;
    const bonus = this.getLensApexExtension();
    for (const lens of lenses) {
      lens.timer += bonus;
      lens.maxTimer = (lens.maxTimer ?? lens.timer) + bonus;
    }
  },

  // ——— Éclipse : fenêtre Cataclysme (combo mêlée) ———
  onEclipseCataclysm(player: { _cataclysmWindowUntil?: number; position?: THREE.Vector3 }) {
    if (!player) return;
    openEclipseCataclysmWindow(player);
    createDamageText('FENÊTRE CATACLYSME', player.position, '#ffffff');
    createSkillVisual('shockwave', player.position, 5, 0xffffff);
  },

  getEclipseAttackSpeedMult(): number {
    return 1;
  },

  consumeEmpoweredAttack(): boolean {
    return false;
  },

  applyCataclysmVulnerability() {},

  getCataclysmVulnMult(): number {
    return 1;
  },
};
