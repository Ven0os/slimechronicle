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
  max: 100,
  fillTime: 4.33,
  skillCost: 30,
  silence: 1.5,
  ruptureMin: 85,
  ruptureMax: 95,
} as const;

export const CHRONO_ASCENDANT = {
  max: 0.55,
  ramp: 3,
} as const;

export const CHRONO_SKILLS = {
  lens: { duration: 8, radius: 1.4, cone: 0.14, placeDist: 5 },
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
