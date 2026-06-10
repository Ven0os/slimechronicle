// @ts-nocheck
import { STATE } from '../core/config';
import { Globals } from '../core/globals';
import { AudioSys } from '../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual } from '../visual/effects';
import { Network } from './network';
import { Projectile } from '../gameplay/entities';

function safePlay(soundName) {
    if (AudioSys && AudioSys.sfx) {
        if (typeof AudioSys.sfx[soundName] === 'function') {
            AudioSys.sfx[soundName]();
        } else if (AudioSys.play) {
             AudioSys.play(soundName);
        }
    }
}

export const NetSkills = {
    // --- HOST LOGIC (Dégâts réels) ---
    applyRemoteSkillLogic: function(data, pos, dir) {
        // La logique de dégâts reste gérée par le Host ici (inchangée)
        // car les méthodes de classes sont visuelles ou locales.
        // On garde la logique simplifiée ou on peut appeler des méthodes "calculDmg" si elles existent.
        
        const baseDmg = 30; 
        
        // Attaques de base (Mêlée/Distance)
        if (data.action === 'attack-melee') {
             const range = 3.5;
             const damage = 20; 
             Globals.enemies.forEach(e => {
                if(e.position.distanceTo(pos) < range) {
                    const toE = e.position.clone().sub(pos).normalize();
                    if(dir.dot(toE) > 0.5) {
                         e.takeDamage(damage);
                         spawnParticles(e.position, data.color || 0xffffff, 5);
                    }
                }
             });
        }
        
        // Warrior Space (Exemple conservé pour compatibilité)
        if (data.class === 'warrior' && data.key === 'space') {
            Globals.enemies.forEach(e => { 
                if(e.position.distanceTo(pos) <= 8) { 
                    e.takeDamage(baseDmg * 2.5); 
                    if(typeof e.pushBack === 'function') e.pushBack(pos.clone().sub(e.position).normalize().multiplyScalar(-10));
                } 
            });
        }
    },

    // --- VISUAL FEEDBACK (CLIENT & HOST) ---
    triggerRemoteSkillVisual: function(data, remotePlayer) {
        const pos = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
        const dir = data.dir ? new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z) : new THREE.Vector3(0,0,1);

        // SI ON A UNE INSTANCE DE CLASSE RÉELLE (Warrior, Mage...)
        if (remotePlayer && typeof remotePlayer.performAttack === 'function') {
            
            // 1. Orienter le joueur vers l'action
            if (remotePlayer.mesh) {
                // Orienter le mesh dans la direction du skill
                const angle = Math.atan2(dir.x, dir.z);
                // On anime la rotation ou on set direct ? 
                // Set direct pour être réactif sur le skill
                remotePlayer.mesh.rotation.y = angle; 
                remotePlayer.netRotation = angle;
            }

            // 2. Déclencher l'animation spécifique
            if (data.action === 'attack-melee' || data.action === 'attack-range') {
                // Déclenche performAttack() de la sous-classe (Warrior.performAttack, etc.)
                // Grâce à isRemote=true, cela ne renverra pas de paquet réseau, mais jouera son, anim et projectile.
                console.log(`[NET] Anim Attack sur ${remotePlayer.className}`);
                remotePlayer.performAttack(); 
            
            } else if (data.action === 'skill') {
                console.log(`[NET] Anim Skill ${data.key} sur ${remotePlayer.className}`);
                // Déclenche useSkill() de la sous-classe
                // Cela lance l'anim (Space/Shift/E)
                remotePlayer.useSkill(data.key);
            }

        } 
        
        // IMPORTANT : AUCUN FALLBACK ICI
        // Si remotePlayer est null (ce qui arrive si l'ID est le mien), on ne joue RIEN.
        // Cela empêche l'écho visuel sur le joueur local.
    }
};