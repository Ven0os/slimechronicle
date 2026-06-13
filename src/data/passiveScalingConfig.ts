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
    paragraphs: () => [
      '−8 % dégâts reçus (cumul DEF et Peau de Fer).',
      'Parade : durée +3,5 s.',
      'Blocage : soigne 1 % HP max.',
      'Fin de Parade avec blocage : soigne 3 % HP max.',
    ],
  },

  titanBlood: {
    paragraphs: (rank) => [
      `Convertit ${rank * 2} % HP max en DEF bonus permanente.`,
      'Augmente les dégâts de l\'attaque, du Cri, de la Parade et de la Frappe Sismique.',
      'Fin de Parade : +10 % vitesse de sprint pendant 3 s.',
    ],
  },

  guardianWarCry: {
    paragraphs: () => [
      'Cri de Guerre : soins réduits de 35 %.',
      'Alliés à portée (12 m) : +10 % de votre DEF pendant 6 s.',
      'Le cri de guerre affecte les alliés en multijoueur dans la zone.',
    ],
  },

  parryRefund: {
    paragraphs: () => [
      'Fin de Parade : −10 % recharge max (Espace, Shift, E).',
      'Fin de Parade : 0,4 s d\'intangibilité.',
      'Chaque fin de Parade réduit le temps d\'attente de vos trois compétences.',
    ],
  },

  parryCharge: {
    paragraphs: (rank) => [
      `Parade : ${25 * rank} % des dégâts bloqués stockés en charge.`,
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
    paragraphs: (rank) => [
      `Après un sort : les deux autres compétences −${rank >= 2 ? '1,2' : '0,6'} s de recharge.`,
      'Enchaîner Espace, Shift et E accélère votre rotation magique.',
      'Ne réduit pas la recharge du sort que vous venez de lancer.',
    ],
  },

  paradoxOverload: {

    paragraphs: () => [

      'Tous les 5 éliminations : bonus de stat permanent.',

      'Stat aléatoire parmi ATK, HP, vitesse, Crit Chance, DEF…\n+0,01 % à +0,09 % par gain.',

      'Cumul persistant sur la partie.',

    ],

  },

  deepStasis: {
    paragraphs: () => [
      'Chronostase (Shift) : ralentissement des ennemis porté à 85 % (au lieu de 70 %).',
      'Zone de stase légèrement élargie (+1 m).',
      'Les ennemis gelés subissent vos sorts avec un retard accru.',
    ],
  },

  blinkMastery: {
    paragraphs: () => [
      'Transfert (E) : rayon d\'explosion +30 %, dégâts +20 %.',
      'Éliminer un ennemi avec l\'explosion remet Transfert à 50 % de recharge.',
      'L\'explosion à l\'arrivée touche une zone plus large.',
    ],
  },

  paradoxReplicated: {
    paragraphs: () => [
      'Transfert (E) laisse un clone actif pendant 8 s (maximum 2 clones).',
      'Les clones reproduisent Barrage Arcanique et Chronostase à 25 % d\'efficacité.',
      'Compétence reproduite : −10 % de recharge sur le sort d\'origine.\nPas de récursion sur Transfert.',
    ],
  },

  cloneExtend: {
    paragraphs: () => [
      'Barrage Arcanique (Espace) : +1 projectile central en rafale.',
      'Écartement latéral des tirs doublé pour couvrir une zone plus large.',
      'La rafale couvre un arc plus large devant vous.',
    ],
  },

  stellarOvercharge: {
    paragraphs: () => [
      'Rayon Stellaire : charge de 50 % à 250 % de dégâts.',
      'Charge maximale après 3,25 s.',
      'À 250 % : +20 % Portée.',
      'Une jauge affiche l\'amplification actuelle en temps réel.',
    ],
  },

  solarBeamHaste: {
    paragraphs: () => [
      'Rayon Stellaire : taille du faisceau +10 %.',
      'Rayon Stellaire : +5 % HP max en dégâts au coup.',
      'Zone d\'impact et recul augmentés.',
    ],
  },

  healAmp: {
    paragraphs: () => [
      'Soins reçus : +15 %.',
      'Champ de Lumière : rayon +2 m · durée +2 s.',
      'Champ de Lumière : soin personnel +15 % par tick.',
    ],
  },

  beamHaste: {
    paragraphs: () => [
      'Après Rayon Stellaire complet : +30 % vitesse de sprint.',
      'Durée du burst : 2 s.',
      'Permet de repositionner rapidement après un tir chargé.',
    ],
  },

  overhealShield: {
    paragraphs: () => [
      '50 % des soins excédentaires (au-dessus du HP max) deviennent un bouclier d\'absorption.',
      'Le bouclier est consommé avant les HP.',
      'Capacité maximale du bouclier : 25 % de votre HP max.',
    ],
  },

  solarInspiration: {

    paragraphs: () => [

      'Aura 14 m : alliés +15 % ATK et +1 % HP/s.\nVous : +30 % ATK.',

      'Champ de Lumière devient Puits Solaire.\nEnnemis : −35 % vitesse · +25 % dégâts subis.',

      'Ancré dans le puits : +35 % dégâts infligés.\n+12 % dégâts reçus · soin 2 % HP/s.',

    ],

  },

  bloodFrenzy: {
    paragraphs: () => [
      'Sous 50 % HP : Frénésie offensive pendant 6 s.',
      'Frénésie : +10 % HP max en dégâts par attaque · vitesse d\'attaque +25 %.',
      'Critical hits en Frénésie : prolonge la durée de 0,5 s (maximum 10 s).',
    ],
  },

  hemorrhage: {
    paragraphs: () => [
      'Chaque critique applique Saignée : 20 % de vos dégâts du coup en DoT sur 3 s.',
      'Empilable jusqu\'à 3 fois sur la même cible.',
      'Les stacks de Saignée prolongent la fenêtre de burst.',
    ],
  },

  dashReset: {
    paragraphs: () => [
      'Ombre Véloce (Shift) : 0,4 s d\'intangibilité à l\'arrivée du dash.',
      'Éliminer un ennemi dans les 3 s après le dash remet Shift à 40 % de recharge.',
      'Permet d\'enchaîner les assassinats en mobilité.',
    ],
  },

  cyclonePull: {
    paragraphs: () => [
      'Toupie Létale (Espace) : aspiration continue vers le centre pendant la rotation.',
      'Durée +1 s.',
      'Chaque ennemi aspiré subit un tick de 35 % ATK toutes les 0,5 s.',
    ],
  },

  eternalThirst: {

    paragraphs: () => [

      'Par % de HP manquant : +0,3 % Crit Chance et +0,3 % Crit Damage.',

      'À 0 HP : jusqu\'à +30 % Crit Chance et +30 % Crit Damage.',

    ],

  },

  lastBreath: {

    paragraphs: () => [

      'Premier coup fatal évité.',

      'Survie à 1 HP.\nIntangibilité pendant 2 s.',

      'Recharge : 90 s.',

    ],

  },

  shieldOverflow: {
    paragraphs: () => [
      'Capacité du Bouclier de Sang : +25 % HP max.',
      'Soins excédentaires sous bouclier : 35 % convertis en charge de bouclier supplémentaire.',
      'Le bouclier peut dépasser sa capacité de base via l\'overflow.',
    ],
  },

  executioner: {
    paragraphs: () => [
      'Cibles marquées (Verdict Sanguin) : +35 % dégâts subis.',
      'Durée de la marque : 6 s.',
      'Les compétences suivantes frappent les condamnés bien plus fort.',
    ],
  },

  frenzyAdrenaline: {
    paragraphs: () => [
      'En Frénésie (E), tuer un ennemi remet Frénésie à 0 s de recharge.',
      'Une fois par activation de Frénésie maximum.',
      'Récompense l\'agression soutenue en zone.',
    ],
  },

  acceleratedTransfusion: {
    paragraphs: () => [
      'Blood Pistol (Frénésie) : vitesse d\'attaque +40 %.',
      'Auto-transfusion : dégâts subis −30 %.',
      'Projectiles : dégâts −15 % · vitesse du projectile +25 %.',
    ],
  },

  vampJumpAmp: {
    paragraphs: () => [
      'Saut Vampirique (Espace) : zone d\'impact 5 m → 6,75 m (+35 %).',
      'Dégâts d\'atterrissage +25 % · étourdissement 2 s → 2,5 s.',
      'Soin par ennemi touché : 65 % ATK (au lieu de 50 %).',
    ],
    summary: () => 'Saut plus large, plus lent, plus de soin à l\'impact.',
  },

  bloodPact: {

    paragraphs: () => [

      '+45 % Crit Damage.',

      'Chaque 3e projectile : Méga-Critique.\nMultiplicateur crit × 1,5.',

    ],

  },

  devouringSun: {
    paragraphs: () => [
      'Attaques de lance (Soleil) : portée +30 %.',
      'Brûlure Solaire : dégâts +40 % · durée +2 s (3 ticks).',
      'Chaque tick de brûlure applique la vulnérabilité cataclysmique.',
    ],
  },

  solarFlare: {
    paragraphs: () => [
      'Fulgurance Solaire (Espace) : dash en infligeant des dégâts aux ennemis traversés.',
      'Brûlure sur 3 ticks à 42 % des dégâts du coup (au lieu d\'1 tick à 30 %).',
      'Chaque ennemi traversé reçoit la brûlure complète.',
    ],
  },

  lunarSpike: {
    paragraphs: () => [
      'Pic de Lune (Shift) : rayon du burst +25 %, ralentissement +15 %.',
      'Dégâts du pic +12 %.',
      'Le ralentissement lunaire facilite les enchaînements Soleil/Lune.',
    ],
  },

  orbitalWeave: {
    paragraphs: () => [
      'Alterner Soleil puis Lune (ou l\'inverse) : +4 % ATK par stack (max 4, +16 %).',
      'Chaque compétence opposée à la précédente compte.',
      'Les stacks se réinitialisent après 8 s sans sort.',
    ],
  },

  voidPull: {
    paragraphs: () => [
      'Cataclysme (E) : aspiration des ennemis vers le centre à l\'explosion.',
      'Dégâts de Cataclysme +20 % lorsque le passif est actif.',
      'Regroupe les cibles avant le burst gravitationnel.',
    ],
  },

  celestialConvergence: {

    paragraphs: () => [

      'Après Cataclysme : 6 attaques renforcées.\n+30 % dégâts · Soleil et Lune simultanés.',

      'Après Cataclysme : +50 % vitesse d\'attaque pendant 5 s.',

      'Brûlures appliquent Vulnérabilité cataclysmique.\n+25 % dégâts de Cataclysme.',

    ],

  },

  extraPrismLens: {
    paragraphs: () => [
      'Lentille de Focalisation : split en 4 rayons au lieu de 3.',
      'Rayons prismatiques : dégâts −10 % par rayon.',
      'Rayons prismatiques : infligent une brûlure temporelle.',
    ],
  },

  continuumBurst: {
    paragraphs: () => [
      'Lentille (Espace) : cône +15 % · dégâts du rayon +8 %.',
      'Convergence Temporelle (E) : durée +0,5 s.',
      'Convergence Temporelle (E) : rayon de résonance +0,5 m.',
    ],
  },

  ruptureSurge: {
    paragraphs: () => [
      'Explosion volontaire de Fracture (85–95 %) : +35 % dégâts.',
      'Rayon de l\'explosion : dégâts +8 %.',
      'Déclencher volontairement la rupture devient bien plus rentable.',
    ],
  },

  anachronismeAmp: {
    paragraphs: () => [
      'Coût Fracture des compétences : 25 (au lieu de 30).',
      'Libère de la Fracture pour enchaîner plus de sorts.',
      'S\'applique à toutes les compétences consommant de la Fracture.',
    ],
  },

  freezeFieldAmp: {
    paragraphs: () => [
      'Déphasage (Shift) : portée +2 m, durée du champ +1 s.',
      'Instabilité appliquée aux ennemis : +2 s.',
      'Le champ de distorsion couvre une zone plus large et plus longtemps.',
    ],
  },

  continuumMastery: {

    paragraphs: () => [

      'Prismes Affinés : maximum 3.\nDurée initiale 5 s + 3,5 s Apex = 8,5 s par prisme.',

      'Chaque nouveau prisme prolonge tous les prismes actifs de +3,5 s.\nChaque prisme −20 % dégâts · duplication de rayons.',

      'Rayon via prisme : +100 % Crit Chance.\n−25 % Crit Damage.',

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


