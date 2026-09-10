# Slime Chronicles

Action-RPG 3D dans le navigateur. Solo ou coop à deux, sans serveur dédié.

Tu choisis une classe, tu sors de la zone sûre, tu farmes, tu montes ta constellation, tu enchaînes les biomes — et tu vas voir le Roi.

**Stack :** Three.js · TypeScript · Vite · PeerJS

## Ce que c'est

Un petit monde ouvert procedurally decorated : forêt, ruines, rochers, zone corrompue, bosquet sakura avec lac et pont en arche. Le camp de départ sert de hub (constellation, forge, rappel). Autour, des packs d'ennemis, des mini-boss, et au nord-ouest le **Sanctuaire du Roi**.

Le combat est en temps réel, vue 3D, caméra libre. Attaque de base à la souris, trois sorts par classe, progression via XP, fragments prismatiques et arbre de talents.

## Classes

Sept voies, une signature chacune :

| Classe | Rôle | Idée |
| --- | --- | --- |
| **Guerrier Runique** | Tank / mêlée | Encaisser, parer, exploser au sol |
| **Mage Paradoxe** | DPS / contrôle | Projectiles, gel, distorsion temporelle |
| **Sentinelle** | Support / distance | Rayon stellaire, soins, bouclier divin |
| **Brise-lame** | Mobile / off-tank | Dash, lames, fluidité de l'eau |
| **Pacifieur** | Hybride / risque | Vol de vie, marque, pistolet qui coûte de la HP |
| **Chronorégisseur** | DPS / jauge | Rayon continu, Fracture, pics au bon moment |
| **Chevalier Éclipse** | DPS / burst | Alternance Soleil / Lune, dash, cataclysme |

## Contrôles

| Touche | Action |
| --- | --- |
| **Z Q S D** (WASD) | Déplacement |
| **Clic gauche** | Attaque de base (le Chrono canalise son rayon) |
| **Espace** | Sort 1 |
| **Shift** | Sort 2 |
| **E** | Sort 3 |
| **F** | Interagir |
| **B** | Rappel vers le camp (channeling) |
| **Échap** | Pause / options |

## Modes

- **Aventure solo** — tout de suite, pas de code.
- **Créer (hôte)** — un code de partie s'affiche, à donner à l'autre joueur.
- **Rejoindre** — coller le code. Connexion P2P (PeerJS), l'hôte a l'autorité monde.

Le multi est du **deux joueurs**. Pas de backend maison : si le NAT est vicieux, la connexion peut échouer.

## Lancer en local

Prérequis : Node.js 18+.

```bash
npm install
npm run dev
```

Le jeu s'ouvre sur [http://localhost:5173](http://localhost:5173). Vite écoute sur toutes les interfaces (`host: true`), donc un autre PC sur le LAN peut aussi y accéder.

Autres scripts :

```bash
npm run build       # bundle production dans dist/
npm run preview     # servir le build
npm run typecheck   # tsc --noEmit
```

## Contenu

- **Monde** — arène centrale, forêt, ruines, collines, corruption, bosquet sakura (camp, lac, pont taiko-bashi).
- **Ennemis** — slimes / rôdeurs, sentinelles, warlocks, shamans, gardes royaux, corrompus. Mini-boss à tiers.
- **Boss** — Aethelgard, Souverain d'Ambre (King Slime) ; Slime Lord. Victoire → NG+ (le Roi scale).
- **Progression** — niveaux, constellation par classe (branches + keystones + apex), fragments prismatiques, forge.
- **Hub** — zone sûre, rappel (B), menus constellation / forge.

L'index prismatique (menu titre) catalogue les fragments et enchantements.

## Structure du repo

```
src/
  core/          scène, input, config, ressources
  gameplay/      joueur, classes, ennemis, monde, events
  multiplayer/   PeerJS, sync, autorité hôte
  systems/       constellation, passifs
  visual/        UI, VFX, CSS
  data/          stats, layouts de constellations
  partials/      HTML des menus / HUD
assets/          logo, (textures & sons ignorés par git s'ils sont lourds)
```

Point d'entrée : `src/main.ts` → `src/game-loop.ts`.

## Notes

Projet amateur en cours. Les events monde (autel, géode, gong, etc.) existent dans le code ; leur spawn aléatoire est pour l'instant coupé.

Les gros fichiers audio / textures sont listés dans `.gitignore` : un clone nu peut manquer de SFX et de musiques si tu n'as pas le dossier `assets/` complet.
