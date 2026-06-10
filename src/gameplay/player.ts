// @ts-nocheck
import { Warrior } from './classes/player_warrior';
import { Mage } from './classes/player_mage';
import { Sentinel } from './classes/player_sentinel';
import { Blade } from './classes/player_blade';
import { Pacifier } from './classes/player_pacifier';
import { Eclipse } from './classes/player_eclipse';
import { Chronoregulator } from './classes/player_chronoregulator';

// Le fichier player.js agit maintenant comme une "Factory"
// Il exporte une "fausse classe" Player qui retourne en fait une instance de la bonne sous-classe
export class Player {
    constructor(className) {
        switch(className) {
            case 'warrior': return new Warrior();
            case 'mage': return new Mage();
            case 'sentinel': return new Sentinel();
            case 'blade': return new Blade();
            case 'pacifier': return new Pacifier();
            case 'eclipse': return new Eclipse();
            case 'chronoregulator': return new Chronoregulator();
            default: 
                console.error("Classe inconnue:", className);
                return new Warrior(); // Fallback
        }
    }
}