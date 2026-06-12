// @ts-nocheck
import { Globals } from '../core/globals';
import { STATE } from '../core/config';

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

export function updateFloatingTexts(dt) {
    if (!Globals.camera) return;

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const item = floatingTexts[i];
        item.life -= dt;
        item.pos.add(item.velocity.clone().multiplyScalar(dt));
        
        const vector = item.pos.clone();
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

export function spawnParticles(pos, color, count, sizeMult = 1.0) {
    for (let i = 0; i < count; i++) {
        // Random shape: Box, Octahedron, or Tetrahedron for realistic debris shards
        const size = (0.06 + Math.random() * 0.14) * sizeMult;
        let geo;
        const rand = Math.random();
        if (rand < 0.4) {
            geo = new THREE.BoxGeometry(size, size, size);
        } else if (rand < 0.7) {
            geo = new THREE.OctahedronGeometry(size, 0);
        } else {
            geo = new THREE.TetrahedronGeometry(size, 0);
        }

        const mat = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.95
        });
        const mesh = new THREE.Mesh(geo, mat);
        
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
    let mesh;
    const mat = new THREE.MeshBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.3, 
        side: THREE.DoubleSide,
        depthWrite: false
    });

    if (shape === 'circle') {
        mesh = new THREE.Mesh(new THREE.RingGeometry(size * 0.95, size, 32), mat);
        mesh.rotation.x = -Math.PI / 2;
        const fillMesh = new THREE.Mesh(new THREE.CircleGeometry(size, 32), new THREE.MeshBasicMaterial({color: color, transparent: true, opacity: 0.1}));
        fillMesh.rotation.x = -Math.PI / 2;
        fillMesh.position.y = 0.01;
        mesh.add(fillMesh);
        mesh.fill = fillMesh;
    } 
    else if (shape === 'rect') {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -rotationY + Math.PI/2; 
        mesh.translateY(size.y / 2); 
    }
    else if (shape === 'cone') {
        mesh = new THREE.Mesh(new THREE.CircleGeometry(size, 32, 0, Math.PI/3), mat); 
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = -rotationY - Math.PI/6; 
    }

    if (!mesh) return;

    mesh.position.copy(pos);
    mesh.position.y = 0.05; 
    Globals.scene.add(mesh);

    mesh.userData = {
        timer: duration,
        maxTimer: duration,
        onComplete: onComplete
    };
    
    Globals.telegraphs = Globals.telegraphs || [];
    Globals.telegraphs.push(mesh);
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
        } else {
            t.material.opacity = 0.3 + Math.sin(Date.now() * 0.02) * 0.2;
        }

        if (t.userData.timer <= 0) {
            if (t.userData.onComplete) t.userData.onComplete();
            Globals.scene.remove(t);
            if(t.geometry) t.geometry.dispose();
            if(t.material) t.material.dispose();
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
            v.mesh.scale.multiplyScalar(1.05); // Légère expansion
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
        const geo = new THREE.RingGeometry(0.5, 1, 32);
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0));
        mesh.rotation.x = -Math.PI / 2;
        Globals.scene.add(mesh);
        
        // Animation simple inline pour la shockwave (ou ajouter à updateSkillVisuals pour plus de propreté)
        const expand = () => {
            if(!mesh.parent) return;
            const s = mesh.scale.x + 0.5;
            mesh.scale.set(s, s, s);
            mesh.material.opacity -= 0.05;
            if(mesh.material.opacity <= 0) {
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

        // Animate everything together
        const maxLife = 0.45;
        let life = maxLife;
        const animate = () => {
            life -= 0.016; // approx dt
            const progress = life / maxLife; // 1.0 down to 0.0
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
}