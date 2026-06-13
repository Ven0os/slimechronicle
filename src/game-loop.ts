import { STATE } from '@/core/config';
import { Globals, removeEnemy } from '@/core/globals';
import { AudioSys, TextureManager } from '@/core/ressources';
import { Input } from '@/core/input';
import { UI, UICompendium } from '@/visual/ui';
import { Network } from '@/multiplayer/network';
import { initScene } from '@/core/scene';
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

initScene();
Input.init();
TextureManager.load();

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

createBoundaries();
createThemedWorldMap();
spawnSafeZoneNPCs();
createAltars();
createDecorations();
createAnimatedSky();
SafeZoneHub.init();

let questArrow: THREE.Group | null = null;

function createQuestArrowModel(): THREE.Group {
  const group = new THREE.Group();
  const greenMat = new THREE.MeshBasicMaterial({
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
  const head = new THREE.Mesh(headGeo, greenMat);
  head.rotation.x = -Math.PI / 2;
  head.position.z = 0.5;
  arrowMesh.add(head);
  return group;
}

function updateQuestIndicator(): void {
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
      const targetPos = Globals.player.position.clone().add(new THREE.Vector3(0, 3.5, 0));
      questArrow.position.lerp(targetPos, 0.2);
      questArrow.lookAt(target.position.x, target.position.y, target.position.z);
      const t = Date.now() * 0.005;
      if (questArrow.children[0]) questArrow.children[0].position.z = Math.sin(t) * 0.2;
      const opacity = 0.6 + Math.sin(t * 0.5) * 0.4;
      questArrow.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.material && 'opacity' in (mesh.material as THREE.Material)) {
          (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
        }
      });
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
  if (e.code === 'KeyF') {
    if (!WorldEvents.tryInteract()) GameLogic.tryInteractLocal();
  }
  if (e.code === 'KeyB') {
    SafeZoneHub.startRecallChanneling();
  }
  if (Globals.player && !Globals.player.dead) {
    if (e.code === 'Space') Globals.player.useSkill('space');
    if (e.code === 'ShiftLeft') Globals.player.useSkill('shift');
    if (e.code === 'KeyE') Globals.player.useSkill('e');
  }
});

let lastTime = performance.now();
let enemySpawnTimer = 0;

function animate(): void {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (STATE.isPaused) return;

  handlePassives(dt);
  HUDEnchant.updateLoop(dt);
  SafeZoneHub.tick(dt);
  WorldEvents.update(dt);
  updateQuestIndicator();

  if (Globals.player && Globals.camera) {
    updateOcclusion(Globals.camera, Globals.player);
  }

  if (STATE.multiplayer.active) {
    Network.update(dt);
    if (STATE.multiplayer.isHost) {
      Network.sendWorldState();
      enemySpawnTimer += dt * STATE.timeScale;
      const rate = STATE.gameOptions?.enemySpawnRate ?? 1.0;
      if (!STATE.bossSpawned && Globals.enemies.length < 15 && enemySpawnTimer > (9.0 / rate)) {
        if (Globals.player && !isInSafeZone(Globals.player.position) && !isNoMobZone(Globals.player.position)) {
          GameLogic.spawnEnemy();
          enemySpawnTimer = 0;
        }
      }
    }
  } else if (!STATE.multiplayer.active && Globals.player && !Globals.player.dead) {
    enemySpawnTimer += dt * STATE.timeScale;
    const rate = STATE.gameOptions?.enemySpawnRate ?? 1.0;
    if (enemySpawnTimer > (9.0 / rate) && Globals.enemies.length < 30) {
      if (!isInSafeZone(Globals.player.position) && !isNoMobZone(Globals.player.position)) {
        GameLogic.spawnEnemy();
      }
      enemySpawnTimer = 0;
    }
  }

  if (Globals.player) Globals.player.update(dt);
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
  for (let i = Globals.particles.length - 1; i >= 0; i--) {
    const p = Globals.particles[i];
    p.life -= dt;
    p.mesh.position.add(p.vel);
    p.vel.y -= 0.01;
    p.mesh.rotation.x += 0.1;
    p.mesh.scale.multiplyScalar(0.95);
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

  if (camTarget) {
    Globals.camera.position.x = camTarget.position.x;
    Globals.camera.position.z = camTarget.position.z + 12;
    Globals.camera.position.y = camTarget.position.y + 14;
    Globals.camera.lookAt(camTarget.position);
  } else {
    const time = now * 0.0001;
    const radius = 80;
    Globals.camera.position.x = Math.cos(time) * radius;
    Globals.camera.position.z = Math.sin(time) * radius;
    Globals.camera.position.y = 5;
    Globals.camera.lookAt(0, 0, 0);
  }

  Globals.renderer.render(Globals.scene, Globals.camera);
}

export function startGameLoop(): void {
  UI.show('landing');
  animate();
}
