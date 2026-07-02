// @ts-nocheck
import { Globals } from '../core/globals';
import { STATE } from '../core/config';
import { getGroundLevelAt } from '../gameplay/world/worldZones';

let floatingTexts = [];

export function createDamageText(text, pos, color = '#ffffff') {
    if(!Globals.camera) return;
    
    const offsetPos = pos.clone();
    offsetPos.x += (Math.random() - 0.5) * 1.0;
    offsetPos.y += 2.0; 
    offsetPos.z += (Math.random() - 0.5) * 1.0;

    const div = document.createElement('div');
    div.innerText = text;
    div.style.position = 'absolute';
    div.style.color = color;
    div.style.fontWeight = 'bold';
    div.style.fontSize = '1.2rem';
    div.style.textShadow = '0 0 5px #000';
    div.style.pointerEvents = 'none';
    div.style.userSelect = 'none';
    div.style.whiteSpace = 'nowrap';
    div.style.opacity = '1';
    div.style.transition = 'opacity 0.5s';
    div.className = 'floating-text';

    if(String(text).includes("CRIT")) {
        div.style.fontSize = '2rem';
        div.style.color = '#ffff00';
        div.style.zIndex = '1000';
    }

    const container = document.getElementById('damage-text-container') || document.body;
    container.appendChild(div);

    floatingTexts.push({
        el: div,
        pos: offsetPos,
        life: 1.5,
        velocity: new THREE.Vector3(0, 1.5, 0)
    });
}

const floatingTextProjection = new THREE.Vector3();

export function updateFloatingTexts(dt) {
    if (!Globals.camera) return;

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const item = floatingTexts[i];
        item.life -= dt;
        item.pos.addScaledVector(item.velocity, dt);
        
        const vector = floatingTextProjection.copy(item.pos);
        vector.project(Globals.camera);

        const x = (vector.x * .5 + .5) * window.innerWidth;
        const y = (-(vector.y * .5) + .5) * window.innerHeight;

        item.el.style.left = `${x}px`;
        item.el.style.top = `${y}px`;
        item.el.style.transform = `translate(-50%, -50%) scale(${Math.max(0.5, item.life)})`; 

        if (item.life < 0.5) {
            item.el.style.opacity = item.life * 2;
        }

        if (item.life <= 0 || x < -50 || x > window.innerWidth + 50 || y < -50 || y > window.innerHeight + 50) {
            if(item.el.parentNode) item.el.parentNode.removeChild(item.el);
            floatingTexts.splice(i, 1);
        }
    }
}

// Géométries unitaires et matériaux partagés entre toutes les particules :
// évite une allocation GPU par particule et la fuite mémoire à leur destruction.
let particleGeos = null;
const particleMats = new Map();

function getParticleGeo() {
    if (!particleGeos) {
        particleGeos = [
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.OctahedronGeometry(1, 0),
            new THREE.TetrahedronGeometry(1, 0),
        ];
    }
    const rand = Math.random();
    if (rand < 0.4) return particleGeos[0];
    if (rand < 0.7) return particleGeos[1];
    return particleGeos[2];
}

function getParticleMat(color) {
    const key = String(color);
    let mat = particleMats.get(key);
    if (!mat) {
        mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.95 });
        particleMats.set(key, mat);
    }
    return mat;
}

export function spawnParticles(pos, color, count, sizeMult = 1.0) {
    for (let i = 0; i < count; i++) {
        // Random shape: Box, Octahedron, or Tetrahedron for realistic debris shards
        const size = (0.06 + Math.random() * 0.14) * sizeMult;
        const mesh = new THREE.Mesh(getParticleGeo(), getParticleMat(color));
        mesh.scale.setScalar(size);
        
        // Randomize initial positions around origin
        mesh.position.copy(pos);
        mesh.position.x += (Math.random() - 0.5) * 0.4;
        mesh.position.y += (Math.random() - 0.5) * 0.4;
        mesh.position.z += (Math.random() - 0.5) * 0.4;

        // Randomize starting rotation
        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        Globals.scene.add(mesh);

        // Randomize life and velocity vector for realistic dispersion physics
        Globals.particles.push({
            mesh: mesh,
            life: 0.4 + Math.random() * 0.5,
            vel: new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                (Math.random() * 1.5),
                (Math.random() - 0.5) * 0.8
            )
        });
    }
}

