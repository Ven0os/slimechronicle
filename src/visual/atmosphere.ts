// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '../core/globals';
import { STATE } from '../core/config';
import { BIOMES, sampleBiomeWeights } from '../gameplay/world/worldZones';
import { damp } from '../core/smoothing';

/**
 * Ciel et brume du monde.
 *
 * Le jeu se contentait d'une couleur de fond unie et d'une brume blanche identique
 * partout, basculées d'un bloc entre deux états codés en dur. Ce module garde ces deux
 * mêmes états — le reste du code continue de demander « normal » ou « dark » — mais les
 * décrit sous forme de profils, les fait transiter progressivement, et teinte la brume
 * selon les biomes que le joueur traverse.
 */

interface AtmosphereProfile {
  /** Couleur au zénith et à l'horizon du dôme céleste. */
  skyTop: number;
  skyHorizon: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  /** Multiplicateur appliqué à la densité de brume du biome courant. */
  fogDensityMult: number;
  /** Si défini, impose la teinte de brume au lieu de suivre le biome. */
  fogColorOverride?: number;
  exposure: number;
}

/**
 * Les intensités sont plus élevées que les valeurs historiques (soleil 1.2, ciel 1.0)
 * parce que le rendu passe désormais par un tone mapping : celui-ci comprime les hautes
 * lumières et tasse les noirs, ce qui coûtait environ 40 % de luminosité à réglages
 * constants. Ces valeurs ont été calibrées en jeu pour retrouver une image au moins aussi
 * lisible qu'avant, tout en gagnant des effets lumineux qui gardent leur couleur au lieu
 * de virer au blanc.
 */
const PROFILES: Record<string, AtmosphereProfile> = {
  normal: {
    skyTop: 0x2f77cf,
    skyHorizon: 0xbfe3f7,
    sunColor: 0xfff4e0,
    sunIntensity: 2.0,
    hemiSky: 0xdcefff,
    hemiGround: 0x8d7a55,
    hemiIntensity: 1.45,
    fogDensityMult: 1.0,
    exposure: 1.5,
  },
  // Reprend l'ambiance sombre historique (brume 0x050505 dense, lumières très basses),
  // avec la même compensation d'intensité que le profil de jour.
  dark: {
    skyTop: 0x04060d,
    skyHorizon: 0x151b28,
    sunColor: 0x5566aa,
    sunIntensity: 0.34,
    hemiSky: 0x223044,
    hemiGround: 0x0a0a0f,
    hemiIntensity: 0.34,
    fogDensityMult: 8.0,
    fogColorOverride: 0x050505,
    exposure: 1.35,
  },
};

const SKY_RADIUS = 500;

let skyDome: THREE.Mesh | null = null;
let skyColorAttr: THREE.BufferAttribute | null = null;
/** Hauteur normalisée (0 à l'horizon, 1 au zénith) de chaque sommet du dôme. */
let skyVertexRamp: Float32Array | null = null;

let targetProfile: AtmosphereProfile = PROFILES.normal;

// État courant, interpolé vers la cible pour éviter les ruptures brutales.
const currentSkyTop = new THREE.Color(PROFILES.normal.skyTop);
const currentSkyHorizon = new THREE.Color(PROFILES.normal.skyHorizon);
const currentFogColor = new THREE.Color(0xffffff);
let currentFogDensity = 0.005;
let currentSunIntensity = PROFILES.normal.sunIntensity;
let currentHemiIntensity = PROFILES.normal.hemiIntensity;
let currentExposure = PROFILES.normal.exposure;

const _biomeWeights: number[] = new Array(BIOMES.length).fill(0);
const _targetFogColor = new THREE.Color();
const _scratchColor = new THREE.Color();

/** Construit le dôme céleste. Un seul appel de rendu, sans coût notable par image. */
export function initAtmosphere(): void {
  if (!Globals.scene) return;

  const geo = new THREE.SphereGeometry(SKY_RADIUS, 32, 24);
  const pos = geo.attributes.position;
  const count = pos.count;

  skyVertexRamp = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Le dégradé s'écrase vers l'horizon pour éviter une bande médiane trop marquée.
    const h = Math.max(0, pos.getY(i) / SKY_RADIUS);
    skyVertexRamp[i] = Math.pow(h, 0.55);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  skyColorAttr = geo.attributes.color;

  const mat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    vertexColors: true,
    fog: false,
    depthWrite: false,
  });

  skyDome = new THREE.Mesh(geo, mat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -1;
  skyDome.matrixAutoUpdate = false;
  Globals.scene.add(skyDome);
  Globals.skyDome = skyDome;

  paintSky();
}

/** Réécrit les couleurs des sommets du dôme depuis les teintes courantes. */
function paintSky(): void {
  if (!skyColorAttr || !skyVertexRamp) return;
  const arr = skyColorAttr.array as Float32Array;
  for (let i = 0; i < skyVertexRamp.length; i++) {
    const t = skyVertexRamp[i];
    const o = i * 3;
    arr[o] = currentSkyHorizon.r + (currentSkyTop.r - currentSkyHorizon.r) * t;
    arr[o + 1] = currentSkyHorizon.g + (currentSkyTop.g - currentSkyHorizon.g) * t;
    arr[o + 2] = currentSkyHorizon.b + (currentSkyTop.b - currentSkyHorizon.b) * t;
  }
  skyColorAttr.needsUpdate = true;
}

