// @ts-nocheck

import { STATE } from '@/core/config';

import type { ClassId } from './constellations';

import { getNodeById } from './constellations';

import { getPassiveMeta } from './passiveCatalog';



export interface PassiveDetailDef {

  /** Paragraphes de tooltip (lignes séparées par \\n à l'intérieur d'un bloc). */

  paragraphs?: (rank: number) => string[];

  /** Lignes brutes — regroupées automatiquement si paragraphs absent. */

  mechanics?: (rank: number) => string[];

  summary?: (rank: number) => string;

}



const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;



export const PASSIVE_DETAILS: Record<string, PassiveDetailDef> = {

  ironWall: {

    mechanics: () => [

      '−8 % dégâts reçus (cumul DEF et Peau de Fer).',

      'Parade : durée 3,5 s.',

      'Blocage : soin 1 % PV max.',

      'Fin de Parade avec blocage : soin 3 % PV max.',

    ],

  },

  titanBlood: {

    mechanics: (rank) => [

      `Convertit ${rank * 2} % PV max en DEF runique.`,

      'Augmente les dégâts de l\'attaque, du Cri, de la Parade et de la Frappe Sismique.',

      'Fin de Parade : +10 % vitesse de sprint pendant 3 s.',

    ],

  },

  parryRefund: {

    mechanics: () => [

      'Fin de Parade : −10 % recharge max (Espace, Shift, E).',

      'Fin de Parade : 0,4 s d\'intangibilité.',

    ],

  },

  parryCharge: {

    mechanics: (rank) => [

      `Parade : ${25 * rank} % des dégâts bloqués stockés.`,

      'Fin de Parade : Frappe Sismique gratuite.',

      'Charge ajoutée aux dégâts du séisme · rayon 12 m.',

    ],

  },

  runicColossus: {

    paragraphs: () => [

      'En Parade, renvoie 30 % des dégâts bloqués.',

      'Bonus de renvoi : +5 % de la DEF.\nDéclenchement à chaque blocage réussi.',

    ],

  },

  warFervor: {

    mechanics: () => [

      'Chaque attaque de base : +3 % dégâts (max 5 stacks, +15 %).',

      'Les stacks persistent jusqu\'à la fin du combat.',

    ],

  },

  arcaneOverload: {

    mechanics: (rank) => [

      `Après un sort : les deux autres compétences −${rank >= 2 ? '1,2' : '0,6'} s de recharge.`,

    ],

  },

  paradoxOverload: {

    paragraphs: () => [

      'Tous les 5 éliminations : bonus de stat permanent.',

      'Stat aléatoire parmi ATK, PV max, vitesse, critique, DEF…\n+0,01 % à +0,09 % par gain.',

      'Cumul persistant sur la partie.',

    ],

  },

  deepStasis: {

    mechanics: () => [

      'Chronostase (Shift) : ralentissement des ennemis porté à 85 % (au lieu de 70 %).',

      'Durée de stase inchangée, zone légèrement élargie (+1 m).',

    ],

  },

  blinkMastery: {

    mechanics: () => [

      'Transfert (E) : rayon d\'explosion +30 %, dégâts +20 %.',

      'Éliminer un ennemi avec l\'explosion remet Transfert à 50 % de recharge.',

    ],

  },

  cloneExtend: {

    mechanics: () => [

      'Barrage Arcanique (Espace) : +1 projectile central en rafale.',

      'Écartement latéral des tirs doublé pour couvrir une zone plus large.',

    ],

  },

  solarBeamHaste: {

    mechanics: () => [

      'Rayon Stellaire : taille du faisceau +10 %.',

      'Rayon Stellaire : +5 % PV max en dégâts au coup.',

      'Zone d\'impact et recul augmentés.',

    ],

  },

  healAmp: {

    mechanics: () => [

      'Soins reçus : +15 %.',

      'Champ de Lumière : rayon +2 m.',

      'Champ de Lumière : durée +2 s.',

      'Champ de Lumière : soin personnel +15 % par tick.',

    ],

  },

  beamHaste: {

    mechanics: () => [

      'Après Rayon Stellaire complet : +30 % vitesse de sprint.',

      'Durée : 2 s.',

    ],

  },

  overhealShield: {

    mechanics: () => [

      '50 % des soins excédentaires (au-dessus des PV max) deviennent un bouclier d\'absorption.',

      'Le bouclier est consommé avant les PV ; maximum = 25 % de vos PV max.',

    ],

  },

  solarInspiration: {

    paragraphs: () => [

      'Aura 14 m : alliés +15 % ATK et +1 % PV max/s.\nVous : +30 % ATK.',

      'Champ de Lumière devient Puits Solaire.\nEnnemis : −35 % vitesse · +25 % dégâts subis.',

      'Ancré dans le puits : +35 % dégâts infligés.\n+12 % dégâts reçus · soin 2 % PV/s.',

    ],

  },

  hemorrhage: {

    mechanics: () => [

      'Chaque critique applique Saignée : 20 % de vos dégâts du coup en DoT sur 3 s.',

      'Empilable jusqu\'à 3 fois sur la même cible.',

    ],

  },

  dashReset: {

    mechanics: () => [

      'Ombre Véloce (Shift) : 0,4 s d\'intangibilité à l\'arrivée du dash.',

      'Éliminer un ennemi dans les 3 s après le dash remet Shift à 40 % de recharge.',

    ],

  },

  cyclonePull: {

    mechanics: () => [

      'Toupie Létale (Espace) : aspiration continue vers le centre pendant la rotation.',

      'Durée +1 s · chaque ennemi aspiré subit un tick de 35 % ATK toutes les 0,5 s.',

    ],

  },

  eternalThirst: {

    paragraphs: () => [

      'Par % de PV manquant : +0,3 % critique et +0,3 % dégâts critiques.',

      'À 0 PV : jusqu\'à +30 % crit et +30 % dégâts crit.',

    ],

  },

  lastBreath: {

    paragraphs: () => [

      'Premier coup fatal évité.',

      'Survie à 1 PV.\nIntangibilité pendant 2 s.',

      'Recharge : 90 s.',

    ],

  },

  shieldOverflow: {

    mechanics: () => [

      'Capacité du Bouclier de Sang : +25 % PV max.',

      'Soins excédentaires sous bouclier : 35 % convertis en charge de bouclier supplémentaire.',

    ],

  },

  executioner: {

    mechanics: () => [

      'Cibles marquées (Verdict Sanguin) : +35 % dégâts subis.',

      'Durée de la marque : 6 s.',

    ],

  },

  frenzyAdrenaline: {

    mechanics: () => [

      'En Frénésie (E), tuer un ennemi remet Frénésie à 0 s de recharge.',

      'Une fois par activation de Frénésie maximum.',

    ],

  },

  vampJumpAmp: {

    mechanics: () => [

      'Saut Vampirique (Espace) : zone d\'impact 5 m → 6,75 m (+35 %).',

      'Dégâts d\'atterrissage +25 % ; étourdissement 2 s → 2,5 s.',

      'Soin par ennemi touché : 65 % ATK (au lieu de 50 %) ; cumule avec le +3 % vol de vie du nœud.',

    ],

    summary: () => 'Saut plus large, plus lent, plus de soin à l\'impact.',

  },

  bloodPact: {

    paragraphs: () => [

      '+45 % dégâts critiques.',

      'Chaque 3e projectile : Méga-Critique.\nMultiplicateur crit × 1,5.',

    ],

  },

  solarFlare: {
    mechanics: () => [
      'Fulgurance Solaire (Espace) : Dash en infligeant des dégâts aux ennemis traversés.',
      'Brûlure sur 3 ticks à 42 % des dégâts du coup (au lieu d\'1 tick à 30 %).',
    ],
  },

  lunarSpike: {

    mechanics: () => [

      'Pic de Lune (Shift) : rayon du burst +25 %, ralentissement +15 %.',

      'Dégâts du pic +12 %.',

    ],

  },

  orbitalWeave: {

    mechanics: () => [

      'Alterner Soleil puis Lune (ou l\'inverse) : +4 % ATK par stack (max 4, +16 %).',

      'Chaque compétence opposée à la précédente compte ; se réinitialise après 8 s sans sort.',

    ],

  },

  voidPull: {

    mechanics: () => [

      'Cataclysme (E) : aspiration des ennemis vers le centre à l\'explosion.',

      'Dégâts de Cataclysme +20 % lorsque le passif est actif.',

    ],

  },

  celestialConvergence: {

    paragraphs: () => [

      'Après Cataclysme : 6 attaques renforcées.\n+30 % dégâts · Soleil et Lune simultanés.',

      'Après Cataclysme : +50 % vitesse d\'attaque pendant 5 s.',

      'Brûlures appliquent Vulnérabilité cataclysmique.\n+25 % dégâts de Cataclysme.',

    ],

  },

  continuumBurst: {

    mechanics: () => [

      'Lentille (Espace) : cône +15 %.',

      'Lentille (Espace) : dégâts du rayon +8 %.',

      'Convergence Temporelle (E) : durée +0,5 s.',

      'Convergence Temporelle (E) : rayon de résonance +0,5 m.',

    ],

  },

  ruptureSurge: {

    mechanics: () => [

      'Explosion volontaire de Fracture (85–95 %) : +35 % dégâts.',

      'Rayon de l\'explosion : dégâts +8 %.',

    ],

  },

  anachronismeAmp: {

    mechanics: () => [

      'Coût Fracture des compétences : 25 (au lieu de 30).',

    ],

  },

  freezeFieldAmp: {

    mechanics: () => [

      'Déphasage (Shift) : portée +2 m, durée du champ +1 s.',

      'Instabilité appliquée aux ennemis : +2 s.',

    ],

  },

  continuumMastery: {

    paragraphs: () => [

      'Prismes Affinés : maximum 3.\nDurée initiale 5 s + 3,5 s Apex = 8,5 s par prisme.',

      'Chaque nouveau prisme prolonge tous les prismes actifs de +3,5 s.\nChaque prisme −20 % dégâts · duplication de rayons.',

      'Rayon via prisme : +100 % critique.\n−25 % dégâts critiques.',

      'Fracture max : 150 % (au lieu de 100 %).\n+0,33 % dégâts infligés par point de Fracture (jusqu\'à +49,5 % à 150 %).',

    ],

  },

};



