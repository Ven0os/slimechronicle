// @ts-nocheck
import type { ClassId } from './constellations';
import { getNodeById } from './constellations';
import { getPassiveMeta } from './passiveCatalog';

export interface PassiveDetailDef {
  /** Puces de détail mécanique affichées dans le panneau constellation / grimoire. */
  mechanics: (rank: number) => string[];
  summary?: (rank: number) => string;
}

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

export const PASSIVE_DETAILS: Record<string, PassiveDetailDef> = {
  ironWall: {
    mechanics: () => [
      'Réduit tous les dégâts reçus de 8 %, en plus de la réduction par DEF et Peau de Fer.',
      'Cumulable avec les nœuds Rempart (+PV, +DEF).',
    ],
    summary: () => '−8 % dégâts reçus permanents.',
  },
  titanBlood: {
    mechanics: (rank) => [
      `Convertit ${rank * 2} % de vos PV maximum en DEF runique permanente.`,
      'Augmente les dégâts de l\'attaque, du Cri, de la Parade et surtout de la Frappe Sismique.',
      'Se recalcule automatiquement quand vos PV max augmentent.',
    ],
  },
  parryRefund: {
    mechanics: () => [
      'À la fin de Parade (E), réduit de 10 % le temps de recharge maximum de Espace, Shift et E.',
      'S\'applique même si aucun coup n\'a été bloqué.',
    ],
  },
  parryCharge: {
    mechanics: (rank) => [
      `En Parade, ${25 * rank} % des dégâts bloqués sont stockés en charge sismique.`,
      'La prochaine Frappe Sismique (Espace) ajoute cette charge aux dégâts d\'impact.',
      'La charge s\'affiche sous le HUD guerrier.',
    ],
  },
  runicColossus: {
    mechanics: () => [
      'Peau de Fer apex : −18 % dégâts reçus (remplace le −12 % de base).',
      'Parade stocke 40 % des dégâts bloqués pour la Frappe Sismique.',
      'Remplace l\'explosion « Retour de force » par la charge sismique.',
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
      `Après un sort, les deux autres compétences récupèrent ${rank >= 2 ? '1,2' : '0,6'} s de recharge.`,
      'Encourage la rotation Espace → Shift → E.',
    ],
  },
  paradoxOverload: {
    mechanics: () => [
      'Version apex : −1,2 s de recharge sur les deux autres sorts à chaque utilisation.',
      'Rotation quasi permanente entre les trois compétences.',
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
      'Les clones du Prisme durent 8 s au lieu de 5 s.',
      'Chaque clone conserve 60 % de vos dégâts à la création.',
    ],
  },
  solarBeamHaste: {
    mechanics: () => [
      'Rayon Stellaire (Espace) : temps de charge réduit de 1 s à 0,75 s (−25 %).',
      'Les dégâts du faisceau et sa portée sont inchangés.',
    ],
  },
  healAmp: {
    mechanics: () => [
      'Tous les soins reçus (auto-soin, alliés, régénération) : +15 %.',
      'Champ de Lumière (Shift) : rayon +2 m et soin de zone +10 %.',
    ],
  },
  beamHaste: {
    mechanics: () => [
      'Après un Rayon Stellaire complet : +30 % vitesse de sprint pendant 2 s.',
      'Permet de repositionner ou d\'esquiver pendant la fenêtre.',
    ],
  },
  overhealShield: {
    mechanics: () => [
      '50 % des soins excédentaires (au-dessus des PV max) deviennent un bouclier d\'absorption.',
      'Le bouclier est consommé avant les PV ; maximum = 25 % de vos PV max.',
    ],
  },
  solarInspiration: {
    mechanics: () => [
      'Aura solaire permanente (14 m) : alliés +15 % dégâts, +1 % PV max/s.',
      'Sur vous : +30 % dégâts (double du bonus allié), soin +1 % PV max/s (non doublé).',
      'En solo, l\'aura ne s\'applique qu\'à vous avec le bonus offensif doublé.',
    ],
    summary: () => 'Aura 14 m · alliés +15 % ATK · vous +30 % ATK · soin 1 % PV/s.',
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
      'Toupie Létale (Espace) attire les ennemis vers le centre (force légère).',
      'Durée de la toupie +1 s ; dégâts par tick inchangés.',
    ],
  },
  eternalThirst: {
    mechanics: (rank) => [
      `À bas PV : jusqu'à ${rank >= 2 ? '+60' : '+40'} % dégâts (seuil 30 % PV, linéaire).`,
      'Apex : seuil étendu à 50 % PV pour activer le bonus plus tôt.',
    ],
  },
  lastBreath: {
    mechanics: () => [
      'Premier coup fatal évité : vous survivez à 1 PV (CD 90 s).',
      'Texte « Dernier Souffle » affiché à l\'activation.',
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
      'Verdict Sanguin (Shift) : cibles marquées subissent +35 % dégâts de toutes vos sources.',
      'La marque dure 6 s et se voit sur l\'ennemi (texte « MARQUÉ »).',
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
    mechanics: () => [
      'Bouclier de Sang : plafond +40 % PV max.',
      'Frénésie (E) : +2 projectiles par rafale ; 3e balle de chaque rafale est un critique garanti.',
    ],
  },
  solarFlare: {
    mechanics: () => [
      'Éclat Solaire (Espace) : DoT +40 %, durée +2 s.',
      'Les rebonds infligent 50 % des dégâts initiaux (au lieu de 35 %).',
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
      'Cataclysme (E) attire les ennemis vers le centre pendant 1,5 s.',
      'Charge de Cataclysme +20 % plus rapide après un Pic de Lune.',
    ],
  },
  celestialConvergence: {
    mechanics: () => [
      'Après un cycle Soleil → Lune complet : Ascension permanente (+vitesse, +dégâts).',
      'Les bonus des deux astres restent actifs sans retomber en phase simple.',
    ],
  },
  continuumBurst: {
    mechanics: () => [
      'Lentille (Espace) : cône +15 %, dégâts du rayon +8 %.',
      'Convergence (E) : durée +0,5 s, rayon de résonance +0,5 m.',
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
      'Chaque compétence coûte 25 Fracture au lieu de 30 (−17 %).',
      'Libère plus souvent Déphasage et Convergence dans la même rotation.',
    ],
  },
  freezeFieldAmp: {
    mechanics: () => [
      'Déphasage (Shift) : portée +2 m, durée du champ +1 s.',
      'Instabilité appliquée aux ennemis : +2 s.',
    ],
  },
  continuumMastery: {
    mechanics: () => [
      'Forme Ascendant : +60 % dégâts du rayon continu.',
      'Fenêtre Écho élargie (80–98 % Fracture) ; surchauffe : −25 % contrecoup PV.',
    ],
  },
};

export function getPassiveMechanics(passiveKey: string, rank = 1): string[] {
  const def = PASSIVE_DETAILS[passiveKey];
  if (def) return def.mechanics(rank);
  const meta = getPassiveMeta(passiveKey);
  return meta ? [meta.desc] : [];
}

export function formatPassiveDetailHtml(passiveKey: string, rank = 1): string {
  const lines = getPassiveMechanics(passiveKey, rank);
  if (!lines.length) return '';
  return `<ul class="detail-passive-mechanics">${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`;
}

export function formatPassiveScalingHtml(_passiveKey: string, _rank = 1): string {
  return '';
}

export function formatPassiveScalingText(passiveKey: string, rank = 1): string {
  const def = PASSIVE_DETAILS[passiveKey];
  if (def?.summary) return def.summary(rank);
  return getPassiveMechanics(passiveKey, rank).join(' ');
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
