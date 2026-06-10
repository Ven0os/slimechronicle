// @ts-nocheck
// core/ressources.js

export const AudioSys = {
    sounds: {},
    activeLoops: {},
    
    musicTracks: {
        'menu': '/songs/musics/music_menu.mp3',
        'explore': '/songs/musics/music_explore.mp3',
        'boss_king': '/songs/musics/music_boss_king.mp3',
        'boss_void': '/songs/musics/music_boss_void.mp3',
        'victory': '/songs/musics/music_victory.mp3'
    },
    
    currentBgm: null,
    bgmNode: null, 
    initialized: false,
    ctx: null, 
    
    volumes: {
        sfx: 0.4,
        music: 0.25
    },

    // Modifié pour supporter le préchargement partiel + chargement paresseux (lazy loading)
    init: function(onProgress?: any) {
        return new Promise((resolve, reject) => {
            if (this.initialized) {
                if(onProgress) onProgress(1.0);
                resolve();
                return;
            }
            
            // On crée le contexte immédiatement (il sera en 'suspended', on le reprendra au clic)
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;

            // --- SFX ESSENTIELS À PRÉCHARGER ---
            // On ne précharge que les sons de base requis au démarrage pour accélérer le chargement
            const essentialSfx = [
                'ui_hover', 'ui_click', 'ui_error', 'levelup', 'toast', 'step'
            ];

            let loadedCount = 0;
            const total = essentialSfx.length;

            if (total === 0) {
                resolve();
                return;
            }

            const promises = essentialSfx.map(name => {
                return this.loadSound(name)
                    .then(() => {
                        loadedCount++;
                        if (onProgress) onProgress(loadedCount / total);
                    })
                    .catch(() => {
                        // On compte quand même les erreurs pour ne pas bloquer la barre de chargement
                        loadedCount++; 
                        if (onProgress) onProgress(loadedCount / total);
                    });
            });

            // On attend que les sons essentiels soient chargés (ou échoués)
            Promise.all(promises).then(() => {
                console.log(`AudioSys: ${loadedCount}/${total} sons essentiels préchargés.`);
                resolve();
            });
        });
    },

    // Méthode pour charger un son à la demande de manière asynchrone
    loadSound: function(name) {
        if (this.sounds[name]) return Promise.resolve(this.sounds[name]);
        if (!this._loadingPromises) this._loadingPromises = {};
        if (this._loadingPromises[name]) {
            return this._loadingPromises[name];
        }

        this._loadingPromises[name] = fetch(`/songs/sfx/${name}.mp3`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                if (!this.ctx) {
                    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                }
                return this.ctx.decodeAudioData(arrayBuffer);
            })
            .then(audioBuffer => {
                this.sounds[name] = audioBuffer;
                delete this._loadingPromises[name];
                return audioBuffer;
            })
            .catch(e => {
                console.warn(`SFX ignoré ou introuvable : ${name} (${e.message})`);
                delete this._loadingPromises[name];
                throw e;
            });

        return this._loadingPromises[name];
    },

    stopLoop: function(key) {
        const loop = this.activeLoops[key];
        if (!loop) return;
        if (loop.crackleTimer) clearInterval(loop.crackleTimer);
        try { loop.source?.stop(); } catch (_) { /* déjà arrêté */ }
        loop.nodes?.forEach((n) => { try { n.disconnect(); } catch (_) {} });
        delete this.activeLoops[key];
    },

    startElectricBeamLoop: function(key = 'electric_beam', volume = 0.55) {
        if (!this.ctx || this.activeLoops[key]) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        const bufferSize = Math.floor(this.ctx.sampleRate * 2);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 2400;
        bandpass.Q.value = 1.6;

        const highpass = this.ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 900;

        const gain = this.ctx.createGain();
        gain.gain.value = volume * this.volumes.sfx * 0.22;

        source.connect(highpass);
        highpass.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);

        const crackleTimer = setInterval(() => {
            if (!this.activeLoops[key]) return;
            const now = this.ctx.currentTime;
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(volume * this.volumes.sfx * 0.38, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * this.volumes.sfx * 0.14), now + 0.09);
            if (Math.random() < 0.45) {
                this.play('warlock_beam', 0.22, 0.35);
            } else if (Math.random() < 0.25) {
                this.play('telegraph', 0.12, 0.5);
            }
        }, 90 + Math.floor(Math.random() * 70));

        this.activeLoops[key] = { source, gain, bandpass, highpass, crackleTimer, nodes: [source, bandpass, highpass, gain] };
    },

    _playBuffer: function(name, volume, pitchVar) {
        if (!this.sounds[name]) return;
        const source = this.ctx.createBufferSource();
        source.buffer = this.sounds[name];
        
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume * this.volumes.sfx;
        
        if (pitchVar > 0) {
            source.playbackRate.value = 1.0 + (Math.random() * pitchVar * 2 - pitchVar);
        }

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);
    },

    play: function(name, volume = 1.0, pitchVar = 0.0) {
        if (!this.ctx) return;
        
        // Tentative de reprise automatique si suspendu (peut échouer sans gesture)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        if (this.sounds[name]) {
            this._playBuffer(name, volume, pitchVar);
        } else {
            this.loadSound(name)
                .then(() => {
                    this._playBuffer(name, volume, pitchVar);
                })
                .catch(() => {}); // Déjà warné dans loadSound
        }
    },

    playBgm: function(trackKey) {
        if (!this.ctx) return;
        if (this.currentBgm === trackKey) return;
        
        if (this.bgmNode) {
            this.bgmNode.stop();
            this.bgmNode = null;
        }

        const url = this.musicTracks[trackKey];
        if (!url) return;

        this.currentBgm = trackKey;
        
        fetch(url)
            .then(response => {
                if(!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                if (this.currentBgm !== trackKey) return; 
                
                const source = this.ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.loop = true;
                
                const gainNode = this.ctx.createGain();
                gainNode.gain.value = this.volumes.music;
                
                source.connect(gainNode);
                gainNode.connect(this.ctx.destination);
                source.start(0);
                this.bgmNode = source;
            })
            .catch(e => console.error("Erreur BGM:", e));
    },

    // Raccourcis sfx
    sfx: {
        warrior: {
            swing: () => AudioSys.play('sword_swing', 0.8, 0.1),
            block: () => AudioSys.play('shield_bash', 1.0),
            shout: () => AudioSys.play('war_cry', 1.0),
            smash: () => AudioSys.play('earth_smash', 1.0)
        },
        mage: {
            bolt: () => AudioSys.play('magic_cast', 0.5, 0.2),
            cast: () => AudioSys.play('magic_cast', 0.5, 0.2),
            freeze: () => AudioSys.play('ice_freeze', 0.8),
            blink: () => AudioSys.play('teleport', 0.7),
            teleport: () => AudioSys.play('teleport', 0.7)
        },
        sentinel: {
            bash: () => AudioSys.play('shield_bash', 0.9),
            heal: () => AudioSys.play('magic_cast', 0.6, 0.3),
            laser: () => AudioSys.play('solar_beam', 0.7), 
            field: () => AudioSys.play('solar_beam', 0.8), 
            shield: () => AudioSys.play('shield_cast', 0.8)
        },
        blade: {
            slash: () => AudioSys.play('water_slash', 0.7, 0.1),
            dash: () => AudioSys.play('water_dash', 0.8),
            wave: () => AudioSys.play('wave_push', 0.9)
        },
        pacifier: {
            shot: () => AudioSys.play('pistol_shot', 0.6, 0.1),
            reload: () => AudioSys.play('reload', 0.8),
            drain: () => AudioSys.play('blood_drain', 0.7),
            mark: () => AudioSys.play('mark_apply', 0.8)
        },
        eclipse: {
            beam: () => AudioSys.play('solar_beam', 0.7),
            burst: () => AudioSys.play('eclipse_burst', 1.0)
        },
        chrono: {
            convergenceStart: () => AudioSys.play('king_laser', 0.55, 0.15),
            convergenceEnd: () => AudioSys.play('eclipse_burst', 0.65, 0.1),
            electricBeam: () => AudioSys.startElectricBeamLoop('chrono_convergence', 0.7),
            electricBeamStop: () => AudioSys.stopLoop('chrono_convergence'),
        },
        bossSpawn: () => AudioSys.play('boss_spawn', 1.0),
        bossRoar: () => AudioSys.play('boss_roar', 1.0),
        telegraph: () => AudioSys.play('telegraph', 0.5),
        step: () => AudioSys.play('step', 0.2, 0.1),
        hit: () => AudioSys.play('hit', 0.6, 0.2)
    }
};

