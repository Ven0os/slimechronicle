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

async function boot(): Promise<void> {
  const bar = document.getElementById('loading-bar');
  const details = document.getElementById('loading-details');
  const loadingScreen = document.getElementById('loading-screen');

  if (details) details.innerText = "Chargement de l'interface...";
  await loadComponents();
  if (bar) bar.style.width = '20%';

  if (details) details.innerText = 'Génération des textures...';
  TextureManager.load();
  if (bar) bar.style.width = '30%';

  if (details) details.innerText = 'Chargement des effets sonores...';
  await AudioSys.init((progress) => {
    if (bar) bar.style.width = `${30 + progress * 70}%`;
    if (details) details.innerText = `Chargement Audio... ${Math.floor(progress * 100)}%`;
  });

  if (bar) bar.style.width = '100%';
  if (details) details.innerText = 'Lancement du jeu...';

  setTimeout(async () => {
    if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') {
      AudioSys.ctx.resume().catch(() => undefined);
    }

    loadingScreen?.classList.add('hidden');
    setTimeout(() => loadingScreen?.remove(), 500);

    const { startGameLoop } = await import('./game-loop');
    startGameLoop();
  }, 500);
}

window.BuffBar = BuffBar;
boot();
