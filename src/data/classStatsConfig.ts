import { STATE } from '../core/config';
import type { ClassId } from './constellations';
import { getPlayerDefense } from '@/gameplay/combat/defense';

/** Clés de sorts — `primary` = attaque canalisable / auto, `rupture` = chrono uniquement */
export type SkillKey = 'primary' | 'space' | 'shift' | 'e' | 'rupture';

export type ScaleStat = 'atk' | 'defense' | 'maxHp' | 'speed' | 'utility';

export interface SkillScaleLine {
  stat: ScaleStat;
  /** Multiplicateur affiché en % (0.34 → 34 %, −0.5 → −50 %) */
  mult: number;
  suffix?: string;
  /** Libellé personnalisé (ex. « Dégâts réduits » au lieu de « DEF »). */
  label?: string;
  /** Texte libre pour sorts utilitaires */
  note?: string;
}

export interface SkillRatioDef {
  /** Ratio × ATK pour l'estimation des dégâts */
  ratio: number;
  /** Libellé affiché dans les étoiles / grimoire */
  label: string;
  /** Ratios affichés dans le grimoire (ex. 180 % ATK, 75 % Dégâts réduits) */
  scaling?: SkillScaleLine[];
}

const SCALE_STAT_LABEL: Record<ScaleStat, string> = {
  atk: 'ATK',
  defense: 'DEF',
  maxHp: 'HP',
  speed: 'Vitesse',
  utility: 'Utilité',
};

const DAMAGE_SCALE_STATS: ScaleStat[] = ['atk', 'defense', 'maxHp'];

export interface ClassBaseStatsDef {
  maxHp: number;
  atk: number;
  /** Défense de base (réduction de dégâts + scaling guerrier). */
  defense: number;
  speed: number;
  attackMaxCooldown: number;
  cooldowns: Record<'space' | 'shift' | 'e', number>;
}

export interface ClassStatsDef {
  classId: ClassId;
  base: ClassBaseStatsDef;
  /** Ratios de dégâts par sort (config gameplay + UI) */
  skills: Partial<Record<SkillKey, SkillRatioDef>>;
  /**
   * Chaque branche constellation améliore UN sort précis via `skillMods`.
   * null = branche sans bonus de dégâts de sort.
   */
  branchSkills: Record<string, SkillKey | null>;
}

const DEFAULT_SKILLS: Record<'space' | 'shift' | 'e', SkillRatioDef> = {
  space: { ratio: 2.2, label: 'Compétence Espace' },
  shift: { ratio: 1.8, label: 'Compétence Shift' },
  e: { ratio: 1.5, label: 'Compétence E' },
};

