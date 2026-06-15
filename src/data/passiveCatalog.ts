/** Métadonnées d'affichage des passifs (constellation + runtime). */

export interface PassiveDisplayMeta {
  key: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  category: 'offense' | 'defense' | 'utility' | 'synergy';
}

export const PASSIVE_CATALOG: Record<string, PassiveDisplayMeta> = {
  ironThorn: { key: 'ironThorn', name: 'Épines de Fer', desc: 'Renvoie une partie des dégâts subis à l\'attaquant le plus proche.', icon: 'fa-icicles', color: '#95a5a6', category: 'defense' },
  ironWall: { key: 'ironWall', name: 'Mur Impénétrable', desc: '−8% dégâts reçus en plus de la réduction par DEF. Synergie Peau de Fer.', icon: 'fa-shield-halved', color: '#7f8c8d', category: 'defense' },
  warFervor: { key: 'warFervor', name: 'Ferveur Guerrière', desc: 'Chaque attaque de base : +3% dégâts (max 5 stacks).', icon: 'fa-fire', color: '#e74c3c', category: 'offense' },
  titanBlood: { key: 'titanBlood', name: 'Sang de Titan', desc: '2% des HP max convertis en DEF bonus.', icon: 'fa-dumbbell', color: '#c0392b', category: 'defense' },
  guardianWarCry: { key: 'guardianWarCry', name: 'Cri du Gardien', desc: 'Cri de Guerre : soins réduits de 35 %. Affecte les alliés. Alliés : +10 % de votre DEF pendant 6 s.', icon: 'fa-shield-heart', color: '#f39c12', category: 'utility' },
  parryRefund: { key: 'parryRefund', name: 'Parade Réactive', desc: 'Fin de Parade : −10% du cooldown max de chaque compétence.', icon: 'fa-shield-virus', color: '#9b59b6', category: 'utility' },
  parryCharge: { key: 'parryCharge', name: 'Charge Sismique', desc: '25% des dégâts bloqués en Parade ajoutés à la Frappe Sismique.', icon: 'fa-mountain', color: '#8e44ad', category: 'synergy' },
  runicColossus: { key: 'runicColossus', name: 'Jugement Runique', desc: 'Parade crée des Sceaux Runiques. Cri de Guerre les consomme en projectiles.', icon: 'fa-crown', color: '#ffd86b', category: 'synergy' },
  arcaneOverload: { key: 'arcaneOverload', name: 'Surcharge Arcane', desc: 'Les sorts réduisent les autres temps de recharge.', icon: 'fa-recycle', color: '#3498db', category: 'utility' },
  paradoxOverload: { key: 'paradoxOverload', name: 'Paradoxe Absolu', desc: 'Tous les 5 kills : +0,01–0,09 % stat permanente.', icon: 'fa-infinity', color: '#2980b9', category: 'synergy' },
  deepStasis: { key: 'deepStasis', name: 'Stase Profonde', desc: 'Chronostase ralentit davantage les ennemis.', icon: 'fa-hourglass', color: '#5dade2', category: 'utility' },
  etherSteps: { key: 'etherSteps', name: 'Pas Éthérés', desc: 'Charges d\'intangibilité après lancement de sort.', icon: 'fa-stairs', color: '#aaddff', category: 'defense' },
  blinkMastery: { key: 'blinkMastery', name: 'Transfert Maîtrisé', desc: 'Explosion de téléportation renforcée.', icon: 'fa-right-left', color: '#48c9b0', category: 'offense' },
  arcaneBarragePlus: { key: 'arcaneBarragePlus', name: 'Barrage Étendu', desc: 'Projectiles supplémentaires sur Arcane Barrage.', icon: 'fa-crosshairs', color: '#1abc9c', category: 'offense' },
  paradoxReplicated: { key: 'paradoxReplicated', name: 'Paradoxe Répliqué', desc: 'Les clones reproduisent vos compétences. Efficacité : 25 %. Ne peut pas se déclencher en chaîne.', icon: 'fa-clone', color: '#16a085', category: 'utility' },
  cloneExtend: { key: 'cloneExtend', name: 'Clones Persistants', desc: 'Les clones durent plus longtemps.', icon: 'fa-users', color: '#16a085', category: 'utility' },
  stellarOvercharge: { key: 'stellarOvercharge', name: 'Surcharge Stellaire', desc: 'Rayon Stellaire : charge de 50 % à 250 % de dégâts en 3,25 s. Relâcher Espace tire avec l\'amplification affichée. À 250 % : +20 % Portée.', icon: 'fa-star', color: '#f1c40f', category: 'offense' },
  solarBeamHaste: { key: 'solarBeamHaste', name: 'Faisceau Dévastateur', desc: 'Rayon Stellaire +10 % taille, scaling HP max, impact renforcé.', icon: 'fa-sun', color: '#f1c40f', category: 'offense' },
  lightFieldAmp: { key: 'lightFieldAmp', name: 'Champ Persistant', desc: 'Champ de Lumière prolongé et renforcé.', icon: 'fa-circle-radiation', color: '#f39c12', category: 'utility' },
  healAmp: { key: 'healAmp', name: 'Bénédiction', desc: 'Soins reçus augmentés.', icon: 'fa-hand-holding-medical', color: '#2ecc71', category: 'defense' },
  beamHaste: { key: 'beamHaste', name: 'Hâte Solaire', desc: 'Burst de vitesse après Rayon Stellaire.', icon: 'fa-person-running', color: '#ffe066', category: 'utility' },
  divineBulwark: { key: 'divineBulwark', name: 'Égide Renforcée', desc: 'Égide Divine octroie un bouclier.', icon: 'fa-shield-halved', color: '#ffd700', category: 'defense' },
  overhealShield: { key: 'overhealShield', name: 'Martyr', desc: 'Soins excédentaires convertis en bouclier.', icon: 'fa-hand-sparkles', color: '#ebe534', category: 'defense' },
  solarInspiration: { key: 'solarInspiration', name: 'Singularité Stellaire', desc: 'Rayon Stellaire crée un Champ de Lumière sur kill. Alliés : +15 % ATK. Sentinel : +30 % ATK.', icon: 'fa-sun', color: '#ffcc00', category: 'synergy' },
  bloodFrenzy: { key: 'bloodFrenzy', name: 'Frénésie Sanglante', desc: 'Sous 50 % HP : Frénésie pendant 6 s. Vitesse d\'attaque +25 %. Critical hits : +0,5 s. Maximum : 10 s.', icon: 'fa-fire-flame-curved', color: '#c0392b', category: 'offense' },
  hemorrhage: { key: 'hemorrhage', name: 'Saignée', desc: 'Les critiques appliquent des dégâts sur la durée.', icon: 'fa-droplet', color: '#c0392b', category: 'offense' },
  shadowVeil: { key: 'shadowVeil', name: 'Voile Fantôme', desc: 'Intangibilité brève après le dash.', icon: 'fa-ghost', color: '#1abc9c', category: 'defense' },
  dashReset: { key: 'dashReset', name: 'Pas du Néant', desc: 'Élimination recharge le dash.', icon: 'fa-street-view', color: '#16a085', category: 'utility' },
  cycloneExtend: { key: 'cycloneExtend', name: 'Toupie Prolongée', desc: 'Toupie Létale dure plus longtemps.', icon: 'fa-circle-notch', color: '#1abc9c', category: 'offense' },
  cyclonePull: { key: 'cyclonePull', name: 'Maelström', desc: 'La toupie attire les ennemis.', icon: 'fa-tornado', color: '#0e6655', category: 'offense' },
  earlyThirst: { key: 'earlyThirst', name: 'Fureur Précoce', desc: 'Soif de Sang active plus tôt.', icon: 'fa-fire', color: '#e74c3c', category: 'offense' },
  eternalThirst: { key: 'eternalThirst', name: 'Point de Rupture', desc: 'Soif de Sang stack 2x plus vite et cap à +120 %. À 10 % HP, la prochaine compétence devient Rupture.', icon: 'fa-skull', color: '#ff2d55', category: 'synergy' },
  lastBreath: { key: 'lastBreath', name: 'Dernier Souffle', desc: 'Survie unique à un coup fatal (CD 90s).', icon: 'fa-heart-crack', color: '#1abc9c', category: 'defense' },
  crimsonShield: { key: 'crimsonShield', name: 'Bouclier Écarlate', desc: 'Capacité du bouclier de sang augmentée.', icon: 'fa-shield-heart', color: '#8a0b0b', category: 'defense' },
  shieldOverflow: { key: 'shieldOverflow', name: 'Overflow', desc: 'Soins excédentaires renforcent le bouclier.', icon: 'fa-fill-drip', color: '#c0392b', category: 'defense' },
  vampiricMark: { key: 'vampiricMark', name: 'Marque Vampirique', desc: 'Vol de vie sur cibles marquées.', icon: 'fa-eye', color: '#e91e63', category: 'offense' },
  executioner: { key: 'executioner', name: 'Exécution', desc: 'Dégâts massifs contre cibles marquées.', icon: 'fa-skull-crossbones', color: '#641e16', category: 'offense' },
  frenzyBurst: { key: 'frenzyBurst', name: 'Rafale', desc: 'Balles supplémentaires en Frénésie.', icon: 'fa-gun', color: '#af601a', category: 'offense' },
  acceleratedTransfusion: { key: 'acceleratedTransfusion', name: 'Transfusion Accélérée', desc: 'Blood Pistol : vitesse d\'attaque +40 %. Dégâts subis −30 %. Dégâts −15 %. Vitesse du projectile +25 %.', icon: 'fa-syringe', color: '#d35400', category: 'offense' },
  frenzyAdrenaline: { key: 'frenzyAdrenaline', name: 'Adrénaline', desc: 'Kill en Frénésie recharge la compétence.', icon: 'fa-syringe', color: '#d35400', category: 'utility' },
  vampJumpAmp: { key: 'vampJumpAmp', name: 'Saut Vampirique+', desc: 'Impact élargi, +25 % dégâts, étourdissement prolongé et soin renforcé.', icon: 'fa-arrow-up', color: '#922b21', category: 'utility' },
  bloodPact: { key: 'bloodPact', name: 'Hémocycle', desc: 'Blood Pistol applique des Marques de Sang. Chaque marque stocke des dégâts amplifiés par les HP max de la cible.', icon: 'fa-heart-pulse', color: '#ff4d6d', category: 'synergy' },
  solarBounce: { key: 'solarBounce', name: 'Éclats Multiples', desc: 'Rebonds solaires supplémentaires.', icon: 'fa-meteor', color: '#ffcc00', category: 'offense' },
  devouringSun: { key: 'devouringSun', name: 'Soleil Vorace', desc: 'Brûlure : 20 % de chance d\'Étincelle Solaire par tick. 5 étincelles → Explosion Solaire (80 % lance).', icon: 'fa-sun-plant-wilt', color: '#f39c12', category: 'offense' },
  solarFlare: { key: 'solarFlare', name: 'Couronne Éclipsée', desc: 'Débloque la charge des attaques de lance (+75 % portée max). Prochaine charge : +7 % dégâts par ennemi de la dernière Fulgurance.', icon: 'fa-crown', color: '#f39c12', category: 'offense' },
  lunarSlow: { key: 'lunarSlow', name: 'Givre Lunaire', desc: 'Ralentissement lunaire renforcé.', icon: 'fa-snowflake', color: '#a3b1cc', category: 'utility' },
  lunarSpike: { key: 'lunarSpike', name: 'Marée Lunaire', desc: 'Pic de Lune : rayon +25 %. Sous Cataclysme : soigne 25 % des dégâts infligés.', icon: 'fa-circle', color: '#85929e', category: 'offense' },
  ruptureAstrale: { key: 'ruptureAstrale', name: 'Rupture Astrale', desc: 'Tous les 4 coups de lance : Rupture Astrale (90 % + 80 % dégâts, effets Soleil/Lune).', icon: 'fa-burst', color: '#9b59b6', category: 'offense' },
  equinoxHaste: { key: 'equinoxHaste', name: 'Équinoxe', desc: 'Vitesse accrue en Ascension.', icon: 'fa-arrows-spin', color: '#bb8fce', category: 'utility' },
  cataclysmHaste: { key: 'cataclysmHaste', name: 'Cataclysme Chargé', desc: 'Cataclysme se charge plus vite.', icon: 'fa-circle-notch', color: '#6c3483', category: 'offense' },
  voidPull: { key: 'voidPull', name: 'Trou Noir', desc: 'Cataclysme attire les ennemis.', icon: 'fa-circle-dot', color: '#2c3e50', category: 'offense' },
  celestialConvergence: { key: 'celestialConvergence', name: 'Dualité Céleste', desc: 'Rupture Astrale · Lance · Ascension · Cataclysme.', icon: 'fa-circle-half-stroke', color: '#af7ac5', category: 'synergy' },
  extraPrismLens: { key: 'extraPrismLens', name: 'Prisme Supplémentaire', desc: '4 rayons prismatiques (−10 % dégâts/rayon). Tirer à travers un Prisme applique Brûlure Temporelle (10 % dmg/s, 3 s, max 3 cumuls).', icon: 'fa-gem', color: '#48c9b0', category: 'offense' },
  continuumBurst: { key: 'continuumBurst', name: 'Prisme Affiné', desc: 'Cône prisme +15%. Rayon +8% dégâts. Convergence +0,5 s et +0,5 rayon résonance.', icon: 'fa-gem', color: '#48c9b0', category: 'offense' },
  ruptureSurge: { key: 'ruptureSurge', name: 'Déchirure Amplifiée', desc: 'Explosion de rupture volontaire +35%. Rayon +8% dégâts.', icon: 'fa-burst', color: '#ffd93d', category: 'offense' },
  anachronismeAmp: { key: 'anachronismeAmp', name: 'Conduction Fractale', desc: 'Compétences coûtent 25 Fracture au lieu de 30.', icon: 'fa-hourglass-half', color: '#bb8fce', category: 'utility' },
  freezeFieldAmp: { key: 'freezeFieldAmp', name: 'Déphasage Renforcé', desc: 'Déphasage : portée +2, Instabilité +2s.', icon: 'fa-atom', color: '#f39c12', category: 'utility' },
  continuumMastery: { key: 'continuumMastery', name: 'Architecte de la Fracture', desc: 'Fracture 150 % · rayon renforcé et élargi · prismes 5s+3,5s.', icon: 'fa-infinity', color: '#ffd93d', category: 'synergy' },
};

export function getPassiveMeta(key: string): PassiveDisplayMeta | undefined {
  return PASSIVE_CATALOG[key];
}
