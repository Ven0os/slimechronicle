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
  /** Passif runtime — réservé aux keystones (palier 4) et apex. */
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

function chain(
  classId: ClassId,
  branch: string,
  slot: ConstellationBranch['slot'],
  label: string,
  defs: Array<Omit<ConstellationNode, 'id' | 'branch' | 'tier' | 'requires'> & { tier: number }>,
): ConstellationBranch {
  const nodes: ConstellationNode[] = defs.map((d, i) => ({
    ...d,
    id: `${classId}-${branch}-${d.tier}`,
    branch,
    requires: i > 0 ? [`${classId}-${branch}-${d.tier - 1}`] : undefined,
  }));
  return { id: branch, label, slot, nodes };
}

const APEX_REQ_COUNT = 10;

export const CONSTELLATION_APEX_MIN_NODES = APEX_REQ_COUNT;

export const CLASS_CONSTELLATIONS: Record<ClassId, ClassConstellation> = {
  warrior: {
    classId: 'warrior',
    title: 'Forteresse Runique',
    subtitle: 'Remparts, fureur et retribution',
    themeColor: '#8e44ad',
    apex: {
      id: 'warrior-apex',
      branch: 'apex',
      tier: 5,
      name: 'Colosse Runique',
      desc: 'Parade : 30 % renvoi · +5 % DEF en dégâts réfléchis.',
      icon: 'fa-crown',
      cost: 2,
      keystone: true,
      effects: { passive: 'runicColossus', passiveRank: 2 },
    },
    branches: [
      chain('warrior', 'rempart', 'hp', 'Rempart', [
        { tier: 1, name: 'Cuirasse', desc: '+25 HP', icon: 'fa-shield', cost: 1, effects: { maxHpFlat: 25 } },
        { tier: 2, name: 'Garde-Fer', desc: '+8 DEF', icon: 'fa-shield-halved', cost: 1, effects: { def: 8 } },
        { tier: 3, name: 'Forteresse', desc: '+20 HP, +5 DEF', icon: 'fa-icicles', cost: 1, effects: { maxHpFlat: 20, def: 5 } },
        { tier: 4, name: 'Mur Impénétrable', desc: 'Passif : réduction de dégâts, parade renforcée et soins au blocage.', icon: 'fa-fort-awesome', cost: 1, keystone: true, effects: { maxHpFlat: 40, def: 10, regen: 1, passive: 'ironWall', passiveRank: 1 } },
      ]),
      chain('warrior', 'fureur', 'atk', 'Fureur', [
        { tier: 1, name: 'Lame Lourde', desc: '+4 ATK', icon: 'fa-gavel', cost: 1, effects: { atk: 4 } },
        { tier: 2, name: 'Ferveur', desc: '+4 ATK', icon: 'fa-fire', cost: 1, effects: { atk: 4 } },
        { tier: 3, name: 'Sang de Bataille', desc: '+8 ATK', icon: 'fa-droplet', cost: 1, effects: { atk: 8 } },
        { tier: 4, name: 'Titan Sanguin', desc: 'Passif : HP convertis en DEF bonus et dégâts amplifiés.', icon: 'fa-dumbbell', cost: 1, keystone: true, effects: { atk: 6, maxHpFlat: 28, passive: 'titanBlood', passiveRank: 1 } },
      ]),
      chain('warrior', 'cri', 'spd', 'Cri', [
        { tier: 1, name: 'Allure de Guerre', desc: '+1.0 Vitesse sprint', icon: 'fa-shoe-prints', cost: 1, effects: { speed: 1 } },
        { tier: 2, name: 'Hâte Martiale', desc: '-8% recharge Cri de Guerre', icon: 'fa-bolt', cost: 1, effects: { skillCdMods: { shift: -0.08 } } },
        { tier: 3, name: 'Élan Tactique', desc: '+0.8 sprint, -5% recharge Cri de Guerre', icon: 'fa-bullhorn', cost: 1, effects: { speed: 0.8, skillCdMods: { shift: -0.05 } } },
        { tier: 4, name: 'Parade Réactive', desc: 'Passif : fin de Parade accélère les compétences et confère l\'intangibilité.', icon: 'fa-shield-virus', cost: 1, keystone: true, effects: { def: 8, skillCdMods: { space: -0.08, shift: -0.08, e: -0.08 }, passive: 'parryRefund', passiveRank: 1 } },
      ]),
      chain('warrior', 'gardien', 'hp', 'Gardien', [
        { tier: 1, name: 'Voix de Commandement', desc: '+8% Cri de Guerre', icon: 'fa-bullhorn', cost: 1, effects: { skillMods: { shift: 0.08 } } },
        { tier: 2, name: 'Ralliement', desc: '+6 DEF', icon: 'fa-shield-heart', cost: 1, effects: { def: 6 } },
        { tier: 3, name: 'Protecteur', desc: '+16 HP, −5% recharge Cri de Guerre', icon: 'fa-users', cost: 1, effects: { maxHpFlat: 16, skillCdMods: { shift: -0.05 } } },
        { tier: 4, name: 'Cri du Gardien', desc: 'Passif : Cri de Guerre renforce les alliés en zone.', icon: 'fa-shield-heart', cost: 1, keystone: true, effects: { maxHpFlat: 32, def: 8, passive: 'guardianWarCry', passiveRank: 1 } },
      ]),
      chain('warrior', 'seisme', 'mst', 'Séisme', [
        { tier: 1, name: 'Impact', desc: '+5% Crit Chance', icon: 'fa-burst', cost: 1, effects: { crit: 0.05 } },
        { tier: 2, name: 'Fracas', desc: '+15% Crit Damage', icon: 'fa-explosion', cost: 1, effects: { critDmg: 0.15 } },
        { tier: 3, name: 'Puissance Tellurique', desc: '+6 ATK, +8% Frappe Sismique', icon: 'fa-mountain', cost: 1, effects: { atk: 6, skillMods: { space: 0.08 } } },
        { tier: 4, name: 'Cataclysme', desc: 'Passif : fin de Parade déclenche un séisme gratuit chargé.', icon: 'fa-meteor', cost: 1, keystone: true, effects: { atk: 8, skillMods: { space: 0.1 }, passive: 'parryCharge', passiveRank: 1 } },
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
      tier: 5,
      name: 'Paradoxe Absolu',
      desc: 'Tous les 5 kills : stat permanente +0,01–0,09 %.',
      icon: 'fa-infinity',
      cost: 2,
      keystone: true,
      effects: { passive: 'paradoxOverload', passiveRank: 2 },
    },
    branches: [
      chain('mage', 'flux', 'atk', 'Flux', [
        { tier: 1, name: 'Arcane', desc: '+5 ATK', icon: 'fa-wand-magic-sparkles', cost: 1, effects: { atk: 5 } },
        { tier: 2, name: 'Décharge', desc: '+10% Arcane Barrage', icon: 'fa-bolt', cost: 1, effects: { skillMods: { space: 0.1 } } },
        { tier: 3, name: 'Conduit', desc: '+4 ATK, +8% Arcane Barrage', icon: 'fa-recycle', cost: 1, effects: { atk: 4, skillMods: { space: 0.08 } } },
        { tier: 4, name: 'Tempête Arcanique', desc: 'Passif : sorts réduisent les autres CD', icon: 'fa-hurricane', cost: 1, keystone: true, effects: { atk: 6, skillMods: { space: 0.1 }, passive: 'arcaneOverload', passiveRank: 1 } },
      ]),
      chain('mage', 'givre', 'hp', 'Givre', [
        { tier: 1, name: 'Résilience', desc: '+32 HP', icon: 'fa-snowflake', cost: 1, effects: { maxHpFlat: 32 } },
        { tier: 2, name: 'Barrière de Glace', desc: '+6 DEF', icon: 'fa-icicles', cost: 1, effects: { def: 6 } },
        { tier: 3, name: 'Cœur de Glace', desc: '+20 HP, +5 DEF', icon: 'fa-hourglass', cost: 1, effects: { maxHpFlat: 20, def: 5 } },
        { tier: 4, name: 'Cœur Gelé', desc: 'Passif : Chronostase ralentit davantage', icon: 'fa-heart-pulse', cost: 1, keystone: true, effects: { maxHpFlat: 35, regen: 1.2, passive: 'deepStasis', passiveRank: 1 } },
      ]),
      chain('mage', 'mirage', 'spd', 'Mirage', [
        { tier: 1, name: 'Pas Fantôme', desc: '+1.2 Vitesse sprint', icon: 'fa-ghost', cost: 1, effects: { speed: 1.2 } },
        { tier: 2, name: 'Hâte Arcane', desc: '-10% recharge Transfert', icon: 'fa-stopwatch', cost: 1, effects: { skillCdMods: { e: -0.1 } } },
        { tier: 3, name: 'Éclipse Rapide', desc: '+1.0 sprint, -6% recharge Transfert', icon: 'fa-stairs', cost: 1, effects: { speed: 1, skillCdMods: { e: -0.06 } } },
        { tier: 4, name: 'Transfert Maîtrisé', desc: 'Passif : Transfert explosif et reset au kill.', icon: 'fa-right-left', cost: 1, keystone: true, effects: { atk: 5, speed: 0.8, skillCdMods: { e: -0.10 }, passive: 'blinkMastery', passiveRank: 1 } },
      ]),
      chain('mage', 'prisme', 'mst', 'Prisme', [
        { tier: 1, name: 'Focus', desc: '+4% Crit Chance', icon: 'fa-eye', cost: 1, effects: { crit: 0.04 } },
        { tier: 2, name: 'Résonance', desc: '+10% XP', icon: 'fa-graduation-cap', cost: 1, effects: { xpMod: 0.1 } },
        { tier: 3, name: 'Précision Arcane', desc: '+5% Crit Chance, +8% Crit Damage', icon: 'fa-crosshairs', cost: 1, effects: { crit: 0.05, critDmg: 0.08 } },
        { tier: 4, name: 'Singularité', desc: 'Passif : Barrage Arcanique élargi et rafales renforcées.', icon: 'fa-atom', cost: 1, keystone: true, effects: { crit: 0.08, critDmg: 0.12, passive: 'cloneExtend', passiveRank: 1 } },
      ]),
      chain('mage', 'replique', 'mst', 'Réplique', [
        { tier: 1, name: 'Echo Arcanique', desc: '+4% Crit Chance', icon: 'fa-clone', cost: 1, effects: { crit: 0.04 } },
        { tier: 2, name: 'Reflet', desc: '+8% Transfert', icon: 'fa-ghost', cost: 1, effects: { skillMods: { e: 0.08 } } },
        { tier: 3, name: 'Duplicata', desc: '+5% Crit Chance, +6% Arcane Barrage', icon: 'fa-eye', cost: 1, effects: { crit: 0.05, skillMods: { space: 0.06 } } },
        { tier: 4, name: 'Paradoxe Répliqué', desc: 'Passif : les clones reproduisent vos compétences.', icon: 'fa-clone', cost: 1, keystone: true, effects: { atk: 5, skillCdMods: { space: -0.08, shift: -0.08, e: -0.08 }, passive: 'paradoxReplicated', passiveRank: 1 } },
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
      tier: 5,
      name: 'Hélios Incarné',
      desc: 'Aura 14 m · Puits Solaire · bonus/malus ancrage.',
      icon: 'fa-sun',
      cost: 2,
      keystone: true,
      effects: { passive: 'solarInspiration', passiveRank: 2 },
    },
    branches: [
      chain('sentinel', 'rayon', 'atk', 'Rayon', [
        { tier: 1, name: 'Focalisation', desc: '+4 ATK', icon: 'fa-sun', cost: 1, effects: { atk: 4 } },
        { tier: 2, name: 'Faisceau', desc: '+12% Rayon Stellaire', icon: 'fa-bolt', cost: 1, effects: { skillMods: { space: 0.12 } } },
        { tier: 3, name: 'Amplificateur', desc: '+5 ATK, +8% Rayon Stellaire', icon: 'fa-battery-full', cost: 1, effects: { atk: 5, skillMods: { space: 0.08 } } },
        { tier: 4, name: 'Supernova', desc: 'Passif : Rayon Stellaire +10 % taille, scaling HP max', icon: 'fa-star', cost: 1, keystone: true, effects: { atk: 8, crit: 0.08, passive: 'solarBeamHaste', passiveRank: 1 } },
      ]),
      chain('sentinel', 'surcharge', 'atk', 'Surcharge', [
        { tier: 1, name: 'Condensateur', desc: '+6% Rayon Stellaire', icon: 'fa-battery-half', cost: 1, effects: { skillMods: { space: 0.06 } } },
        { tier: 2, name: 'Amplificateur', desc: '+4 ATK', icon: 'fa-bolt', cost: 1, effects: { atk: 4 } },
        { tier: 3, name: 'Surintensité', desc: '+8% Rayon Stellaire, +4% Crit Chance', icon: 'fa-sun', cost: 1, effects: { skillMods: { space: 0.08 }, crit: 0.04 } },
        { tier: 4, name: 'Surcharge Stellaire', desc: 'Passif : Rayon Stellaire charge jusqu\'à 250 %', icon: 'fa-star', cost: 1, keystone: true, effects: { crit: 0.15, critDmg: 0.20, passive: 'stellarOvercharge', passiveRank: 1 } },
      ]),
      chain('sentinel', 'sanctuaire', 'hp', 'Sanctuaire', [
        { tier: 1, name: 'Vitalité Sacrée', desc: '+28 HP', icon: 'fa-heart', cost: 1, effects: { maxHpFlat: 28 } },
        { tier: 2, name: 'Bénédiction', desc: '+1.2 HP/s', icon: 'fa-hand-holding-medical', cost: 1, effects: { regen: 1.2 } },
        { tier: 3, name: 'Ancrage Sacré', desc: '+16 HP, +0.8 HP/s', icon: 'fa-circle-radiation', cost: 1, effects: { maxHpFlat: 16, regen: 0.8 } },
        { tier: 4, name: 'Autel Mobile', desc: 'Passif : soins reçus amplifiés et Champ de Lumière renforcé.', icon: 'fa-church', cost: 1, keystone: true, effects: { maxHpFlat: 50, regen: 0.8, passive: 'healAmp', passiveRank: 1 } },
      ]),
      chain('sentinel', 'aile', 'spd', 'Aile', [
        { tier: 1, name: 'Légèreté', desc: '+1.0 Vitesse sprint', icon: 'fa-feather', cost: 1, effects: { speed: 1 } },
        { tier: 2, name: 'Célérité Divine', desc: '-9% recharge Rayon Stellaire', icon: 'fa-wind', cost: 1, effects: { skillCdMods: { space: -0.09 } } },
        { tier: 3, name: 'Plumes Légères', desc: '+0.9 sprint, -6% recharge Rayon Stellaire', icon: 'fa-person-running', cost: 1, effects: { speed: 0.9, skillCdMods: { space: -0.06 } } },
        { tier: 4, name: 'Plumes d\'Or', desc: 'Passif : burst de sprint après Rayon Stellaire.', icon: 'fa-dove', cost: 1, keystone: true, effects: { speedPct: 0.12, skillCdMods: { space: -0.08 }, passive: 'beamHaste', passiveRank: 1 } },
      ]),
      chain('sentinel', 'egide', 'mst', 'Égide', [
        { tier: 1, name: 'Protection', desc: '+5 DEF', icon: 'fa-shield', cost: 1, effects: { def: 5 } },
        { tier: 2, name: 'Rempart Sacré', desc: '+13 HP', icon: 'fa-shield-heart', cost: 1, effects: { maxHpFlat: 13 } },
        { tier: 3, name: 'Bastion', desc: '+8 DEF, +13 HP', icon: 'fa-shield-halved', cost: 1, effects: { def: 8, maxHpFlat: 13 } },
        { tier: 4, name: 'Martyr', desc: 'Passif : soins excédentaires convertis en bouclier d\'absorption.', icon: 'fa-hand-sparkles', cost: 1, keystone: true, effects: { maxHpFlat: 45, def: 10, passive: 'overhealShield', passiveRank: 1 } },
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
      tier: 5,
      name: 'Soif Éternelle',
      desc: '+0,3 % Crit Chance et Crit Damage par % HP manquant.',
      icon: 'fa-skull',
      cost: 2,
      keystone: true,
      effects: { passive: 'eternalThirst', passiveRank: 2 },
    },
    branches: [
      chain('blade', 'hemo', 'atk', 'Hémorragie', [
        { tier: 1, name: 'Lame Affûtée', desc: '+3 ATK', icon: 'fa-scythe', cost: 1, effects: { atk: 3 } },
        { tier: 2, name: 'Précision Mortelle', desc: '+8% Crit Chance', icon: 'fa-crosshairs', cost: 1, effects: { crit: 0.08 } },
        { tier: 3, name: 'Affûtage Sanglant', desc: '+6% Crit Chance, +1% vol de vie', icon: 'fa-droplet', cost: 1, effects: { crit: 0.06, lifesteal: 0.01 } },
        { tier: 4, name: 'Bain de Sang', desc: 'Passif : critiques appliquent Saignée', icon: 'fa-bath', cost: 1, keystone: true, effects: { lifesteal: 0.02, critDmg: 0.15, passive: 'hemorrhage', passiveRank: 1 } },
      ]),
      chain('blade', 'sanguine', 'atk', 'Sanguine', [
        { tier: 1, name: 'Pulsation', desc: '+4 ATK', icon: 'fa-heart-pulse', cost: 1, effects: { atk: 4 } },
        { tier: 2, name: 'Sang Bouillonnant', desc: '+6% Crit Chance', icon: 'fa-fire', cost: 1, effects: { crit: 0.06 } },
        { tier: 3, name: 'Soif Critique', desc: '+8% Crit Damage', icon: 'fa-droplet', cost: 1, effects: { critDmg: 0.08 } },
        { tier: 4, name: 'Frénésie Sanglante', desc: 'Passif : sous 50 % HP, Frénésie offensive', icon: 'fa-fire-flame-curved', cost: 1, keystone: true, effects: { crit: 0.08, critDmg: 0.12, attackSpeedMod: -0.10, passive: 'bloodFrenzy', passiveRank: 1 } },
      ]),
      chain('blade', 'ombre', 'spd', 'Ombre', [
        { tier: 1, name: 'Foulée', desc: '+1.5 Vitesse sprint', icon: 'fa-person-running', cost: 1, effects: { speed: 1.5 } },
        { tier: 2, name: 'Hâte des Ombres', desc: '-12% recharge Ombre Véloce', icon: 'fa-bolt', cost: 1, effects: { skillCdMods: { shift: -0.12 } } },
        { tier: 3, name: 'Pas Furtifs', desc: '+1.0 sprint, -8% cadence d\'attaque', icon: 'fa-ghost', cost: 1, effects: { speed: 1, attackSpeedMod: -0.08 } },
        { tier: 4, name: 'Pas du Néant', desc: 'Passif : intangible au dash et reset au kill.', icon: 'fa-street-view', cost: 1, keystone: true, effects: { atk: 5, skillCdMods: { shift: -0.10 }, passive: 'dashReset', passiveRank: 1 } },
      ]),
      chain('blade', 'cyclone', 'mst', 'Cyclone', [
        { tier: 1, name: 'Tourbillon', desc: '+8% Toupie Létale', icon: 'fa-hurricane', cost: 1, effects: { skillMods: { space: 0.08 } } },
        { tier: 2, name: 'Lames Multiples', desc: '+6 ATK', icon: 'fa-burst', cost: 1, effects: { atk: 6 } },
        { tier: 3, name: 'Rafale', desc: '+10% Toupie Létale, +4 ATK', icon: 'fa-circle-notch', cost: 1, effects: { skillMods: { space: 0.1 }, atk: 4 } },
        { tier: 4, name: 'Maelström', desc: 'Passif : Toupie Létale aspire les ennemis vers le centre.', icon: 'fa-tornado', cost: 1, keystone: true, effects: { atk: 6, skillMods: { space: 0.10 }, passive: 'cyclonePull', passiveRank: 1 } },
      ]),
      chain('blade', 'survie', 'hp', 'Survie', [
        { tier: 1, name: 'Endurance', desc: '+25 HP', icon: 'fa-heart', cost: 1, effects: { maxHpFlat: 25 } },
        { tier: 2, name: 'Régénération', desc: '+0.8 HP/s', icon: 'fa-bandage', cost: 1, effects: { regen: 0.8 } },
        { tier: 3, name: 'Vitalité Tenace', desc: '+16 HP, +0.5 HP/s', icon: 'fa-fire', cost: 1, effects: { maxHpFlat: 16, regen: 0.5 } },
        { tier: 4, name: 'Dernier Souffle', desc: 'Passif : survie à un coup fatal avec intangibilité.', icon: 'fa-heart-crack', cost: 1, keystone: true, effects: { maxHpFlat: 38, regen: 0.6, passive: 'lastBreath', passiveRank: 1 } },
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
      tier: 5,
      name: 'Pacte de Sang',
      desc: '+45 % Crit Damage · Méga-Crit tous les 3 tirs.',
      icon: 'fa-heart-pulse',
      cost: 2,
      keystone: true,
      effects: { passive: 'bloodPact', passiveRank: 2 },
    },
    branches: [
      chain('pacifier', 'transfusion', 'hp', 'Transfusion', [
        { tier: 1, name: 'Sang Fort', desc: '+32 HP', icon: 'fa-heart', cost: 1, effects: { maxHpFlat: 32 } },
        { tier: 2, name: 'Flux Vital', desc: '+1 HP/s', icon: 'fa-droplet', cost: 1, effects: { regen: 1 } },
        { tier: 3, name: 'Réservoir', desc: '+20 HP, +0.6 HP/s', icon: 'fa-shield-heart', cost: 1, effects: { maxHpFlat: 20, regen: 0.6 } },
        { tier: 4, name: 'Overflow', desc: 'Passif : bouclier de sang renforcé et overflow de soins.', icon: 'fa-fill-drip', cost: 1, keystone: true, effects: { maxHpFlat: 42, regen: 0.8, passive: 'shieldOverflow', passiveRank: 1 } },
      ]),
      chain('pacifier', 'jugement', 'atk', 'Jugement', [
        { tier: 1, name: 'Sentence', desc: '+5 ATK', icon: 'fa-gavel', cost: 1, effects: { atk: 5 } },
        { tier: 2, name: 'Marque Profonde', desc: '+10% Verdict Sanguin', icon: 'fa-crosshairs', cost: 1, effects: { skillMods: { shift: 0.1 } } },
        { tier: 3, name: 'Condamnation', desc: '+4 ATK, +8% Verdict Sanguin', icon: 'fa-eye', cost: 1, effects: { atk: 4, skillMods: { shift: 0.08 } } },
        { tier: 4, name: 'Exécution', desc: 'Passif : dégâts massifs sur cibles marquées par Verdict Sanguin.', icon: 'fa-skull-crossbones', cost: 1, keystone: true, effects: { atk: 8, crit: 0.10, passive: 'executioner', passiveRank: 1 } },
      ]),
      chain('pacifier', 'frénésie', 'spd', 'Frénésie', [
        { tier: 1, name: 'Réflexes', desc: '+1.0 Vitesse sprint', icon: 'fa-bolt', cost: 1, effects: { speed: 1 } },
        { tier: 2, name: 'Cadence', desc: '-10% cadence d\'attaque', icon: 'fa-stopwatch', cost: 1, effects: { attackSpeedMod: -0.1 } },
        { tier: 3, name: 'Tir Rapide', desc: '+0.6 sprint, -8% cadence d\'attaque', icon: 'fa-gun', cost: 1, effects: { speed: 0.6, attackSpeedMod: -0.08 } },
        { tier: 4, name: 'Adrénaline', desc: 'Passif : kill en Frénésie recharge immédiatement la compétence.', icon: 'fa-syringe', cost: 1, keystone: true, effects: { attackSpeedMod: -0.10, speed: 0.8, passive: 'frenzyAdrenaline', passiveRank: 1 } },
      ]),
      chain('pacifier', 'pistol', 'spd', 'Pistol', [
        { tier: 1, name: 'Gâchette Rapide', desc: '−6% cadence d\'attaque', icon: 'fa-gun', cost: 1, effects: { attackSpeedMod: -0.06 } },
        { tier: 2, name: 'Transfusion Légère', desc: '+13 HP', icon: 'fa-droplet', cost: 1, effects: { maxHpFlat: 13 } },
        { tier: 3, name: 'Tir Sanguin', desc: '−8% cadence, +0.5 sprint', icon: 'fa-crosshairs', cost: 1, effects: { attackSpeedMod: -0.08, speed: 0.5 } },
        { tier: 4, name: 'Transfusion Accélérée', desc: 'Passif : Blood Pistol cadence et sécurité renforcées.', icon: 'fa-syringe', cost: 1, keystone: true, effects: { attackSpeedMod: -0.12, maxHpFlat: 28, passive: 'acceleratedTransfusion', passiveRank: 1 } },
      ]),
      chain('pacifier', 'rituel', 'mst', 'Rituel', [
        { tier: 1, name: 'Précision', desc: '+5% Crit Chance', icon: 'fa-bullseye', cost: 1, effects: { crit: 0.05 } },
        { tier: 2, name: 'XP Sanglant', desc: '+12% XP', icon: 'fa-graduation-cap', cost: 1, effects: { xpMod: 0.12 } },
        { tier: 3, name: 'Rituel Affûté', desc: '+4% Crit Chance, +8% XP', icon: 'fa-arrow-up', cost: 1, effects: { crit: 0.04, xpMod: 0.08 } },
        { tier: 4, name: 'Hémoglobine', desc: 'Passif : Saut Vampirique zone, dégâts et soins amplifiés.', icon: 'fa-vial', cost: 1, keystone: true, effects: { lifesteal: 0.03, atk: 5, passive: 'vampJumpAmp', passiveRank: 1 } },
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
      tier: 5,
      name: 'Dualité Céleste',
      desc: '6 attaques renforcées · +50 % hâte · vulnérabilité.',
      icon: 'fa-circle-half-stroke',
      cost: 2,
      keystone: true,
      effects: { passive: 'celestialConvergence', passiveRank: 2 },
    },
    branches: [
      chain('eclipse', 'soleil', 'atk', 'Soleil', [
        { tier: 1, name: 'Éclat', desc: '+4 ATK', icon: 'fa-sun', cost: 1, effects: { atk: 4 } },
        { tier: 2, name: 'Rayonnement', desc: '+10% Fulgurance Solaire', icon: 'fa-fire', cost: 1, effects: { skillMods: { space: 0.1 } } },
        { tier: 3, name: 'Brasier', desc: '+3 ATK, +8% Fulgurance Solaire', icon: 'fa-meteor', cost: 1, effects: { atk: 3, skillMods: { space: 0.08 } } },
        { tier: 4, name: 'Corona', desc: 'Passif : Fulgurance Solaire dash et brûlure multi-ticks.', icon: 'fa-sun-plant-wilt', cost: 1, keystone: true, effects: { atk: 5, skillMods: { space: 0.10 }, passive: 'solarFlare', passiveRank: 1 } },
      ]),
      chain('eclipse', 'devoration', 'atk', 'Dévoration', [
        { tier: 1, name: 'Brasier Intérieur', desc: '+3 ATK', icon: 'fa-fire', cost: 1, effects: { atk: 3 } },
        { tier: 2, name: 'Incinération', desc: '+8% Fulgurance Solaire', icon: 'fa-sun', cost: 1, effects: { skillMods: { space: 0.08 } } },
        { tier: 3, name: 'Fournaise', desc: '+7 ATK', icon: 'fa-meteor', cost: 1, effects: { atk: 7 } },
        { tier: 4, name: 'Soleil Dévorant', desc: 'Passif : lance et Brûlure Solaire renforcées.', icon: 'fa-sun-plant-wilt', cost: 1, keystone: true, effects: { atk: 11, skillMods: { space: 0.08 }, passive: 'devouringSun', passiveRank: 1 } },
      ]),
      chain('eclipse', 'lune', 'mst', 'Lune', [
        { tier: 1, name: 'Froid Lunaire', desc: '+6% Crit Chance', icon: 'fa-moon', cost: 1, effects: { crit: 0.06 } },
        { tier: 2, name: 'Pic Affûté', desc: '+15% Crit Damage', icon: 'fa-icicles', cost: 1, effects: { critDmg: 0.15 } },
        { tier: 3, name: 'Lame Lunaire', desc: '+4% Crit Chance, +10% Crit Damage', icon: 'fa-snowflake', cost: 1, effects: { crit: 0.04, critDmg: 0.1 } },
        { tier: 4, name: 'Pleine Lune', desc: 'Passif : Pic de Lune élargi et ralentissement renforcé.', icon: 'fa-circle', cost: 1, keystone: true, effects: { crit: 0.10, critDmg: 0.12, passive: 'lunarSpike', passiveRank: 1 } },
      ]),
      chain('eclipse', 'orbite', 'spd', 'Orbite', [
        { tier: 1, name: 'Agilité', desc: '+1.1 Vitesse sprint', icon: 'fa-wind', cost: 1, effects: { speed: 1.1 } },
        { tier: 2, name: 'Cycle Rapide', desc: '-8% recharge Cataclysme', icon: 'fa-stopwatch', cost: 1, effects: { skillCdMods: { e: -0.08 } } },
        { tier: 3, name: 'Orbite Stable', desc: '+0.8 sprint, -5% recharge Cataclysme', icon: 'fa-yin-yang', cost: 1, effects: { speed: 0.8, skillCdMods: { e: -0.05 } } },
        { tier: 4, name: 'Équinoxe', desc: 'Passif : stacks Soleil/Lune alternés et vitesse en Ascension.', icon: 'fa-arrows-spin', cost: 1, keystone: true, effects: { speedPct: 0.10, skillCdMods: { e: -0.08 }, passive: 'orbitalWeave', passiveRank: 1 } },
      ]),
      chain('eclipse', 'vide', 'hp', 'Vide', [
        { tier: 1, name: 'Ancrage', desc: '+25 HP', icon: 'fa-heart', cost: 1, effects: { maxHpFlat: 25 } },
        { tier: 2, name: 'Résilience', desc: '+5 DEF', icon: 'fa-shield', cost: 1, effects: { def: 5 } },
        { tier: 3, name: 'Carapace du Vide', desc: '+16 HP, +4 DEF', icon: 'fa-circle-notch', cost: 1, effects: { maxHpFlat: 16, def: 4 } },
        { tier: 4, name: 'Trou Noir', desc: 'Passif : Cataclysme aspire les ennemis et frappe plus fort.', icon: 'fa-circle-dot', cost: 1, keystone: true, effects: { maxHpFlat: 32, def: 8, passive: 'voidPull', passiveRank: 1 } },
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
      tier: 5,
      name: 'Architecte de la Fracture',
      desc: '3 prismes · Fracture 150 % · +0,33 % dmg/Fracture.',
      icon: 'fa-infinity',
      cost: 2,
      keystone: true,
      effects: { passive: 'continuumMastery', passiveRank: 2 },
    },
    branches: [
      chain('chronoregulator', 'continuum', 'atk', 'Rayon', [
        { tier: 1, name: 'Flux Brut', desc: '+5 ATK', icon: 'fa-bullseye', cost: 1, effects: { atk: 5 } },
        { tier: 2, name: 'Canalisation', desc: '+10% Rayon de Distorsion', icon: 'fa-wave-square', cost: 1, effects: { skillMods: { primary: 0.1 } } },
        { tier: 3, name: 'Surcharge', desc: '+4 ATK, +8% Rayon de Distorsion', icon: 'fa-burst', cost: 1, effects: { atk: 4, skillMods: { primary: 0.08 } } },
        { tier: 4, name: 'Prisme Affiné', desc: 'Passif : cône lentille élargi, rayon +8%, Convergence +0,5 s', icon: 'fa-gem', cost: 1, keystone: true, effects: { atk: 6, skillMods: { primary: 0.1 }, passive: 'continuumBurst', passiveRank: 1 } },
      ]),
      chain('chronoregulator', 'lentille', 'mst', 'Lentille', [
        { tier: 1, name: 'Facette', desc: '+4% Crit Chance', icon: 'fa-gem', cost: 1, effects: { crit: 0.04 } },
        { tier: 2, name: 'Réfraction', desc: '+8% Lentille de Focalisation', icon: 'fa-wave-square', cost: 1, effects: { skillMods: { space: 0.08 } } },
        { tier: 3, name: 'Prisme Brut', desc: '+5 ATK, −5% recharge Lentille', icon: 'fa-eye', cost: 1, effects: { atk: 5, skillCdMods: { space: -0.05 } } },
        { tier: 4, name: 'Prisme Supplémentaire', desc: 'Passif : lentilles projettent 4 rayons brûlants', icon: 'fa-gem', cost: 1, keystone: true, effects: { atk: 6, skillCdMods: { space: -0.07 }, passive: 'extraPrismLens', passiveRank: 1 } },
      ]),
      chain('chronoregulator', 'echo', 'atk', 'Rupture', [
        { tier: 1, name: 'Impact', desc: '+6 ATK', icon: 'fa-burst', cost: 1, effects: { atk: 6 } },
        { tier: 2, name: 'Résonance', desc: '+10% Explosion de Rupture', icon: 'fa-wave-square', cost: 1, effects: { skillMods: { rupture: 0.1 } } },
        { tier: 3, name: 'Faille', desc: '+5 ATK, +6% Explosion de Rupture', icon: 'fa-crosshairs', cost: 1, effects: { atk: 5, skillMods: { rupture: 0.06 } } },
        { tier: 4, name: 'Déchirure Amplifiée', desc: 'Passif : explosion volontaire de Fracture renforcée.', icon: 'fa-burst', cost: 1, keystone: true, effects: { atk: 8, crit: 0.08, passive: 'ruptureSurge', passiveRank: 1 } },
      ]),
      chain('chronoregulator', 'distorsion', 'spd', 'Conduction', [
        { tier: 1, name: 'Foulée', desc: '+1.1 Vitesse sprint', icon: 'fa-person-running', cost: 1, effects: { speed: 1.1 } },
        { tier: 2, name: 'Accélération', desc: '-8% recharge Lentille', icon: 'fa-stopwatch', cost: 1, effects: { skillCdMods: { space: -0.08 } } },
        { tier: 3, name: 'Flux', desc: '+0.8 sprint, -6% recharge Lentille', icon: 'fa-wind', cost: 1, effects: { speed: 0.8, skillCdMods: { space: -0.06 } } },
        { tier: 4, name: 'Conduction Fractale', desc: 'Passif : compétences coûtent moins de Fracture.', icon: 'fa-hourglass-half', cost: 1, keystone: true, effects: { speedPct: 0.08, skillCdMods: { space: -0.08 }, passive: 'anachronismeAmp', passiveRank: 1 } },
      ]),
      chain('chronoregulator', 'paradoxe', 'mst', 'Déphasage', [
        { tier: 1, name: 'Focus', desc: '+4% Crit Chance', icon: 'fa-eye', cost: 1, effects: { crit: 0.04 } },
        { tier: 2, name: 'Déchirure', desc: '+10% XP', icon: 'fa-graduation-cap', cost: 1, effects: { xpMod: 0.1 } },
        { tier: 3, name: 'Faille', desc: '+5% Crit Chance, +8% Crit Damage', icon: 'fa-crosshairs', cost: 1, effects: { crit: 0.05, critDmg: 0.08 } },
        { tier: 4, name: 'Déphasage Renforcé', desc: 'Passif : Déphasage portée élargie et Instabilité prolongée.', icon: 'fa-atom', cost: 1, keystone: true, effects: { crit: 0.08, critDmg: 0.10, passive: 'freezeFieldAmp', passiveRank: 1 } },
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