export function createTelegraph(pos, shape, size, duration, color, onComplete, rotationY = 0, isRemote = false) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos) + 0.05; // Slightly above dynamic ground level
    
    // Set the group's rotation. Since rotationY is Math.atan2(dir.x, dir.z),
    // rotating around Y aligns the local Z axis with the target direction.
    group.rotation.y = rotationY;

    const mat = new THREE.MeshBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.3, 
        side: THREE.DoubleSide,
        depthWrite: false
    });
    group.material = mat;

    if (shape === 'circle') {
        const ringMesh = new THREE.Mesh(new THREE.RingGeometry(size * 0.95, size, 32), mat);
        ringMesh.rotation.x = -Math.PI / 2;
        group.add(ringMesh);
        
        const fillMesh = new THREE.Mesh(new THREE.CircleGeometry(size, 32), new THREE.MeshBasicMaterial({
            color: color, 
            transparent: true, 
            opacity: 0.1
        }));
        fillMesh.rotation.x = -Math.PI / 2;
        fillMesh.position.y = 0.005;
        group.add(fillMesh);
        group.fill = fillMesh;
    } 
    else if (shape === 'rect') {
        const rectMesh = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), mat);
        rectMesh.rotation.x = -Math.PI / 2;
        // In local group coordinates, +Z is target direction.
        // A PlaneGeometry is flat on XZ. Its width is X and its length is Z.
        // It is already perfectly aligned with the target direction.
        group.add(rectMesh);
    }
    else if (shape === 'cone') {
        const sweepAngle = Math.PI * 2 / 3; // 120 degrees (matches the damage cone)
        const coneMesh = new THREE.Mesh(new THREE.CircleGeometry(size, 32, 0, sweepAngle), mat); 
        coneMesh.rotation.x = -Math.PI / 2;
        // The circle sector starts at 0 (along local +X) and goes to sweepAngle.
        // Its center is at sweepAngle / 2.
        // We want the center of the sector to point along local +Z (which is at -Math.PI / 2 on the flat plane).
        // Therefore, we rotate by -Math.PI / 2 - sweepAngle / 2.
        coneMesh.rotation.z = -Math.PI / 2 - sweepAngle / 2;
        group.add(coneMesh);
    }

    Globals.scene.add(group);

    group.userData = {
        timer: duration,
        maxTimer: duration,
        onComplete: onComplete
    };
    
    Globals.telegraphs = Globals.telegraphs || [];
    Globals.telegraphs.push(group);
    return group;
}

export function updateTelegraphs(dt) {
    if (!Globals.telegraphs) return;

    for (let i = Globals.telegraphs.length - 1; i >= 0; i--) {
        const t = Globals.telegraphs[i];
        t.userData.timer -= dt;

        if (t.fill) {
            const progress = 1 - (t.userData.timer / t.userData.maxTimer);
            t.fill.scale.setScalar(progress);
            t.fill.material.opacity = 0.1 + (progress * 0.4);
        } else if (t.material) {
            t.material.opacity = 0.3 + Math.sin(Date.now() * 0.02) * 0.2;
        }

        if (t.userData.timer <= 0) {
            if (t.userData.onComplete) t.userData.onComplete();
            Globals.scene.remove(t);
            
            // Dispose children geometries/materials recursively to prevent memory leaks
            t.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            
            Globals.telegraphs.splice(i, 1);
        }
    }
}

// Liste pour gérer les animations des visuels de compétences
let skillVisuals = [];

export function updateSkillVisuals(dt) {
    for (let i = skillVisuals.length - 1; i >= 0; i--) {
        const v = skillVisuals[i];
        v.life -= dt;
        
        if (v.type === 'melee_slash') {
            v.mesh.rotation.z -= 8.0 * dt; // Rotation rapide
            v.mesh.material.opacity = v.life * 2.0; // Fade out
            v.mesh.scale.multiplyScalar(Math.pow(1.05, dt * 60)); // Légère expansion (indépendante du FPS)
        }

        if (v.life <= 0) {
            Globals.scene.remove(v.mesh);
            if(v.mesh.geometry) v.mesh.geometry.dispose();
            if(v.mesh.material) v.mesh.material.dispose();
            skillVisuals.splice(i, 1);
        }
    }
}