export const CLASS_STATS_CONFIG: Record<ClassId, ClassStatsDef> = {
  warrior: {
    classId: 'warrior',
    base: { maxHp: 250, atk: 0, defense: 85, speed: 13, attackMaxCooldown: 0.9, cooldowns: { space: 5, shift: 6, e: 7 } },
    skills: {
      primary: { ratio: 1.2, label: 'Attaque', scaling: [{ stat: 'defense', mult: 1.2 }] },
      space: { ratio: 3.0, label: 'Frappe Sismique', scaling: [{ stat: 'defense', mult: 3.0 }] },
      shift: { ratio: 1.5, label: 'Cri de Guerre', scaling: [{ stat: 'defense', mult: 1.5 }] },
      e: { ratio: 0, label: 'Parade', scaling: [{ stat: 'utility', mult: 0.75, label: 'Dégâts réduits' }] },
    },
    branchSkills: { rempart: null, fureur: 'primary', cri: 'shift', seisme: 'space' },
  },
  mage: {
    classId: 'mage',
    base: { maxHp: 100, atk: 45, defense: 10, speed: 15.5, attackMaxCooldown: 0.6, cooldowns: { space: 5, shift: 8, e: 12 } },
    skills: {
      primary: { ratio: 0.55, label: 'Attaque arcane' },
      space: { ratio: 0.75, label: 'Arcane Barrage' },
      shift: { ratio: 2.5, label: 'Chronostase' },
      e: { ratio: 1.8, label: 'Transfert' },
    },
    branchSkills: { flux: 'space', givre: 'shift', mirage: 'e', prisme: 'e' },
  },
  sentinel: {
    classId: 'sentinel',
    base: { maxHp: 140, atk: 32, defense: 10, speed: 14.5, attackMaxCooldown: 0.7, cooldowns: { space: 5, shift: 12, e: 12 } },
    skills: {
      primary: { ratio: 1.0, label: 'Attaque' },
      space: { ratio: 3.0, label: 'Rayon Stellaire' },
      shift: { ratio: 1.2, label: 'Champ de Lumière' },
      e: { ratio: 2.0, label: 'Égide Divine' },
    },
    branchSkills: { rayon: 'space', sanctuaire: 'shift', aile: 'space', egide: 'e' },
  },
  blade: {
    classId: 'blade',
    base: { maxHp: 200, atk: 31, defense: 10, speed: 17, attackMaxCooldown: 0.35, cooldowns: { space: 4, shift: 8, e: 8 } },
    skills: {
      primary: {
        ratio: 0,
        label: 'Attaque',
        scaling: [{ stat: 'atk', mult: 0.84 }, { stat: 'maxHp', mult: 0.06 }],
      },
      space: {
        ratio: 0,
        label: 'Toupie Létale',
        scaling: [{ stat: 'atk', mult: 1.14 }, { stat: 'maxHp', mult: 0.09 }],
      },
      shift: {
        ratio: 0,
        label: 'Ombre Véloce',
        scaling: [{ stat: 'atk', mult: 1.16 }, { stat: 'maxHp', mult: 0.06 }],
      },
      e: {
        ratio: 0,
        label: 'Tsunami',
        scaling: [{ stat: 'atk', mult: 2.61 }, { stat: 'maxHp', mult: 0.13 }],
      },
    },
    branchSkills: { hemo: 'primary', ombre: 'shift', cyclone: 'space', survie: 'e' },
  },
  pacifier: {
    classId: 'pacifier',
    base: { maxHp: 190, atk: 38, defense: 10, speed: 15, attackMaxCooldown: 0.5, cooldowns: { space: 5, shift: 8, e: 12 } },
    skills: {
      primary: { ratio: 1.5, label: 'Attaque' },
      space: { ratio: 2.0, label: 'Saut Vampirique' },
      shift: { ratio: 1.8, label: 'Verdict Sanguin' },
      e: { ratio: 0.9, label: 'Frénésie' },
    },
    branchSkills: { transfusion: 'space', jugement: 'shift', 'frénésie': 'e', rituel: 'space' },
  },
  eclipse: {
    classId: 'eclipse',
    base: { maxHp: 160, atk: 35, defense: 10, speed: 15, attackMaxCooldown: 0.6, cooldowns: { space: 5, shift: 10, e: 15 } },
    skills: {
      primary: { ratio: 1.0, label: 'Attaque' },
      space: { ratio: 1.2, label: 'Fulgurance Solaire' },
      shift: { ratio: 2.5, label: 'Pic de Lune' },
      e: { ratio: 3.0, label: 'Cataclysme' },
    },
    branchSkills: { soleil: 'space', lune: 'shift', orbite: 'e', vide: 'e' },
  },
  chronoregulator: {
    classId: 'chronoregulator',
    base: { maxHp: 155, atk: 42, defense: 10, speed: 15.5, attackMaxCooldown: 1.15, cooldowns: { space: 6, shift: 10, e: 17 } },
    skills: {
      primary: {
        ratio: 0.75,
        label: 'Rayon de Distorsion',
        scaling: [
          { stat: 'atk', mult: 0.75, suffix: ' / tick' },
          { stat: 'atk', mult: 2.5, suffix: ' surchauffe' },
          { stat: 'atk', mult: 2.4, suffix: ' rupture' },
        ],
      },
      rupture: { ratio: 2.4, label: 'Explosion de Rupture', scaling: [{ stat: 'atk', mult: 2.4, suffix: ' × Fracture%' }] },
      space: {
        ratio: 0,
        label: 'Lentille de Focalisation',
      },
      shift: {
        ratio: 3.38,
        label: 'Déphasage Moléculaire',
        scaling: [{ stat: 'atk', mult: 3.38 }],
      },
      e: {
        ratio: 0,
        label: 'Convergence Temporelle',
        scaling: [
          { stat: 'atk', mult: 5.5, suffix: ' finale' },
          { stat: 'atk', mult: 0.25, suffix: ' /coup' },
        ],
      },
    },
    branchSkills: { continuum: 'primary', echo: 'rupture', distorsion: 'space', paradoxe: 'e' },
  },
};

