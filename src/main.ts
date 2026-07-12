import './shims/globals';
import '@/visual/css/game_base.css';
import '@/visual/css/menu_ui.css';
import '@/visual/css/systems_rpg.css';
import '@/visual/css/buff-bar.css';
import '@/visual/css/constellation-ui.css';
import '@/visual/css/grimoire-ui.css';
import '@/visual/css/prismatic-index.css';
import '@/visual/css/destiny-menu.css';
import '@/visual/css/safe-zone-hub.css';
import '@/visual/ui/safeZoneHub';
import { BuffBar } from '@/ui/buffBar';
import { loadComponents } from './bootstrap/loadComponents';
import { AudioSys, TextureManager } from '@/core/ressources';

function updateProgress(percentage: number, text: string) {
  const bar = document.getElementById('loading-bar');
  const details = document.getElementById('loading-details');
  const percentEl = document.getElementById('loading-percentage');
  
  if (bar) bar.style.width = `${percentage}%`;
  if (details) details.innerText = text;
  if (percentEl) percentEl.innerText = `${Math.floor(percentage)}%`;
}

async function boot(): Promise<void> {
  const loadingScreen = document.getElementById('loading-screen');
  const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 20));

  // Phase 1: Interface UI elements
  updateProgress(5, "Initialisation de l'interface...");
  await loadComponents();
  await yieldToBrowser();

  // Phase 2: Audio preloading
  updateProgress(15, "Chargement des effets sonores...");
  await AudioSys.init((progress) => {
    // Maps audio progress (0 to 1) to progress range (15 to 45)
    const currentProgress = 15 + progress * 30;
    updateProgress(currentProgress, `Chargement audio... ${Math.floor(progress * 100)}%`);
  });
  await yieldToBrowser();

  // Phase 3: Game Loop module import
  updateProgress(48, "Chargement du moteur de jeu...");
  const { initializeGame, startGameLoop } = await import('./game-loop');
  await yieldToBrowser();

  // Phase 4: Game initialization (scene, boundaries, map, npcs, altars, decorations)
  await initializeGame((stepProgress, stepDetail) => {
    // Maps initializeGame progress (0 to 100) to progress range (50 to 95)
    const currentProgress = 50 + (stepProgress / 100) * 45;
    updateProgress(currentProgress, stepDetail);
  });

  // Phase 5: Complete
  updateProgress(100, "Prêt !");

  setTimeout(() => {
    if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') {
      AudioSys.ctx.resume().catch(() => undefined);
    }

    loadingScreen?.classList.add('hidden');
    setTimeout(() => loadingScreen?.remove(), 600);

    startGameLoop();
  }, 400);
}

window.BuffBar = BuffBar;
boot();
