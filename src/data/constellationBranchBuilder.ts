// @ts-nocheck
/** Construction des branches — 10 nœuds, keystone au palier 10 avec 3 bonus plats. */

import type { SkillKey } from './classStatsConfig';
import type { ClassId, ConstellationBranch, ConstellationNode, NodeEffects } from './constellations';
import { BRANCH_KEYSTONE_TIER, BRANCH_NODE_COUNT } from './constellationConstants';

export type BranchSlot = ConstellationBranch['slot'];

export type KeystoneStatBlock = {
  atk: number;
  maxHpFlat: number;
  def: number;
};

export type BranchNodeDef = Omit<ConstellationNode, 'id' | 'branch' | 'requires'> & {
  tier: number;
};

export type BranchBuildInput = {
  classId: ClassId;
  branchId: string;
  slot: BranchSlot;
  label: string;
  /** Paliers 1–9 (le 10ᵉ est le keystone). */
  nodes: BranchNodeDef[];
  keystone: {
    name: string;
    desc: string;
    icon: string;
    passive: string;
    stats: KeystoneStatBlock;
  };
};

function assertBranchInput(input: BranchBuildInput): void {
  if (input.nodes.length !== BRANCH_NODE_COUNT - 1) {
    throw new Error(
      `${input.classId}-${input.branchId}: attendu ${BRANCH_NODE_COUNT - 1} nœuds intermédiaires, reçu ${input.nodes.length}`,
    );
  }
  for (let i = 0; i < input.nodes.length; i++) {
    if (input.nodes[i].tier !== i + 1) {
      throw new Error(`${input.classId}-${input.branchId}: palier ${i + 1} invalide`);
    }
  }
  const stats = input.keystone.stats;
  const count = [stats.atk, stats.maxHpFlat, stats.def].filter((v) => v > 0).length;
  if (count !== 3) {
    throw new Error(`${input.classId}-${input.branchId}: keystone doit avoir exactement 3 bonus plats HP/ATK/DEF`);
  }
}

/** Crée une branche complète (10 nœuds) avec chaînage linéaire. */
export function buildBranch(input: BranchBuildInput): ConstellationBranch {
  assertBranchInput(input);
  const { classId, branchId, slot, label, nodes, keystone } = input;

  const keystoneNode: BranchNodeDef = {
    tier: BRANCH_KEYSTONE_TIER,
    name: keystone.name,
    desc: keystone.desc,
    icon: keystone.icon,
    cost: 1,
    keystone: true,
    effects: {
      atk: keystone.stats.atk,
      maxHpFlat: keystone.stats.maxHpFlat,
      def: keystone.stats.def,
      passive: keystone.passive,
      passiveRank: 1,
    },
  };

  const allDefs = [...nodes, keystoneNode];
  const built: ConstellationNode[] = allDefs.map((d, i) => ({
    ...d,
    id: `${classId}-${branchId}-${d.tier}`,
    branch: branchId,
    requires: i > 0 ? [`${classId}-${branchId}-${d.tier - 1}`] : undefined,
  }));

  return { id: branchId, label, slot, nodes: built };
}

type SkillRef = { key: SkillKey; label: string; icon?: string };

