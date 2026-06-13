/** Constantes gameplay — Chronorégisseur */
export const CHRONO_BEAM = {
  range: 26,
  width: 0.72,
  tickBase: 0.34,
  tickDmg: 0.75,
  moveMult: 0.85,
  atkSpdImpact: 0.75,
  logMs: 3000,
} as const;

export const CHRONO_FRACTURE = {
  /** Plafond Fracture sans Apex. */
  max: 100,
  /** Plafond Fracture avec Apex Architecte de la Fracture. */
  apexMax: 150,
  /** +0,33 % dégâts infligés par point de Fracture (Apex). */
  apexDmgPerPoint: 0.0033,
  fillTime: 4.33,
  skillCost: 30,
  silence: 1.5,
  /** Marge avant le plafond pour Surcharge imminente (max − cette valeur). */
  overloadWarningBeforeMax: 5,
  /** Réduction Fracture après relâchement correct pendant Surcharge imminente. */
  overloadReleaseReductionPct: 0.1,
  /** Inactivité avant début de décroissance (s). */
  decayDelay: 1,
  /** Vitesse de décroissance continue : 4 % du plafond par seconde (= 2 % / 0,5 s). */
  decayPerSecondPct: 0.04,
  /** Proc de désurcharge (relâchement correct en fenêtre imminente). */
  overloadImminenceProc: { radius: 4.2, dmgMult: 2.1 },
} as const;

export const CHRONO_ASCENDANT = {
  max: 0.55,
  ramp: 3,
} as const;

export const CHRONO_SKILLS = {
  /** Prisme (compétence Espace) — clé interne `lens`. */
  lens: {
    baseDuration: 5,
    radius: 1.4,
    cone: 0.14,
    placeDist: 5,
  },
  /** Prismes affinés (Apex Architecte de la Fracture uniquement). */
  refinedLens: {
    /** Bonus Apex ajouté à la durée de base (nouveau prisme = base + bonus). */
    apexExtension: 3.5,
    maxActive: 3,
  },
  dephasing: {
    range: 9,
    halfAngleDot: 0.5,
    dmgMult: 1.15,
    markDuration: 4,
    fractureDivisor: 4,
    beamMarkedBonus: 0.1,
    grenade: {
      launchSpeed: 13,
      launchLift: 8.5,
      gravity: 24,
      fuseMax: 2.4,
      blastRadius: 4.8,
      blastDmgMult: 3.38,
    },
  },
  convergence: {
    duration: 6,
    moveSpeedBonus: 0.1,
    beamDmgBonus: 0.05,
    beamVisualScale: 1.35,
    pullSpeed: 4.2,
    resonanceRadius: 3.5,
    resonanceDmgMult: 1.25,
    finaleRadius: 7.5,
    finaleBaseDmgMult: 5.5,
    finalePerHitMult: 0.25,
  },
  ruptureBurst: { radius: 5.5, dmgMult: 2.4 },
  overheat: { radius: 4.5, dmgMult: 2.5, backlashPct: 0.14 },
} as const;
