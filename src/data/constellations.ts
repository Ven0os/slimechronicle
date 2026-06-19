/** Définitions des constellations — une carte unique par classe. */

import type { SkillKey } from './classStatsConfig';

export type ClassId =
  | 'warrior'
  | 'mage'
  | 'sentinel'
  | 'blade'
  | 'pacifier'
  | 'eclipse'
  | 'chronoregulator';

export interface NodeEffects {
  atk?: number;
  maxHpPct?: number;
  maxHpFlat?: number;
  /** Vitesse de sprint (déplacement). */
  speed?: number;
  speedPct?: number;
  crit?: number;
  critDmg?: number;
  /** Réduction recharge d'UN sort (négatif = plus rapide), ex. `{ shift: -0.12 }`. */
  skillCdMods?: Partial<Record<'space' | 'shift' | 'e', number>>;
  /** Cadence des attaques de base (négatif = plus rapide). */
  attackSpeedMod?: number;
  regen?: number;
  lifesteal?: number;
  def?: number;
  /** Défense (alias universel de `def`). */
  defense?: number;
  xpMod?: number;
  /** Bonus % additif sur UN sort précis (ex. `{ space: 0.1 }` = +10% Rayon Stellaire). */
  skillMods?: Partial<Record<SkillKey, number>>;
  /** Passif runtime — réservé aux keystones (palier 10) et apex. */
  passive?: string;
  passiveRank?: number;
}

export interface ConstellationNode {
  id: string;
  branch: string;
  tier: number;
  name: string;
  desc: string;
  icon: string;
  cost: number;
  requires?: string[];
  effects: NodeEffects;
  keystone?: boolean;
}

export interface ConstellationBranch {
  id: string;
  label: string;
  slot: 'atk' | 'hp' | 'spd' | 'mst';
  nodes: ConstellationNode[];
}

export interface ClassConstellation {
  classId: ClassId;
  title: string;
  subtitle: string;
  themeColor: string;
  apex: ConstellationNode;
  branches: ConstellationBranch[];
}

function branch10(
  classId: ClassId,
  branch: string,
  slot: ConstellationBranch['slot'],
  label: string,
  defs: Array<{
    name: string;
    desc: string;
    icon: string;
    effects: NodeEffects;
    keystone?: boolean;
  }>
): ConstellationBranch {
  const nodes: ConstellationNode[] = defs.map((d, i) => ({
    ...d,
    id: `${classId}-${branch}-${i + 1}`,
    branch,
    tier: i + 1,
    cost: 1,
    requires: i > 0 ? [`${classId}-${branch}-${i}`] : undefined,
  }));
  return { id: branch, label, slot, nodes };
}