export const SKILL_KEYS: SkillKey[] = ['primary', 'space', 'shift', 'e', 'rupture'];

export type AbilityKey = 'space' | 'shift' | 'e';

export function createDefaultSkillMods(): Record<SkillKey, number> {
  return { primary: 1, space: 1, shift: 1, e: 1, rupture: 1 };
}

export function createDefaultSkillCdMods(): Record<AbilityKey, number> {
  return { space: 1, shift: 1, e: 1 };
}

export function formatSkillCdLabel(classId: ClassId, skillKey: AbilityKey, value: number): string {
  const pct = Math.round(value * 100);
  const name = getSkillLabel(classId, skillKey);
  return `${pct}% Recharge ${name}`;
}

export function getClassStatsConfig(classId: ClassId): ClassStatsDef {
  return CLASS_STATS_CONFIG[classId];
}


/** Stat offensive utilisée pour les ratios de dégâts (Défense pour le guerrier). */
export function getClassPowerStat(classId: ClassId): number {
  if (classId === 'warrior') return getPlayerDefense();
  return STATE.stats.atk;
}

/** @deprecated Alias — puissance runique = Défense totale (pas de double comptage). */
export function getWarriorDefPower(): number {
  return getPlayerDefense();
}

export function getClassPowerStatKey(classId: ClassId): ScaleStat {
  if (classId === 'warrior') return 'defense';
  return 'atk';
}

/** Dégâts de base d'un sort selon ses lignes de scaling (ATK, DEF, HP…). */
export function calcSkillBaseDamage(classId: ClassId, skillKey: SkillKey): number {
  const lines = getSkillScaling(classId, skillKey);
  let total = 0;
  for (const line of lines) {
    if (line.stat === 'utility') continue;
    if (line.stat === 'atk') total += STATE.stats.atk * line.mult;
    else if (line.stat === 'defense') total += getPlayerDefense() * line.mult;
    else if (line.stat === 'maxHp') total += STATE.stats.maxHp * line.mult;
    else if (line.stat === 'speed') total += STATE.stats.speed * line.mult;
  }
  return total;
}

export function getBranchSkillKey(classId: ClassId, branch: string): SkillKey | null {
  return CLASS_STATS_CONFIG[classId]?.branchSkills[branch] ?? null;
}

export function getSkillLabel(classId: ClassId, skillKey: SkillKey): string {
  const def = CLASS_STATS_CONFIG[classId]?.skills[skillKey];
  if (def) return def.label;
  return DEFAULT_SKILLS[skillKey as 'space']?.label ?? skillKey;
}

export function getSkillRatio(classId: ClassId, skillKey: SkillKey): number {
  return CLASS_STATS_CONFIG[classId]?.skills[skillKey]?.ratio ?? DEFAULT_SKILLS[skillKey as 'space']?.ratio ?? 1;
}

export function formatSkillModLabel(classId: ClassId, skillKey: SkillKey, value: number): string {
  const pct = Math.round(value * 100);
  const name = getSkillLabel(classId, skillKey);
  return `+${pct}% ${name}`;
}