/** Génère 6 nœuds thématiques (paliers 4–9) à partir des 3 premiers. */
export function extendBranchPath(
  early: [BranchNodeDef, BranchNodeDef, BranchNodeDef],
  theme: {
    skill?: SkillRef;
    focus: 'defense' | 'offense' | 'speed' | 'crit' | 'sustain' | 'control';
  },
  capstonePrep?: BranchNodeDef[],
): BranchNodeDef[] {
  const [n1, n2, n3] = early;
  const skill = theme.skill;
  const skillIcon = skill?.icon || 'fa-bolt';
  const mid: BranchNodeDef[] = [];

  const push = (tier: number, name: string, desc: string, icon: string, effects: NodeEffects) => {
    mid.push({ tier, name, desc, icon, cost: 1, effects });
  };

  switch (theme.focus) {
    case 'defense':
      push(4, 'Rempart II', '+6 DEF', 'fa-shield-halved', { def: 6 });
      push(5, 'Vitalité', '+14 HP', 'fa-heart', { maxHpFlat: 14 });
      if (skill) push(6, 'Garde Active', `+6% ${skill.label}`, skillIcon, { skillMods: { [skill.key]: 0.06 } });
      else push(6, 'Bastion', '+5 DEF', 'fa-shield', { def: 5 });
      push(7, 'Mur Renforcé', '+12 HP, +4 DEF', 'fa-shield-heart', { maxHpFlat: 12, def: 4 });
      push(8, 'Endurance', '+8 DEF', 'fa-icicles', { def: 8 });
      push(9, 'Forteresse II', '+16 HP', 'fa-fort-awesome', { maxHpFlat: 16 });
      break;
    case 'offense':
      push(4, 'Lame II', '+3 ATK', 'fa-gavel', { atk: 3 });
      if (skill) push(5, 'Amplification', `+6% ${skill.label}`, skillIcon, { skillMods: { [skill.key]: 0.06 } });
      else push(5, 'Frappe', '+4 ATK', 'fa-fire', { atk: 4 });
      push(6, 'Puissance', '+5 ATK', 'fa-burst', { atk: 5 });
      if (skill) push(7, 'Maîtrise', `+8% ${skill.label}, +3 ATK`, skillIcon, { skillMods: { [skill.key]: 0.08 }, atk: 3 });
      else push(7, 'Ferveur II', '+6 ATK', 'fa-fire', { atk: 6 });
      push(8, 'Impact', '+4 ATK', 'fa-crosshairs', { atk: 4 });
      push(9, 'Culmination', '+7 ATK', 'fa-meteor', { atk: 7 });
      break;
    case 'speed':
      push(4, 'Allure II', '+0.8 Vitesse sprint', 'fa-person-running', { speed: 0.8 });
      if (skill) push(5, 'Hâte', `−5% recharge ${skill.label}`, 'fa-stopwatch', { skillCdMods: { [skill.key]: -0.05 } });
      else push(5, 'Célérité', '+0.6 sprint', 'fa-wind', { speed: 0.6 });
      push(6, 'Élan', '+0.7 sprint', 'fa-bolt', { speed: 0.7 });
      if (skill) push(7, 'Flux Rapide', `+0.5 sprint, −4% ${skill.label}`, 'fa-bolt', { speed: 0.5, skillCdMods: { [skill.key]: -0.04 } });
      else push(7, 'Agilité II', '+0.9 sprint', 'fa-feather', { speed: 0.9 });
      push(8, 'Réactivité', '−6% cadence d\'attaque', 'fa-stopwatch', { attackSpeedMod: -0.06 });
      push(9, 'Tempête', '+1.0 sprint', 'fa-wind', { speed: 1 });
      break;
    case 'crit':
      push(4, 'Précision II', '+4% Crit Chance', 'fa-crosshairs', { crit: 0.04 });
      push(5, 'Impact Critique', '+10% Crit Damage', 'fa-burst', { critDmg: 0.1 });
      push(6, 'Affûtage', '+3% Crit Chance', 'fa-eye', { crit: 0.03 });
      if (skill) push(7, 'Focus Mortel', `+5% Crit, +6% ${skill.label}`, skillIcon, { crit: 0.05, skillMods: { [skill.key]: 0.06 } });
      else push(7, 'Lame Critique', '+5% Crit Chance', 'fa-crosshairs', { crit: 0.05 });
      push(8, 'Frappe Létale', '+12% Crit Damage', 'fa-skull', { critDmg: 0.12 });
      push(9, 'Perfection', '+6% Crit Chance', 'fa-bullseye', { crit: 0.06 });
      break;
    case 'sustain':
      push(4, 'Vitalité II', '+14 HP', 'fa-heart', { maxHpFlat: 14 });
      push(5, 'Régénération II', '+0.6 HP/s', 'fa-bandage', { regen: 0.6 });
      push(6, 'Résilience', '+10 HP, +3 DEF', 'fa-shield-heart', { maxHpFlat: 10, def: 3 });
      push(7, 'Flux Vital', '+1.0 HP/s', 'fa-droplet', { regen: 1 });
      push(8, 'Ancrage', '+12 HP', 'fa-heart-pulse', { maxHpFlat: 12 });
      push(9, 'Ténacité', '+8 HP, +4 DEF', 'fa-fire', { maxHpFlat: 8, def: 4 });
      break;
    case 'control':
      push(4, 'Discipline', '+5 DEF', 'fa-shield', { def: 5 });
      if (skill) push(5, 'Contrôle', `+7% ${skill.label}`, skillIcon, { skillMods: { [skill.key]: 0.07 } });
      else push(5, 'Focus', '+4% Crit Chance', 'fa-eye', { crit: 0.04 });
      push(6, 'Maîtrise II', '+4 ATK', 'fa-wand-magic-sparkles', { atk: 4 });
      if (skill) push(7, 'Amplification', `−6% recharge ${skill.label}`, 'fa-stopwatch', { skillCdMods: { [skill.key]: -0.06 } });
      else push(7, 'Puissance', '+5 ATK', 'fa-burst', { atk: 5 });
      push(8, 'Harmonie', '+10% XP', 'fa-graduation-cap', { xpMod: 0.1 });
      push(9, 'Synthèse', '+5 ATK, +4% Crit', 'fa-atom', { atk: 5, crit: 0.04 });
      break;
    default:
      break;
  }

  if (capstonePrep?.length) {
    for (const extra of capstonePrep) {
      const slot = mid.findIndex((n) => n.tier === extra.tier);
      if (slot >= 0) mid[slot] = { ...extra, cost: 1 };
    }
  }

  return [...early, ...mid].map((n) => ({ ...n, cost: n.cost ?? 1 }));
}
