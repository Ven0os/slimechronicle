// @ts-nocheck
// /core/globals.js
import { STATE } from './config';
import { enableShadowCasting } from '../visual/meshMaterialUtils';

// Conteneur pour les objets Three.js et les entités partagées
export const Globals = {
    player: null,
    enemies: [],
    projectiles: [],
    particles: [],
    skillVisuals: [],
    telegraphs: [],
    menhirs: [],
    scene: null,
    camera: null,
    renderer: null,
    hemiLight: null,
    dirLight: null,
    obstacles: [],
    safeHubMarker: null,
    water: null,
    ground: null,
    cameraOverride: null,
    cameraShake: { x: 0, y: 0, z: 0 },
};

// Actions du jeu exposées pour éviter les dépendances circulaires
export const GameActions = {
    spawnBoss: null,
    triggerWipe: null,
    startGameLogic: null,
    setAmbiance: null,
    gainXp: null
};

// Helpers
export function setPlayer(p) {
    Globals.player = p;
    enableShadowCasting(p);
}
export function addEnemy(e) {
    Globals.enemies.push(e);
    enableShadowCasting(e);
}
export function removeEnemy(e) { 
    const idx = Globals.enemies.indexOf(e);
    if(idx > -1) Globals.enemies.splice(idx, 1);
    disposeEnemyResources(e);
}

// Libère les ressources GPU d'un ennemi définitivement retiré (géométries, matériaux, textures).
// Chaque ennemi construit son propre modèle : aucune ressource n'est partagée entre instances.
export function disposeEnemyResources(e) {
    if (!e || e._resourcesDisposed) return;
    e._resourcesDisposed = true;
    if (e.flashTimeout) { clearTimeout(e.flashTimeout); e.flashTimeout = null; }
    if (typeof e.disposeHealthBar === 'function') e.disposeHealthBar();
    if (typeof e.traverse === 'function') {
        e.traverse((child) => {
            if (child.isMesh || child.isSprite || child.isPoints || child.isLine) {
                if (child.geometry) child.geometry.dispose();
                const mats = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
                for (const m of mats) {
                    if (m.map) m.map.dispose();
                    m.dispose();
                }
            }
        });
    }
}