function groupLinesIntoParagraphs(lines: string[]): string[] {
  if (!lines.length) return [];
  const out: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      out.push(buf.join('\n'));
      buf = [];
    }
  };
  for (const line of lines) {
    buf.push(line);
    const solo = /^(Recharge|Durée|Cumul|Maximum|Fracture max)/i.test(line);
    if (solo || buf.length >= 2) flush();
  }
  flush();
  return out;
}

export function getPassiveParagraphs(passiveKey: string, rank = 1, _classId?: ClassId): string[] {
  const def = PASSIVE_DETAILS[passiveKey];
  if (def?.paragraphs) return def.paragraphs(rank);
  if (def?.mechanics) return groupLinesIntoParagraphs(def.mechanics(rank));
  const meta = getPassiveMeta(passiveKey);
  return meta ? [meta.desc] : [];
}

export function getPassiveMechanics(passiveKey: string, rank = 1, classId?: ClassId): string[] {
  return getPassiveParagraphs(passiveKey, rank, classId).flatMap((p) => p.split('\n'));
}

export function formatPassiveDetailHtml(passiveKey: string, rank = 1, classId?: ClassId): string {
  const paragraphs = getPassiveParagraphs(passiveKey, rank, classId);
  if (!paragraphs.length) return '';
  return `<div class="detail-passive-prose">${paragraphs.map((block) => {
    const inner = block.split('\n').map((line) => `<span class="detail-passive-line">${line}</span>`).join('<br>');
    return `<p class="detail-passive-paragraph">${inner}</p>`;
  }).join('')}</div>`;
}



export function formatPassiveScalingHtml(_passiveKey: string, _rank = 1): string {

  return '';

}



export function formatPassiveScalingText(passiveKey: string, rank = 1): string {

  const def = PASSIVE_DETAILS[passiveKey];

  if (def?.summary) return def.summary(rank);

  return getPassiveParagraphs(passiveKey, rank).join(' ');

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


