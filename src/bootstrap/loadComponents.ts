import systemOverlays from '../partials/system_overlays.html?raw';
import menuMain from '../partials/menu_main.html?raw';
import menuClasses from '../partials/menu_classes.html?raw';
import menuCompendium from '../partials/menu_compendium.html?raw';
import gameHud from '../partials/game_hud.html?raw';
import gameTalents from '../partials/game_talents.html?raw';
import gameModals from '../partials/game_modals.html?raw';
import menuForge from '../partials/menu_forge.html?raw';
import { initDestinySkillPanels } from '../visual/ui/destinyMenu';

const MOUNTS: Array<{ id: string; html: string }> = [
  { id: 'system-overlays', html: systemOverlays },
  { id: 'menu-main', html: menuMain },
  { id: 'menu-classes', html: menuClasses },
  { id: 'menu-compendium', html: menuCompendium },
  { id: 'game-hud', html: gameHud },
  { id: 'game-talents', html: gameTalents },
  { id: 'game-modals', html: gameModals },
  { id: 'menu-forge', html: menuForge },
];

export async function loadComponents(): Promise<void> {
  for (const { id, html } of MOUNTS) {
    const host = document.getElementById(id);
    if (host) host.innerHTML = html;
  }
  initDestinySkillPanels();
}