export function getSkillScaling(classId: ClassId, skillKey: SkillKey): SkillScaleLine[] {
  const skillDef = CLASS_STATS_CONFIG[classId]?.skills[skillKey];
  if (skillDef?.scaling?.length) return skillDef.scaling;
  if (skillDef && skillDef.ratio > 0) {
    return [{ stat: getClassPowerStatKey(classId), mult: skillDef.ratio }];
  }
  if (skillDef) return [];
  return [{ stat: getClassPowerStatKey(classId), mult: 1 }];
}

/** Classe CSS du badge grimoire (pill) par type de stat. */
export function getScaleChipClass(stat: ScaleStat, line?: Pick<SkillScaleLine, 'label' | 'stat'>): string {
  if (stat === 'utility' && line?.label === 'Dégâts réduits') return 'chip-mitigation';
  const map: Record<ScaleStat, string> = {
    atk: 'chip-atk',
    defense: 'chip-def',
    maxHp: 'chip-maxHp',
    speed: 'chip-speed',
    utility: 'chip-utility',
  };
  return map[stat] || 'chip-utility';
}

export function formatScaleLine(line: SkillScaleLine): string {
  if (line.stat === 'utility') {
    if (line.label != null && line.mult !== 0) {
      const pct = Math.round(line.mult * 100);
      const suffix = line.suffix || '';
      return `${pct}% ${line.label}${suffix}`;
    }
    return line.note || 'Utilité';
  }
  const pct = Math.round(line.mult * 100);
  const statLabel = line.label ?? SCALE_STAT_LABEL[line.stat];
  const suffix = line.suffix || '';
  if (pct < 0) return `${pct}% ${statLabel}${suffix}`;
  return `${pct}% ${statLabel}${suffix}`;
}

export function formatScaleLineHtml(line: SkillScaleLine): string {
  const text = formatScaleLine(line);
  const cls = `grimoire-ratio-chip ${getScaleChipClass(line.stat, line)}`;
  return `<span class="${cls}">${text}</span>`;
}

export function getSkillDamageScaling(classId: ClassId, skillKey: SkillKey): SkillScaleLine[] {
  return getSkillScaling(classId, skillKey).filter((line) => DAMAGE_SCALE_STATS.includes(line.stat));
}

export function formatSkillScalingHtml(classId: ClassId, skillKey: SkillKey): string {
  return getSkillScaling(classId, skillKey).map(formatScaleLineHtml).join('');
}

export function formatSkillDamageScalingHtml(classId: ClassId, skillKey: SkillKey): string {
  return getSkillDamageScaling(classId, skillKey).map(formatScaleLineHtml).join('');
}

export function formatDestinySkillDetailHtml(classId: ClassId, skillKey: AbilityKey): string {
  const cfg = getClassStatsConfig(classId);
  const def = cfg.skills[skillKey] ?? DEFAULT_SKILLS[skillKey];
  const cd = cfg.base.cooldowns[skillKey];
  const damageLines = getSkillDamageScaling(classId, skillKey);
  const chips = formatSkillScalingHtml(classId, skillKey);

  let meta = `<div class="destiny-skill-meta-row">
    <span class="destiny-skill-meta-label">Recharge</span>
    <span class="destiny-skill-meta-value">${cd}s</span>
  </div>`;

  if (def.ratio > 0 && damageLines.length === 0) {
    const chip = formatScaleLineHtml({
      stat: getClassPowerStatKey(classId),
      mult: def.ratio,
    });
    meta += `<div class="destiny-skill-meta-row">
      <span class="destiny-skill-meta-label">Ratio</span>
      <span class="destiny-skill-meta-value"><span class="grimoire-ratio-chips">${chip}</span></span>
    </div>`;
  }

  const scalingBlock = chips
    ? `<div class="destiny-skill-scaling-label">Scaling</div><div class="grimoire-ratio-chips">${chips}</div>`
    : '';

  return `<div class="destiny-skill-detail-inner">
    <div class="destiny-skill-meta">${meta}</div>
    ${scalingBlock}
    <div class="destiny-skill-hint">Cliquer pour replier</div>
  </div>`;
}
