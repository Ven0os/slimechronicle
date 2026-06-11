// @ts-nocheck
import { Globals } from '../core/globals';
import { STATE } from '../core/config';
import { spawnParticles, createDamageText } from '../visual/effects';
import { dealDamageToEnemy } from './combat/damage_helpers';
import { damageClosestPlayerInRadius, isServerAuthority, isVisualOnlyMode } from '@/multiplayer/net_combat';

export class Projectile {
    constructor(geo, mat, pos, dir, speed, dmg, owner, color, hasTrail = true) {
        this.mesh = new THREE.Mesh(geo, mat); 
        this.mesh.position.copy(pos);
        
        // Orientation du modèle dans la direction du tir
        this.mesh.lookAt(pos.clone().add(dir));
        
        Globals.scene.add(this.mesh);
        
        this.color = color; 
        this.dir = dir; 
        this.speed = speed; 
        this.dmg = dmg; 
        this.owner = owner; 
        this.life = 2.0;
        this.maxLife = 2.0; 
        this.trailTimer = 0;
        this.hasTrail = hasTrail;
        
        // Rotation propre au projectile (pour l'effet magique)
        // On ajoute une vitesse de rotation aléatoire sur l'axe Z local
        this.rotSpeed = (Math.random() - 0.5) * 10;

        this.piercing = false;
        this.hitIds = new Set();
        this.onHitEnemy = null;
        this.visualOnly = isVisualOnlyMode();

        // Glow (Lueur) ajustée selon la forme
        const glowGeo = (geo.type === 'CylinderGeometry' || geo.type === 'CapsuleGeometry') 
            ? geo.clone().scale(1.5, 1, 1.5) 
            : new THREE.SphereGeometry(geo.parameters.radius ? geo.parameters.radius * 2.0 : 0.6); // Glow plus gros
            
        const glow = new THREE.Mesh(
            glowGeo, 
            new THREE.MeshBasicMaterial({color: color, transparent: true, opacity: 0.4})
        );
        this.mesh.add(glow);
    }

    update(dt) {
        this.life -= dt; 
        if(this.life <= 0) { this.destroy(); return; }
        
        this.mesh.position.add(this.dir.clone().multiplyScalar(this.speed * dt));
        
        // Effet de rotation sur lui-même (pour les orbes magiques)
        this.mesh.rotateZ(this.rotSpeed * dt);
        this.mesh.rotateX(this.rotSpeed * 0.5 * dt);

        // Traînée de particules
        if (this.hasTrail) {
            this.trailTimer += dt; 
            if(this.trailTimer > 0.01) { // Plus fréquent pour une belle traînée
                const offset = this.dir.clone().multiplyScalar(-0.5);
                // Petite variation aléatoire pour étoffer la traînée
                offset.add(new THREE.Vector3((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2));
                spawnParticles(this.mesh.position.clone().add(offset), this.color, 1); 
                this.trailTimer = 0; 
            }
        }

        // --- Collisions Environnement ---
        if (Globals.obstacles && (this.maxLife - this.life) > 0.1) {
            for (const obs of Globals.obstacles) {
                const dx = this.mesh.position.x - obs.position.x;
                const dz = this.mesh.position.z - obs.position.z;
                const dist2d = Math.sqrt(dx*dx + dz*dz);
                
                if (dist2d < obs.radius + 0.2) { 
                    spawnParticles(this.mesh.position, this.color, 5);
                    this.destroy();
                    return; 
                }
            }
        }
        
        // --- Collisions Joueur (Tir Ennemi) — autorité hôte uniquement ---
        if (this.owner === 'enemy' && isServerAuthority()) {
            const hitPos = this.mesh.position;
            const targets = [];
            if (Globals.player && !Globals.player.dead) targets.push(Globals.player);
            for (const id in STATE.multiplayer.remotePlayers) {
                const p = STATE.multiplayer.remotePlayers[id];
                if (p && !p.dead && p.visible) targets.push(p);
            }
            for (const t of targets) {
                const dx = hitPos.x - t.position.x;
                const dz = hitPos.z - t.position.z;
                if (Math.sqrt(dx * dx + dz * dz) < 1.2) {
                    damageClosestPlayerInRadius(hitPos, 1.2, this.dmg);
                    spawnParticles(hitPos, this.color, 8);
                    this.destroy();
                    return;
                }
            }
        }
        
        // --- Collisions Ennemis (Tir Joueur/Allié) ---
        // IMPORTANT : On exclut 'enemy' ici. Les ennemis ne se touchent plus entre eux.
        if(this.owner === 'player' || this.owner === 'blood_pistol' || this.owner === 'dagger' || this.owner === 'remote') {
            for(let e of Globals.enemies) {
                if(e.dead) continue;
                const dx = this.mesh.position.x - e.position.x;
                const dz = this.mesh.position.z - e.position.z;
                const dist2d = Math.sqrt(dx*dx + dz*dz);
                
                if(dist2d <= (e.radius + 0.5)) {
                    const eid = e.netId || e.uuid || `${e.position.x}-${e.position.z}`;
                    if (this.piercing && this.hitIds.has(eid)) continue;

                    if (this.visualOnly) {
                        spawnParticles(this.mesh.position, this.color, 5);
                        if (!this.piercing) { this.destroy(); break; }
                        this.hitIds.add(eid);
                        continue;
                    }

                    dealDamageToEnemy(e, this.dmg, {
                        pos: e.position,
                        onHitEnemy: this.onHitEnemy,
                    });

                    if (this.piercing) this.hitIds.add(eid);
                    
                    if(this.owner === 'blood_pistol' && Globals.player) Globals.player.heal(Globals.player.maxHp * 0.01);
                    
                    spawnParticles(this.mesh.position, this.color, 5);
                    if (!this.piercing) {
                        this.destroy();
                        break;
                    }
                }
            }
        }
    }
    
    destroy() { 
        Globals.scene.remove(this.mesh); 
        const idx = Globals.projectiles.indexOf(this);
        if(idx > -1) Globals.projectiles.splice(idx, 1);
    }
}