export const TextureManager = {
    loader: new THREE.TextureLoader(),
    
    // FIX 1: Utilisation d'un Proxy pour éviter le crash "map has value of undefined"
    textures: new Proxy({}, {
        get: (target, prop) => {
            if (prop in target) return target[prop];
            if (typeof prop === 'symbol' || prop === 'toJSON' || prop === 'then') return undefined;

            if (target['white']) {
                if (!target._warned) target._warned = new Set();
                if (!target._warned.has(prop)) {
                    console.warn(`⚠️ Texture manquante : '${String(prop)}'. Fallback sur 'white'.`);
                    target._warned.add(prop);
                }
                return target['white'];
            }
            return undefined;
        }
    }),

    load: function() {
        const createTex = (color) => {
            const canvas = document.createElement('canvas'); 
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d'); 
            ctx.fillStyle = color; ctx.fillRect(0,0,64,64);
            const tex = new THREE.CanvasTexture(canvas);
            
            // FIX 2: Désactiver les mipmaps pour éviter le warning WebGL "Lazy initialization"
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            return tex;
        };

        this.textures['white'] = createTex('#ffffff');
        this.textures['grass'] = createTex('#7cfc00');
        
        // Textures placeholder pour éviter les crashs
        this.textures['stone'] = createTex('#888888');
        this.textures['dirt'] = createTex('#5d4037');
        this.textures['wood'] = createTex('#795548');
        this.textures['water'] = createTex('#00bcd4');
    }
};