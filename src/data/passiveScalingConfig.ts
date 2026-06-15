// @ts-nocheck

import { STATE } from '@/core/config';

import type { ClassId } from './constellations';

import { getNodeById } from './constellations';

import { getPassiveMeta } from './passiveCatalog';



export interface PassiveDetailDef {

  /** Blocs de tooltip : une entree = une mecanique lisible. */

  paragraphs?: (rank: number) => string[];

  /** Lignes brutes — regroupées automatiquement si paragraphs absent. */

  mechanics?: (rank: number) => string[];

  summary?: (rank: number) => string;

}

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

const CELESTIAL_CONVERGENCE_PARAGRAPHS = () => [
  `RUPTURE ASTRALE :
Chaque ennemi touché réduit de 0,5 s la recharge restante de Pic de Lune.
Déclenche un second impact 0,25 s après le premier.
Premier impact :
90 % dégâts.
Second impact :
80 % dégâts.
Si la cible possède simultanément :
• Brûlure Solaire
• Fragilité Lunaire
Le second impact :
• Inflige des dégâts supplémentaires équivalents à 10 % des PV actuels de la cible au moment de l'impact.
• Réapplique les effets Solaires.
• Réapplique les effets Lunaires.`,
  `ATTAQUES DE LANCE :
Infligent +10 % dégâts aux cibles affectées simultanément par :
• Brûlure Solaire
• Fragilité Lunaire`,
  `ASCENSION :
• Le second impact de Rupture Astrale est garanti.
• Ascension n'inflige plus de dégâts au joueur.`,
  `CATACLYSME :
• Applique Fragilité Lunaire pendant 4 s.`,
];

const BLOOD_PACT_PARAGRAPHS = () => [
  `BLOOD PISTOL :
• Chaque tir applique une Marque de Sang.
• Chaque marque stocke 20 % des dégâts infligés + 1 % HP max de la cible.
• Maximum : 6 marques.`,
  `MARQUES DE SANG :
• À 6 marques, le prochain Blood Pistol consomme toutes les marques.
• Relâche 100 % des dégâts stockés.
• Peut déclencher plusieurs coups critiques.
• Bénéficie des bonus Blood Pistol.`,
  `VAMPIRISME :
• 50 % du vol de vie est converti en dégâts bonus sur Blood Pistol.`,
];

const CONTINUUM_MASTERY_PARAGRAPHS = () => [
  `PRISMES AFFINÉS :
• Maximum : 3 prismes simultanés.
• Durée initiale : 8,5 s (5 s + 3,5 s Apex).
• Chaque nouveau prisme prolonge tous les prismes actifs de +3,5 s.
• Rayons dupliqués : −20 % dégâts par profondeur de prisme.`,
  `FRACTURE :
• Plafond Apex : 150 % (au lieu de 100 %).
• Rayon de distorsion : +0,42 % dégâts et +0,05 % taille par point de Fracture.
• À 150 % Fracture : jusqu'à +63 % dégâts et +7,5 % taille.`,
  `SURCHARGE & SURCHAUFFE :
• Surcharge imminente : à partir de 145 % Fracture (plafond − 5 %).
• Surchauffe : à 150 % Fracture.`,
  `BRÛLURE TEMPORELLE :
• Requiert le passif Prisme Supplémentaire.
• Prisme : 4 rayons au lieu de 3.
• Rayons routés par un prisme : Brûlure Temporelle.
• 10 % des dégâts infligés par seconde pendant 3 s.
• Maximum : 3 cumuls.`,
];

const SOLAR_INSPIRATION_PARAGRAPHS = () => [
  `RAYON STELLAIRE :
• Les ennemis tués par Rayon Stellaire créent automatiquement un Puits de Lumière.`,
  `PUITS DE LUMIÈRE :
• Chaque allié présent dans le Puits gagne +15 % ATK.
• Le Sentinel reçoit le double de ce bonus.`,
  `BRÛLURE SOLAIRE :
• Les ennemis présents dans le Puits subissent Brûlure Solaire.`,
  `SINGULARITÉ :
• Les ennemis affectés par Brûlure Solaire subissent +15 % dégâts du Rayon Stellaire.`,
];