export const CLASS_CONSTELLATIONS: Record<ClassId, ClassConstellation> = {
  warrior: {
    classId: 'warrior',
    title: 'Forteresse Runique',
    subtitle: 'Remparts, fureur et retribution',
    themeColor: '#8e44ad',
    apex: {
      id: 'warrior-apex',
      branch: 'apex',
      tier: 11,
      name: 'Jugement Runique',
      desc: 'Parade : Sceaux Runiques · Cri de Guerre déclenche une volée de projectiles.',
      icon: 'fa-crown',
      cost: 2,
      keystone: true,
      effects: { passive: 'runicColossus', passiveRank: 2 },
    },
    branches: [
      branch10('warrior', 'rempart', 'hp', 'Rempart', [
        { name: 'Cuirasse', desc: '+25 HP', icon: 'fa-shield', effects: { maxHpFlat: 25 } },
        { name: 'Garde-Fer', desc: '+8 DEF', icon: 'fa-shield-halved', effects: { def: 8 } },
        { name: 'Forteresse', desc: '+20 HP', icon: 'fa-icicles', effects: { maxHpFlat: 20 } },
        { name: 'Écorce de Fer', desc: '+30 HP', icon: 'fa-tree', effects: { maxHpFlat: 30 } },
        { name: 'Peau de Pierre', desc: '+10 DEF', icon: 'fa-gem', effects: { def: 10 } },
        { name: 'Résilience', desc: '+35 HP', icon: 'fa-heart', effects: { maxHpFlat: 35 } },
        { name: 'Rempart d\'Acier', desc: '+12 DEF', icon: 'fa-shield', effects: { def: 12 } },
        { name: 'Vitalité Runique', desc: '+40 HP', icon: 'fa-mountain', effects: { maxHpFlat: 40 } },
        { name: 'Bastion de Fer', desc: '+15 DEF', icon: 'fa-fort-awesome', effects: { def: 15 } },
        {
          name: 'Mur Impénétrable',
          desc: 'Passif : réduction de dégâts, parade renforcée et soins au blocage.\n\nBONUS DE STATS\n+40 HP\n+10 DEF\n+1.0 HP/s',
          icon: 'fa-fort-awesome',
          keystone: true,
          effects: { maxHpFlat: 40, def: 10, regen: 1.0, passive: 'ironWall' }
        }
      ]),
      branch10('warrior', 'fureur', 'atk', 'Fureur', [
        { name: 'Lame Lourde', desc: '+4 ATK', icon: 'fa-gavel', effects: { atk: 4 } },
        { name: 'Ferveur', desc: '+4 ATK', icon: 'fa-fire', effects: { atk: 4 } },
        { name: 'Sang de Bataille', desc: '+6 ATK', icon: 'fa-droplet', effects: { atk: 6 } },
        { name: 'Rage Croissante', desc: '+6 ATK', icon: 'fa-fire-flame-curved', effects: { atk: 6 } },
        { name: 'Force Brute', desc: '+8 ATK', icon: 'fa-hand-fist', effects: { atk: 8 } },
        { name: 'Courroux', desc: '+8 ATK', icon: 'fa-bolt', effects: { atk: 8 } },
        { name: 'Fureur Interne', desc: '+10 ATK', icon: 'fa-burst', effects: { atk: 10 } },
        { name: 'Lame de Sang', desc: '+10 ATK', icon: 'fa-droplet', effects: { atk: 10 } },
        { name: 'Puissance Pure', desc: '+12 ATK', icon: 'fa-dumbbell', effects: { atk: 12 } },
        {
          name: 'Sang de Titan',
          desc: 'Passif : HP convertis en DEF bonus et dégâts amplifiés.\n\nBONUS DE STATS\n+10 ATK\n+30 HP\n+8% Crit Chance',
          icon: 'fa-dumbbell',
          keystone: true,
          effects: { atk: 10, maxHpFlat: 30, crit: 0.08, passive: 'titanBlood' }
        }
      ]),
      branch10('warrior', 'cri', 'spd', 'Cri', [
        { name: 'Allure de Guerre', desc: '+1.0 Vitesse sprint', icon: 'fa-shoe-prints', effects: { speed: 1.0 } },
        { name: 'Hâte Martiale', desc: '-8% CD Cri de Guerre', icon: 'fa-bolt', effects: { skillCdMods: { shift: -0.08 } } },
        { name: 'Élan Tactique', desc: '+0.8 Vitesse sprint', icon: 'fa-bullhorn', effects: { speed: 0.8 } },
        { name: 'Souffle Martial', desc: '-6% CD Cri de Guerre', icon: 'fa-wind', effects: { skillCdMods: { shift: -0.06 } } },
        { name: 'Célérité', desc: '+0.8 Vitesse sprint', icon: 'fa-person-running', effects: { speed: 0.8 } },
        { name: 'Cri Écho', desc: '-5% CD Cri de Guerre', icon: 'fa-volume-high', effects: { skillCdMods: { shift: -0.05 } } },
        { name: 'Allure Légère', desc: '+0.6 Vitesse sprint', icon: 'fa-feather', effects: { speed: 0.6 } },
        { name: 'Réduction Tactique', desc: '-5% CD Cri de Guerre', icon: 'fa-clock', effects: { skillCdMods: { shift: -0.05 } } },
        { name: 'Élan Suprême', desc: '+0.8 Vitesse sprint', icon: 'fa-forward', effects: { speed: 0.8 } },
        {
          name: 'Parade Réactive',
          desc: 'Passif : fin de Parade accélère les compétences et confère l\'intangibilité.\n\nBONUS DE STATS\n+8 DEF\n+1.0 Vitesse sprint\n+6% Crit Chance',
          icon: 'fa-shield-virus',
          keystone: true,
          effects: { def: 8, speed: 1.0, crit: 0.06, passive: 'parryRefund' }
        }
      ]),
      branch10('warrior', 'gardien', 'hp', 'Gardien', [
        { name: 'Voix de Commandement', desc: '+8% Cri de Guerre', icon: 'fa-bullhorn', effects: { skillMods: { shift: 0.08 } } },
        { name: 'Ralliement', desc: '+6 DEF', icon: 'fa-shield-heart', effects: { def: 6 } },
        { name: 'Protecteur', desc: '+16 HP', icon: 'fa-users', effects: { maxHpFlat: 16 } },
        { name: 'Vigilance', desc: '+8 DEF', icon: 'fa-eye', effects: { def: 8 } },
        { name: 'Peau de Garde', desc: '+20 HP', icon: 'fa-user-shield', effects: { maxHpFlat: 20 } },
        { name: 'Muraille Mobile', desc: '+10 DEF', icon: 'fa-fort-awesome', effects: { def: 10 } },
        { name: 'Cri de Ralliement', desc: '+24 HP', icon: 'fa-users-viewfinder', effects: { maxHpFlat: 24 } },
        { name: 'Rempart Divin', desc: '+12 DEF', icon: 'fa-shield-halved', effects: { def: 12 } },
        { name: 'Discipline', desc: '+30 HP', icon: 'fa-dumbbell', effects: { maxHpFlat: 30 } },
        {
          name: 'Cri du Gardien',
          desc: 'Passif : Cri de Guerre renforce les alliés en zone.\n\nBONUS DE STATS\n+32 HP\n+8 DEF\n+0.8 HP/s',
          icon: 'fa-shield-heart',
          keystone: true,
          effects: { maxHpFlat: 32, def: 8, regen: 0.8, passive: 'guardianWarCry' }
        }
      ]),
      branch10('warrior', 'seisme', 'mst', 'Séisme', [
        { name: 'Impact', desc: '+5% Crit Chance', icon: 'fa-burst', effects: { crit: 0.05 } },
        { name: 'Fracas', desc: '+15% Crit Damage', icon: 'fa-explosion', effects: { critDmg: 0.15 } },
        { name: 'Puissance Tellurique', desc: '+6 ATK', icon: 'fa-mountain', effects: { atk: 6 } },
        { name: 'Secousse', desc: '+4% Crit Chance', icon: 'fa-volcano', effects: { crit: 0.04 } },
        { name: 'Onde de Choc', desc: '+10% Crit Damage', icon: 'fa-wave-square', effects: { critDmg: 0.10 } },
        { name: 'Force Sismique', desc: '+6 ATK', icon: 'fa-gavel', effects: { atk: 6 } },
        { name: 'Impact Majeur', desc: '+4% Crit Chance', icon: 'fa-burst', effects: { crit: 0.04 } },
        { name: 'Cataclysme Lunaire', desc: '+10% Crit Damage', icon: 'fa-meteor', effects: { critDmg: 0.10 } },
        { name: 'Puissance Sismique', desc: '+8 ATK', icon: 'fa-mountain', effects: { atk: 8 } },
        {
          name: 'Charge Sismique',
          desc: 'Passif : fin de Parade déclenche un séisme gratuit chargé.\n\nBONUS DE STATS\n+8 ATK\n+5% Crit Chance\n+15% Dégâts Crit',
          icon: 'fa-meteor',
          keystone: true,
          effects: { atk: 8, crit: 0.05, critDmg: 0.15, passive: 'parryCharge' }
        }
      ]),
    ],
  },

  mage: {
    classId: 'mage',
    title: 'Spirale Arcane',
    subtitle: 'Flux, givre et mirage',
    themeColor: '#3498db',
    apex: {
      id: 'mage-apex',
      branch: 'apex',
      tier: 11,
      name: 'Paradoxe Absolu',
      desc: 'Tous les 5 kills : stat permanente +0,01–0,09 %.',
      icon: 'fa-infinity',
      cost: 2,
      keystone: true,
      effects: { passive: 'paradoxOverload', passiveRank: 2 },
    },
    branches: [
      branch10('mage', 'flux', 'atk', 'Flux', [
        { name: 'Arcane', desc: '+5 ATK', icon: 'fa-wand-magic-sparkles', effects: { atk: 5 } },
        { name: 'Décharge', desc: '+8% Arcane Barrage', icon: 'fa-bolt', effects: { skillMods: { space: 0.08 } } },
        { name: 'Conduit', desc: '+4 ATK', icon: 'fa-recycle', effects: { atk: 4 } },
        { name: 'Amplification', desc: '+8% Arcane Barrage', icon: 'fa-bolt', effects: { skillMods: { space: 0.08 } } },
        { name: 'Flux Interne', desc: '+5 ATK', icon: 'fa-star-of-david', effects: { atk: 5 } },
        { name: 'Surchargé', desc: '+10% Arcane Barrage', icon: 'fa-sun', effects: { skillMods: { space: 0.10 } } },
        { name: 'Conduit Pur', desc: '+6 ATK', icon: 'fa-wand-magic', effects: { atk: 6 } },
        { name: 'Tempête Céleste', desc: '+10% Arcane Barrage', icon: 'fa-cloud-showers-water', effects: { skillMods: { space: 0.10 } } },
        { name: 'Énergie Arcane', desc: '+8 ATK', icon: 'fa-meteor', effects: { atk: 8 } },
        {
          name: 'Surcharge Arcane',
          desc: 'Passif : sorts réduisent les autres CD.\n\nBONUS DE STATS\n+8 ATK\n+6% Crit Chance\n+10% Dégâts Crit',
          icon: 'fa-hurricane',
          keystone: true,
          effects: { atk: 8, crit: 0.06, critDmg: 0.10, passive: 'arcaneOverload' }
        }
      ]),
      branch10('mage', 'givre', 'hp', 'Givre', [
        { name: 'Résilience', desc: '+32 HP', icon: 'fa-snowflake', effects: { maxHpFlat: 32 } },
        { name: 'Barrière de Glace', desc: '+6 DEF', icon: 'fa-icicles', effects: { def: 6 } },
        { name: 'Cœur de Glace', desc: '+20 HP', icon: 'fa-hourglass', effects: { maxHpFlat: 20 } },
        { name: 'Armure Cristalline', desc: '+8 DEF', icon: 'fa-shield', effects: { def: 8 } },
        { name: 'Stase Résiliente', desc: '+30 HP', icon: 'fa-hourglass-empty', effects: { maxHpFlat: 30 } },
        { name: 'Rampart Gelé', desc: '+10 DEF', icon: 'fa-fort-awesome-alt', effects: { def: 10 } },
        { name: 'Vitalité Gelée', desc: '+35 HP', icon: 'fa-heart-pulse', effects: { maxHpFlat: 35 } },
        { name: 'Glaçon Impénétrable', desc: '+12 DEF', icon: 'fa-cube', effects: { def: 12 } },
        { name: 'Cœur Glacial', desc: '+40 HP', icon: 'fa-snowflake', effects: { maxHpFlat: 40 } },
        {
          name: 'Stase Profonde',
          desc: 'Passif : Chronostase ralentit davantage.\n\nBONUS DE STATS\n+45 HP\n+10 DEF\n+1.2 HP/s',
          icon: 'fa-heart-pulse',
          keystone: true,
          effects: { maxHpFlat: 45, def: 10, regen: 1.2, passive: 'deepStasis' }
        }
      ]),
      branch10('mage', 'mirage', 'spd', 'Mirage', [
        { name: 'Pas Fantôme', desc: '+1.2 Vitesse sprint', icon: 'fa-ghost', effects: { speed: 1.2 } },
        { name: 'Hâte Arcane', desc: '-10% recharge Transfert', icon: 'fa-stopwatch', effects: { skillCdMods: { e: -0.1 } } },
        { name: 'Éclipse Rapide', desc: '+1.0 Vitesse sprint', icon: 'fa-stairs', effects: { speed: 1.0 } },
        { name: 'Vortex de Dash', desc: '-8% recharge Transfert', icon: 'fa-arrow-rotate-left', effects: { skillCdMods: { e: -0.08 } } },
        { name: 'Pas Illusionniste', desc: '+0.8 Vitesse sprint', icon: 'fa-masks-theater', effects: { speed: 0.8 } },
        { name: 'Hâte de Mirage', desc: '-6% recharge Transfert', icon: 'fa-clock', effects: { skillCdMods: { e: -0.06 } } },
        { name: 'Écho Fantomatique', desc: '+0.8 Vitesse sprint', icon: 'fa-eye', effects: { speed: 0.8 } },
        { name: 'Blink Fluide', desc: '-6% recharge Transfert', icon: 'fa-bolt', effects: { skillCdMods: { e: -0.06 } } },
        { name: 'Échappée Arcane', desc: '+1.0 Vitesse sprint', icon: 'fa-person-running', effects: { speed: 1.0 } },
        {
          name: 'Transfert Maîtrisé',
          desc: 'Passif : Transfert explosif et reset au kill.\n\nBONUS DE STATS\n+6 ATK\n+1.0 Vitesse sprint\n+5% Crit Chance',
          icon: 'fa-right-left',
          keystone: true,
          effects: { atk: 6, speed: 1.0, crit: 0.05, passive: 'blinkMastery' }
        }
      ]),
      branch10('mage', 'prisme', 'mst', 'Prisme', [
        { name: 'Focus', desc: '+4% Crit Chance', icon: 'fa-eye', effects: { crit: 0.04 } },
        { name: 'Résonance', desc: '+10% XP', icon: 'fa-graduation-cap', effects: { xpMod: 0.10 } },
        { name: 'Précision Arcane', desc: '+5% Crit Chance', icon: 'fa-crosshairs', effects: { crit: 0.05 } },
        { name: 'XP Étendu', desc: '+8% XP', icon: 'fa-graduation-cap', effects: { xpMod: 0.08 } },
        { name: 'Focus Divin', desc: '+4% Crit Chance', icon: 'fa-eye', effects: { crit: 0.04 } },
        { name: 'Résonance Pure', desc: '+8% XP', icon: 'fa-book-open', effects: { xpMod: 0.08 } },
        { name: 'Focus Temporel', desc: '+5% Crit Chance', icon: 'fa-clock', effects: { crit: 0.05 } },
        { name: 'XP Amplifié', desc: '+8% XP', icon: 'fa-scroll', effects: { xpMod: 0.08 } },
        { name: 'Lentille du Destin', desc: '+10% Dégâts Crit', icon: 'fa-gem', effects: { critDmg: 0.10 } },
        {
          name: 'Clones Persistants',
          desc: 'Passif : les clones durent plus longtemps.\n\nBONUS DE STATS\n+8% Crit Chance\n+12% Dégâts Crit\n+10% XP',
          icon: 'fa-atom',
          keystone: true,
          effects: { crit: 0.08, critDmg: 0.12, xpMod: 0.10, passive: 'cloneExtend' }
        }
      ]),
      branch10('mage', 'replique', 'mst', 'Réplique', [
        { name: 'Echo Arcanique', desc: '+4% Crit Chance', icon: 'fa-clone', effects: { crit: 0.04 } },
        { name: 'Reflet', desc: '+8% Transfert', icon: 'fa-ghost', effects: { skillMods: { e: 0.08 } } },
        { name: 'Duplicata', desc: '+5% Crit Chance', icon: 'fa-eye', effects: { crit: 0.05 } },
        { name: 'Clonage', desc: '+6% Arcane Barrage', icon: 'fa-clone', effects: { skillMods: { space: 0.06 } } },
        { name: 'Reflet Pur', desc: '+8% Transfert', icon: 'fa-compass', effects: { skillMods: { e: 0.08 } } },
        { name: 'Duplicata Supérieur', desc: '+4% Crit Chance', icon: 'fa-eye-low-vision', effects: { crit: 0.04 } },
        { name: 'Écho Double', desc: '+6% Arcane Barrage', icon: 'fa-network-wired', effects: { skillMods: { space: 0.06 } } },
        { name: 'Clonage de l\'Ombre', desc: '+8% Transfert', icon: 'fa-mask', effects: { skillMods: { e: 0.08 } } },
        { name: 'Duplicata d\'Or', desc: '+6% Arcane Barrage', icon: 'fa-trophy', effects: { skillMods: { space: 0.06 } } },
        {
          name: 'Paradoxe Répliqué',
          desc: 'Passif : les clones reproduisent vos compétences.\n\nBONUS DE STATS\n+8 ATK\n+0.8 Vitesse sprint\n+6% Crit Chance',
          icon: 'fa-clone',
          keystone: true,
          effects: { atk: 8, speed: 0.8, crit: 0.06, passive: 'paradoxReplicated' }
        }
      ]),
    ],
  },

  sentinel: {
    classId: 'sentinel',
    title: 'Couronne Solaire',
    subtitle: 'Rayon, sanctuaire et discipline',
    themeColor: '#f1c40f',
    apex: {
      id: 'sentinel-apex',
      branch: 'apex',
      tier: 11,
      name: 'Singularité Stellaire',
      desc: 'Rayon Stellaire crée un Champ de Lumière sur kill. Alliés dans le Champ : +15 % ATK. Sentinel : +30 % ATK.',
      icon: 'fa-sun',
      cost: 2,
      keystone: true,
      effects: { passive: 'solarInspiration', passiveRank: 2 },
    },
    branches: [
      branch10('sentinel', 'rayon', 'atk', 'Rayon', [
        { name: 'Focalisation', desc: '+4 ATK', icon: 'fa-sun', effects: { atk: 4 } },
        { name: 'Faisceau', desc: '+12% Rayon Stellaire', icon: 'fa-bolt', effects: { skillMods: { space: 0.12 } } },
        { name: 'Amplificateur', desc: '+5 ATK', icon: 'fa-battery-full', effects: { atk: 5 } },
        { name: 'Optique Solaire', desc: '+8% Rayon Stellaire', icon: 'fa-glasses', effects: { skillMods: { space: 0.08 } } },
        { name: 'Focalisation Pure', desc: '+6 ATK', icon: 'fa-star', effects: { atk: 6 } },
        { name: 'Lentille Solaire', desc: '+8% Rayon Stellaire', icon: 'fa-eye', effects: { skillMods: { space: 0.08 } } },
        { name: 'Laser Stellaire', desc: '+6 ATK', icon: 'fa-burst', effects: { atk: 6 } },
        { name: 'Super-Faisceau', desc: '+10% Rayon Stellaire', icon: 'fa-meteor', effects: { skillMods: { space: 0.10 } } },
        { name: 'Fureur Solaire', desc: '+8 ATK', icon: 'fa-sun', effects: { atk: 8 } },
        {
          name: 'Faisceau Dévastateur',
          desc: 'Passif : Rayon Stellaire +10 % taille, scaling HP max, impact renforcé.\n\nBONUS DE STATS\n+10 ATK\n+8% Crit Chance\n+12% Dégâts Crit',
          icon: 'fa-sun',
          keystone: true,
          effects: { atk: 10, crit: 0.08, critDmg: 0.12, passive: 'solarBeamHaste' }
        }
      ]),
      branch10('sentinel', 'surcharge', 'atk', 'Surcharge', [
        { name: 'Condensateur', desc: '+6% Rayon Stellaire', icon: 'fa-battery-half', effects: { skillMods: { space: 0.06 } } },
        { name: 'Surintensité', desc: '+4 ATK', icon: 'fa-bolt', effects: { atk: 4 } },
        { name: 'Amplification', desc: '+8% Rayon Stellaire', icon: 'fa-sun', effects: { skillMods: { space: 0.08 } } },
        { name: 'Accumulateur', desc: '+4% Crit Chance', icon: 'fa-bolt', effects: { crit: 0.04 } },
        { name: 'Condensateur Majeur', desc: '+6% Rayon Stellaire', icon: 'fa-battery-full', effects: { skillMods: { space: 0.06 } } },
        { name: 'Surtension', desc: '+6 ATK', icon: 'fa-bolt', effects: { atk: 6 } },
        { name: 'Surcharge Solaire', desc: '+6% Rayon Stellaire', icon: 'fa-burst', effects: { skillMods: { space: 0.06 } } },
        { name: 'Accumulation Critique', desc: '+4% Crit Chance', icon: 'fa-hourglass-start', effects: { crit: 0.04 } },
        { name: 'Condensateur Pur', desc: '+8 ATK', icon: 'fa-plug', effects: { atk: 8 } },
        {
          name: 'Surcharge Stellaire',
          desc: 'Passif : Rayon Stellaire charge jusqu\'à 250 %.\n\nBONUS DE STATS\n+15% Crit Chance\n+20% Dégâts Crit\n+8 ATK',
          icon: 'fa-star',
          keystone: true,
          effects: { crit: 0.15, critDmg: 0.20, atk: 8, passive: 'stellarOvercharge' }
        }
      ]),
      branch10('sentinel', 'sanctuaire', 'hp', 'Sanctuaire', [
        { name: 'Vitalité Sacrée', desc: '+28 HP', icon: 'fa-heart', effects: { maxHpFlat: 28 } },
        { name: 'Bénédiction', desc: '+1.2 HP/s', icon: 'fa-hand-holding-medical', effects: { regen: 1.2 } },
        { name: 'Ancrage Sacré', desc: '+16 HP', icon: 'fa-circle-radiation', effects: { maxHpFlat: 16 } },
        { name: 'Restauration Solaire', desc: '+0.8 HP/s', icon: 'fa-hand-sparkles', effects: { regen: 0.8 } },
        { name: 'Vitalité Majeure', desc: '+30 HP', icon: 'fa-heart', effects: { maxHpFlat: 30 } },
        { name: 'Ancrage Divin', desc: '+0.8 HP/s', icon: 'fa-church', effects: { regen: 0.8 } },
        { name: 'Restauration Sacrée', desc: '+32 HP', icon: 'fa-user-shield', effects: { maxHpFlat: 32 } },
        { name: 'Fontaine de Vie', desc: '+1.0 HP/s', icon: 'fa-faucet-drip', effects: { regen: 1.0 } },
        { name: 'Vitalité Solaire', desc: '+36 HP', icon: 'fa-sun', effects: { maxHpFlat: 36 } },
        {
          name: 'Bénédiction',
          desc: 'Passif : soins reçus amplifiés et Champ de Lumière renforcé.\n\nBONUS DE STATS\n+50 HP\n+1.5 HP/s\n+8 DEF',
          icon: 'fa-church',
          keystone: true,
          effects: { maxHpFlat: 50, regen: 1.5, def: 8, passive: 'healAmp' }
        }
      ]),
      branch10('sentinel', 'aile', 'spd', 'Aile', [
        { name: 'Légèreté', desc: '+1.0 Vitesse sprint', icon: 'fa-feather', effects: { speed: 1.0 } },
        { name: 'Célérité Divine', desc: '-9% CD Rayon Stellaire', icon: 'fa-wind', effects: { skillCdMods: { space: -0.09 } } },
        { name: 'Plumes Légères', desc: '+0.9 Vitesse sprint', icon: 'fa-person-running', effects: { speed: 0.9 } },
        { name: 'Vol Astral', desc: '-6% CD Rayon Stellaire', icon: 'fa-plane-up', effects: { skillCdMods: { space: -0.06 } } },
        { name: 'Élan Céleste', desc: '+0.8 Vitesse sprint', icon: 'fa-shoe-prints', effects: { speed: 0.8 } },
        { name: 'Vent Solaire', desc: '-6% CD Rayon Stellaire', icon: 'fa-wind', effects: { skillCdMods: { space: -0.06 } } },
        { name: 'Plumes de Vent', desc: '+0.8 Vitesse sprint', icon: 'fa-feather', effects: { speed: 0.8 } },
        { name: 'Élan de Lumière', desc: '-5% CD Rayon Stellaire', icon: 'fa-bolt', effects: { skillCdMods: { space: -0.05 } } },
        { name: 'Vol Solaire', desc: '+1.0 Vitesse sprint', icon: 'fa-dove', effects: { speed: 1.0 } },
        {
          name: 'Hâte Solaire',
          desc: 'Passif : burst de sprint après Rayon Stellaire.\n\nBONUS DE STATS\n+1.0 Vitesse sprint\n+25 HP\n+6% Crit Chance',
          icon: 'fa-dove',
          keystone: true,
          effects: { speed: 1.0, maxHpFlat: 25, crit: 0.06, passive: 'beamHaste' }
        }
      ]),
      branch10('sentinel', 'egide', 'mst', 'Égide', [
        { name: 'Protection', desc: '+5 DEF', icon: 'fa-shield', effects: { def: 5 } },
        { name: 'Rempart Sacré', desc: '+13 HP', icon: 'fa-shield-heart', effects: { maxHpFlat: 13 } },
        { name: 'Bastion', desc: '+8 DEF', icon: 'fa-shield-halved', effects: { def: 8 } },
        { name: 'Égide Divine', desc: '+15 HP', icon: 'fa-cross', effects: { maxHpFlat: 15 } },
        { name: 'Bouclier Céleste', desc: '+10 DEF', icon: 'fa-shield-virus', effects: { def: 10 } },
        { name: 'Bastion Solaire', desc: '+20 HP', icon: 'fa-heart', effects: { maxHpFlat: 20 } },
        { name: 'Protection Pure', desc: '+12 DEF', icon: 'fa-shield-halved', effects: { def: 12 } },
        { name: 'Rempart Solaire', desc: '+25 HP', icon: 'fa-sun', effects: { maxHpFlat: 25 } },
        { name: 'Bastion d\'Acier', desc: '+14 DEF', icon: 'fa-fort-awesome', effects: { def: 14 } },
        {
          name: 'Martyr',
          desc: 'Passif : soins excédentaires convertis en bouclier d\'absorption.\n\nBONUS DE STATS\n+45 HP\n+10 DEF\n+0.8 HP/s',
          icon: 'fa-hand-sparkles',
          keystone: true,
          effects: { maxHpFlat: 45, def: 10, regen: 0.8, passive: 'overhealShield' }
        }
      ]),
    ],
  },

  blade: {
    classId: 'blade',
    title: 'Lame Sanguine',
    subtitle: 'Hémorragie, ombre et cyclone',
    themeColor: '#1abc9c',
    apex: {
      id: 'blade-apex',
      branch: 'apex',
      tier: 11,
      name: 'Point de Rupture',
      desc: 'Soif de Sang 2x plus rapide · cap +120 % · à 10 % HP, prochaine compétence de Rupture.',
      icon: 'fa-skull',
      cost: 2,
      keystone: true,
      effects: { passive: 'eternalThirst', passiveRank: 2 },
    },
    branches: [
      branch10('blade', 'hemo', 'atk', 'Hémorragie', [
        { name: 'Lame Affûtée', desc: '+3 ATK', icon: 'fa-slash', effects: { atk: 3 } },
        { name: 'Précision Mortelle', desc: '+8% Crit Chance', icon: 'fa-crosshairs', effects: { crit: 0.08 } },
        { name: 'Affûtage Sanglant', desc: '+6% Crit Chance', icon: 'fa-droplet', effects: { crit: 0.06 } },
        { name: 'Vol de Vie', desc: '+1% Vol de vie', icon: 'fa-heart-circle-bolt', effects: { lifesteal: 0.01 } },
        { name: 'Lame de Saignée', desc: '+4 ATK', icon: 'fa-droplet', effects: { atk: 4 } },
        { name: 'Précision Majeure', desc: '+6% Crit Chance', icon: 'fa-crosshairs', effects: { crit: 0.06 } },
        { name: 'Vol de Vie Sanguin', desc: '+1% Vol de vie', icon: 'fa-droplet', effects: { lifesteal: 0.01 } },
        { name: 'Lame Critique', desc: '+8% Crit Chance', icon: 'fa-burst', effects: { crit: 0.08 } },
        { name: 'Tranchant Cruel', desc: '+6 ATK', icon: 'fa-gavel', effects: { atk: 6 } },
        {
          name: 'Saignée',
          desc: 'Passif : critiques appliquent Saignée.\n\nBONUS DE STATS\n+8 ATK\n+8% Crit Chance\n+2% Vol de vie',
          icon: 'fa-bath',
          keystone: true,
          effects: { atk: 8, crit: 0.08, lifesteal: 0.02, passive: 'hemorrhage' }
        }
      ]),
      branch10('blade', 'sanguine', 'atk', 'Sanguine', [
        { name: 'Pulsation', desc: '+4 ATK', icon: 'fa-heart-pulse', effects: { atk: 4 } },
        { name: 'Sang Bouillonnant', desc: '+6% Crit Chance', icon: 'fa-fire', effects: { crit: 0.06 } },
        { name: 'Soif Critique', desc: '+8% Crit Damage', icon: 'fa-droplet', effects: { critDmg: 0.08 } },
        { name: 'Pulsation Cruelle', desc: '+5 ATK', icon: 'fa-heart-pulse', effects: { atk: 5 } },
        { name: 'Ferveur Critique', desc: '+5% Crit Chance', icon: 'fa-fire-flame-curved', effects: { crit: 0.05 } },
        { name: 'Sang en Fureur', desc: '+8% Crit Damage', icon: 'fa-explosion', effects: { critDmg: 0.08 } },
        { name: 'Rage Critique', desc: '+6 ATK', icon: 'fa-burst', effects: { atk: 6 } },
        { name: 'Vitesse Martiale', desc: '-4% Vitesse d\'attaque', icon: 'fa-stopwatch', effects: { attackSpeedMod: -0.04 } },
        { name: 'Hémoglobine Pure', desc: '+6 ATK', icon: 'fa-vial', effects: { atk: 6 } },
        {
          name: 'Frénésie Sanglante',
          desc: 'Passif : sous 50 % HP, Frénésie offensive.\n\nBONUS DE STATS\n+8% Crit Chance\n+12% Dégâts Crit\n-10% Vitesse d\'attaque',
          icon: 'fa-fire-flame-curved',
          keystone: true,
          effects: { crit: 0.08, critDmg: 0.12, attackSpeedMod: -0.10, passive: 'bloodFrenzy' }
        }
      ]),
      branch10('blade', 'ombre', 'spd', 'Ombre', [
        { name: 'Foulée', desc: '+1.5 Vitesse sprint', icon: 'fa-person-running', effects: { speed: 1.5 } },
        { name: 'Hâte des Ombres', desc: '-12% CD Ombre Véloce', icon: 'fa-bolt', effects: { skillCdMods: { shift: -0.12 } } },
        { name: 'Pas Furtifs', desc: '+1.0 Vitesse sprint', icon: 'fa-ghost', effects: { speed: 1.0 } },
        { name: 'Dash Silencieux', desc: '-8% CD Ombre Véloce', icon: 'fa-circle-arrow-right', effects: { skillCdMods: { shift: -0.08 } } },
        { name: 'Course de l\'Ombre', desc: '+0.8 Vitesse sprint', icon: 'fa-person-walking-dashed-line', effects: { speed: 0.8 } },
        { name: 'Recharge Furtive', desc: '-6% CD Ombre Véloce', icon: 'fa-clock', effects: { skillCdMods: { shift: -0.06 } } },
        { name: 'Pas du Spectre', desc: '+0.8 Vitesse sprint', icon: 'fa-ghost', effects: { speed: 0.8 } },
        { name: 'Hâte Ombragée', desc: '-6% CD Ombre Véloce', icon: 'fa-bolt', effects: { skillCdMods: { shift: -0.06 } } },
        { name: 'Foulée Divine', desc: '+1.0 Vitesse sprint', icon: 'fa-forward', effects: { speed: 1.0 } },
        {
          name: 'Pas du Néant',
          desc: 'Passif : intangible au dash et reset au kill.\n\nBONUS DE STATS\n+1.2 Vitesse sprint\n+6 ATK\n+6% Crit Chance',
          icon: 'fa-street-view',
          keystone: true,
          effects: { speed: 1.2, atk: 6, crit: 0.06, passive: 'dashReset' }
        }
      ]),
      branch10('blade', 'cyclone', 'mst', 'Cyclone', [
        { name: 'Tourbillon', desc: '+8% Toupie Létale', icon: 'fa-hurricane', effects: { skillMods: { space: 0.08 } } },
        { name: 'Lames Multiples', desc: '+6 ATK', icon: 'fa-burst', effects: { atk: 6 } },
        { name: 'Rafale', desc: '+10% Toupie Létale', icon: 'fa-circle-notch', effects: { skillMods: { space: 0.10 } } },
        { name: 'Tranchant Rotatif', desc: '+4 ATK', icon: 'fa-gavel', effects: { atk: 4 } },
        { name: 'Tempête de Lames', desc: '+8% Toupie Létale', icon: 'fa-tornado', effects: { skillMods: { space: 0.08 } } },
        { name: 'Vent Déchireur', desc: '+5 ATK', icon: 'fa-wind', effects: { atk: 5 } },
        { name: 'Cyclone Cruel', desc: '+8% Toupie Létale', icon: 'fa-dharmachakra', effects: { skillMods: { space: 0.08 } } },
        { name: 'Rafale Tranchante', desc: '+6 ATK', icon: 'fa-shield-virus', effects: { atk: 6 } },
        { name: 'Lame Cyclone', desc: '+10% Toupie Létale', icon: 'fa-hurricane', effects: { skillMods: { space: 0.10 } } },
        {
          name: 'Maelström',
          desc: 'Passif : Toupie Létale aspire les ennemis vers le centre.\n\nBONUS DE STATS\n+8 ATK\n+6% Crit Chance\n+10% Dégâts Crit',
          icon: 'fa-tornado',
          keystone: true,
          effects: { atk: 8, crit: 0.06, critDmg: 0.10, passive: 'cyclonePull' }
        }
      ]),
      branch10('blade', 'survie', 'hp', 'Survie', [
        { name: 'Endurance', desc: '+25 HP', icon: 'fa-heart', effects: { maxHpFlat: 25 } },
        { name: 'Régénération', desc: '+0.8 HP/s', icon: 'fa-bandage', effects: { regen: 0.8 } },
        { name: 'Vitalité Tenace', desc: '+16 HP', icon: 'fa-fire', effects: { maxHpFlat: 16 } },
        { name: 'Peau de Fer', desc: '+6 DEF', icon: 'fa-shield-halved', effects: { def: 6 } },
        { name: 'Endurance Majeure', desc: '+28 HP', icon: 'fa-heart', effects: { maxHpFlat: 28 } },
        { name: 'Régénération Pure', desc: '+0.6 HP/s', icon: 'fa-briefcase-medical', effects: { regen: 0.6 } },
        { name: 'Vitalité Sanguine', desc: '+30 HP', icon: 'fa-droplet', effects: { maxHpFlat: 30 } },
        { name: 'Carapace Runique', desc: '+8 DEF', icon: 'fa-shield', effects: { def: 8 } },
        { name: 'Endurance Pure', desc: '+32 HP', icon: 'fa-heart-pulse', effects: { maxHpFlat: 32 } },
        {
          name: 'Dernier Souffle',
          desc: 'Passif : survie à un coup fatal avec intangibilité.\n\nBONUS DE STATS\n+38 HP\n+8 DEF\n+0.6 HP/s',
          icon: 'fa-heart-crack',
          keystone: true,
          effects: { maxHpFlat: 38, def: 8, regen: 0.6, passive: 'lastBreath' }
        }
      ]),
    ],
  },

  pacifier: {
    classId: 'pacifier',
    title: 'Serment Écarlate',
    subtitle: 'Transfusion, jugement et frénésie',
    themeColor: '#8a0b0b',
    apex: {
      id: 'pacifier-apex',
      branch: 'apex',
      tier: 11,
      name: 'Hémocycle',
      desc: 'Blood Pistol : Marques de Sang · stockage amplifié par les HP max du personnage.',
      icon: 'fa-heart-pulse',
      cost: 2,
      keystone: true,
      effects: { passive: 'bloodPact', passiveRank: 2 },
    },
    branches: [
      branch10('pacifier', 'transfusion', 'hp', 'Transfusion', [
        { name: 'Sang Fort', desc: '+32 HP', icon: 'fa-heart', effects: { maxHpFlat: 32 } },
        { name: 'Flux Vital', desc: '+1.0 HP/s', icon: 'fa-droplet', effects: { regen: 1.0 } },
        { name: 'Réservoir', desc: '+20 HP', icon: 'fa-shield-heart', effects: { maxHpFlat: 20 } },
        { name: 'Sang Épais', desc: '+0.6 HP/s', icon: 'fa-droplet', effects: { regen: 0.6 } },
        { name: 'Réservoir Majeur', desc: '+25 HP', icon: 'fa-heart', effects: { maxHpFlat: 25 } },
        { name: 'Barrière de Sang', desc: '+6 DEF', icon: 'fa-shield-halved', effects: { def: 6 } },
        { name: 'Flux Sacré', desc: '+28 HP', icon: 'fa-heart-circle-check', effects: { maxHpFlat: 28 } },
        { name: 'Régénération Divine', desc: '+0.8 HP/s', icon: 'fa-hand-holding-medical', effects: { regen: 0.8 } },
        { name: 'Réservoir Divin', desc: '+30 HP', icon: 'fa-shield-heart', effects: { maxHpFlat: 30 } },
        {
          name: 'Overflow',
          desc: 'Passif : bouclier de sang renforcé et overflow de soins.\n\nBONUS DE STATS\n+42 HP\n+0.8 HP/s\n+8 DEF',
          icon: 'fa-fill-drip',
          keystone: true,
          effects: { maxHpFlat: 42, regen: 0.8, def: 8, passive: 'shieldOverflow' }
        }
      ]),
      branch10('pacifier', 'jugement', 'atk', 'Jugement', [
        { name: 'Sentence', desc: '+5 ATK', icon: 'fa-gavel', effects: { atk: 5 } },
        { name: 'Marque Profonde', desc: '+10% Verdict Sanguin', icon: 'fa-crosshairs', effects: { skillMods: { shift: 0.10 } } },
        { name: 'Condamnation', desc: '+4 ATK', icon: 'fa-eye', effects: { atk: 4 } },
        { name: 'Verdict Pénétrant', desc: '+8% Verdict Sanguin', icon: 'fa-skull-crossbones', effects: { skillMods: { shift: 0.08 } } },
        { name: 'Sentence Pure', desc: '+5 ATK', icon: 'fa-gavel', effects: { atk: 5 } },
        { name: 'Condamnation Éternelle', desc: '+8% Verdict Sanguin', icon: 'fa-crosshairs', effects: { skillMods: { shift: 0.08 } } },
        { name: 'Sentence Majeure', desc: '+6 ATK', icon: 'fa-star-of-david', effects: { atk: 6 } },
        { name: 'Marque de Sang', desc: '+8% Verdict Sanguin', icon: 'fa-eye', effects: { skillMods: { shift: 0.08 } } },
        { name: 'Exécuteur Impitoyable', desc: '+8 ATK', icon: 'fa-skull', effects: { atk: 8 } },
        {
          name: 'Exécution',
          desc: 'Passif : dégâts massifs sur cibles marquées par Verdict Sanguin.\n\nBONUS DE STATS\n+8 ATK\n+10% Crit Chance\n+15% Dégâts Crit',
          icon: 'fa-skull-crossbones',
          keystone: true,
          effects: { atk: 8, crit: 0.10, critDmg: 0.15, passive: 'executioner' }
        }
      ]),
      branch10('pacifier', 'frénesie', 'spd', 'Frénésie', [
        { name: 'Réflexes', desc: '+1.0 Vitesse sprint', icon: 'fa-bolt', effects: { speed: 1.0 } },
        { name: 'Cadence', desc: '-10% Vitesse d\'attaque', icon: 'fa-stopwatch', effects: { attackSpeedMod: -0.10 } },
        { name: 'Tir Rapide', desc: '+0.6 Vitesse sprint', icon: 'fa-gun', effects: { speed: 0.6 } },
        { name: 'Cadence Sanguine', desc: '-8% Vitesse d\'attaque', icon: 'fa-clock', effects: { attackSpeedMod: -0.08 } },
        { name: 'Réflexes Majeurs', desc: '+0.6 Vitesse sprint', icon: 'fa-bolt', effects: { speed: 0.6 } },
        { name: 'Cadence Divine', desc: '-6% Vitesse d\'attaque', icon: 'fa-bolt-lightning', effects: { attackSpeedMod: -0.06 } },
        { name: 'Tir Accéléré', desc: '+0.6 Vitesse sprint', icon: 'fa-forward', effects: { speed: 0.6 } },
        { name: 'Cadence Critique', desc: '-6% Vitesse d\'attaque', icon: 'fa-stopwatch-20', effects: { attackSpeedMod: -0.06 } },
        { name: 'Sprint de Frénésie', desc: '+0.8 Vitesse sprint', icon: 'fa-person-running', effects: { speed: 0.8 } },
        {
          name: 'Adrénaline',
          desc: 'Passif : kill en Frénésie recharge immédiatement la compétence.\n\nBONUS DE STATS\n+0.8 Vitesse sprint\n-10% Vitesse d\'attaque\n+6 ATK',
          icon: 'fa-syringe',
          keystone: true,
          effects: { speed: 0.8, attackSpeedMod: -0.10, atk: 6, passive: 'frenzyAdrenaline' }
        }
      ]),
      branch10('pacifier', 'pistol', 'spd', 'Pistol', [
        { name: 'Gâchette Rapide', desc: '-6% Vitesse d\'attaque', icon: 'fa-gun', effects: { attackSpeedMod: -0.06 } },
        { name: 'Transfusion Légère', desc: '+13 HP', icon: 'fa-droplet', effects: { maxHpFlat: 13 } },
        { name: 'Tir Sanguin', desc: '-8% Vitesse d\'attaque', icon: 'fa-crosshairs', effects: { attackSpeedMod: -0.08 } },
        { name: 'Gâchette Divine', desc: '+15 HP', icon: 'fa-shield-heart', effects: { maxHpFlat: 15 } },
        { name: 'Cadence de Blood Pistol', desc: '-6% Vitesse d\'attaque', icon: 'fa-stopwatch', effects: { attackSpeedMod: -0.06 } },
        { name: 'Transfusion Divine', desc: '+18 HP', icon: 'fa-droplet', effects: { maxHpFlat: 18 } },
        { name: 'Cadence Pure', desc: '-6% Vitesse d\'attaque', icon: 'fa-clock', effects: { attackSpeedMod: -0.06 } },
        { name: 'Transfusion Majeure', desc: '+20 HP', icon: 'fa-heart', effects: { maxHpFlat: 20 } },
        { name: 'Tir de Précision', desc: '+6 ATK', icon: 'fa-eye', effects: { atk: 6 } },
        {
          name: 'Transfusion Accélérée',
          desc: 'Passif : Blood Pistol cadence et sécurité renforcées.\n\nBONUS DE STATS\n-12% Vitesse d\'attaque\n+28 HP\n+8 ATK',
          icon: 'fa-syringe',
          keystone: true,
          effects: { attackSpeedMod: -0.12, maxHpFlat: 28, atk: 8, passive: 'acceleratedTransfusion' }
        }
      ]),
      branch10('pacifier', 'rituel', 'mst', 'Rituel', [
        { name: 'Précision', desc: '+5% Crit Chance', icon: 'fa-bullseye', effects: { crit: 0.05 } },
        { name: 'XP Sanglant', desc: '+12% XP', icon: 'fa-graduation-cap', effects: { xpMod: 0.12 } },
        { name: 'Rituel Affûté', desc: '+4% Crit Chance', icon: 'fa-arrow-up', effects: { crit: 0.04 } },
        { name: 'Vol de Vie Rituel', desc: '+1% Vol de vie', icon: 'fa-droplet', effects: { lifesteal: 0.01 } },
        { name: 'Précision Rituelle', desc: '+4% Crit Chance', icon: 'fa-crosshairs', effects: { crit: 0.04 } },
        { name: 'XP de Combat', desc: '+8% XP', icon: 'fa-book-open', effects: { xpMod: 0.08 } },
        { name: 'XP Sacré', desc: '+8% XP', icon: 'fa-scroll', effects: { xpMod: 0.08 } },
        { name: 'Vol de Vie Majeur', desc: '+1% Vol de vie', icon: 'fa-vial', effects: { lifesteal: 0.01 } },
        { name: 'Concentration Rituelle', desc: '+5 ATK', icon: 'fa-star-of-david', effects: { atk: 5 } },
        {
          name: 'Saut Vampirique+',
          desc: 'Passif : Saut Vampirique zone, dégâts et soins amplifiés.\n\nBONUS DE STATS\n+3% Vol de vie\n+5 ATK\n+6% Crit Chance',
          icon: 'fa-vial',
          keystone: true,
          effects: { lifesteal: 0.03, atk: 5, crit: 0.06, passive: 'vampJumpAmp' }
        }
      ]),
    ],
  },

  eclipse: {
    classId: 'eclipse',
    title: 'Dualité Astrale',
    subtitle: 'Soleil, lune et éclipse',
    themeColor: '#9b59b6',
    apex: {
      id: 'eclipse-apex',
      branch: 'apex',
      tier: 11,
      name: 'Dualité Céleste',
      desc: 'Rupture Éclipsante · Lance · Ascension · Cataclysme.',
      icon: 'fa-circle-half-stroke',
      cost: 2,
      keystone: true,
      effects: { passive: 'celestialConvergence', passiveRank: 2 },
    },
    branches: [
      branch10('eclipse', 'soleil', 'atk', 'Soleil', [
        { name: 'Éclat', desc: '+4 ATK', icon: 'fa-sun', effects: { atk: 4 } },
        { name: 'Rayonnement', desc: '+10% Fulgurance Solaire', icon: 'fa-fire', effects: { skillMods: { space: 0.10 } } },
        { name: 'Brasier', desc: '+3 ATK', icon: 'fa-meteor', effects: { atk: 3 } },
        { name: 'Incinération Solaire', desc: '+8% Fulgurance Solaire', icon: 'fa-sun-plant-wilt', effects: { skillMods: { space: 0.08 } } },
        { name: 'Éclat Solaire', desc: '+4 ATK', icon: 'fa-star', effects: { atk: 4 } },
        { name: 'Chaleur Intense', desc: '+8% Fulgurance Solaire', icon: 'fa-fire-flame-curved', effects: { skillMods: { space: 0.08 } } },
        { name: 'Brasier Pur', desc: '+5 ATK', icon: 'fa-burst', effects: { atk: 5 } },
        { name: 'Chaleur Céleste', desc: '+10% Fulgurance Solaire', icon: 'fa-sun-plant-wilt', effects: { skillMods: { space: 0.10 } } },
        { name: 'Fournaise Solaire', desc: '+6 ATK', icon: 'fa-meteor', effects: { atk: 6 } },
        {
          name: 'Couronne Éclipsée',
          desc: 'Passif : charge des attaques de lance · bonus Fulgurance.\n\nBONUS DE STATS\n+16 ATK\n+2 DEF\n+22 HP',
          icon: 'fa-crown',
          keystone: true,
          effects: { atk: 16, def: 2, maxHpFlat: 22, passive: 'solarFlare' }
        }
      ]),
      branch10('eclipse', 'devoration', 'atk', 'Dévoration', [
        { name: 'Brasier Intérieur', desc: '+3 ATK', icon: 'fa-fire', effects: { atk: 3 } },
        { name: 'Incinération', desc: '+8% Fulgurance Solaire', icon: 'fa-sun', effects: { skillMods: { space: 0.08 } } },
        { name: 'Fournaise', desc: '+5 ATK', icon: 'fa-meteor', effects: { atk: 5 } },
        { name: 'Éclat de Dévoration', desc: '+6% Fulgurance Solaire', icon: 'fa-sun-plant-wilt', effects: { skillMods: { space: 0.06 } } },
        { name: 'Brasier de Lance', desc: '+4 ATK', icon: 'fa-star-of-david', effects: { atk: 4 } },
        { name: 'Chaleur Dévorante', desc: '+6% Fulgurance Solaire', icon: 'fa-fire-flame-simple', effects: { skillMods: { space: 0.06 } } },
        { name: 'Fournaise Pure', desc: '+5 ATK', icon: 'fa-volcano', effects: { atk: 5 } },
        { name: 'Éclat Pur', desc: '+8% Fulgurance Solaire', icon: 'fa-burst', effects: { skillMods: { space: 0.08 } } },
        { name: 'Brasier Astral', desc: '+6 ATK', icon: 'fa-sun', effects: { atk: 6 } },
        {
          name: 'Soleil Vorace',
          desc: 'Passif : brûlures → Étincelles Solaires → Explosion Solaire (80 % lance).\n\nBONUS DE STATS\n+10 ATK\n+10 HP\n+8 DEF',
          icon: 'fa-sun-plant-wilt',
          keystone: true,
          effects: { atk: 10, maxHpFlat: 10, def: 8, passive: 'devouringSun' }
        }
      ]),
      branch10('eclipse', 'lune', 'mst', 'Lune', [
        { name: 'Froid Lunaire', desc: '+6% Crit Chance', icon: 'fa-moon', effects: { crit: 0.06 } },
        { name: 'Pic Affûté', desc: '+15% Crit Damage', icon: 'fa-icicles', effects: { critDmg: 0.15 } },
        { name: 'Lame Lunaire', desc: '+4% Crit Chance', icon: 'fa-snowflake', effects: { crit: 0.04 } },
        { name: 'Glaçon Astral', desc: '+10% Crit Damage', icon: 'fa-cube', effects: { critDmg: 0.10 } },
        { name: 'Reflet Lunaire', desc: '+4% Crit Chance', icon: 'fa-eye-low-vision', effects: { crit: 0.04 } },
        { name: 'Pic de Cristal', desc: '+8% Crit Damage', icon: 'fa-gem', effects: { critDmg: 0.08 } },
        { name: 'Froid Pur', desc: '+5% Crit Chance', icon: 'fa-snowflake', effects: { crit: 0.05 } },
        { name: 'Givre Lunaire', desc: '+8% Crit Damage', icon: 'fa-icicles', effects: { critDmg: 0.08 } },
        { name: 'Lame d\'Argent', desc: '+10% Crit Damage', icon: 'fa-circle', effects: { critDmg: 0.10 } },
        {
          name: 'Marée Lunaire',
          desc: 'Passif : Pic de Lune rayon +25 % · soin 25 % des dégâts sous Cataclysme.\n\nBONUS DE STATS\n+10 ATK\n+8 DEF\n+20 HP',
          icon: 'fa-circle',
          keystone: true,
          effects: { atk: 10, def: 8, maxHpFlat: 20, passive: 'lunarSpike' }
        }
      ]),
      branch10('eclipse', 'orbite', 'spd', 'Orbite', [
        { name: 'Agilité', desc: '+1.1 Vitesse sprint', icon: 'fa-wind', effects: { speed: 1.1 } },
        { name: 'Cycle Rapide', desc: '-8% CD Cataclysme', icon: 'fa-stopwatch', effects: { skillCdMods: { e: -0.08 } } },
        { name: 'Orbite Stable', desc: '+0.8 Vitesse sprint', icon: 'fa-yin-yang', effects: { speed: 0.8 } },
        { name: 'Vitesse Orbitale', desc: '-6% CD Cataclysme', icon: 'fa-clock', effects: { skillCdMods: { e: -0.06 } } },
        { name: 'Agilité Céleste', desc: '+0.8 Vitesse sprint', icon: 'fa-wind', effects: { speed: 0.8 } },
        { name: 'Cycle de Lune', desc: '-6% CD Cataclysme', icon: 'fa-moon', effects: { skillCdMods: { e: -0.06 } } },
        { name: 'Pas Astral', desc: '+0.8 Vitesse sprint', icon: 'fa-person-running', effects: { speed: 0.8 } },
        { name: 'Recharge d\'Ascension', desc: '-5% CD Cataclysme', icon: 'fa-bolt', effects: { skillCdMods: { e: -0.05 } } },
        { name: 'Équinoxe Stellaire', desc: '+1.0 Vitesse sprint', icon: 'fa-arrows-spin', effects: { speed: 1.0 } },
        {
          name: 'Rupture Astrale',
          desc: 'Passif : tous les 4 coups de lance déclenchent une Rupture Astrale.\n\nBONUS DE STATS\n+10 ATK\n+8 DEF\n+20 HP',
          icon: 'fa-burst',
          keystone: true,
          effects: { atk: 10, def: 8, maxHpFlat: 20, passive: 'ruptureAstrale' }
        }
      ]),
      branch10('eclipse', 'vide', 'hp', 'Vide', [
        { name: 'Ancrage', desc: '+25 HP', icon: 'fa-heart', effects: { maxHpFlat: 25 } },
        { name: 'Résilience', desc: '+5 DEF', icon: 'fa-shield', effects: { def: 5 } },
        { name: 'Carapace du Vide', desc: '+16 HP', icon: 'fa-circle-notch', effects: { maxHpFlat: 16 } },
        { name: 'Mur du Néant', desc: '+4 DEF', icon: 'fa-shield-halved', effects: { def: 4 } },
        { name: 'Ancrage Majeur', desc: '+20 HP', icon: 'fa-heart-pulse', effects: { maxHpFlat: 20 } },
        { name: 'Résilience Céleste', desc: '+6 DEF', icon: 'fa-fingerprint', effects: { def: 6 } },
        { name: 'Carapace Sombre', desc: '+24 HP', icon: 'fa-circle-dot', effects: { maxHpFlat: 24 } },
        { name: 'Bastion du Vide', desc: '+8 DEF', icon: 'fa-fort-awesome', effects: { def: 8 } },
        { name: 'Ancrage Astral', desc: '+30 HP', icon: 'fa-atom', effects: { maxHpFlat: 30 } },
        {
          name: 'Trou Noir',
          desc: 'Passif : Cataclysme aspire les ennemis et frappe plus fort.\n\nBONUS DE STATS\n+32 HP\n+8 DEF\n+0.8 HP/s',
          icon: 'fa-circle-dot',
          keystone: true,
          effects: { maxHpFlat: 32, def: 8, regen: 0.8, passive: 'voidPull' }
        }
      ]),
    ],
  },

  chronoregulator: {
    classId: 'chronoregulator',
    title: 'Spirale de Fracture',
    subtitle: 'Rayon, surchauffe et convergence',
    themeColor: '#48c9b0',
    apex: {
      id: 'chronoregulator-apex',
      branch: 'apex',
      tier: 11,
      name: 'Architecte de la Fracture',
      desc: '3 prismes · Fracture 150 % · rayon +0,42 % dmg et +0,05 % taille/Fracture.',
      icon: 'fa-infinity',
      cost: 2,
      keystone: true,
      effects: { passive: 'continuumMastery', passiveRank: 2 },
    },
    branches: [
      branch10('chronoregulator', 'continuum', 'atk', 'Rayon', [
        { name: 'Flux Brut', desc: '+5 ATK', icon: 'fa-bullseye', effects: { atk: 5 } },
        { name: 'Canalisation', desc: '+10% Rayon de Distorsion', icon: 'fa-wave-square', effects: { skillMods: { primary: 0.10 } } },
        { name: 'Surcharge', desc: '+4 ATK', icon: 'fa-burst', effects: { atk: 4 } },
        { name: 'Lumière Polarisée', desc: '+8% Rayon de Distorsion', icon: 'fa-bolt', effects: { skillMods: { primary: 0.08 } } },
        { name: 'Flux Majeur', desc: '+5 ATK', icon: 'fa-sun', effects: { atk: 5 } },
        { name: 'Canalisation Divine', desc: '+8% Rayon de Distorsion', icon: 'fa-wave-square', effects: { skillMods: { primary: 0.08 } } },
        { name: 'Surcharge Pure', desc: '+6 ATK', icon: 'fa-star-of-david', effects: { atk: 6 } },
        { name: 'Laser Fracturé', desc: '+10% Rayon de Distorsion', icon: 'fa-arrow-right-to-bracket', effects: { skillMods: { primary: 0.10 } } },
        { name: 'Énergie Pure', desc: '+8 ATK', icon: 'fa-gem', effects: { atk: 8 } },
        {
          name: 'Prisme Affiné',
          desc: 'Passif : cône du prisme élargi, rayon +8%, Convergence +0,5 s.\n\nBONUS DE STATS\n+8 ATK\n+6% Crit Chance\n+10% Dégâts Crit',
          icon: 'fa-gem',
          keystone: true,
          effects: { atk: 8, crit: 0.06, critDmg: 0.10, passive: 'continuumBurst' }
        }
      ]),
      branch10('chronoregulator', 'lentille', 'mst', 'Prisme', [
        { name: 'Facette', desc: '+4% Crit Chance', icon: 'fa-gem', effects: { crit: 0.04 } },
        { name: 'Réfraction', desc: '+8% Prisme', icon: 'fa-wave-square', effects: { skillMods: { space: 0.08 } } },
        { name: 'Prisme Brut', desc: '+5 ATK', icon: 'fa-eye', effects: { atk: 5 } },
        { name: 'Optique de Rupture', desc: '-5% CD Prisme', icon: 'fa-stopwatch', effects: { skillCdMods: { space: -0.05 } } },
        { name: 'Facette Pure', desc: '+4% Crit Chance', icon: 'fa-gem', effects: { crit: 0.04 } },
        { name: 'Réfraction Majeure', desc: '+6% Prisme', icon: 'fa-wave-square', effects: { skillMods: { space: 0.06 } } },
        { name: 'Prisme Cristallin', desc: '+5 ATK', icon: 'fa-shield-halved', effects: { atk: 5 } },
        { name: 'Optique Divine', desc: '-5% CD Prisme', icon: 'fa-clock', effects: { skillCdMods: { space: -0.05 } } },
        { name: 'Cristal Focal', desc: '+5% Crit Chance', icon: 'fa-crosshairs', effects: { crit: 0.05 } },
        {
          name: 'Prisme Supplémentaire',
          desc: 'Passif : prismes projettent 4 rayons brûlants.\n\nBONUS DE STATS\n+8 ATK\n+8% Crit Chance\n+12% Dégâts Crit',
          icon: 'fa-gem',
          keystone: true,
          effects: { atk: 8, crit: 0.08, critDmg: 0.12, passive: 'extraPrismLens' }
        }
      ]),
      branch10('chronoregulator', 'echo', 'atk', 'Rupture', [
        { name: 'Impact', desc: '+6 ATK', icon: 'fa-burst', effects: { atk: 6 } },
        { name: 'Résonance', desc: '+10% Explosion de Rupture', icon: 'fa-wave-square', effects: { skillMods: { rupture: 0.10 } } },
        { name: 'Faille', desc: '+5 ATK', icon: 'fa-crosshairs', effects: { atk: 5 } },
        { name: 'Onde Fractale', desc: '+6% Explosion de Rupture', icon: 'fa-arrow-down-up-across-line', effects: { skillMods: { rupture: 0.06 } } },
        { name: 'Impact de Faille', desc: '+5 ATK', icon: 'fa-burst', effects: { atk: 5 } },
        { name: 'Résonance Pure', desc: '+6% Explosion de Rupture', icon: 'fa-wave-square', effects: { skillMods: { rupture: 0.06 } } },
        { name: 'Faille Majeure', desc: '+6 ATK', icon: 'fa-star-of-david', effects: { atk: 6 } },
        { name: 'Onde de Rupture', desc: '+8% Explosion de Rupture', icon: 'fa-arrow-rotate-left', effects: { skillMods: { rupture: 0.08 } } },
        { name: 'Impact Pur', desc: '+8 ATK', icon: 'fa-burst', effects: { atk: 8 } },
        {
          name: 'Déchirure Amplifiée',
          desc: 'Passif : explosion volontaire de Fracture renforcée.\n\nBONUS DE STATS\n+8 ATK\n+8% Crit Chance\n+10% Dégâts Crit',
          icon: 'fa-burst',
          keystone: true,
          effects: { atk: 8, crit: 0.08, critDmg: 0.10, passive: 'ruptureSurge' }
        }
      ]),
      branch10('chronoregulator', 'distorsion', 'spd', 'Conduction', [
        { name: 'Foulée', desc: '+1.1 Vitesse sprint', icon: 'fa-person-running', effects: { speed: 1.1 } },
        { name: 'Accélération', desc: '-8% CD Prisme', icon: 'fa-stopwatch', effects: { skillCdMods: { space: -0.08 } } },
        { name: 'Flux', desc: '+0.8 Vitesse sprint', icon: 'fa-wind', effects: { speed: 0.8 } },
        { name: 'Conduction Temporelle', desc: '-6% CD Prisme', icon: 'fa-hourglass-start', effects: { skillCdMods: { space: -0.06 } } },
        { name: 'Pas de Conduction', desc: '+0.8 Vitesse sprint', icon: 'fa-shoe-prints', effects: { speed: 0.8 } },
        { name: 'Accélération Divine', desc: '-6% CD Prisme', icon: 'fa-bolt-lightning', effects: { skillCdMods: { space: -0.06 } } },
        { name: 'Foulée Céleste', desc: '+0.8 Vitesse sprint', icon: 'fa-person-running', effects: { speed: 0.8 } },
        { name: 'Hâte de Prisme', desc: '-5% CD Prisme', icon: 'fa-clock', effects: { skillCdMods: { space: -0.05 } } },
        { name: 'Conduction Pure', desc: '+1.0 Vitesse sprint', icon: 'fa-bolt', effects: { speed: 1.0 } },
        {
          name: 'Conduction Fractale',
          desc: 'Passif : compétences coûtent moins de Fracture.\n\nBONUS DE STATS\n+1.0 Vitesse sprint\n+6 ATK\n+6% Crit Chance',
          icon: 'fa-hourglass-half',
          keystone: true,
          effects: { speed: 1.0, atk: 6, crit: 0.06, passive: 'anachronismeAmp' }
        }
      ]),
      branch10('chronoregulator', 'paradoxe', 'mst', 'Déphasage', [
        { name: 'Focus', desc: '+4% Crit Chance', icon: 'fa-eye', effects: { crit: 0.04 } },
        { name: 'Déchirure', desc: '+10% XP', icon: 'fa-graduation-cap', effects: { xpMod: 0.10 } },
        { name: 'Faille', desc: '+5% Crit Chance', icon: 'fa-crosshairs', effects: { crit: 0.05 } },
        { name: 'Focus Majeur', desc: '+8% XP', icon: 'fa-graduation-cap', effects: { xpMod: 0.08 } },
        { name: 'Déchirure Pure', desc: '+4% Crit Chance', icon: 'fa-eye', effects: { crit: 0.04 } },
        { name: 'Instabilité', desc: '+8% XP', icon: 'fa-book-open', effects: { xpMod: 0.08 } },
        { name: 'Faille Céleste', desc: '+5% Crit Chance', icon: 'fa-star-of-david', effects: { crit: 0.05 } },
        { name: 'XP de Déphasage', desc: '+8% XP', icon: 'fa-scroll', effects: { xpMod: 0.08 } },
        { name: 'Focus Temporel', desc: '+8% Dégâts Crit', icon: 'fa-gem', effects: { critDmg: 0.08 } },
        {
          name: 'Déphasage Renforcé',
          desc: 'Passif : Déphasage portée élargie et Instabilité prolongée.\n\nBONUS DE STATS\n+8% Crit Chance\n+10% Dégâts Crit\n+10% XP',
          icon: 'fa-atom',
          keystone: true,
          effects: { crit: 0.08, critDmg: 0.10, xpMod: 0.10, passive: 'freezeFieldAmp' }
        }
      ]),
    ],
  },
};

export function getAllNodesForClass(classId: ClassId): ConstellationNode[] {
  const c = CLASS_CONSTELLATIONS[classId];
  return [...c.branches.flatMap((b) => b.nodes), c.apex];
}

export function getNodeById(nodeId: string): ConstellationNode | undefined {
  for (const c of Object.values(CLASS_CONSTELLATIONS)) {
    if (c.apex.id === nodeId) return c.apex;
    for (const b of c.branches) {
      const n = b.nodes.find((x) => x.id === nodeId);
      if (n) return n;
    }
  }
  return undefined;
}

export function getConstellationForClass(classId: ClassId): ClassConstellation {
  return CLASS_CONSTELLATIONS[classId];
}
