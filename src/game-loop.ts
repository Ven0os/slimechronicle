import { STATE } from '@/core/config';
import { Globals, removeEnemy } from '@/core/globals';
import { AudioSys, TextureManager } from '@/core/ressources';
import { Input } from '@/core/input';
import { UI, UICompendium } from '@/visual/ui';
import { Network } from '@/multiplayer/network';
import { initScene, updateSunShadow } from '@/core/scene';
import { updateAtmosphere } from '@/visual/atmosphere';
import { GameLogic, GameLauncher } from '@/gameplay/logic';
import {
  createBoundaries,
  createAltars,
  updateMenhirVisuals,
  createAnimatedSky,
  createDecorations,
  updateOcclusion,
} from '@/gameplay/environment';
import {
  updateSkillVisuals,
  updateTelegraphs,
  updateFloatingTexts,
} from '@/visual/effects';
import { HUDEnchant } from '@/visual/ui/hud_enchant';
import { WorldEvents } from '@/gameplay/events';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { BuffBar } from '@/ui/buffBar';
import { SafeZoneHub } from '@/visual/ui/safeZoneHub';
import { createThemedWorldMap, spawnSafeZoneNPCs } from '@/gameplay/world/worldMap';
import { isInSafeZone, isNoMobZone } from '@/gameplay/world/worldZones';
import * as THREE from 'three';

declare global {
  interface Window {
    GameLauncher: typeof GameLauncher;
    Network: typeof Network;
    GameLogic: typeof GameLogic;
    Debug: Record<string, (...args: unknown[]) => void>;
    Globals: typeof Globals;
    UI: typeof UI;
    SkillTree: unknown;
    NewSkillUI: unknown;
    ForgeUI: unknown;
    ForgeSystem: unknown;
  }
}

export async function initializeGame(onProgress?: (progress: number, detail: string) => void): Promise<void> {
  window.GameLauncher = GameLauncher;
  window.Network = Network;
  window.GameLogic = GameLogic;

  window.Debug = {
    givePrism: (filter = 'random') => {
      if (!UICompendium.allFragmentsList) UICompendium.generatePrismaticOptions();
      let t = null;
      if (filter === 'random') {
        t = UICompendium.allFragmentsList[Math.floor(Math.random() * UICompendium.allFragmentsList.length)];
      } else {
        const m = UICompendium.allFragmentsList.filter(
          (f: { rarity: string; id: string }) => f.rarity === filter || f.id.includes(filter as string),
        );
        if (m.length > 0) t = m[Math.floor(Math.random() * m.length)];
      }
      if (t) UI.selectReward(t);
    },
    spawnBloodAltar: () =>
      WorldEvents.spawnBloodAltar(Globals.player.position.clone().add(new THREE.Vector3(5, 0, 0))),
    spawnGeode: () =>
      WorldEvents.spawnGeode(Globals.player.position.clone().add(new THREE.Vector3(-5, 0, 0))),
    spawnCrystalDefense: () =>
      WorldEvents.spawnCrystalDefense(Globals.player.position.clone().add(new THREE.Vector3(0, 0, 10))),
    spawnRunePuzzle: () =>
      WorldEvents.spawnRunePuzzle(Globals.player.position.clone().add(new THREE.Vector3(0, 0, -10))),
    spawnAncientGong: () =>
      WorldEvents.spawnAncientGong(Globals.player.position.clone().add(new THREE.Vector3(-5, 0, -5))),
    spawnElementalPillars: () =>
      WorldEvents.spawnElementalPillars(Globals.player.position.clone().add(new THREE.Vector3(15, 0, 0))),
    spawnLaserMirrors: () =>
      WorldEvents.spawnLaserMirrors(Globals.player.position.clone().add(new THREE.Vector3(0, 0, 15))),
    spawnLightRitual: () =>
      WorldEvents.spawnLightRitual(Globals.player.position.clone().add(new THREE.Vector3(0, 0, -15))),
    spawnGliderRun: () =>
      WorldEvents.spawnGliderRun(Globals.player.position.clone().add(new THREE.Vector3(10, 0, 10))),
    spawnMiniBoss: (miniId = 'random', tiers = null) =>
      GameLogic.spawnMiniBoss(miniId as string, tiers as string | string[] | null),
  };

  const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 20));

  if (onProgress) onProgress(0, 'Initialisation de la scène 3D...');
  initScene();
  await yieldToBrowser();

  if (onProgress) onProgress(15, 'Configuration des touches...');
  Input.init();
  await yieldToBrowser();

  if (onProgress) onProgress(30, 'Génération des textures...');
  TextureManager.load();
  await yieldToBrowser();

  if (onProgress) onProgress(45, 'Définition des limites...');
  createBoundaries();
  await yieldToBrowser();

  if (onProgress) onProgress(60, 'Génération de la carte...');
  createThemedWorldMap();
  await yieldToBrowser();

  if (onProgress) onProgress(75, 'Apparition des PNJ...');
  spawnSafeZoneNPCs();
  await yieldToBrowser();

  if (onProgress) onProgress(85, 'Génération des sanctuaires...');
  createAltars();
  await yieldToBrowser();

  if (onProgress) onProgress(90, 'Création des décors...');
  createDecorations();
  await yieldToBrowser();

  if (onProgress) onProgress(95, 'Finalisation de l\'environnement...');
  createAnimatedSky();
  SafeZoneHub.init();
  await yieldToBrowser();

  if (onProgress) onProgress(100, 'Lancement imminent...');

  // Appliquer les paramètres graphiques sauvegardés au démarrage
  if (UI && typeof UI.applyGraphicsSettings === 'function') {
    UI.applyGraphicsSettings();
  }
}

