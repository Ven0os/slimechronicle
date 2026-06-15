// @ts-nocheck
/** Données de branches — 5 × 10 nœuds par classe. */

import type { ClassConstellation, ClassId } from './constellations';
import { buildBranch, extendBranchPath, type BranchNodeDef } from './constellationBranchBuilder';

function n(
  tier: number,
  name: string,
  desc: string,
  icon: string,
  effects: BranchNodeDef['effects'],
  extra: Partial<BranchNodeDef> = {},
): BranchNodeDef {
  return { tier, name, desc, icon, cost: 1, effects, ...extra };
}

export const CLASS_CONSTELLATION_DATA: Record<ClassId, ClassConstellation> = {
  warrior: {
    classId: 'warrior',
    title: 'Forteresse Runique',
    subtitle: 'Défense, parade, cri et séisme',
    themeColor: '#8e44ad',
    apex: {
      id: 'warrior-apex',
      branch: 'apex',
      tier: 5,
      name: 'Jugement Runique',
      desc: 'Parade : Sceaux Runiques · Cri de Guerre déclenche une volée de projectiles.',
      icon: 'fa-crown',
      cost: 2,
      keystone: true,
      effects: { passive: 'runicColossus', passiveRank: 2 },
    },
    branches: [
      buildBranch({
        classId: 'warrior',
        branchId: 'rempart',
        slot: 'hp',
        label: 'Défense',
        nodes: extendBranchPath(
          [
            n(1, 'Cuirasse', '+25 HP', 'fa-shield', { maxHpFlat: 25 }),
            n(2, 'Garde-Fer', '+8 DEF', 'fa-shield-halved', { def: 8 }),
            n(3, 'Forteresse', '+20 HP, +5 DEF', 'fa-icicles', { maxHpFlat: 20, def: 5 }),
          ],
          { focus: 'defense', skill: { key: 'shift', label: 'Cri de Guerre' } },
          [n(8, 'Régénération', '+1 HP/s', 'fa-bandage', { regen: 1 })],
        ),
        keystone: {
          name: 'Mur Impénétrable',
          desc: 'Passif : réduction de dégâts, parade renforcée et soins au blocage.',
          icon: 'fa-fort-awesome',
          passive: 'ironWall',
          stats: { maxHpFlat: 40, def: 10, atk: 8 },
        },
      }),
      buildBranch({
        classId: 'warrior',
        branchId: 'fureur',
        slot: 'atk',
        label: 'Contre-attaque',
        nodes: extendBranchPath(
          [
            n(1, 'Lame Lourde', '+4 ATK', 'fa-gavel', { atk: 4 }),
            n(2, 'Ferveur', '+4 ATK', 'fa-fire', { atk: 4 }),
            n(3, 'Sang de Bataille', '+8 ATK', 'fa-droplet', { atk: 8 }),
          ],
          { focus: 'offense' },
        ),
        keystone: {
          name: 'Titan Sanguin',
          desc: 'Passif : HP convertis en DEF bonus et dégâts amplifiés.',
          icon: 'fa-dumbbell',
          passive: 'titanBlood',
          stats: { atk: 8, maxHpFlat: 28, def: 6 },
        },
      }),
      buildBranch({
        classId: 'warrior',
        branchId: 'cri',
        slot: 'spd',
        label: 'Parade',
        nodes: extendBranchPath(
          [
            n(1, 'Allure de Guerre', '+1.0 Vitesse sprint', 'fa-shoe-prints', { speed: 1 }),
            n(2, 'Hâte Martiale', '−8% recharge Cri de Guerre', 'fa-bolt', { skillCdMods: { shift: -0.08 } }),
            n(3, 'Élan Tactique', '+0.8 sprint, −5% recharge Cri', 'fa-bullhorn', { speed: 0.8, skillCdMods: { shift: -0.05 } }),
          ],
          { focus: 'speed', skill: { key: 'shift', label: 'Cri de Guerre' } },
          [
            n(9, 'Parade Réflexe', '−8% recharge compétences', 'fa-shield-virus', {
              skillCdMods: { space: -0.08, shift: -0.08, e: -0.08 },
            }),
          ],
        ),
        keystone: {
          name: 'Parade Réactive',
          desc: 'Passif : fin de Parade accélère les compétences et confère l\'intangibilité.',
          icon: 'fa-shield-virus',
          passive: 'parryRefund',
          stats: { def: 8, atk: 6, maxHpFlat: 15 },
        },
      }),
      buildBranch({
        classId: 'warrior',
        branchId: 'gardien',
        slot: 'hp',
        label: 'Cri de Guerre',
        nodes: extendBranchPath(
          [
            n(1, 'Voix de Commandement', '+8% Cri de Guerre', 'fa-bullhorn', { skillMods: { shift: 0.08 } }),
            n(2, 'Ralliement', '+6 DEF', 'fa-shield-heart', { def: 6 }),
            n(3, 'Protecteur', '+16 HP, −5% recharge Cri', 'fa-users', { maxHpFlat: 16, skillCdMods: { shift: -0.05 } }),
          ],
          { focus: 'defense', skill: { key: 'shift', label: 'Cri de Guerre' } },
        ),
        keystone: {
          name: 'Cri du Gardien',
          desc: 'Passif : Cri de Guerre renforce les alliés en zone.',
          icon: 'fa-shield-heart',
          passive: 'guardianWarCry',
          stats: { maxHpFlat: 32, def: 8, atk: 6 },
        },
      }),
      buildBranch({
        classId: 'warrior',
        branchId: 'seisme',
        slot: 'mst',
        label: 'Séisme',
        nodes: extendBranchPath(
          [
            n(1, 'Impact', '+5% Crit Chance', 'fa-burst', { crit: 0.05 }),
            n(2, 'Fracas', '+15% Crit Damage', 'fa-explosion', { critDmg: 0.15 }),
            n(3, 'Puissance Tellurique', '+6 ATK, +8% Frappe Sismique', 'fa-mountain', { atk: 6, skillMods: { space: 0.08 } }),
          ],
          { focus: 'crit', skill: { key: 'space', label: 'Frappe Sismique' } },
          [n(9, 'Charge Sismique', '+10% Frappe Sismique', 'fa-meteor', { skillMods: { space: 0.1 } })],
        ),
        keystone: {
          name: 'Cataclysme',
          desc: 'Passif : fin de Parade déclenche un séisme gratuit chargé.',
          icon: 'fa-meteor',
          passive: 'parryCharge',
          stats: { atk: 8, maxHpFlat: 12, def: 6 },
        },
      }),
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
      buildBranch({
        classId: 'mage',
        branchId: 'flux',
        slot: 'atk',
        label: 'Flux',
        nodes: extendBranchPath(
          [
            n(1, 'Arcane', '+5 ATK', 'fa-wand-magic-sparkles', { atk: 5 }),
            n(2, 'Décharge', '+10% Arcane Barrage', 'fa-bolt', { skillMods: { space: 0.1 } }),
            n(3, 'Conduit', '+4 ATK, +8% Arcane Barrage', 'fa-recycle', { atk: 4, skillMods: { space: 0.08 } }),
          ],
          { focus: 'offense', skill: { key: 'space', label: 'Arcane Barrage' } },
          [n(9, 'Surcharge', '+10% Arcane Barrage', 'fa-hurricane', { skillMods: { space: 0.1 } })],
        ),
        keystone: {
          name: 'Tempête Arcanique',
          desc: 'Passif : sorts réduisent les autres CD.',
          icon: 'fa-hurricane',
          passive: 'arcaneOverload',
          stats: { atk: 8, maxHpFlat: 12, def: 5 },
        },
      }),
      buildBranch({
        classId: 'mage',
        branchId: 'givre',
        slot: 'hp',
        label: 'Givre',
        nodes: extendBranchPath(
          [
            n(1, 'Résilience', '+32 HP', 'fa-snowflake', { maxHpFlat: 32 }),
            n(2, 'Barrière de Glace', '+6 DEF', 'fa-icicles', { def: 6 }),
            n(3, 'Cœur de Glace', '+20 HP, +5 DEF', 'fa-hourglass', { maxHpFlat: 20, def: 5 }),
          ],
          { focus: 'sustain' },
          [n(8, 'Gel Profond', '+1.2 HP/s', 'fa-heart-pulse', { regen: 1.2 })],
        ),
        keystone: {
          name: 'Cœur Gelé',
          desc: 'Passif : Chronostase ralentit davantage.',
          icon: 'fa-heart-pulse',
          passive: 'deepStasis',
          stats: { maxHpFlat: 35, def: 8, atk: 5 },
        },
      }),
      buildBranch({
        classId: 'mage',
        branchId: 'mirage',
        slot: 'spd',
        label: 'Mirage',
        nodes: extendBranchPath(
          [
            n(1, 'Pas Fantôme', '+1.2 Vitesse sprint', 'fa-ghost', { speed: 1.2 }),
            n(2, 'Hâte Arcane', '−10% recharge Transfert', 'fa-stopwatch', { skillCdMods: { e: -0.1 } }),
            n(3, 'Éclipse Rapide', '+1.0 sprint, −6% Transfert', 'fa-stairs', { speed: 1, skillCdMods: { e: -0.06 } }),
          ],
          { focus: 'speed', skill: { key: 'e', label: 'Transfert' } },
          [n(9, 'Transfert Expert', '−10% recharge Transfert', 'fa-right-left', { skillCdMods: { e: -0.1 } })],
        ),
        keystone: {
          name: 'Transfert Maîtrisé',
          desc: 'Passif : Transfert explosif et reset au kill.',
          icon: 'fa-right-left',
          passive: 'blinkMastery',
          stats: { atk: 6, maxHpFlat: 14, def: 5 },
        },
      }),
      buildBranch({
        classId: 'mage',
        branchId: 'prisme',
        slot: 'mst',
        label: 'Prisme',
        nodes: extendBranchPath(
          [
            n(1, 'Focus', '+4% Crit Chance', 'fa-eye', { crit: 0.04 }),
            n(2, 'Résonance', '+10% XP', 'fa-graduation-cap', { xpMod: 0.1 }),
            n(3, 'Précision Arcane', '+5% Crit, +8% Crit Damage', 'fa-crosshairs', { crit: 0.05, critDmg: 0.08 }),
          ],
          { focus: 'crit', skill: { key: 'space', label: 'Arcane Barrage' } },
          [n(9, 'Singularité II', '+8% Crit, +12% Crit Damage', 'fa-atom', { crit: 0.08, critDmg: 0.12 })],
        ),
        keystone: {
          name: 'Singularité',
          desc: 'Passif : Barrage Arcanique élargi et rafales renforcées.',
          icon: 'fa-atom',
          passive: 'cloneExtend',
          stats: { atk: 7, maxHpFlat: 10, def: 6 },
        },
      }),
      buildBranch({
        classId: 'mage',
        branchId: 'replique',
        slot: 'mst',
        label: 'Réplique',
        nodes: extendBranchPath(
          [
            n(1, 'Echo Arcanique', '+4% Crit Chance', 'fa-clone', { crit: 0.04 }),
            n(2, 'Reflet', '+8% Transfert', 'fa-ghost', { skillMods: { e: 0.08 } }),
            n(3, 'Duplicata', '+5% Crit, +6% Arcane Barrage', 'fa-eye', { crit: 0.05, skillMods: { space: 0.06 } }),
          ],
          { focus: 'control', skill: { key: 'e', label: 'Transfert' } },
          [
            n(9, 'Paradoxe II', '−8% recharge compétences', 'fa-clone', {
              skillCdMods: { space: -0.08, shift: -0.08, e: -0.08 },
            }),
          ],
        ),
        keystone: {
          name: 'Paradoxe Répliqué',
          desc: 'Passif : les clones reproduisent vos compétences.',
          icon: 'fa-clone',
          passive: 'paradoxReplicated',
          stats: { atk: 6, maxHpFlat: 12, def: 5 },
        },
      }),
    ],
  },

  sentinel: {
    classId: 'sentinel',
    title: 'Couronne Solaire',
    subtitle: 'Rayon chargé, puits, critique et soutien',
    themeColor: '#f1c40f',
    apex: {
      id: 'sentinel-apex',
      branch: 'apex',
      tier: 5,
      name: 'Singularité Stellaire',
      desc: 'Rayon Stellaire crée des Puits de Lumière sur kill. Alliés dans le Puits : +15 % ATK. Sentinel : +30 % ATK.',
      icon: 'fa-sun',
      cost: 2,
      keystone: true,
      effects: { passive: 'solarInspiration', passiveRank: 2 },
    },
    branches: [
      buildBranch({
        classId: 'sentinel',
        branchId: 'rayon',
        slot: 'atk',
        label: 'Tir Chargé',
        nodes: extendBranchPath(
          [
            n(1, 'Focalisation', '+4 ATK', 'fa-sun', { atk: 4 }),
            n(2, 'Faisceau', '+12% Rayon Stellaire', 'fa-bolt', { skillMods: { space: 0.12 } }),
            n(3, 'Amplificateur', '+5 ATK, +8% Rayon Stellaire', 'fa-battery-full', { atk: 5, skillMods: { space: 0.08 } }),
          ],
          { focus: 'offense', skill: { key: 'space', label: 'Rayon Stellaire' } },
          [n(9, 'Supernova II', '+8% Crit Chance', 'fa-star', { crit: 0.08 })],
        ),
        keystone: {
          name: 'Supernova',
          desc: 'Passif : Rayon Stellaire +10 % taille, scaling HP max.',
          icon: 'fa-star',
          passive: 'solarBeamHaste',
          stats: { atk: 8, maxHpFlat: 15, def: 6 },
        },
      }),
      buildBranch({
        classId: 'sentinel',
        branchId: 'surcharge',
        slot: 'atk',
        label: 'Surcharge',
        nodes: extendBranchPath(
          [
            n(1, 'Condensateur', '+6% Rayon Stellaire', 'fa-battery-half', { skillMods: { space: 0.06 } }),
            n(2, 'Amplificateur', '+4 ATK', 'fa-bolt', { atk: 4 }),
            n(3, 'Surintensité', '+8% Rayon, +4% Crit', 'fa-sun', { skillMods: { space: 0.08 }, crit: 0.04 }),
          ],
          { focus: 'crit', skill: { key: 'space', label: 'Rayon Stellaire' } },
          [n(9, 'Surcharge Max', '+15% Crit, +20% Crit Damage', 'fa-star', { crit: 0.15, critDmg: 0.2 })],
        ),
        keystone: {
          name: 'Surcharge Stellaire',
          desc: 'Passif : Rayon Stellaire charge de 50 % à 250 % en 3,25 s.',
          icon: 'fa-star',
          passive: 'stellarOvercharge',
          stats: { atk: 7, maxHpFlat: 12, def: 8 },
        },
      }),
      buildBranch({
        classId: 'sentinel',
        branchId: 'sanctuaire',
        slot: 'hp',
        label: 'Puits',
        nodes: extendBranchPath(
          [
            n(1, 'Vitalité Sacrée', '+28 HP', 'fa-heart', { maxHpFlat: 28 }),
            n(2, 'Bénédiction', '+1.2 HP/s', 'fa-hand-holding-medical', { regen: 1.2 }),
            n(3, 'Ancrage Sacré', '+16 HP, +0.8 HP/s', 'fa-circle-radiation', { maxHpFlat: 16, regen: 0.8 }),
          ],
          { focus: 'sustain', skill: { key: 'shift', label: 'Champ de Lumière' } },
          [n(8, 'Autel', '+0.8 HP/s', 'fa-church', { regen: 0.8 })],
        ),
        keystone: {
          name: 'Autel Mobile',
          desc: 'Passif : soins reçus amplifiés et Champ de Lumière renforcé.',
          icon: 'fa-church',
          passive: 'healAmp',
          stats: { maxHpFlat: 50, def: 8, atk: 5 },
        },
      }),
      buildBranch({
        classId: 'sentinel',
        branchId: 'aile',
        slot: 'spd',
        label: 'Mobilité',
        nodes: extendBranchPath(
          [
            n(1, 'Légèreté', '+1.0 Vitesse sprint', 'fa-feather', { speed: 1 }),
            n(2, 'Célérité Divine', '−9% recharge Rayon Stellaire', 'fa-wind', { skillCdMods: { space: -0.09 } }),
            n(3, 'Plumes Légères', '+0.9 sprint, −6% Rayon', 'fa-person-running', { speed: 0.9, skillCdMods: { space: -0.06 } }),
          ],
          { focus: 'speed', skill: { key: 'space', label: 'Rayon Stellaire' } },
          [n(9, 'Plumes d\'Or II', '−8% recharge Rayon', 'fa-dove', { skillCdMods: { space: -0.08 } })],
        ),
        keystone: {
          name: 'Plumes d\'Or',
          desc: 'Passif : burst de sprint après Rayon Stellaire.',
          icon: 'fa-dove',
          passive: 'beamHaste',
          stats: { atk: 6, maxHpFlat: 14, def: 7 },
        },
      }),
      buildBranch({
        classId: 'sentinel',
        branchId: 'egide',
        slot: 'mst',
        label: 'Soutien',
        nodes: extendBranchPath(
          [
            n(1, 'Protection', '+5 DEF', 'fa-shield', { def: 5 }),
            n(2, 'Rempart Sacré', '+13 HP', 'fa-shield-heart', { maxHpFlat: 13 }),
            n(3, 'Bastion', '+8 DEF, +13 HP', 'fa-shield-halved', { def: 8, maxHpFlat: 13 }),
          ],
          { focus: 'defense' },
        ),
        keystone: {
          name: 'Martyr',
          desc: 'Passif : soins excédentaires convertis en bouclier d\'absorption.',
          icon: 'fa-hand-sparkles',
          passive: 'overhealShield',
          stats: { maxHpFlat: 45, def: 10, atk: 5 },
        },
      }),
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
      name: 'Point de Rupture',
      desc: 'Soif de Sang 2x plus rapide · cap +120 % · à 10 % HP, prochaine compétence de Rupture.',
      icon: 'fa-skull',
      cost: 2,
      keystone: true,
      effects: { passive: 'eternalThirst', passiveRank: 2 },
    },
    branches: [
      buildBranch({
        classId: 'blade',
        branchId: 'hemo',
        slot: 'atk',
        label: 'Hémorragie',
        nodes: extendBranchPath(
          [
            n(1, 'Lame Affûtée', '+3 ATK', 'fa-scythe', { atk: 3 }),
            n(2, 'Précision Mortelle', '+8% Crit Chance', 'fa-crosshairs', { crit: 0.08 }),
            n(3, 'Affûtage Sanglant', '+6% Crit, +1% vol de vie', 'fa-droplet', { crit: 0.06, lifesteal: 0.01 }),
          ],
          { focus: 'crit' },
          [n(9, 'Bain II', '+2% vol de vie, +15% Crit Damage', 'fa-bath', { lifesteal: 0.02, critDmg: 0.15 })],
        ),
        keystone: {
          name: 'Bain de Sang',
          desc: 'Passif : critiques appliquent Saignée.',
          icon: 'fa-bath',
          passive: 'hemorrhage',
          stats: { atk: 8, maxHpFlat: 12, def: 5 },
        },
      }),
      buildBranch({
        classId: 'blade',
        branchId: 'sanguine',
        slot: 'atk',
        label: 'Frénésie',
        nodes: extendBranchPath(
          [
            n(1, 'Pulsation', '+4 ATK', 'fa-heart-pulse', { atk: 4 }),
            n(2, 'Sang Bouillonnant', '+6% Crit Chance', 'fa-fire', { crit: 0.06 }),
            n(3, 'Soif Critique', '+8% Crit Damage', 'fa-droplet', { critDmg: 0.08 }),
          ],
          { focus: 'offense' },
          [
            n(9, 'Frénésie II', '+8% Crit, −10% cadence', 'fa-fire-flame-curved', {
              crit: 0.08,
              attackSpeedMod: -0.1,
            }),
          ],
        ),
        keystone: {
          name: 'Frénésie Sanglante',
          desc: 'Passif : sous 50 % HP, Frénésie offensive.',
          icon: 'fa-fire-flame-curved',
          passive: 'bloodFrenzy',
          stats: { atk: 8, maxHpFlat: 14, def: 6 },
        },
      }),
      buildBranch({
        classId: 'blade',
        branchId: 'ombre',
        slot: 'spd',
        label: 'Ombre',
        nodes: extendBranchPath(
          [
            n(1, 'Foulée', '+1.5 Vitesse sprint', 'fa-person-running', { speed: 1.5 }),
            n(2, 'Hâte des Ombres', '−12% recharge Ombre Véloce', 'fa-bolt', { skillCdMods: { shift: -0.12 } }),
            n(3, 'Pas Furtifs', '+1.0 sprint, −8% cadence', 'fa-ghost', { speed: 1, attackSpeedMod: -0.08 }),
          ],
          { focus: 'speed', skill: { key: 'shift', label: 'Ombre Véloce' } },
          [n(9, 'Néant', '−10% recharge Ombre Véloce', 'fa-street-view', { skillCdMods: { shift: -0.1 } })],
        ),
        keystone: {
          name: 'Pas du Néant',
          desc: 'Passif : intangible au dash et reset au kill.',
          icon: 'fa-street-view',
          passive: 'dashReset',
          stats: { atk: 6, maxHpFlat: 10, def: 7 },
        },
      }),
      buildBranch({
        classId: 'blade',
        branchId: 'cyclone',
        slot: 'mst',
        label: 'Cyclone',
        nodes: extendBranchPath(
          [
            n(1, 'Tourbillon', '+8% Toupie Létale', 'fa-hurricane', { skillMods: { space: 0.08 } }),
            n(2, 'Lames Multiples', '+6 ATK', 'fa-burst', { atk: 6 }),
            n(3, 'Rafale', '+10% Toupie, +4 ATK', 'fa-circle-notch', { skillMods: { space: 0.1 }, atk: 4 }),
          ],
          { focus: 'offense', skill: { key: 'space', label: 'Toupie Létale' } },
          [n(9, 'Maelström II', '+10% Toupie Létale', 'fa-tornado', { skillMods: { space: 0.1 } })],
        ),
        keystone: {
          name: 'Maelström',
          desc: 'Passif : Toupie Létale aspire les ennemis vers le centre.',
          icon: 'fa-tornado',
          passive: 'cyclonePull',
          stats: { atk: 8, maxHpFlat: 10, def: 6 },
        },
      }),
      buildBranch({
        classId: 'blade',
        branchId: 'survie',
        slot: 'hp',
        label: 'Survie',
        nodes: extendBranchPath(
          [
            n(1, 'Endurance', '+25 HP', 'fa-heart', { maxHpFlat: 25 }),
            n(2, 'Régénération', '+0.8 HP/s', 'fa-bandage', { regen: 0.8 }),
            n(3, 'Vitalité Tenace', '+16 HP, +0.5 HP/s', 'fa-fire', { maxHpFlat: 16, regen: 0.5 }),
          ],
          { focus: 'sustain' },
          [n(8, 'Dernier Souffle II', '+0.6 HP/s', 'fa-heart-crack', { regen: 0.6 })],
        ),
        keystone: {
          name: 'Dernier Souffle',
          desc: 'Passif : survie à un coup fatal avec intangibilité.',
          icon: 'fa-heart-crack',
          passive: 'lastBreath',
          stats: { maxHpFlat: 38, def: 8, atk: 5 },
        },
      }),
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
      name: 'Hémocycle',
      desc: 'Blood Pistol : Marques de Sang · stockage amplifié par les HP max de la cible.',
      icon: 'fa-heart-pulse',
      cost: 2,
      keystone: true,
      effects: { passive: 'bloodPact', passiveRank: 2 },
    },
    branches: [
      buildBranch({
        classId: 'pacifier',
        branchId: 'transfusion',
        slot: 'hp',
        label: 'Transfusion',
        nodes: extendBranchPath(
          [
            n(1, 'Sang Fort', '+32 HP', 'fa-heart', { maxHpFlat: 32 }),
            n(2, 'Flux Vital', '+1 HP/s', 'fa-droplet', { regen: 1 }),
            n(3, 'Réservoir', '+20 HP, +0.6 HP/s', 'fa-shield-heart', { maxHpFlat: 20, regen: 0.6 }),
          ],
          { focus: 'sustain' },
          [n(8, 'Overflow II', '+0.8 HP/s', 'fa-fill-drip', { regen: 0.8 })],
        ),
        keystone: {
          name: 'Overflow',
          desc: 'Passif : bouclier de sang renforcé et overflow de soins.',
          icon: 'fa-fill-drip',
          passive: 'shieldOverflow',
          stats: { maxHpFlat: 42, def: 8, atk: 5 },
        },
      }),
      buildBranch({
        classId: 'pacifier',
        branchId: 'jugement',
        slot: 'atk',
        label: 'Jugement',
        nodes: extendBranchPath(
          [
            n(1, 'Sentence', '+5 ATK', 'fa-gavel', { atk: 5 }),
            n(2, 'Marque Profonde', '+10% Verdict Sanguin', 'fa-crosshairs', { skillMods: { shift: 0.1 } }),
            n(3, 'Condamnation', '+4 ATK, +8% Verdict', 'fa-eye', { atk: 4, skillMods: { shift: 0.08 } }),
          ],
          { focus: 'offense', skill: { key: 'shift', label: 'Verdict Sanguin' } },
          [n(9, 'Exécution II', '+10% Crit Chance', 'fa-skull-crossbones', { crit: 0.1 })],
        ),
        keystone: {
          name: 'Exécution',
          desc: 'Passif : dégâts massifs sur cibles marquées par Verdict Sanguin.',
          icon: 'fa-skull-crossbones',
          passive: 'executioner',
          stats: { atk: 10, maxHpFlat: 12, def: 6 },
        },
      }),
      buildBranch({
        classId: 'pacifier',
        branchId: 'frénésie',
        slot: 'spd',
        label: 'Frénésie',
        nodes: extendBranchPath(
          [
            n(1, 'Réflexes', '+1.0 Vitesse sprint', 'fa-bolt', { speed: 1 }),
            n(2, 'Cadence', '−10% cadence d\'attaque', 'fa-stopwatch', { attackSpeedMod: -0.1 }),
            n(3, 'Tir Rapide', '+0.6 sprint, −8% cadence', 'fa-gun', { speed: 0.6, attackSpeedMod: -0.08 }),
          ],
          { focus: 'speed' },
          [n(9, 'Adrénaline II', '−10% cadence, +0.8 sprint', 'fa-syringe', { attackSpeedMod: -0.1, speed: 0.8 })],
        ),
        keystone: {
          name: 'Adrénaline',
          desc: 'Passif : kill en Frénésie recharge immédiatement la compétence.',
          icon: 'fa-syringe',
          passive: 'frenzyAdrenaline',
          stats: { atk: 7, maxHpFlat: 14, def: 5 },
        },
      }),
      buildBranch({
        classId: 'pacifier',
        branchId: 'pistol',
        slot: 'spd',
        label: 'Pistol',
        nodes: extendBranchPath(
          [
            n(1, 'Gâchette Rapide', '−6% cadence d\'attaque', 'fa-gun', { attackSpeedMod: -0.06 }),
            n(2, 'Transfusion Légère', '+13 HP', 'fa-droplet', { maxHpFlat: 13 }),
            n(3, 'Tir Sanguin', '−8% cadence, +0.5 sprint', 'fa-crosshairs', { attackSpeedMod: -0.08, speed: 0.5 }),
          ],
          { focus: 'speed' },
          [n(9, 'Transfusion Accélérée II', '−12% cadence', 'fa-syringe', { attackSpeedMod: -0.12 })],
        ),
        keystone: {
          name: 'Transfusion Accélérée',
          desc: 'Passif : Blood Pistol cadence et sécurité renforcées.',
          icon: 'fa-syringe',
          passive: 'acceleratedTransfusion',
          stats: { maxHpFlat: 28, atk: 6, def: 7 },
        },
      }),
      buildBranch({
        classId: 'pacifier',
        branchId: 'rituel',
        slot: 'mst',
        label: 'Rituel',
        nodes: extendBranchPath(
          [
            n(1, 'Précision', '+5% Crit Chance', 'fa-bullseye', { crit: 0.05 }),
            n(2, 'XP Sanglant', '+12% XP', 'fa-graduation-cap', { xpMod: 0.12 }),
            n(3, 'Rituel Affûté', '+4% Crit, +8% XP', 'fa-arrow-up', { crit: 0.04, xpMod: 0.08 }),
          ],
          { focus: 'control' },
          [n(9, 'Hémoglobine II', '+3% vol de vie', 'fa-vial', { lifesteal: 0.03 })],
        ),
        keystone: {
          name: 'Hémoglobine',
          desc: 'Passif : Saut Vampirique zone, dégâts et soins amplifiés.',
          icon: 'fa-vial',
          passive: 'vampJumpAmp',
          stats: { atk: 7, maxHpFlat: 15, def: 6 },
        },
      }),
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
      desc: 'Rupture Éclipsante · Lance · Ascension · Cataclysme.',
      icon: 'fa-circle-half-stroke',
      cost: 2,
      keystone: true,
      effects: { passive: 'celestialConvergence', passiveRank: 2 },
    },
    branches: [
      buildBranch({
        classId: 'eclipse',
        branchId: 'soleil',
        slot: 'atk',
        label: 'Soleil',
        nodes: extendBranchPath(
          [
            n(1, 'Éclat', '+4 ATK', 'fa-sun', { atk: 4 }),
            n(2, 'Rayonnement', '+10% Fulgurance Solaire', 'fa-fire', { skillMods: { space: 0.1 } }),
            n(3, 'Brasier', '+3 ATK, +8% Fulgurance', 'fa-meteor', { atk: 3, skillMods: { space: 0.08 } }),
          ],
          { focus: 'offense', skill: { key: 'space', label: 'Fulgurance Solaire' } },
          [n(9, 'Corona II', '+10% Fulgurance Solaire', 'fa-sun-plant-wilt', { skillMods: { space: 0.1 } })],
        ),
        keystone: {
          name: 'Couronne Éclipsée',
          desc: 'Passif : charge des attaques de lance · bonus Fulgurance.',
          icon: 'fa-crown',
          passive: 'solarFlare',
          stats: { atk: 16, def: 2, maxHpFlat: 22 },
        },
      }),
      buildBranch({
        classId: 'eclipse',
        branchId: 'devoration',
        slot: 'atk',
        label: 'Dévoration',
        nodes: extendBranchPath(
          [
            n(1, 'Brasier Intérieur', '+3 ATK', 'fa-fire', { atk: 3 }),
            n(2, 'Incinération', '+8% Fulgurance Solaire', 'fa-sun', { skillMods: { space: 0.08 } }),
            n(3, 'Fournaise', '+7 ATK', 'fa-meteor', { atk: 7 }),
          ],
          { focus: 'offense', skill: { key: 'space', label: 'Fulgurance Solaire' } },
          [n(9, 'Soleil Dévorant II', '+8% Fulgurance', 'fa-sun-plant-wilt', { skillMods: { space: 0.08 } })],
        ),
        keystone: {
          name: 'Soleil Vorace',
          desc: 'Passif : brûlures génèrent des Étincelles → Explosion Solaire.',
          icon: 'fa-sun-plant-wilt',
          passive: 'devouringSun',
          stats: { atk: 10, maxHpFlat: 10, def: 8 },
        },
      }),
      buildBranch({
        classId: 'eclipse',
        branchId: 'lune',
        slot: 'mst',
        label: 'Lune',
        nodes: extendBranchPath(
          [
            n(1, 'Froid Lunaire', '+6% Crit Chance', 'fa-moon', { crit: 0.06 }),
            n(2, 'Pic Affûté', '+15% Crit Damage', 'fa-icicles', { critDmg: 0.15 }),
            n(3, 'Lame Lunaire', '+4% Crit, +10% Crit Damage', 'fa-snowflake', { crit: 0.04, critDmg: 0.1 }),
          ],
          { focus: 'crit' },
          [n(9, 'Pleine Lune II', '+10% Crit, +12% Crit Damage', 'fa-circle', { crit: 0.1, critDmg: 0.12 })],
        ),
        keystone: {
          name: 'Marée Lunaire',
          desc: 'Passif : Pic de Lune rayon +25 % · soin sous Cataclysme.',
          icon: 'fa-circle',
          passive: 'lunarSpike',
          stats: { atk: 10, def: 8, maxHpFlat: 20 },
        },
      }),
      buildBranch({
        classId: 'eclipse',
        branchId: 'orbite',
        slot: 'spd',
        label: 'Orbite',
        nodes: extendBranchPath(
          [
            n(1, 'Agilité', '+1.1 Vitesse sprint', 'fa-wind', { speed: 1.1 }),
            n(2, 'Cycle Rapide', '−8% recharge Cataclysme', 'fa-stopwatch', { skillCdMods: { e: -0.08 } }),
            n(3, 'Orbite Stable', '+0.8 sprint, −5% Cataclysme', 'fa-yin-yang', { speed: 0.8, skillCdMods: { e: -0.05 } }),
          ],
          { focus: 'speed', skill: { key: 'e', label: 'Cataclysme' } },
          [n(9, 'Équinoxe II', '−8% recharge Cataclysme', 'fa-arrows-spin', { skillCdMods: { e: -0.08 } })],
        ),
        keystone: {
          name: 'Rupture Astrale',
          desc: 'Passif : tous les 4 coups de lance déclenchent une Rupture Astrale.',
          icon: 'fa-burst',
          passive: 'ruptureAstrale',
          stats: { atk: 10, def: 8, maxHpFlat: 20 },
        },
      }),
      buildBranch({
        classId: 'eclipse',
        branchId: 'vide',
        slot: 'hp',
        label: 'Vide',
        nodes: extendBranchPath(
          [
            n(1, 'Ancrage', '+25 HP', 'fa-heart', { maxHpFlat: 25 }),
            n(2, 'Résilience', '+5 DEF', 'fa-shield', { def: 5 }),
            n(3, 'Carapace du Vide', '+16 HP, +4 DEF', 'fa-circle-notch', { maxHpFlat: 16, def: 4 }),
          ],
          { focus: 'defense', skill: { key: 'e', label: 'Cataclysme' } },
        ),
        keystone: {
          name: 'Trou Noir',
          desc: 'Passif : Cataclysme aspire les ennemis et frappe plus fort.',
          icon: 'fa-circle-dot',
          passive: 'voidPull',
          stats: { maxHpFlat: 32, def: 8, atk: 6 },
        },
      }),
    ],
  },

  chronoregulator: {
    classId: 'chronoregulator',
    title: 'Spirale de Fracture',
    subtitle: 'Prisme, fracture, rayon et surcharge',
    themeColor: '#48c9b0',
    apex: {
      id: 'chronoregulator-apex',
      branch: 'apex',
      tier: 5,
      name: 'Architecte de la Fracture',
      desc: '3 prismes · Fracture 150 % · rayon +0,42 % dmg et +0,05 % taille/Fracture.',
      icon: 'fa-infinity',
      cost: 2,
      keystone: true,
      effects: { passive: 'continuumMastery', passiveRank: 2 },
    },
    branches: [
      buildBranch({
        classId: 'chronoregulator',
        branchId: 'continuum',
        slot: 'atk',
        label: 'Rayon',
        nodes: extendBranchPath(
          [
            n(1, 'Flux Brut', '+5 ATK', 'fa-bullseye', { atk: 5 }),
            n(2, 'Canalisation', '+10% Rayon de Distorsion', 'fa-wave-square', { skillMods: { primary: 0.1 } }),
            n(3, 'Surcharge', '+4 ATK, +8% Rayon', 'fa-burst', { atk: 4, skillMods: { primary: 0.08 } }),
          ],
          { focus: 'offense', skill: { key: 'primary', label: 'Rayon de Distorsion' } },
          [n(9, 'Prisme Affiné II', '+10% Rayon, Convergence +0,5 s', 'fa-gem', { skillMods: { primary: 0.1 } })],
        ),
        keystone: {
          name: 'Prisme Affiné',

          desc: 'Passif : cône prisme élargi, rayon +8 %, Convergence +0,5 s.',

          icon: 'fa-gem',
          passive: 'continuumBurst',
          stats: { atk: 8, maxHpFlat: 10, def: 6 },
        },
      }),
      buildBranch({
        classId: 'chronoregulator',
        branchId: 'lentille',
        slot: 'mst',
        label: 'Prisme',
        nodes: extendBranchPath(
          [
            n(1, 'Facette', '+4% Crit Chance', 'fa-gem', { crit: 0.04 }),
            n(2, 'Réfraction', '+8% Prisme', 'fa-wave-square', { skillMods: { space: 0.08 } }),
            n(3, 'Prisme Brut', '+5 ATK, −5% recharge Prisme', 'fa-eye', { atk: 5, skillCdMods: { space: -0.05 } }),
          ],
          { focus: 'control', skill: { key: 'space', label: 'Prisme' } },
          [n(9, 'Prisme Supplémentaire II', '−7% recharge Prisme', 'fa-gem', { skillCdMods: { space: -0.07 } })],
        ),
        keystone: {
          name: 'Prisme Supplémentaire',
          desc: 'Passif : prismes projettent 4 rayons brûlants.',

          icon: 'fa-gem',
          passive: 'extraPrismLens',
          stats: { atk: 8, maxHpFlat: 10, def: 6 },
        },
      }),
      buildBranch({
        classId: 'chronoregulator',
        branchId: 'echo',
        slot: 'atk',
        label: 'Fracture',
        nodes: extendBranchPath(
          [
            n(1, 'Impact', '+6 ATK', 'fa-burst', { atk: 6 }),
            n(2, 'Résonance', '+10% Désurcharge', 'fa-wave-square', { skillMods: { primary: 0.1 } }),
            n(3, 'Faille', '+5 ATK, +6% Désurcharge', 'fa-crosshairs', { atk: 5, skillMods: { primary: 0.06 } }),
          ],
          { focus: 'offense' },
          [n(9, 'Déchirure II', '+8% Crit Chance', 'fa-burst', { crit: 0.08 })],
        ),
        keystone: {
          name: 'Déchirure Amplifiée',
          desc: 'Passif : désurcharge Fracture renforcée.',
          icon: 'fa-burst',
          passive: 'ruptureSurge',
          stats: { atk: 10, maxHpFlat: 10, def: 6 },
        },
      }),
      buildBranch({
        classId: 'chronoregulator',
        branchId: 'distorsion',
        slot: 'spd',
        label: 'Surcharge',
        nodes: extendBranchPath(
          [
            n(1, 'Foulée', '+1.1 Vitesse sprint', 'fa-person-running', { speed: 1.1 }),
            n(2, 'Accélération', '−8% recharge Prisme', 'fa-stopwatch', { skillCdMods: { space: -0.08 } }),
            n(3, 'Flux', '+0.8 sprint, −6% Prisme', 'fa-wind', { speed: 0.8, skillCdMods: { space: -0.06 } }),
          ],
          { focus: 'speed', skill: { key: 'space', label: 'Prisme' } },
          [n(9, 'Conduction II', '−8% recharge compétences', 'fa-hourglass-half', { skillCdMods: { space: -0.08 } })],
        ),
        keystone: {
          name: 'Conduction Fractale',
          desc: 'Passif : compétences coûtent moins de Fracture.',
          icon: 'fa-hourglass-half',
          passive: 'anachronismeAmp',
          stats: { atk: 6, maxHpFlat: 14, def: 7 },
        },
      }),
      buildBranch({
        classId: 'chronoregulator',
        branchId: 'paradoxe',
        slot: 'mst',
        label: 'Déphasage',
        nodes: extendBranchPath(
          [
            n(1, 'Focus', '+4% Crit Chance', 'fa-eye', { crit: 0.04 }),
            n(2, 'Déchirure', '+10% XP', 'fa-graduation-cap', { xpMod: 0.1 }),
            n(3, 'Faille', '+5% Crit, +8% Crit Damage', 'fa-crosshairs', { crit: 0.05, critDmg: 0.08 }),
          ],
          { focus: 'control', skill: { key: 'shift', label: 'Déphasage' } },
          [n(9, 'Déphasage II', '+8% Crit, +10% Crit Damage', 'fa-atom', { crit: 0.08, critDmg: 0.1 })],
        ),
        keystone: {
          name: 'Déphasage Renforcé',
          desc: 'Passif : Déphasage portée élargie et Instabilité prolongée.',
          icon: 'fa-atom',
          passive: 'freezeFieldAmp',
          stats: { atk: 7, maxHpFlat: 12, def: 8 },
        },
      }),
    ],
  },
};
