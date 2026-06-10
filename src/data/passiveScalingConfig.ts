// @ts-nocheck
import type { ClassId } from './constellations';
import { getNodeById } from './constellations';
import type { SkillScaleLine } from './classStatsConfig';
import { formatScaleLineHtml } from './classStatsConfig';

export interface PassiveScaleDef {
  lines: (rank: number) => SkillScaleLine[];
  summary?: (rank: number) => string;
}

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

export const PASSIVE_SCALING: Record<string, PassiveScaleDef> = {
  ironWall: {
    lines: () => [
      { stat: 'def', mult: 0, note: `${pct(-0.08)} dégâts reçus` },
      { stat: 'def', mult: 0, note: 'Peau de Fer runique cumulée' },
    ],
    summary: () => 'Réduit les dégâts entrants de 8% en plus de la DEF.',
  },
  titanBlood: {
    lines: (rank) => [
      { stat: 'maxHp', mult: 0.02 * rank, suffix: ' → DEF' },
    ],
    summary: (rank) => `Convertit ${Math.round(rank * 2)}% des PV max en DEF bonus.`,
  },
  parryRefund: {
    lines: () => [
      { stat: 'utility', mult: 0, note: '−10% recharge max (Espace, Shift, E) après Parade' },
    ],
    summary: () => 'Chaque Parade réduit les cooldowns des trois compétences.',
  },
  parryCharge: {
    lines: (rank) => [
      { stat: 'def', mult: 0, note: `${Math.round(25 * rank)}% dégâts bloqués → charge sismique` },
    ],
    summary: () => 'Les dégâts bloqués en Parade chargent la prochaine Frappe Sismique.',
  },
  runicColossus: {
    lines: (rank) => [
      { stat: 'def', mult: 0, note: `${pct(-0.18)} dégâts reçus (remplace −12%)` },
      { stat: 'def', mult: 0, note: '40% dégâts bloqués → charge sismique' },
      { stat: 'def', mult: 0, note: 'Peau de Fer apex active' },
    ],
    summary: () => 'Peau de Fer maximale et stockage de blocage renforcé pour le Séisme.',
  },
  warFervor: {
    lines: (rank) => [
      { stat: 'atk', mult: 0.03 * rank, suffix: ' / stack (max 5)' },
    ],
    summary: () => '+3% dégâts par attaque de base, jusqu\'à 5 stacks.',
  },
  arcaneOverload: {
    lines: (rank) => [
      { stat: 'utility', mult: 0, note: rank >= 2 ? '−1,2s CD autres sorts' : '−0,6s CD autres sorts' },
    ],
  },
  continuumBurst: {
    lines: () => [
      { stat: 'atk', mult: 0.15, suffix: ' cône lentille' },
      { stat: 'atk', mult: 0.08, suffix: ' rayon' },
      { stat: 'utility', mult: 0, note: 'Convergence +0,5 s · +0,5 rayon résonance' },
    ],
  },
  continuumMastery: {
    lines: () => [
      { stat: 'atk', mult: 0.6, suffix: ' Ascendant' },
      { stat: 'utility', mult: 0, note: 'Fenêtre Écho 80–98%' },
      { stat: 'utility', mult: 0, note: 'Surchauffe −25% contrecoup' },
    ],
  },
  eternalThirst: {
    lines: (rank) => [
      { stat: 'atk', mult: rank >= 2 ? 0.6 : 0.4, suffix: ' dégâts (bas PV)' },
    ],
  },
  executioner: {
    lines: () => [{ stat: 'atk', mult: 0.35, suffix: ' vs marqué' }],
  },
  lastBreath: {
    lines: () => [{ stat: 'utility', mult: 0, note: 'Survie 1× / 90 s' }],
  },
  deepStasis: {
    lines: () => [{ stat: 'utility', mult: 0, note: 'Chronostase : ralentissement renforcé' }],
  },
  blinkMastery: {
    lines: () => [{ stat: 'atk', mult: 0, note: 'Transfert : explosion + reset au kill' }],
  },
  beamHaste: {
    lines: () => [{ stat: 'speed', mult: 0, note: '+30% sprint 2 s après Rayon Stellaire' }],
  },
  healAmp: {
    lines: (rank) => [{ stat: 'utility', mult: 0, note: `+${Math.round(15 * rank)}% soins reçus` }],
  },
  overhealShield: {
    lines: () => [{ stat: 'utility', mult: 0, note: 'Soins excédentaires → bouclier' }],
  },
  hemorrhage: {
    lines: () => [{ stat: 'atk', mult: 0, note: 'Critiques : Saignée (DoT)' }],
  },
  orbitalWeave: {
    lines: () => [
      { stat: 'atk', mult: 0.04, suffix: ' / stack (max 4)' },
      { stat: 'utility', mult: 0, note: 'Alternance Soleil/Lune' },
    ],
  },
  solarInspiration: {
    lines: (rank) => [{ stat: 'maxHp', mult: 0.01 * rank, suffix: ' PV/s régén' }],
  },
  ruptureSurge: {
    lines: () => [
      { stat: 'atk', mult: 0.35, suffix: ' explosion 85–95%' },
      { stat: 'atk', mult: 0.08, suffix: ' rayon' },
    ],
  },
  anachronismeAmp: {
    lines: () => [{ stat: 'utility', mult: 0, note: 'Coût sorts : 25 Fracture (au lieu de 30)' }],
  },
  freezeFieldAmp: {
    lines: () => [{ stat: 'utility', mult: 0, note: 'Déphasage +2 portée · Instabilité +2 s' }],
  },
};

export function getPassiveScalingLines(passiveKey: string, rank = 1): SkillScaleLine[] {
  const def = PASSIVE_SCALING[passiveKey];
  if (!def) return [{ stat: 'utility', mult: 0, note: 'Effet passif actif' }];
  return def.lines(rank);
}

export function formatPassiveScalingHtml(passiveKey: string, rank = 1): string {
  return getPassiveScalingLines(passiveKey, rank)
    .map((line) => {
      if (line.note) {
        return `<span class="grimoire-ratio-chip chip-passive">${line.note}</span>`;
      }
      return formatScaleLineHtml(line);
    })
    .join('');
}

export function formatPassiveScalingText(passiveKey: string, rank = 1): string {
  const def = PASSIVE_SCALING[passiveKey];
  if (def?.summary) return def.summary(rank);
  return getPassiveScalingLines(passiveKey, rank)
    .map((l) => l.note || formatScaleLineHtml(l).replace(/<[^>]+>/g, ''))
    .join(' · ');
}

export function getUnlockedPassiveDetails(classId: ClassId, unlockedNodes: string[]): Array<{
  key: string;
  rank: number;
  name: string;
}> {
  const out: Array<{ key: string; rank: number; name: string }> = [];
  const seen = new Set<string>();
  for (const id of unlockedNodes) {
    if (!id.startsWith(classId)) continue;
    const node = getNodeById(id);
    const key = node?.effects?.passive;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      rank: (node.effects.passiveRank as number) || 1,
      name: node.name,
    });
  }
  return out;
}