let questArrow: THREE.Group | null = null;
let questArrowMat: THREE.MeshBasicMaterial | null = null;

function createQuestArrowModel(): THREE.Group {
  const group = new THREE.Group();
  questArrowMat = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const arrowMesh = new THREE.Group();
  arrowMesh.rotation.y = Math.PI;
  group.add(arrowMesh);
  const headShape = new THREE.Shape();
  headShape.moveTo(0, 0.5);
  headShape.lineTo(0.4, -0.5);
  headShape.lineTo(0, -0.3);
  headShape.lineTo(-0.4, -0.5);
  headShape.lineTo(0, 0.5);
  const headGeo = new THREE.ShapeGeometry(headShape);
  const head = new THREE.Mesh(headGeo, questArrowMat);
  head.rotation.x = -Math.PI / 2;
  head.position.z = 0.5;
  arrowMesh.add(head);
  return group;
}

const questArrowTarget = new THREE.Vector3();

function updateQuestIndicator(dt: number): void {
  if (!Globals.player) return;
  if (!questArrow) {
    questArrow = createQuestArrowModel();
    Globals.scene.add(questArrow);
  }
  if (WorldEvents.interactables.length > 0) {
    const target = WorldEvents.interactables[0];
    const dist = Globals.player.position.distanceTo(target.position);
    if (dist < 15.0) {
      questArrow.visible = false;
    } else {
      questArrow.visible = true;
      questArrowTarget.copy(Globals.player.position);
      questArrowTarget.y += 3.5;
      questArrow.position.lerp(questArrowTarget, 1 - Math.exp(-13 * dt));
      questArrow.lookAt(target.position.x, target.position.y, target.position.z);
      const t = Date.now() * 0.005;
      if (questArrow.children[0]) questArrow.children[0].position.z = Math.sin(t) * 0.2;
      if (questArrowMat) {
        questArrowMat.opacity = 0.6 + Math.sin(t * 0.5) * 0.4;
      }
    }
  } else {
    questArrow.visible = false;
  }
}

function handlePassives(dt: number): void {
  ConstellationEngine.tick(dt);
  BuffBar.tick();
}

document.addEventListener(
  'click',
  () => {
    if (!AudioSys.initialized) AudioSys.init();
    if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
    AudioSys.playBgm('menu');
  },
  { once: true },
);

window.addEventListener('keydown', (e) => {
  if (STATE.cinematicActive) return;
  if (e.code === 'KeyF') {
    if (!WorldEvents.tryInteract()) GameLogic.tryInteractLocal();
  }
  if (e.code === 'KeyB') {
    SafeZoneHub.startRecallChanneling();
  }
  if (e.code === 'Escape') {
    if (Globals.player && !Globals.player.dead) {
      const optionsScreen = document.getElementById('screen-options');
      if (optionsScreen && optionsScreen.classList.contains('active')) {
        UI.closeInGameOptions();
      } else if (UI.isMenuOpen()) {
        // Un autre menu bloquant est ouvert, on le laisse se fermer via son propre listener (comme dans skills.ts)
        return;
      } else {
        UI.togglePauseMenu();
      }
    }
  }
  if (Globals.player && !Globals.player.dead) {
    if (e.code === 'Space') Globals.player.useSkill('space');
    if (e.code === 'ShiftLeft') Globals.player.useSkill('shift');
    if (e.code === 'KeyE') Globals.player.useSkill('e');
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && Globals.player?.releaseStellarCharge) {
    Globals.player.releaseStellarCharge();
  }
  if (Globals.player?.releaseLanceCharge) {
    Globals.player.releaseLanceCharge();
  }
});

