/** Profils de placement par classe — identité visuelle unique de chaque constellation. */

import type { ClassId } from './constellations';

export interface BranchLayoutSpec {
  /** Angle de départ de la branche (degrés, 0 = droite, sens horaire). */
  angleDeg: number;
  /** Multiplicateur de distance radiale. */
  spread: number;
  /** Écart angulaire entre paliers le long de l'arc. */
  tierAngleStep: number;
  /** Biais de rayon par branche. */
  radiusBias: number;
}

export interface ClassConstellationLayout {
  /** Branche dont l'Apex est l'aboutissement thématique principal. */
  primaryBranch: string;
  /** Rayon des nœuds palier 4 (keystone) — proche de l'Apex. */
  keystoneRadiusFrac: number;
  /** Rayons des paliers 1–3 (extérieur → intérieur). */
  outerTierFracs: [number, number, number];
  branches: Record<string, BranchLayoutSpec>;
}

export const CLASS_CONSTELLATION_LAYOUTS: Record<ClassId, ClassConstellationLayout> = {
  warrior: {
    primaryBranch: 'seisme',
    keystoneRadiusFrac: 0.28,
    outerTierFracs: [0.88, 0.72, 0.56],
    branches: {
      rempart: { angleDeg: 145, spread: 1.02, tierAngleStep: 0.22, radiusBias: 1.04 },
      fureur: { angleDeg: -42, spread: 1.06, tierAngleStep: 0.38, radiusBias: 0.96 },
      cri: { angleDeg: 18, spread: 0.98, tierAngleStep: 0.3, radiusBias: 1.0 },
      seisme: { angleDeg: -128, spread: 1.04, tierAngleStep: 0.34, radiusBias: 1.02 },
    },
  },
  mage: {
    primaryBranch: 'flux',
    keystoneRadiusFrac: 0.26,
    outerTierFracs: [0.9, 0.74, 0.58],
    branches: {
      flux: { angleDeg: -75, spread: 1.05, tierAngleStep: 0.44, radiusBias: 1.0 },
      givre: { angleDeg: 155, spread: 0.94, tierAngleStep: 0.2, radiusBias: 1.06 },
      mirage: { angleDeg: 8, spread: 1.08, tierAngleStep: 0.36, radiusBias: 0.95 },
      prisme: { angleDeg: 98, spread: 1.0, tierAngleStep: 0.28, radiusBias: 1.03 },
    },
  },
  sentinel: {
    primaryBranch: 'rayon',
    keystoneRadiusFrac: 0.27,
    outerTierFracs: [0.86, 0.7, 0.54],
    branches: {
      rayon: { angleDeg: -88, spread: 1.0, tierAngleStep: 0.18, radiusBias: 1.05 },
      sanctuaire: { angleDeg: 92, spread: 1.0, tierAngleStep: 0.18, radiusBias: 1.05 },
      aile: { angleDeg: 2, spread: 1.02, tierAngleStep: 0.32, radiusBias: 0.98 },
      egide: { angleDeg: 178, spread: 1.02, tierAngleStep: 0.32, radiusBias: 0.98 },
    },
  },
  blade: {
    primaryBranch: 'hemo',
    keystoneRadiusFrac: 0.29,
    outerTierFracs: [0.92, 0.76, 0.6],
    branches: {
      hemo: { angleDeg: -58, spread: 1.04, tierAngleStep: 0.4, radiusBias: 1.0 },
      ombre: { angleDeg: 32, spread: 1.1, tierAngleStep: 0.26, radiusBias: 0.94 },
      cyclone: { angleDeg: 122, spread: 0.96, tierAngleStep: 0.34, radiusBias: 1.02 },
      survie: { angleDeg: -148, spread: 0.98, tierAngleStep: 0.24, radiusBias: 1.06 },
    },
  },
  pacifier: {
    primaryBranch: 'jugement',
    keystoneRadiusFrac: 0.28,
    outerTierFracs: [0.87, 0.71, 0.55],
    branches: {
      transfusion: { angleDeg: 168, spread: 0.97, tierAngleStep: 0.2, radiusBias: 1.04 },
      jugement: { angleDeg: -68, spread: 1.06, tierAngleStep: 0.36, radiusBias: 1.0 },
      frénésie: { angleDeg: 12, spread: 1.08, tierAngleStep: 0.3, radiusBias: 0.96 },
      rituel: { angleDeg: 108, spread: 1.0, tierAngleStep: 0.42, radiusBias: 1.02 },
    },
  },
  eclipse: {
    primaryBranch: 'soleil',
    keystoneRadiusFrac: 0.25,
    outerTierFracs: [0.85, 0.68, 0.52],
    branches: {
      soleil: { angleDeg: -90, spread: 1.0, tierAngleStep: 0.12, radiusBias: 1.08 },
      lune: { angleDeg: 90, spread: 1.0, tierAngleStep: 0.12, radiusBias: 1.08 },
      orbite: { angleDeg: 0, spread: 1.04, tierAngleStep: 0.28, radiusBias: 0.96 },
      vide: { angleDeg: 180, spread: 1.04, tierAngleStep: 0.28, radiusBias: 0.96 },
    },
  },
  chronoregulator: {
    primaryBranch: 'continuum',
    keystoneRadiusFrac: 0.27,
    outerTierFracs: [0.88, 0.72, 0.56],
    branches: {
      continuum: { angleDeg: -55, spread: 1.02, tierAngleStep: 0.2, radiusBias: 1.0 },
      echo: { angleDeg: -25, spread: 1.04, tierAngleStep: 0.24, radiusBias: 1.02 },
      distorsion: { angleDeg: 55, spread: 1.0, tierAngleStep: 0.34, radiusBias: 0.98 },
      paradoxe: { angleDeg: 145, spread: 0.98, tierAngleStep: 0.3, radiusBias: 1.04 },
    },
  },
};

export function getClassLayout(classId: ClassId): ClassConstellationLayout {
  return CLASS_CONSTELLATION_LAYOUTS[classId];
}

export function getBranchLayout(classId: ClassId, branchId: string): BranchLayoutSpec {
  const layout = CLASS_CONSTELLATION_LAYOUTS[classId];
  return layout.branches[branchId] || {
    angleDeg: 0,
    spread: 1,
    tierAngleStep: 0.34,
    radiusBias: 1,
  };
}