const RUNIC_COLOSSUS_PARAGRAPHS = () => [
  `PARADE :
• Chaque Parade réussie crée un Sceau Runique.
• Maximum : 5 Sceaux Runiques.`,
  `SCEAUX RUNIQUES :
• Les Sceaux orbitent autour du Guerrier Runique.
• Chaque Sceau stocke 250 % des dégâts bloqués par la Parade qui l'a généré.`,
  `CRI DE GUERRE :
• Consomme tous les Sceaux Runiques.
• Pour chaque Sceau : lance un projectile runique sur un ennemi proche.
• Inflige 150 % de la valeur stockée.`,
  `PARADE PARFAITE :
• Si 5 Sceaux Runiques sont consommés, Cri de Guerre est immédiatement réinitialisé.`,
];

const ETERNAL_THIRST_PARAGRAPHS = () => [
  `HP MANQUANTS :
• Chaque 1 % HP manquant accorde +0,3 % Chance Critique.
• Chaque 1 % HP manquant accorde +0,66 % Dégâts Critiques.
• Cap : 10 % HP restants.`,
  `SOIF DE SANG :
• En Apex, Soif de Sang stack 2x plus vite.
• Cap dégâts : +120 % au lieu de +100 %.
• À 30 % HP restants : +120 % dégâts.`,
  `RUPTURE :
• À 10 % HP restants, la prochaine compétence applique Hémorragie.
• Cette compétence crit automatiquement.
• Temps de recharge : 15 s.`,
  `EXÉCUTION :
• Si cette compétence tue une cible, elle réinitialise immédiatement son temps de recharge.
• Restaure 12,5 % Max HP.`,
];