// Tolérance du limiteur de FPS : absorbe la gigue du vsync (~1 ms) sans relâcher la limite.
const FRAME_TOLERANCE_MS = 2;

let lastTime = performance.now();
let lastFrameTime = 0;
let enemySpawnTimer = 0;
let frameCount = 0;
let lastFpsUpdateTime = 0;
let currentFps = 0;

function animate(): void {
  requestAnimationFrame(animate);
  const now = performance.now();

  // Limiteur de FPS graphique.
  // La marge d'une demi-frame évite de rejeter une frame arrivée juste avant l'échéance :
  // sans elle, un écran 60 Hz limité à 60 FPS saute une frame sur deux et tombe à 30 FPS.
  const fpsLimit = STATE.gameOptions?.fpsLimit || 120;
  if (fpsLimit < 120) {
    const frameDelay = 1000 / fpsLimit;
    if (now - lastFrameTime < frameDelay - FRAME_TOLERANCE_MS) {
      return;
    }
    // On avance l'échéance d'un pas fixe plutôt que de la caler sur `now`, ce qui éviterait
    // de dériver et de perdre progressivement des frames.
    const overshoot = now - lastFrameTime - frameDelay;
    lastFrameTime = overshoot > frameDelay ? now : now - Math.max(0, overshoot);
  } else {
    lastFrameTime = now;
  }

  // Calcul des FPS réels
  frameCount++;
  if (now - lastFpsUpdateTime >= 1000) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
    frameCount = 0;
    lastFpsUpdateTime = now;
    
    const showFps = !!STATE.gameOptions?.showFps;
    const fpsCounter = document.getElementById('fps-counter');
    if (fpsCounter) {
      if (showFps) {
        fpsCounter.style.display = 'block';
        fpsCounter.innerText = `${currentFps} FPS`;
      } else {
        fpsCounter.style.display = 'none';
      }
    }
  }

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (STATE.isPaused) return;

  if (!Globals.player) {
    const classScreen = document.getElementById('screen-class');
    const compendiumScreen = document.getElementById('screen-compendium');
    const isOpaqueScreenActive = (classScreen?.classList.contains('active')) || (compendiumScreen?.classList.contains('active'));

    if (!isOpaqueScreenActive) {
      if (Globals.water) {
        Globals.water.position.y = -1.8 + Math.sin(now * 0.001) * 0.05;
      }
      if (Globals.camera) {
        Globals.camera.position.set(48, 30, 48);
        Globals.camera.lookAt(0, 0, 0);
      }
      if (Globals.renderer && Globals.scene && Globals.camera) {
        Globals.renderer.render(Globals.scene, Globals.camera);
      }
    }
    return;
  }

  handlePassives(dt);
  HUDEnchant.updateLoop(dt);
  SafeZoneHub.tick(dt);
  WorldEvents.update(dt);
  updateQuestIndicator(dt);

  if (Globals.camera) {
    updateOcclusion(Globals.camera, Globals.player);
  }

  if (STATE.multiplayer.active) {
    // Network.update envoie déjà l'état du monde (throttlé à ~20 Hz côté NetSync).
    Network.update(dt);
    if (STATE.multiplayer.isHost) {
      enemySpawnTimer += dt * STATE.timeScale;
      const rate = STATE.gameOptions?.enemySpawnRate ?? 1.0;
      const maxMobs = STATE.gameOptions?.maxMobDisplay ?? 15;
      if (!STATE.bossSpawned && Globals.enemies.length < maxMobs && enemySpawnTimer > (9.0 / rate)) {
        if (Globals.player && !isInSafeZone(Globals.player.position) && !isNoMobZone(Globals.player.position)) {
          GameLogic.spawnEnemy();
          enemySpawnTimer = 0;
        }
      }
    }
  } else if (!STATE.multiplayer.active && Globals.player && !Globals.player.dead) {
    enemySpawnTimer += dt * STATE.timeScale;
    const rate = STATE.gameOptions?.enemySpawnRate ?? 1.0;
    const maxMobs = STATE.gameOptions?.maxMobDisplay ?? 30;
    if (enemySpawnTimer > (9.0 / rate) && Globals.enemies.length < maxMobs) {
      if (!isInSafeZone(Globals.player.position) && !isNoMobZone(Globals.player.position)) {
        GameLogic.spawnEnemy();
      }
      enemySpawnTimer = 0;
    }
  }

  if (Globals.player) Globals.player.update(dt);
  if (Globals.water) {
    Globals.water.position.y = -1.8 + Math.sin(now * 0.001) * 0.05;
  }
  GameLogic.checkBossVictory();
  GameLogic.updateActiveCamps(dt);
  updateTelegraphs(dt);
  updateSkillVisuals(dt);
  updateMenhirVisuals();
  updateFloatingTexts(dt);

  for (let i = Globals.projectiles.length - 1; i >= 0; i--) Globals.projectiles[i].update(dt);
  for (let i = Globals.enemies.length - 1; i >= 0; i--) {
    const e = Globals.enemies[i];
    e.update(dt);
    if (e.dead) {
      if (!e.isDying) {
        e.startDeathAnimation();
      }
      if (e.deathAnimDone) {
        if (e.mesh) Globals.scene.remove(e.mesh);
        if (e instanceof THREE.Object3D) Globals.scene.remove(e);
        if (e.labelSprite) Globals.scene.remove(e.labelSprite);
        removeEnemy(e);
      }
    }
  }
  // Physique particules normalisée sur 60 FPS pour rester identique quel que soit le framerate.
  const particleStep = dt * 60;
  // Ces trois facteurs sont les mêmes pour toutes les particules de la frame : les calculer
  // une fois évite un Math.pow par particule (elles se comptent en centaines en combat).
  const particleShrink = Math.pow(0.95, particleStep);
  const particleGravity = 0.01 * particleStep;
  const particleSpin = 0.1 * particleStep;
  for (let i = Globals.particles.length - 1; i >= 0; i--) {
    const p = Globals.particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, particleStep);
    p.vel.y -= particleGravity;
    p.mesh.rotation.x += particleSpin;
    p.mesh.scale.multiplyScalar(particleShrink);
    if (p.life <= 0) {
      Globals.scene.remove(p.mesh);
      Globals.particles.splice(i, 1);
    }
  }

  let camTarget = Globals.player;
  if (Globals.player && Globals.player.dead && STATE.multiplayer.active) {
    for (const id in STATE.multiplayer.remotePlayers) {
      if (STATE.multiplayer.remotePlayers[id]) {
        camTarget = STATE.multiplayer.remotePlayers[id];
        break;
      }
    }
  }

  if (Globals.cameraOverride) {
    Globals.camera.position.copy(Globals.cameraOverride.position);
    Globals.camera.lookAt(Globals.cameraOverride.lookAt);
  } else if (camTarget) {
    Globals.camera.position.x = camTarget.position.x;
    Globals.camera.position.z = camTarget.position.z + 12;
    Globals.camera.position.y = camTarget.position.y + 14;
    Globals.camera.lookAt(camTarget.position);
  } else {
    // Vue fixe pré-jeu au lieu d'une rotation continue consommatrice en ressources
    Globals.camera.position.set(48, 30, 48);
    Globals.camera.lookAt(0, 0, 0);
  }

  if (Globals.cameraShake) {
    Globals.camera.position.x += Globals.cameraShake.x;
    Globals.camera.position.y += Globals.cameraShake.y;
    Globals.camera.position.z += Globals.cameraShake.z;
    const shakeDecay = Math.pow(0.88, dt * 60);
    Globals.cameraShake.x *= shakeDecay;
    Globals.cameraShake.y *= shakeDecay;
    Globals.cameraShake.z *= shakeDecay;
  }

  // Le soleil suit l'action plutôt que la caméra : le tremblement d'écran ne doit pas
  // faire vibrer les ombres portées.
  const shadowFocus = camTarget ? camTarget.position : Globals.camera.position;
  updateSunShadow(shadowFocus.x, shadowFocus.z);
  updateAtmosphere(dt, shadowFocus.x, shadowFocus.z);

  Globals.renderer.render(Globals.scene, Globals.camera);
}

export function startGameLoop(): void {
  UI.show('landing');
  animate();
}
