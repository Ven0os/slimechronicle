// @ts-nocheck
/**
 * Layout scripté du camp japonais sakura (centre SAKURA_CAMP).
 * Positions relatives au camp ; l'appelant ajoute SAKURA_CAMP.cx/cz.
 * Le lac est au sud : pont au centre du lac, torii sur chaque rive.
 */

export const SAKURA_PALETTE = {
  pink: 0xffb7d5,
  lightPink: 0xffd6e5,
  lightGreen: 0xb8e6a3,
  softGreen: 0x8fcf83,
  naturalGreen: 0x5faf68,
  wood: 0xc68a5a,
  darkWood: 0x6f4532,
  vermillion: 0xc83c3c,
  cream: 0xfff4dc,
  gold: 0xd9a441,
};

/** Lac + pont + torii de rive. Pas de maisons. Positions alignées sur SAKURA_LAKE. */
export const SAKURA_CAMP_STRUCTURES = [
  { type: 'jp', subtype: 'lake', x: 0, z: -16, s: 1, ry: 0 },
  { type: 'jp', subtype: 'bridge', x: 0, z: -16, s: 1, ry: 0 },
  { type: 'jp', subtype: 'torii_entry', x: 0, z: -6.2, s: 1, ry: 0 },
  { type: 'jp', subtype: 'torii_small', x: 0, z: -25.8, s: 1, ry: 0 },
];

export const SAKURA_CAMP_DECOR = [];

export const SAKURA_GROVE_TREES = [
  { type: 'sakura', subtype: 'large', x: -9, z: 5, s: 2.0, ry: 0.3 },
  { type: 'sakura', subtype: 'large', x: 10, z: 4.5, s: 1.85, ry: -0.4 },
  { type: 'sakura', subtype: 'medium', x: -16, z: -14, s: 1.5, ry: 1.0 },
  { type: 'sakura', subtype: 'medium', x: 17, z: -15, s: 1.45, ry: 0.2 },
  { type: 'sakura', subtype: 'medium', x: -16, z: -33, s: 1.4, ry: 0.7 },
  { type: 'sakura', subtype: 'medium', x: 16, z: -33, s: 1.35, ry: 0.9 },
  { type: 'sakura', subtype: 'small', x: -13, z: 2, s: 1.0, ry: 0.7 },
  { type: 'sakura', subtype: 'small', x: 14, z: 1.5, s: 0.95, ry: 1.4 },
  { type: 'sakura', subtype: 'small', x: -18, z: -24, s: 1.05, ry: 0.1 },
  { type: 'sakura', subtype: 'small', x: 18, z: -24, s: 0.9, ry: 0.5 },
];