/**
 * Choisit l'ambiance visée. La bascule n'est pas immédiate : updateAtmosphere amène
 * progressivement le ciel, la brume et les lumières vers ce profil.
 */
export function setAtmosphereMode(mode: string): void {
  targetProfile = PROFILES[mode] || PROFILES.normal;
}

/** Applique instantanément l'ambiance visée, sans transition (chargement, téléportation). */
export function snapAtmosphere(): void {
  currentSkyTop.setHex(targetProfile.skyTop);
  currentSkyHorizon.setHex(targetProfile.skyHorizon);
  currentSunIntensity = targetProfile.sunIntensity;
  currentHemiIntensity = targetProfile.hemiIntensity;
  currentExposure = targetProfile.exposure;
  paintSky();
}

/**
 * Mélange les teintes de brume des biomes autour du point donné. Aux frontières, deux
 * ambiances coexistent au lieu de basculer d'un coup.
 */
function resolveBiomeFog(x: number, z: number, dt: number): void {
  sampleBiomeWeights(x, z, _biomeWeights);
  let r = 0, g = 0, b = 0, density = 0;
  for (let i = 0; i < BIOMES.length; i++) {
    const w = _biomeWeights[i];
    const c = BIOMES[i].fogColor;
    r += c.r * w;
    g += c.g * w;
    b += c.b * w;
    density += BIOMES[i].fogDensity * w;
  }
  _targetFogColor.setRGB(r, g, b);
  currentFogDensity = damp(currentFogDensity, density * targetProfile.fogDensityMult, 1.5, dt);
}

/**
 * À appeler une fois par image, avec la position suivie par la caméra.
 * Recentre le dôme, fait converger les couleurs et met à jour brume et lumières.
 */
export function updateAtmosphere(dt: number, x: number, z: number): void {
  if (!Globals.scene) return;

  if (skyDome) {
    // Le dôme accompagne la caméra pour rester à distance constante.
    const cam = Globals.camera;
    if (cam) {
      skyDome.position.copy(cam.position);
      skyDome.updateMatrix();
    }
  }

  // Convergence du ciel : assez lente pour que le passage jour/nuit se remarque.
  const skyChanged =
    approachColor(currentSkyTop, targetProfile.skyTop, 2.2, dt) |
    approachColor(currentSkyHorizon, targetProfile.skyHorizon, 2.2, dt);
  if (skyChanged) paintSky();

  Globals.scene.background = currentSkyHorizon;

  if (targetProfile.fogColorOverride !== undefined) {
    _targetFogColor.setHex(targetProfile.fogColorOverride);
    currentFogDensity = damp(currentFogDensity, 0.005 * targetProfile.fogDensityMult, 1.5, dt);
  } else {
    resolveBiomeFog(x, z, dt);
  }

  // Respecte le réglage du joueur : la brume désactivée le reste, y compris après un
  // changement d'ambiance (ce que l'ancien basculement d'ambiance écrasait).
  const fogEnabled = STATE.gameOptions?.isFogActive !== false;
  if (!fogEnabled) {
    Globals.scene.fog = null;
  } else {
    approachColorTo(currentFogColor, _targetFogColor, 2.2, dt);
    if (!Globals.scene.fog || !Globals.scene.fog.isFogExp2) {
      Globals.scene.fog = new THREE.FogExp2(currentFogColor.getHex(), currentFogDensity);
    }
    Globals.scene.fog.color.copy(currentFogColor);
    Globals.scene.fog.density = currentFogDensity;
  }

  if (Globals.dirLight) {
    currentSunIntensity = damp(currentSunIntensity, targetProfile.sunIntensity, 2.2, dt);
    Globals.dirLight.intensity = currentSunIntensity;
    approachColor(Globals.dirLight.color, targetProfile.sunColor, 2.2, dt);
  }
  if (Globals.hemiLight) {
    currentHemiIntensity = damp(currentHemiIntensity, targetProfile.hemiIntensity, 2.2, dt);
    Globals.hemiLight.intensity = currentHemiIntensity;
    approachColor(Globals.hemiLight.color, targetProfile.hemiSky, 2.2, dt);
    approachColor(Globals.hemiLight.groundColor, targetProfile.hemiGround, 2.2, dt);
  }
  if (Globals.renderer) {
    currentExposure = damp(currentExposure, targetProfile.exposure, 2.2, dt);
    Globals.renderer.toneMappingExposure = currentExposure;
  }
}

/** Rapproche une couleur d'une teinte cible ; renvoie 1 si elle a bougé de façon visible. */
function approachColor(color: THREE.Color, targetHex: number, k: number, dt: number): number {
  _scratchColor.setHex(targetHex);
  return approachColorTo(color, _scratchColor, k, dt);
}

function approachColorTo(color: THREE.Color, target: THREE.Color, k: number, dt: number): number {
  const dr = target.r - color.r;
  const dg = target.g - color.g;
  const db = target.b - color.b;
  if (Math.abs(dr) < 0.002 && Math.abs(dg) < 0.002 && Math.abs(db) < 0.002) {
    color.copy(target);
    return 0;
  }
  color.r = damp(color.r, target.r, k, dt);
  color.g = damp(color.g, target.g, k, dt);
  color.b = damp(color.b, target.b, k, dt);
  return 1;
}
