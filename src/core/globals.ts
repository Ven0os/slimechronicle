// @ts-nocheck
// /core/globals.js
import { STATE } from './config';

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
    dirLight: null
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
export function setPlayer(p) { Globals.player = p; }
export function addEnemy(e) { Globals.enemies.push(e); }
export function removeEnemy(e) { 
    const idx = Globals.enemies.indexOf(e);
    if(idx > -1) Globals.enemies.splice(idx, 1);
}