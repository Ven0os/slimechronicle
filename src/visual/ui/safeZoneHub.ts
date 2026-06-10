// @ts-nocheck
import * as THREE from 'three';
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { isInSafeZone } from '@/gameplay/world/worldZones';
import { WorldEvents } from '@/gameplay/events';
import { NewSkillUI } from './skills';
import { ForgeUI } from './forge';
import { UI } from '../ui';
import { Input } from '@/core/input';
import { AudioSys } from '@/core/ressources';
import { spawnParticles } from '@/visual/effects';

export const SafeZoneHub = {
  recallCooldown: 0,
  _bound: false,
  channelingTime: 0,
  channelingVisual: null,

  init(): void {
    if (!this._bound) {
      this._bound = true;
      this.bindHubButtons();
    }

    const recall = document.getElementById('recall-btn');
    if (recall) recall.style.display = 'none';

    const recallHud = document.getElementById('recall-hud');
    if (recallHud) {
      recallHud.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startRecallChanneling();
      });
    }
  },

  bindHubButtons(): void {
    const panel = document.getElementById('safe-hub-panel');
    if (!panel) return;

    const actions: Record<string, () => void> = {
      stellar: () => this.openStellarUI(),
      forge: () => this.openForge(),
      close: () => this.closeHub(),
    };

    panel.querySelectorAll('[data-hub-action]').forEach((el) => {
      const key = el.getAttribute('data-hub-action');
      if (!key || !actions[key]) return;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        actions[key]();
      });
    });

    panel.addEventListener('click', (e) => {
      if (e.target === panel) this.closeHub();
    });
  },

  isInHub(): boolean {
    return Globals.player && isInSafeZone(Globals.player.position) && !STATE.leftSafeZone;
  },

  canOpenServices(): boolean {
    return this.isInHub();
  },

  openHub(): void {
    if (!this.canOpenServices()) {
      UI.toast('Retournez à la base pour accéder au menu.');
      return;
    }
    const panel = document.getElementById('safe-hub-panel');
    if (panel) {
      panel.classList.add('active');
      if (!STATE.multiplayer.active) STATE.isPaused = true;
    }
  },

  closeHub(keepPaused = false): void {
    const panel = document.getElementById('safe-hub-panel');
    if (panel) panel.classList.remove('active');
    if (!keepPaused && !STATE.multiplayer.active && !UI.isMenuOpen()) STATE.isPaused = false;
  },

  openSkillTab(tab: string): void {
    this.closeHub(true);
    const wrapper = document.getElementById('skill-ui-wrapper');
    if (!wrapper) {
      UI.toast('Interface indisponible.');
      return;
    }
    if (!wrapper.classList.contains('active')) NewSkillUI.toggle();
    NewSkillUI.switchTab(tab);
  },

  openStellarUI(): void {
    this.openSkillTab('tree');
  },

  openForge(): void {
    this.closeHub(true);
    ForgeUI.toggle();
  },

  startRecallChanneling(): void {
    if (!Globals.player || Globals.player.dead) return;
    // Ne pas rappeler si déjà dans la zone sûre
    if (!STATE.leftSafeZone && isInSafeZone(Globals.player.position)) {
      UI.toast('Déjà dans la zone sûre.');
      return;
    }
    if (this.channelingTime > 0) return;

    this.channelingTime = 5.0;

    // Création de l'effet visuel 3D de téléportation
    const group = new THREE.Group();
    
    // Faisceau de lumière principal bleu céleste transparent (du ciel)
    const outerGeo = new THREE.CylinderGeometry(2.0, 2.0, 40.0, 16, 1, true);
    const outerMat = new THREE.MeshBasicMaterial({
        color: 0x00bfff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    const outerBeam = new THREE.Mesh(outerGeo, outerMat);
    outerBeam.position.y = 20.0;
    group.add(outerBeam);

    // Coeur du faisceau blanc brillant ultra-lumineux
    const innerGeo = new THREE.CylinderGeometry(0.8, 0.8, 40.0, 16, 1, true);
    const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
    });
    const innerBeam = new THREE.Mesh(innerGeo, innerMat);
    innerBeam.position.y = 20.0;
    group.add(innerBeam);
    
    // Anneau de sol tournant
    const torusGeo = new THREE.TorusGeometry(2.0, 0.06, 8, 32);
    const torusMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 0.15;
    group.add(torus);
    
    Globals.scene.add(group);
    this.channelingVisual = group;

    // Afficher la barre de canalisation UI
    const container = document.getElementById('channeling-bar-container');
    if (container) container.style.display = 'flex';

    AudioSys.play('magic_cast', 0.5);
    UI.toast('Canalisation du Rappel...');
  },

  cancelRecallChanneling(): void {
    if (this.channelingTime <= 0) return;
    this.channelingTime = 0;

    if (this.channelingVisual) {
      Globals.scene.remove(this.channelingVisual);
      this.channelingVisual = null;
    }

    const container = document.getElementById('channeling-bar-container');
    if (container) container.style.display = 'none';

    // Réinitialiser la rotation et position du mesh
    if (Globals.player) {
      if (Globals.player.mesh) {
        Globals.player.mesh.rotation.set(0, 0, 0);
      }
      Globals.player.verticalVelocity = 0;
    }
  },

  completeRecallChanneling(): void {
    if (!Globals.player) return;
    this.channelingTime = 0;

    if (this.channelingVisual) {
      Globals.scene.remove(this.channelingVisual);
      this.channelingVisual = null;
    }

    const container = document.getElementById('channeling-bar-container');
    if (container) container.style.display = 'none';

    // Téléportation à la Safe Zone à 10m de hauteur (y = 14.0 car la base est à y = 4.0)
    Globals.player.position.set(90, 14.0, 90);
    Globals.player.knockback?.set?.(0, 0, 0);
    Globals.player.verticalVelocity = -35.0; // vitesse de chute rapide d'atterrissage
    Globals.player.justRecalled = true; // Déclenche le slam
    STATE.leftSafeZone = false;

    // Réinitialiser la rotation
    if (Globals.player.mesh) {
      Globals.player.mesh.rotation.set(0, 0, 0);
    }

    // Effets sonores et visuels
    AudioSys.play('teleport', 0.7);
    spawnParticles(Globals.player.position, 0x00ffff, 25);
    UI.toast('Retourné à la base !');
  },

  tick(dt: number): void {
    if (this.recallCooldown > 0) this.recallCooldown = Math.max(0, this.recallCooldown - dt);
    this.updateRecallButton();

    if (!Globals.player) return;

    // Gestion de la canalisation du Rappel
    if (this.channelingTime > 0) {
      // Annuler si le joueur bouge (touches de direction ou espace) ou s'il attaque
      const keysPressed = Input.keys['KeyW'] || Input.keys['KeyS'] || Input.keys['KeyA'] || Input.keys['KeyD'] || Input.keys['Space'];
      const isAttacking = Globals.player.isAttacking;

      if (keysPressed || isAttacking || Globals.player.dead) {
        this.cancelRecallChanneling();
        UI.toast("Rappel annulé (mouvement) !");
        return;
      }

      this.channelingTime = Math.max(0, this.channelingTime - dt);

      // Mouvement d'envol doux dans les 2 dernières secondes
      if (this.channelingTime < 2.0) {
        const liftProgress = (2.0 - this.channelingTime) / 2.0; // 0 à 1
        const targetY = Globals.player.groundLevel !== undefined ? Globals.player.groundLevel : 0.0;
        Globals.player.position.y = targetY + Math.sin(liftProgress * Math.PI / 2) * 4.0;
        if (Globals.player.mesh) {
          Globals.player.mesh.rotation.y += dt * 5.0 * liftProgress;
        }
      }

      // Animer l'effet 3D
      if (this.channelingVisual) {
        this.channelingVisual.position.copy(Globals.player.position);
        // Le faisceau reste horizontalement ancré sur le joueur mais commence au niveau du sol (pas en l'air avec le joueur)
        this.channelingVisual.position.y = Globals.player.groundLevel !== undefined ? Globals.player.groundLevel : 0.0;
        
        // Rotation des faisceaux
        this.channelingVisual.children[0].rotation.y += dt * 2.0;
        this.channelingVisual.children[1].rotation.y -= dt * 4.0;

        // Pulsation du rayon
        const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.05;
        this.channelingVisual.children[0].scale.set(pulse, 1.0, pulse);
        this.channelingVisual.children[1].scale.set(pulse, 1.0, pulse);

        // Intensification à la fin
        if (this.channelingTime < 1.0) {
          const fadeVal = 1.0 - this.channelingTime;
          this.channelingVisual.children[0].scale.set(pulse * (1.0 + fadeVal * 1.5), 1.0, pulse * (1.0 + fadeVal * 1.5));
          this.channelingVisual.children[1].scale.set(pulse * (1.0 + fadeVal * 2.0), 1.0, pulse * (1.0 + fadeVal * 2.0));
          this.channelingVisual.children[0].material.opacity = 0.15 + fadeVal * 0.35;
          this.channelingVisual.children[1].material.opacity = 0.45 + fadeVal * 0.55;
        }

        // Particules ascendantes
        if (Math.random() < 0.4) {
          const pPos = Globals.player.position.clone();
          pPos.x += (Math.random() - 0.5) * 3.5;
          pPos.z += (Math.random() - 0.5) * 3.5;
          pPos.y = (Globals.player.groundLevel !== undefined ? Globals.player.groundLevel : 0.0) + Math.random() * 5.0;
          spawnParticles(pPos, 0x00ffff, 1);
        }
      }

      // Mettre à jour l'UI de la barre
      const timer = document.getElementById('channeling-bar-timer');
      if (timer) {
        timer.textContent = `${this.channelingTime.toFixed(1)}s`;
      }

      if (this.channelingTime <= 0) {
        this.completeRecallChanneling();
      }
    }

    const inSafe = isInSafeZone(Globals.player.position);
    
    // Si le joueur vient de sortir de la zone sûre (chute animée physique depuis la plateforme)
    if (!STATE.leftSafeZone && !inSafe) {
      STATE.leftSafeZone = true;
      AudioSys.play('king_land', 0.55);
      UI.toast("Vous entrez dans la zone de combat !");
    }

    // Gestion de la translucidité de la falaise de spawn et de ses roches
    if (Globals.spawnPlatformGroup) {
      const targetOpacity = STATE.leftSafeZone ? 0.35 : 1.0;
      Globals.spawnPlatformGroup.traverse((child) => {
        if (child.isMesh && child.material) {
          if (!child.material.transparent) {
            child.material.transparent = true;
          }
          child.material.opacity += (targetOpacity - child.material.opacity) * dt * 4.0;
        }
      });
    }

    // Gestion de la translucidité des NPCs du spawn (Mage et Golem)
    if (WorldEvents && WorldEvents.npcs) {
      const targetOpacity = STATE.leftSafeZone ? 0.35 : 1.0;
      for (const npc of WorldEvents.npcs) {
        npc.traverse((child) => {
          if (child.isMesh && child.material) {
            if (!child.material.transparent) {
              child.material.transparent = true;
            }
            child.material.opacity += (targetOpacity - child.material.opacity) * dt * 4.0;
          }
        });
      }
    }

    const isMenuOpen = !!(window.UI && typeof window.UI.isMenuOpen === 'function' && window.UI.isMenuOpen());

    const recallHud = document.getElementById('recall-hud');
    if (recallHud) {
      recallHud.style.display = (STATE.leftSafeZone && !isMenuOpen) ? 'flex' : 'none';
    }
  },

  updateRecallButton(): void {
    const btn = document.getElementById('recall-btn');
    if (btn) btn.style.display = 'none';
  },
};

window.SafeZoneHub = SafeZoneHub;