const PARADOX_OVERLOAD_PARAGRAPHS = () => [
  `RÉCOMPENSE PARADOXALE :
• Toutes les 5 éliminations déclenchent un gain permanent.`,
  `STATS POSSIBLES :
• ATK
• HP max
• Vitesse
• Crit Chance
• Crit Damage
• DEF
• Régén
• Vol de vie`,
  `GAIN PAR PROC :
• +0,01 % à +0,09 % sur la stat tirée.
• Les cumuls persistent jusqu'à la fin de la partie.`,
];

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
    paragraphs: RUNIC_COLOSSUS_PARAGRAPHS,
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
    paragraphs: PARADOX_OVERLOAD_PARAGRAPHS,
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
    paragraphs: SOLAR_INSPIRATION_PARAGRAPHS,
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
    paragraphs: ETERNAL_THIRST_PARAGRAPHS,
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
    paragraphs: BLOOD_PACT_PARAGRAPHS,
  },

  devouringSun: {
    paragraphs: () => [
      'Brûlure Solaire :',
      'Chaque tick de brûlure a 20 % de chance de générer une Étincelle Solaire.',
      'À 5 Étincelles :',
      'La prochaine attaque de lance déclenche une Explosion Solaire.',
      'Explosion Solaire : 80 % dégâts de lance.',
    ],
  },

  solarFlare: {
    paragraphs: () => [
      'Débloque la charge des attaques de lance (maintenir ≥ 0,35 s).',
      'Charge maximale : +75 % portée à 2 s.',
      'La prochaine attaque chargée gagne +7 % dégâts par ennemi traversé par la dernière Fulgurance Solaire.',
      'Clic rapide : attaque normale sans bonus.',
    ],
  },

  lunarSpike: {
    paragraphs: () => [
      'Pic de Lune : rayon +25 %.',
      'Sous Cataclysme :',
      'Soigne 25 % des dégâts infligés.',
    ],
  },

  ruptureAstrale: {
    paragraphs: () => [
      'Tous les 4 coups de lance :',
      'Déclenche une Rupture Astrale.',
      'Premier impact : 90 % dégâts.',
      'Second impact (0,25 s) : 80 % dégâts.',
      'Applique les effets Solaires et Lunaires actifs · génère de l\'énergie Cataclysme.',
      'Si Brûlure Solaire + Fragilité Lunaire : second impact inflige +10 % PV actuels et réapplique les effets.',
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
    paragraphs: CELESTIAL_CONVERGENCE_PARAGRAPHS,
  },

  extraPrismLens: {
    paragraphs: () => [
      'Prisme (Espace) :\nGénère 4 rayons au lieu de 3.',
      'Rayons prismatiques :\nDégâts -10% par rayon.',
      'Tirer à travers un Prisme :\nApplique Brûlure Temporelle.',
      'Brûlure Temporelle :\n10% des dégâts infligés par seconde pendant 3 s.',
      'Maximum 3 cumuls.',
    ],
  },

  continuumBurst: {
    paragraphs: () => [
      'Prisme (Espace) : cône +15 % · dégâts du rayon +8 %.',
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
    paragraphs: CONTINUUM_MASTERY_PARAGRAPHS,
  },

};



Object.assign(PASSIVE_DETAILS, {
  ironWall: {
    paragraphs: () => [
      'Défense : −8 % dégâts reçus en plus de la réduction par DEF.',
      'Parade : durée +3,5 s ; chaque blocage soigne 1 % HP max, ou 3 % à la fin si un blocage a eu lieu.',
    ],
  },

  titanBlood: {
    paragraphs: (rank) => [
      `Sang de Titan : convertit ${rank * 2} % HP max en DEF bonus permanente.`,
      'Compétences de guerrier : attaque, Cri, Parade et Frappe Sismique gagnent du scaling DEF ; fin de Parade donne +10 % vitesse pendant 3 s.',
    ],
  },

  guardianWarCry: {
    paragraphs: () => [
      'Cri de Guerre : soigne 35 % moins, mais affecte les alliés dans 12 m.',
      'Alliés touchés : +10 % de votre DEF pendant 6 s.',
    ],
  },

  parryRefund: {
    paragraphs: () => [
      'Fin de Parade : −10 % recharge max sur Espace, Shift et E ; confère 0,4 s d\'intangibilité.',
    ],
  },

  parryCharge: {
    paragraphs: (rank) => [
      `Parade : stocke ${25 * rank} % des dégâts bloqués.`,
      'Fin de Parade : déclenche une Frappe Sismique gratuite ; la charge stockée est ajoutée au séisme (rayon 12 m).',
    ],
  },

  runicColossus: {
    paragraphs: RUNIC_COLOSSUS_PARAGRAPHS,
  },

  warFervor: {
    paragraphs: () => [
      'Attaque de base : +3 % dégâts par stack, max 5 (+15 %) ; stacks conservés jusqu\'à la fin du combat.',
    ],
  },

  arcaneOverload: {
    paragraphs: (rank) => [
      `Après un sort : les deux autres compétences récupèrent −${rank >= 2 ? '1,2' : '0,6'} s de recharge ; le sort lancé n'est pas réduit.`,
    ],
  },

  paradoxOverload: {
    paragraphs: PARADOX_OVERLOAD_PARAGRAPHS,
  },

  deepStasis: {
    paragraphs: () => [
      'Chronostase (Shift) : ralentissement 85 % au lieu de 70 %, zone +1 m.',
      'Contrôle : les ennemis figés subissent vos sorts avec un retard accru.',
    ],
  },

  blinkMastery: {
    paragraphs: () => [
      'Transfert (E) : explosion +30 % rayon et +20 % dégâts.',
      'Kill avec l\'explosion : remet Transfert à 50 % recharge.',
    ],
  },

  paradoxReplicated: {
    paragraphs: () => [
      'Transfert (E) : laisse un clone 8 s, maximum 2 clones.',
      'Clones : reproduisent Barrage Arcanique et Chronostase à 25 % efficacité ; compétence reproduite −10 % recharge, sans récursion sur Transfert.',
    ],
  },

  cloneExtend: {
    paragraphs: () => [
      'Barrage Arcanique (Espace) : +1 projectile central et écartement latéral doublé.',
    ],
  },

  stellarOvercharge: {
    paragraphs: () => [
      'Rayon Stellaire : charge de 50 % à 250 % dégâts en 3,25 s ; la jauge affiche l\'amplification.',
      'Charge maximale : +20 % portée.',
    ],
  },

  solarBeamHaste: {
    paragraphs: () => [
      'Rayon Stellaire : faisceau +10 % taille, +5 % HP max en dégâts au coup, zone d\'impact et recul augmentés.',
    ],
  },

  healAmp: {
    paragraphs: () => [
      'Soins reçus : +15 %.',
      'Champ de Lumière : rayon +2 m, durée +2 s et soin personnel +15 % par tick.',
    ],
  },

  beamHaste: {
    paragraphs: () => [
      'Rayon Stellaire complet : +30 % vitesse de sprint pendant 2 s.',
    ],
  },

  overhealShield: {
    paragraphs: () => [
      'Soins excédentaires : 50 % devient bouclier d\'absorption, cap 25 % HP max ; le bouclier est consommé avant les HP.',
    ],
  },

  solarInspiration: {
    paragraphs: SOLAR_INSPIRATION_PARAGRAPHS,
  },

  bloodFrenzy: {
    paragraphs: () => [
      'Sous 50 % HP : Frénésie 6 s, +10 % HP max en dégâts par attaque et +25 % vitesse d\'attaque.',
      'Critiques en Frénésie : +0,5 s durée, maximum 10 s.',
    ],
  },

  hemorrhage: {
    paragraphs: () => [
      'Critiques : appliquent Saignée, 20 % des dégâts du coup en DoT sur 3 s, maximum 3 stacks par cible.',
    ],
  },

  dashReset: {
    paragraphs: () => [
      'Ombre Véloce (Shift) : 0,4 s d\'intangibilité à l\'arrivée.',
      'Kill sous 3 s après le dash : remet Shift à 40 % recharge.',
    ],
  },

  cyclonePull: {
    paragraphs: () => [
      'Toupie Létale (Espace) : aspire les ennemis pendant la rotation, durée +1 s.',
      'Ennemis aspirés : subissent 35 % ATK toutes les 0,5 s.',
    ],
  },

  eternalThirst: {
    paragraphs: ETERNAL_THIRST_PARAGRAPHS,
  },

  lastBreath: {
    paragraphs: () => [
      'Coup fatal : évité une fois, survie à 1 HP et intangibilité 2 s.',
      'Recharge : 90 s.',
    ],
  },

  shieldOverflow: {
    paragraphs: () => [
      'Bouclier de Sang : capacité +25 % HP max.',
      'Soins excédentaires sous bouclier : 35 % convertis en charge supplémentaire au-delà du cap de base.',
    ],
  },

  executioner: {
    paragraphs: () => [
      'Verdict Sanguin : cibles marquées subissent +35 % dégâts pendant 6 s.',
    ],
  },

  frenzyAdrenaline: {
    paragraphs: () => [
      'Frénésie (E) : tuer un ennemi remet la compétence à 0 s de recharge, une fois par activation.',
    ],
  },

  acceleratedTransfusion: {
    paragraphs: () => [
      'Blood Pistol : vitesse d\'attaque +40 %, dégâts −15 % et vitesse projectile +25 %.',
      'Auto-transfusion : dégâts subis −30 % pendant l\'effet.',
    ],
  },

  vampJumpAmp: {
    paragraphs: () => [
      'Saut Vampirique (Espace) : zone 5 m → 6,75 m, dégâts +25 %, étourdissement 2 s → 2,5 s.',
      'Soin : 65 % ATK par ennemi touché au lieu de 50 %.',
    ],
    summary: () => 'Saut plus large, plus lent, plus de soin à l\'impact.',
  },

  bloodPact: {
    paragraphs: BLOOD_PACT_PARAGRAPHS,
  },

  devouringSun: {
    paragraphs: () => [
      'Brûlure Solaire : 20 % de chance d\'Étincelle Solaire par tick.',
      '5 Étincelles → Explosion Solaire sur la prochaine attaque de lance (80 % dégâts).',
    ],
  },

  solarFlare: {
    paragraphs: () => [
      'Débloque la charge des attaques de lance (max +75 % portée).',
      'Prochaine attaque chargée : +7 % dégâts par ennemi de la dernière Fulgurance Solaire.',
      'Sous Cataclysme : brûlure solaire, effets lunaires et feedback renforcé.',
    ],
  },

  lunarSpike: {
    paragraphs: () => [
      'Pic de Lune : rayon +25 %.',
      'Sous Cataclysme : soigne 25 % des dégâts infligés.',
    ],
  },

  ruptureAstrale: {
    paragraphs: () => [
      'Tous les 4 coups de lance : déclenche une Rupture Astrale.',
      'Premier impact : 90 % dégâts · second impact (0,25 s) : 80 % dégâts.',
      'Applique les effets Solaires et Lunaires actifs · génère de l\'énergie Cataclysme.',
      'Brûlure + Fragilité : second impact +10 % PV actuels et réapplication des effets.',
    ],
  },

  voidPull: {
    paragraphs: () => [
      'Cataclysme (E) : aspire les ennemis au centre et inflige +20 % dégâts.',
    ],
  },

  celestialConvergence: {
    paragraphs: CELESTIAL_CONVERGENCE_PARAGRAPHS,
  },

  extraPrismLens: {
    paragraphs: () => [
      'Prisme (Espace) : génère 4 rayons au lieu de 3.',
      'Rayons prismatiques : −10 % dégâts par rayon.',
      'Tirer à travers un Prisme : applique Brûlure temporelle.',
    ],
  },

  continuumBurst: {
    paragraphs: () => [
      'Prisme (Espace) : cône +15 % et rayon +8 % dégâts.',
      'Convergence Temporelle (E) : durée +0,5 s et rayon de résonance +0,5 m.',
    ],
  },

  ruptureSurge: {
    paragraphs: () => [
      'Explosion volontaire de Fracture (85–95 %) : +35 % dégâts ; explosion +8 % dégâts.',
    ],
  },

  anachronismeAmp: {
    paragraphs: () => [
      'Compétences Chrono : coût Fracture 25 au lieu de 30, pour enchaîner plus de sorts.',
    ],
  },

  freezeFieldAmp: {
    paragraphs: () => [
      'Déphasage (Shift) : portée +2 m, champ +1 s et Instabilité +2 s.',
    ],
  },

  continuumMastery: {
    paragraphs: CONTINUUM_MASTERY_PARAGRAPHS,
  },
});



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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function escapeHtml(text: string): string {
  return decodeHtmlEntities(text).replace(/[&<>"]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[ch] as string));
}

const PASSIVE_VALUE_PATTERN = /([+−-]?\d+(?:[,.]\d+)?\s*(?:%|s|m|HP|ATK|DEF|Fracture|ticks?|stacks?)?|[×x]\s*\d+(?:[,.]\d+)?)/gi;

function highlightPassiveValues(text: string): string {
  const normalized = decodeHtmlEntities(text);
  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(PASSIVE_VALUE_PATTERN.source, PASSIVE_VALUE_PATTERN.flags);
  while ((match = regex.exec(normalized)) !== null) {
    parts.push(escapeHtml(normalized.slice(last, match.index)));
    parts.push(`<strong class="detail-passive-value">${escapeHtml(match[0])}</strong>`);
    last = match.index + match[0].length;
  }
  parts.push(escapeHtml(normalized.slice(last)));
  return parts.join('');
}

function splitPassiveMechanicBlock(block: string): { label: string; bodyLines: string[] } {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { label: '', bodyLines: [] };

  const first = lines[0];
  const colonIdx = first.indexOf(':');
  const hasLabel = colonIdx > 0 && colonIdx <= 42;
  if (!hasLabel) return { label: '', bodyLines: lines };

  const label = first.slice(0, colonIdx).trim();
  const firstBody = first.slice(colonIdx + 1).trim();
  const bodyLines = firstBody ? [firstBody, ...lines.slice(1)] : lines.slice(1);
  return { label, bodyLines };
}

function isPassiveBulletLine(line: string): boolean {
  return line.startsWith('• ') || line.startsWith('- ');
}

function stripPassiveBulletMarker(line: string): string {
  return isPassiveBulletLine(line) ? line.slice(2) : line;
}

function formatPassiveBodyLine(line: string): string {
  if (isPassiveBulletLine(line)) {
    return `<li class="detail-passive-bullet">${highlightPassiveValues(stripPassiveBulletMarker(line))}</li>`;
  }
  return `<p class="detail-passive-line-p">${highlightPassiveValues(line)}</p>`;
}

function formatPassiveMechanicBlock(block: string): string {
  const { label, bodyLines } = splitPassiveMechanicBlock(block);
  if (!label && !bodyLines.length) return '';

  const chunks: string[] = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      chunks.push('</ul>');
      listOpen = false;
    }
  };

  for (const line of bodyLines) {
    if (isPassiveBulletLine(line)) {
      if (!listOpen) {
        chunks.push('<ul class="detail-passive-list">');
        listOpen = true;
      }
      chunks.push(formatPassiveBodyLine(line));
      continue;
    }
    closeList();
    chunks.push(formatPassiveBodyLine(line));
  }
  closeList();

  return `<section class="detail-passive-section">
    ${label ? `<h4 class="detail-passive-section-title">${escapeHtml(label)}</h4>` : ''}
    <div class="detail-passive-section-body">${chunks.join('')}</div>
  </section>`;
}

export function formatPassiveDetailHtml(passiveKey: string, rank = 1, classId?: ClassId): string {
  const paragraphs = getPassiveParagraphs(passiveKey, rank, classId);
  if (!paragraphs.length) return '';
  const proseClass = rank >= 2 ? 'detail-passive-prose detail-passive-prose-apex' : 'detail-passive-prose';
  return `<div class="${proseClass}">${paragraphs.map((block) => {
    const inner = formatPassiveMechanicBlock(block);
    return `<div class="detail-passive-paragraph">${inner}</div>`;
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