export function createSkillVisual(type, pos, size, color, dir) {
    spawnParticles(pos, color, 10);
    
    if (type === 'slash' || type === 'melee_slash') {
         // Création d'un arc pour l'effet de coup
         // Radius, Tube, RadialSegments, TubularSegments, ArcLength
         const slashGeo = new THREE.TorusGeometry(size, 0.2, 2, 12, Math.PI / 1.5);
         const slashMat = new THREE.MeshBasicMaterial({
             color: color, 
             transparent: true, 
             opacity: 0.8,
             side: THREE.DoubleSide
         });
         const slash = new THREE.Mesh(slashGeo, slashMat);
         
         // Positionner devant le joueur, légèrement en hauteur
         slash.position.copy(pos).add(new THREE.Vector3(0, 1.0, 0));
         
         // Orienter face à la direction de l'attaque
         if(dir) {
             const angle = Math.atan2(dir.x, dir.z);
             slash.rotation.y = angle + Math.PI/2; // Ajustement pour que l'arc soit face devant
             
             // Décaler légèrement dans la direction pour ne pas être DANS le joueur
             slash.position.add(dir.clone().multiplyScalar(1.0));
         }
         
         slash.rotation.x = Math.PI / 2; // Plat par défaut
         // On incline un peu pour donner du style
         slash.rotation.z = Math.PI / 4; 

         Globals.scene.add(slash);
         
         // Ajouter à la liste d'update pour l'animation
         skillVisuals.push({
             mesh: slash,
             life: 0.25, // Durée très courte
             type: 'melee_slash'
         });
    }
    // ... Autres visuels existants ...
    else if (type === 'shockwave') {
        const geo = new THREE.RingGeometry(0.72, 1, 64);
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.78,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0));
        mesh.rotation.x = -Math.PI / 2;
        mesh.scale.setScalar(0.08);
        Globals.scene.add(mesh);
        
        // Animation simple inline pour la shockwave (ou ajouter à updateSkillVisuals pour plus de propreté)
        const startedAt = performance.now();
        const durationMs = 420;
        const targetScale = Math.max(0.2, size);
        const expand = () => {
            if(!mesh.parent) return;
            const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
            const ease = 1 - Math.pow(1 - progress, 3);
            const shimmer = 1 + Math.sin(progress * Math.PI * 2) * 0.025;
            mesh.scale.setScalar(THREE.MathUtils.lerp(0.08, targetScale, ease) * shimmer);
            mesh.material.opacity = (1 - progress) * 0.78;
            if(progress >= 1) {
                Globals.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
            } else {
                requestAnimationFrame(expand);
            }
        };
        expand();
    }
    else if (type === 'explosion') {
        // 1. Expanding and Color-Shifting Fireball
        const geo = new THREE.SphereGeometry(0.2, 16, 16);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
        Globals.scene.add(mesh);

        // 2. Shockwave ring at base
        const ringGeo = new THREE.RingGeometry(0.1, 0.3, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(pos).add(new THREE.Vector3(0, 0.05, 0));
        ringMesh.rotation.x = -Math.PI / 2;
        Globals.scene.add(ringMesh);

        // 3. Spikes of light (energy rays radiating from center)
        const raysGroup = new THREE.Group();
        raysGroup.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
        const rayGeo = new THREE.CylinderGeometry(0, 0.08, size * 0.7, 4);
        rayGeo.translate(0, size * 0.35, 0); // pivot at base
        const rayMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });
        for (let i = 0; i < 6; i++) {
            const ray = new THREE.Mesh(rayGeo, rayMat);
            ray.rotation.x = Math.random() * Math.PI * 2;
            ray.rotation.y = Math.random() * Math.PI * 2;
            ray.rotation.z = Math.random() * Math.PI * 2;
            raysGroup.add(ray);
        }
        Globals.scene.add(raysGroup);

        // Animate everything together (temps réel : identique à tout framerate)
        const maxLife = 0.45;
        const startTime = performance.now();
        const animate = () => {
            const life = maxLife - (performance.now() - startTime) / 1000;
            const progress = Math.max(0, life / maxLife); // 1.0 down to 0.0
            const easeOut = 1 - Math.pow(progress, 3);

            // Fireball updates
            if (mesh.parent) {
                const s = 0.2 + easeOut * (size * 1.2);
                mesh.scale.set(s, s, s);
                mesh.material.opacity = progress * 0.9;
                
                // Color transition from white -> orange -> dark purple/red
                if (progress > 0.7) {
                    mesh.material.color.setHex(0xffffff); // white hot
                } else if (progress > 0.4) {
                    mesh.material.color.lerpColors(new THREE.Color(0xffaa00), new THREE.Color(0xffffff), (progress - 0.4) / 0.3);
                } else {
                    mesh.material.color.lerpColors(new THREE.Color(0x3d0c02), new THREE.Color(0xffaa00), progress / 0.4);
                }
            }

            // Ring updates
            if (ringMesh.parent) {
                const rs = 1.0 + easeOut * (size * 1.8);
                ringMesh.scale.set(rs, rs, rs);
                ringMesh.material.opacity = progress * 0.8;
            }

            // Rays updates
            if (raysGroup.parent) {
                raysGroup.scale.setScalar(0.2 + easeOut * 1.2);
                rayMat.opacity = progress * 0.7;
            }

            if (life <= 0) {
                if (mesh.parent) {
                    Globals.scene.remove(mesh);
                    mesh.geometry.dispose();
                    mesh.material.dispose();
                }
                if (ringMesh.parent) {
                    Globals.scene.remove(ringMesh);
                    ringMesh.geometry.dispose();
                    ringMesh.material.dispose();
                }
                if (raysGroup.parent) {
                    Globals.scene.remove(raysGroup);
                    rayGeo.dispose();
                    rayMat.dispose();
                }
            } else {
                requestAnimationFrame(animate);
            }
        };
        animate();

        // Spawn dense realistic particles (fire sparks, orange flame, black/grey smoke)
        spawnParticles(pos, 0xff5500, 15);
        spawnParticles(pos, 0xffaa00, 10);
        spawnParticles(pos, 0x444444, 8); // grey smoke
        spawnParticles(pos, 0x222222, 8); // dark smoke
    }
    else if (type === 'vortex') {
        const group = new THREE.Group();
        group.position.copy(pos);
        Globals.scene.add(group);

        const spikeMat = new THREE.MeshStandardMaterial({
            color: 0x110722, // Dark obsidian
            emissive: 0x7b2cbf, // Glowing purple edges
            emissiveIntensity: 2.5,
            roughness: 0.3,
            metalness: 0.8
        });

        const numSpikes = 6 + Math.floor(Math.random() * 4);
        const spikes = [];

        for (let i = 0; i < numSpikes; i++) {
            const angle = (i / numSpikes) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist = Math.random() * (size * 0.75);
            
            const height = 1.2 + Math.random() * 1.5;
            const radius = 0.15 + Math.random() * 0.25;
            const geo = new THREE.ConeGeometry(radius, height, 4); // Faceted crystal prism
            
            const mesh = new THREE.Mesh(geo, spikeMat);
            
            // Start below ground
            mesh.position.set(Math.cos(angle) * dist, -height * 0.8, Math.sin(angle) * dist);
            // Random slant
            mesh.rotation.x = (Math.random() - 0.5) * 0.4;
            mesh.rotation.z = (Math.random() - 0.5) * 0.4;
            mesh.rotation.y = Math.random() * Math.PI;

            group.add(mesh);
            spikes.push({
                mesh: mesh,
                targetY: height / 2, // fully emerged Y position
                height: height
            });
        }

        // Emit dense particles on emergence
        spawnParticles(pos, 0x9d4edd, 15);
        spawnParticles(pos, 0x00ffff, 10);

        const duration = 1.5; // Spikes persist for 1.5s
        const spikesStart = performance.now();

        const animateSpikes = () => {
            const elapsed = (performance.now() - spikesStart) / 1000;
            const progress = elapsed / duration;

            spikes.forEach(s => {
                // Rising phase (first 15% of duration)
                if (progress < 0.15) {
                    const t = progress / 0.15;
                    const currentY = THREE.MathUtils.lerp(-s.height * 0.8, s.targetY, Math.sin(t * Math.PI / 2));
                    s.mesh.position.y = currentY;
                }
                // Sinking phase (last 20% of duration)
                else if (progress > 0.8) {
                    const t = (progress - 0.8) / 0.2;
                    s.mesh.position.y = THREE.MathUtils.lerp(s.targetY, -s.height * 0.9, t);
                    s.mesh.scale.setScalar(Math.max(0.001, 1.0 - t));
                }
                // Middle phase (vibrating slightly with void energy)
                else {
                    s.mesh.position.y = s.targetY + Math.sin(elapsed * 25) * 0.02;
                }
            });

            if (progress >= 1.0) {
                Globals.scene.remove(group);
                spikes.forEach(s => {
                    s.mesh.geometry.dispose();
                });
                spikeMat.dispose();
            } else {
                requestAnimationFrame(animateSpikes);
            }
        };

        animateSpikes();
    }
    else if (type === 'beam') {
        const group = new THREE.Group();
        group.position.copy(pos);
        
        // Orient the beam group in target direction
        if (dir) {
            const angle = Math.atan2(dir.x, dir.z);
            group.rotation.y = angle;
        }
        Globals.scene.add(group);

        const length = size;
        const beamRadius = 0.5;

        // Core cylinder (white glowing hot center)
        const coreGeo = new THREE.CylinderGeometry(beamRadius * 0.4, beamRadius * 0.4, length, 8);
        coreGeo.rotateX(Math.PI / 2); // align along Z axis
        coreGeo.translate(0, 0, length / 2); // offset pivot to start at origin
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        group.add(coreMesh);

        // Outer shield cylinder (purple plasma energy)
        const shieldGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, length, 12);
        shieldGeo.rotateX(Math.PI / 2);
        shieldGeo.translate(0, 0, length / 2);
        const shieldMat = new THREE.MeshStandardMaterial({ 
            color: 0x9d4edd, 
            emissive: 0xbd00ff, 
            emissiveIntensity: 3.5, 
            transparent: true, 
            opacity: 0.5 
        });
        const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        group.add(shieldMesh);

        // Add 4 orbiting golden energy rings along the length of the beam
        const ringGeo = new THREE.TorusGeometry(beamRadius * 1.3, 0.03, 4, 16);
        const rings = [];
        for (let i = 0; i < 4; i++) {
            const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 }));
            ring.position.z = (i / 3) * length;
            group.add(ring);
            rings.push(ring);
        }

        const duration = 0.6; // beam channels/blasts for 0.6 seconds
        const beamStart = performance.now();
        let beamLastFrame = beamStart;

        const animateBeam = () => {
            const nowT = performance.now();
            const frameDt = Math.min((nowT - beamLastFrame) / 1000, 0.1);
            beamLastFrame = nowT;
            const elapsed = (nowT - beamStart) / 1000;
            const progress = elapsed / duration;

            if (progress >= 1.0) {
                Globals.scene.remove(group);
                coreGeo.dispose();
                coreMat.dispose();
                shieldGeo.dispose();
                shieldMat.dispose();
                ringGeo.dispose();
                rings.forEach(r => r.material.dispose());
            } else {
                // Pulse size
                const pulse = 1.0 + Math.sin(elapsed * 50) * 0.15;
                shieldMesh.scale.set(pulse, pulse, 1.0);
                coreMesh.scale.set(pulse, pulse, 1.0);
                
                // Fade out
                shieldMat.opacity = (1.0 - progress) * 0.65;
                coreMat.opacity = (1.0 - progress) * 0.95;

                // Spin and move rings
                rings.forEach((r, idx) => {
                    r.rotation.z = elapsed * 6;
                    r.material.opacity = (1.0 - progress) * 0.8;
                    r.position.x = Math.sin(elapsed * 30 + idx) * 0.05;
                    r.position.y = Math.cos(elapsed * 30 + idx) * 0.05;
                });

                // Spawn particles along the beam path (taux normalisé sur 60 FPS)
                if (Math.random() < 0.4 * frameDt * 60) {
                    const randDist = Math.random() * length;
                    const pPos = pos.clone().add(dir.clone().multiplyScalar(randDist));
                    pPos.y += (Math.random() - 0.5) * 0.5;
                    spawnParticles(pPos, 0xbd00ff, 1);
                }

                requestAnimationFrame(animateBeam);
            }
        };
        animateBeam();
    }
    else if (type === 'meteor') {
        const targetPos = pos.clone();
        const startHeight = 15.0;
        const meteorPos = targetPos.clone().add(new THREE.Vector3(0, startHeight, 0));
        
        // Deformed rock mesh
        const rockGeo = new THREE.DodecahedronGeometry(0.6, 1);
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x1a0f2e,
            emissive: 0x9d4edd,
            emissiveIntensity: 1.5,
            roughness: 0.8
        });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.copy(meteorPos);
        Globals.scene.add(rock);

        // Core glow
        const glowGeo = new THREE.SphereGeometry(0.8, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xc77dff, transparent: true, opacity: 0.3 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        rock.add(glow);

        const duration = 0.55; // fall speed
        const fallStart = performance.now();
        let fallLastFrame = fallStart;
        
        const fall = () => {
            const nowT = performance.now();
            const frameDt = Math.min((nowT - fallLastFrame) / 1000, 0.1);
            fallLastFrame = nowT;
            const elapsed = (nowT - fallStart) / 1000;
            const t = Math.min(elapsed / duration, 1.0);
            
            // Linear descent
            rock.position.y = targetPos.y + startHeight * (1.0 - t);
            
            // Rotation during fall
            rock.rotation.x = elapsed * 4.8;
            rock.rotation.y = elapsed * 3;

            // Spawn fire/smoke trail particles (taux normalisé sur 60 FPS)
            if (Math.random() < 0.6 * frameDt * 60) {
                spawnParticles(rock.position.clone().add(new THREE.Vector3(
                    (Math.random()-0.5)*0.2,
                    0.3,
                    (Math.random()-0.5)*0.2
                )), 0x7b2cbf, 1);
            }

            if (t >= 1.0) {
                // Impact!
                Globals.scene.remove(rock);
                rockGeo.dispose();
                rockMat.dispose();
                glowGeo.dispose();
                glowMat.dispose();

                // Trigger callback
                if (dir && typeof dir === 'function') {
                    dir();
                }
            } else {
                requestAnimationFrame(fall);
            }
        };
        fall();
    }
    else if (type === 'poison_cloud') {
        const group = new THREE.Group();
        group.position.copy(pos);
        Globals.scene.add(group);

        const cloudMat = new THREE.MeshBasicMaterial({
            color: 0x39ff14,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending
        });
        const cloudGeo = new THREE.SphereGeometry(size * 0.35, 8, 8);
        const puffCount = 10;
        const puffs = [];

        for (let i = 0; i < puffCount; i++) {
            const mesh = new THREE.Mesh(cloudGeo, cloudMat);
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (size * 0.55);
            mesh.position.set(Math.cos(angle) * dist, 0.15 + Math.random() * 0.25, Math.sin(angle) * dist);
            
            const scale = 0.6 + Math.random() * 1.0;
            mesh.scale.setScalar(scale);
            
            group.add(mesh);
            puffs.push({
                mesh: mesh,
                angle: angle,
                speed: 0.15 + Math.random() * 0.3,
                wobbleSpeed: 2.0 + Math.random() * 2.0,
                baseY: mesh.position.y
            });
        }

        const duration = 4.0; // cloud lasts 4s
        const cloudStart = performance.now();
        let cloudLastFrame = cloudStart;

        const animateCloud = () => {
            const nowT = performance.now();
            const frameDt = Math.min((nowT - cloudLastFrame) / 1000, 0.1);
            cloudLastFrame = nowT;
            const elapsed = (nowT - cloudStart) / 1000;
            const progress = elapsed / duration;
            const driftStep = frameDt * 60;

            puffs.forEach(p => {
                // Expand
                const scale = (0.6 + progress * 1.6);
                p.mesh.scale.setScalar(scale);
                
                // Float up and drift
                p.mesh.position.y = p.baseY + progress * 1.5;
                p.mesh.position.x += Math.sin(elapsed * p.wobbleSpeed) * 0.006 * driftStep;
                p.mesh.position.z += Math.cos(elapsed * p.wobbleSpeed) * 0.006 * driftStep;
            });

            // Pulse opacity (fade out at the end)
            if (progress > 0.7) {
                cloudMat.opacity = (1.0 - (progress - 0.7) / 0.3) * 0.12;
            } else {
                cloudMat.opacity = 0.12 + Math.sin(elapsed * 2) * 0.02;
            }

            // Spawn particles (taux normalisé sur 60 FPS)
            if (Math.random() < 0.22 * driftStep && progress < 0.9) {
                const pPos = pos.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * size * 1.3,
                    0.2 + Math.random() * 0.9,
                    (Math.random() - 0.5) * size * 1.3
                ));
                spawnParticles(pPos, 0x39ff14, 1);
            }

            if (progress >= 1.0) {
                Globals.scene.remove(group);
                cloudGeo.dispose();
                cloudMat.dispose();
            } else {
                requestAnimationFrame(animateCloud);
            }
        };
        animateCloud();
    }
    else if (type === 'shackles_link') {
        const cylinderGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6);
        cylinderGeo.rotateX(Math.PI / 2); // align along Z
        const linkColor = dir.color || 0xbd00ff;
        const cylinderMat = new THREE.MeshBasicMaterial({
            color: linkColor,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const mesh = new THREE.Mesh(cylinderGeo, cylinderMat);
        Globals.scene.add(mesh);

        const sourceObj = dir.source;
        const targetObj = dir.target;

        const duration = size; // duration passed in size parameter
        const linkStart = performance.now();
        let linkLastFrame = linkStart;

        const animateLink = () => {
            const nowT = performance.now();
            const frameDt = Math.min((nowT - linkLastFrame) / 1000, 0.1);
            linkLastFrame = nowT;
            const elapsed = (nowT - linkStart) / 1000;
            
            // Check if either is dead or if elapsed duration exceeded
            if (elapsed >= duration || sourceObj.dead || targetObj.dead || !sourceObj.mesh || !targetObj.mesh) {
                Globals.scene.remove(mesh);
                cylinderGeo.dispose();
                cylinderMat.dispose();
                return;
            }

            // Get source staff position and target chest position
            const pStart = sourceObj.position.clone().add(new THREE.Vector3(0, 1.5, 0));
            const pEnd = targetObj.position.clone().add(new THREE.Vector3(0, 1.0, 0));
            
            // Distance check to break shackle
            const dist = pStart.distanceTo(pEnd);
            if (dist > 13.0) {
                Globals.scene.remove(mesh);
                cylinderGeo.dispose();
                cylinderMat.dispose();
                sourceObj.isChanneling = false; // break channeling
                sourceObj.animState = 'idle';
                createDamageText("BRISÉ !", targetObj.position, '#' + new THREE.Color(linkColor).getHexString());
                return;
            }

            // Position at midpoint
            mesh.position.copy(pStart).add(pEnd).multiplyScalar(0.5);
            
            // Orient mesh from start to end
            mesh.lookAt(pEnd);
            
            // Scale length along Z axis
            mesh.scale.set(1.0 + Math.sin(elapsed * 20) * 0.1, 1.0 + Math.sin(elapsed * 20) * 0.1, dist);

            // Pulsing opacity
            cylinderMat.opacity = 0.6 + Math.sin(elapsed * 25) * 0.2;

            // Spawn particles along the link (taux normalisé sur 60 FPS)
            if (Math.random() < 0.35 * frameDt * 60) {
                const lerpVal = Math.random();
                const pPos = pStart.clone().lerp(pEnd, lerpVal);
                spawnParticles(pPos, linkColor, 1);
            }

            requestAnimationFrame(animateLink);
        };
        animateLink();
    }
}
