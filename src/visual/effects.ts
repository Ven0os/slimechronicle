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

export function spawnParticles(pos, color, count) {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ color: color });

    for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        
        mesh.position.x += (Math.random() - 0.5);
        mesh.position.y += (Math.random() - 0.5);
        mesh.position.z += (Math.random() - 0.5);

        Globals.scene.add(mesh);

        // VITESSE RÉDUITE ICI (Division par 3 environ par rapport à l'original)
        Globals.particles.push({
            mesh: mesh,
            life: 0.5 + Math.random() * 0.5,
            vel: new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,  // Était 2.5
                (Math.random() * 1.5),        // Était 2.5
                (Math.random() - 0.5) * 0.8   // Était 2.5
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
}