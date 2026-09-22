(() => {
    'use strict';

    const root = document.querySelector('.bcm-mini-sim');
    if (!root) return;

    const canvas = root.querySelector('.bcm-mini-sim-canvas');
    const startButton = root.querySelector('.bcm-mini-sim-start');
    const status = root.querySelector('.bcm-mini-sim-status');
    const assetStatus = root.querySelector('.bcm-mini-sim-asset-status');
    const interaction = root.querySelector('.bcm-mini-sim-interaction');
    const menuBackdrop = root.querySelector('.bcm-mini-sim-menu-backdrop');
    const musicButton = root.querySelector('.bcm-mini-sim-music');
    const musicAudio = root.querySelector('.bcm-mini-sim-music-audio');
    const config = window.BCMMiniSimConfig || {};

    const TEXTURE_MAX_DIMENSION = 2048;
    const tiltFrame = {
        enabled: false,
        available: false,
        beta: 0,
        gamma: 0,
        neutralBeta: 0,
        neutralGamma: 0
    };

    if (!canvas || !startButton || !status) return;

    const assets = Array.isArray(config.assets) ? config.assets : [];
    const assetByName = Object.create(null);
    const textureRecords = Object.create(null);
    assets.forEach(asset => {
        if (asset && asset.name && asset.url) {
            assetByName[asset.name] = asset;
        }
    });

    function findAsset(name) {
        const requested = String(name);
        const lower = requested.toLowerCase();
        const imageMatch = lower.match(/^(.*)\\.(png|jpg|jpeg|webp|gif)$/i);

        if (imageMatch) {
            const base = imageMatch[1];

            for (const extension of ['webp', 'jpg', 'jpeg', 'png', 'gif']) {
                const candidate = base + '.' + extension;
                const key = Object.keys(assetByName).find(path =>
                    path.toLowerCase() === candidate
                );

                if (key) return assetByName[key].url;
            }
        }

        if (assetByName[requested]) return assetByName[requested].url;

        const exactKey = Object.keys(assetByName).find(path =>
            path.toLowerCase() === lower
        );

        return exactKey ? assetByName[exactKey].url : '';
    }

    function imageName(name) {
        return findAsset(name);
    }

    function setTextureColor(texture) {
        if (!texture) return;

        // Keep texture memory low on older GPUs. No mipmap pyramid is
        // generated because the test is a first-person close-range scene.
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        if ('encoding' in texture && THREE.sRGBEncoding !== undefined) {
            texture.encoding = THREE.sRGBEncoding;
        }

        texture.needsUpdate = true;
    }

    let renderer;
    let scene;
    let camera;
    let light;
    let running = false;
    let pointerLocked = false;
    let last = performance.now();

    const keys = Object.create(null);
    const touch = Object.create(null);
    const textures = Object.create(null);
    const portalStations = [];
    let chamberVisualsLoaded = false;
    let chamberVisualsLoading = false;

    const assetProgress = {
        total: 0,
        done: 0,
        failed: 0
    };

    let ship = null;

    const shipSystems = {
        shieldOn: true,
        shieldToggleKey: 'KeyF',
        hearts: 4,
        halfHeart: false
    };

    const testDoor = {
        state: 'CLOSED',
        openDistance: 8,
        remoteDistance: 32,
        remoteFacing: 0.90,
        progress: 0,
        speed: 1.8,
        mesh: null,
        leftPanel: null,
        rightPanel: null,
        frameParts: [],
        material: null
    };

    const doorCrystal = {
        cooldown: 0,
        pulseUntil: 0
    };

    function updateAssetStatus() {
        if (!assetStatus) return;

        const manifestImages = assets.filter(asset => asset && asset.type === 'image').length;
        const manifestVideos = assets.filter(asset => asset && asset.type === 'video').length;
        const manifestAudio = assets.filter(asset => asset && asset.type === 'audio').length;

        const musicState = config.musicUrl ? ' · MUSIC READY' : ' · MUSIC MISSING';

        if (assetProgress.total === 0) {
            assetStatus.textContent =
                'LOCAL ASSETS: ' + assets.length +
                ' FILES · ' + manifestImages + ' IMG · ' + manifestVideos +
                ' VIDEO · ' + manifestAudio + ' AUDIO' + musicState;
            return;
        }

        assetStatus.textContent =
            'LOCAL ASSETS: ' + assetProgress.done + '/' + assetProgress.total +
            ' · FILES ' + assets.length +
            musicState +
            (assetProgress.failed ? ' · FAILED ' + assetProgress.failed : '');
    }

    function finalizeTexture(name, image) {
        const record = textureRecords[name];
        if (!record) return;

        try {
            let source = image;
            let width = image.naturalWidth || image.width || 0;
            let height = image.naturalHeight || image.height || 0;

            if (!width || !height) {
                throw new Error('IMAGE_DIMENSIONS_MISSING');
            }

            const maxDimension = Math.min(
                TEXTURE_MAX_DIMENSION,
                renderer && renderer.capabilities
                    ? renderer.capabilities.maxTextureSize
                    : TEXTURE_MAX_DIMENSION
            );

            if (Math.max(width, height) > maxDimension) {
                const scale = maxDimension / Math.max(width, height);
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));

                const sourceCanvas = document.createElement('canvas');
                sourceCanvas.width = width;
                sourceCanvas.height = height;

                const context = sourceCanvas.getContext('2d');

                if (!context) {
                    throw new Error('TEXTURE_CANVAS_UNAVAILABLE');
                }

                context.imageSmoothingEnabled = true;
                context.imageSmoothingQuality = 'high';
                context.drawImage(image, 0, 0, width, height);
                source = sourceCanvas;
            }

            const texture = new THREE.Texture(source);
            setTextureColor(texture);
            texture.needsUpdate = true;

            record.texture = texture;
            record.failed = false;
            assetProgress.done++;
            updateAssetStatus();

            record.callbacks.forEach(callback => {
                if (callback.onReady) callback.onReady(texture);
            });
            record.callbacks.length = 0;
        } catch (error) {
            record.failed = true;
            assetProgress.done++;
            assetProgress.failed++;
            updateAssetStatus();

            record.callbacks.forEach(callback => {
                if (callback.onError) callback.onError(error);
            });
            record.callbacks.length = 0;
        }
    }

    function loadImageTexture(name, url, onReady, onError) {
        const existing = textureRecords[name];

        if (existing) {
            if (existing.texture) {
                if (onReady) onReady(existing.texture);
            } else if (existing.failed) {
                if (onError) onError(new Error('IMAGE_ASSET_FAILED'));
            } else if (onReady || onError) {
                existing.callbacks.push({ onReady, onError });
            }

            return existing.texture || null;
        }

        const record = {
            texture: null,
            failed: false,
            callbacks: []
        };

        if (onReady || onError) {
            record.callbacks.push({ onReady, onError });
        }

        textureRecords[name] = record;
        assetProgress.total++;
        updateAssetStatus();

        const image = new Image();
        image.decoding = 'async';

        image.onload = () => finalizeTexture(name, image);

        image.onerror = () => {
            record.failed = true;
            assetProgress.done++;
            assetProgress.failed++;
            updateAssetStatus();

            record.callbacks.forEach(callback => {
                if (callback.onError) callback.onError(new Error('IMAGE_LOAD_FAILED'));
            });
            record.callbacks.length = 0;
        };

        image.src = url;

        return null;
    }

    function makeTexture(name, onReady, onError) {
        const url = imageName(name);

        if (!url) {
            if (onError) onError(new Error('IMAGE_ASSET_MISSING'));
            return null;
        }

        return loadImageTexture(name, url, onReady, onError);
    }

    function loadKnownTexture(name) {
        return makeTexture(name);
    }

    function texturedMaterial(name, fallbackColor) {
        const material = new THREE.MeshStandardMaterial({
            color: fallbackColor || 0x4a505b,
            roughness: 0.88,
            metalness: 0.16,
            side: THREE.DoubleSide
        });

        makeTexture(
            name,
            texture => {
                material.map = texture;
                material.color.set(0xffffff);
                material.needsUpdate = true;
            }
        );

        return material;
    }

    function lazyTexturedMaterial(name, fallbackColor) {
        const material = new THREE.MeshStandardMaterial({
            color: fallbackColor || 0x4a505b,
            roughness: 0.88,
            metalness: 0.16,
            side: THREE.DoubleSide
        });
        material.userData = material.userData || {};
        material.userData.lazyAsset = name;
        return material;
    }

    function addBox(parent, x, y, z, sx, sy, sz, material) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(sx, sy, sz),
            material
        );
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    }

    function addBeam(parent, x, y, z, sx, sy, sz, material) {
        return addBox(parent, x, y, z, sx, sy, sz, material);
    }

    function buildWorld() {
        const world = new THREE.Group();

        const wall1 = texturedMaterial('wall1.png', 0x39414b);
        const wall2 = texturedMaterial('wall2.png', 0x4b535e);
        const wall3 = texturedMaterial('wall3.png', 0x343b45);
        const wall4 = texturedMaterial('wall4.png', 0x2d343d);
        const wall5 = texturedMaterial('wall5.png', 0x565e68);

        const width = 12;
        const height = 8;
        const corridorLength = 38;
        const zCenter = -13;

        // Test flight corridor. Every supplied wall texture is intentionally
        // used on a real surface rather than merely preloaded.
        addBox(world, 0, -height / 2, zCenter, width, 0.7, corridorLength, wall1);
        addBox(world, 0, height / 2, zCenter, width, 0.7, corridorLength, wall2);
        addBox(world, -width / 2, 0, zCenter, 0.7, height, corridorLength, wall3);
        addBox(world, width / 2, 0, zCenter, 0.7, height, corridorLength, wall4);

        // Repeated overhead supports use the fifth wall texture.
        for (let z = 3; z >= -29; z -= 8) {
            addBeam(world, 0, 3.25, z, width, 0.42, 0.62, wall5);
        }

        // Door entrance trim.
        const trim = new THREE.MeshStandardMaterial({
            color: 0x1d2229,
            metalness: 0.72,
            roughness: 0.42
        });

        addBeam(world, 0, 3.55, -18, 7.5, 0.55, 0.8, trim);
        addBeam(world, 0, -3.55, -18, 7.5, 0.55, 0.8, trim);
        addBeam(world, -3.55, 0, -18, 0.55, 6.55, 0.8, trim);
        addBeam(world, 3.55, 0, -18, 0.55, 6.55, 0.8, trim);

        // Portal chamber beyond the door.
        const chamberFloor = wall1;
        const chamberCeiling = wall2;
        const chamberLeft = wall3;
        const chamberRight = wall4;
        const chamberBack = wall5;

        addBox(world, 0, -3.65, -25.5, 11.2, 0.6, 13.4, chamberFloor);
        addBox(world, 0, 3.65, -25.5, 11.2, 0.6, 13.4, chamberCeiling);
        addBox(world, -5.65, 0, -25.5, 0.6, 7.3, 13.4, chamberLeft);
        addBox(world, 5.65, 0, -25.5, 0.6, 7.3, 13.4, chamberRight);
        addBox(world, 0, 0, -32.2, 11.2, 7.3, 0.6, chamberBack);

        scene.add(world);
        buildPortalStations(world);
        buildAssetGallery(world);
    }

    function portalFrameMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x56616e,
            metalness: 0.82,
            roughness: 0.24,
            emissive: 0x0b1219,
            emissiveIntensity: 0.6
        });
    }

    function createPortalStation(options, parent) {
        const group = new THREE.Group();
        group.position.copy(options.position);
        group.rotation.y = options.rotationY || 0;

        const frame = portalFrameMaterial();
        const width = 3.2;
        const height = 5.7;

        addBox(group, 0, height / 2 + 0.28, 0, width, 0.5, 0.42, frame);
        addBox(group, 0, -height / 2 - 0.28, 0, width, 0.5, 0.42, frame);
        addBox(group, -width / 2 - 0.28, 0, 0, 0.5, height, 0.42, frame);
        addBox(group, width / 2 + 0.28, 0, 0, 0.5, height, 0.42, frame);

        const openingMaterial = new THREE.MeshBasicMaterial({
            color: 0x07111c,
            side: THREE.DoubleSide
        });

        const surface = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            openingMaterial
        );
        surface.position.z = -0.18;
        group.add(surface);

        const glow = new THREE.Mesh(
            new THREE.PlaneGeometry(width + 0.16, height + 0.16),
            new THREE.MeshBasicMaterial({
                color: 0x6ebcff,
                transparent: true,
                opacity: 0.13,
                side: THREE.DoubleSide
            })
        );
        glow.position.z = -0.24;
        group.add(glow);

        const station = {
            group,
            surface,
            glow,
            point: options.point,
            image: options.image,
            routes: options.routes || [],
            routeIndex: 0,
            playing: false
        };

        portalStations.push(station);

        surface.userData.lazyAsset = options.image;
        group.userData.portalStation = station;
        parent.add(group);

        return station;
    }

    function buildPortalStations(parent) {
        // Three clearly visible front-facing openings.
        // Existing routes are unchanged: 1→2, 2→1 and 2→3.
        createPortalStation({
            point: 'POINT 1',
            image: 'portal.png',
            routes: [{
                label: '1 → 2',
                video: 'portal2.mp4',
                target: { x: 0, y: 0, z: -29.35, yaw: 0 }
            }],
            position: new THREE.Vector3(-3.75, 0, -29.55),
            rotationY: 0
        }, parent);

        createPortalStation({
            point: 'POINT 2',
            image: 'portal2.png',
            routes: [
                {
                    label: '2 → 1',
                    video: 'portal1.mp4',
                    target: { x: -3.75, y: 0, z: -29.35, yaw: 0 }
                },
                {
                    label: '2 → 3',
                    video: 'portal3.mp4',
                    target: { x: 3.75, y: 0, z: -29.35, yaw: 0 }
                }
            ],
            position: new THREE.Vector3(0, 0, -29.55),
            rotationY: 0
        }, parent);

        createPortalStation({
            point: 'POINT 3',
            image: 'portal3.png',
            routes: [],
            position: new THREE.Vector3(3.75, 0, -29.55),
            rotationY: 0
        }, parent);
    }


    let portalTransition = null;
    let portalTransitionBusy = false;

    function createPortalTransitionUI() {
        if (portalTransition) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'bcm-mini-sim-transition';
        wrapper.hidden = true;

        const video = document.createElement('video');
        video.className = 'bcm-mini-sim-transition-video';
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'none';

        const label = document.createElement('div');
        label.className = 'bcm-mini-sim-transition-label';

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'bcm-mini-sim-transition-close';
        close.textContent = '×';
        close.title = 'Закрыть переход';
        close.addEventListener('click', () => {
            if (portalTransitionBusy) return;
            wrapper.hidden = true;
            video.pause();
            video.removeAttribute('src');
            video.load();
        });

        wrapper.appendChild(video);
        wrapper.appendChild(label);
        wrapper.appendChild(close);
        root.appendChild(wrapper);

        portalTransition = { wrapper, video, label };
    }

    function finishPortalTransition(station, success) {
        if (!portalTransition) return;

        const video = portalTransition.video;
        video.pause();
        video.removeAttribute('src');
        video.load();
        portalTransition.wrapper.hidden = true;

        const route = station && station.routes
            ? station.routes[station.routeIndex]
            : null;

        if (success && route && route.target) {
            ship.position.set(
                route.target.x,
                route.target.y,
                route.target.z
            );
            ship.velocity.set(0, 0, 0);
            ship.angularVelocity.set(0, 0, 0);
            ship.quaternion.setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                route.target.yaw || 0
            );

            camera.position.copy(ship.position);
            camera.quaternion.copy(ship.quaternion);
            light.position.copy(ship.position);

            status.textContent =
                station.point + ' · ARRIVED · ' +
                (station.routes[station.routeIndex]
                    ? station.routes[station.routeIndex].label
                    : 'PORTAL');
        }

        portalTransitionBusy = false;
    }

    function startPortalTransition(station) {
        if (portalTransitionBusy || !station || !station.routes.length) return false;

        const route = station.routes[station.routeIndex];
        const url = findAsset(route.video);

        if (!url) {
            status.textContent = route.label + ' · VIDEO ASSET MISSING';
            return false;
        }

        createPortalTransitionUI();

        portalTransitionBusy = true;
        portalTransition.wrapper.hidden = false;
        portalTransition.label.textContent =
            station.point + '  ·  ' + route.label;

        const video = portalTransition.video;
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.src = url;
        video.preload = 'auto';
        video.load();

        const onEnded = () => {
            video.removeEventListener('ended', onEnded);
            finishPortalTransition(station, true);
        };

        const onError = () => {
            video.removeEventListener('error', onError);
            status.textContent = route.label + ' · VIDEO FAILED TO LOAD';
            finishPortalTransition(station, false);
        };

        video.addEventListener('ended', onEnded);
        video.addEventListener('error', onError);

        video.play().then(() => {
            status.textContent =
                station.point + ' · ' + route.label + ' · TRANSITION PLAYING';
        }).catch(() => {
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('error', onError);
            status.textContent =
                route.label + ' · BROWSER BLOCKED VIDEO START';
            finishPortalTransition(station, false);
        });

        return true;
    }

    function activatePortal(station) {
        if (!station || !station.routes.length) {
            status.textContent =
                (station ? station.point : 'PORTAL') + ' · ENDPOINT / NO ROUTE';
            return false;
        }

        return startPortalTransition(station);
    }

    function getNearestPortal(maxDistance = 9.5, minimumFacing = 0.35) {
        if (!ship) return null;

        let best = null;
        let bestDistance = Infinity;

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        portalStations.forEach(station => {
            const worldPos = new THREE.Vector3();
            station.group.getWorldPosition(worldPos);

            const to = worldPos.sub(ship.position);
            const distance = to.length();

            if (!distance || distance > maxDistance) return;

            const facing = forward.dot(to.normalize());
            if (facing < minimumFacing) return;

            if (distance < bestDistance) {
                best = station;
                bestDistance = distance;
            }
        });

        return best;
    }

    function cyclePortalRoute() {
        if (!running || portalTransitionBusy) return false;

        const station = getNearestPortal(10, 0.30);

        if (!station || station.routes.length < 2) {
            if (station) {
                status.textContent = station.point + ' · ONLY ONE ROUTE';
            }
            return false;
        }

        station.routeIndex = (station.routeIndex + 1) % station.routes.length;

        status.textContent =
            station.point + ' · ROUTE ' +
            station.routes[station.routeIndex].label;

        return true;
    }

    function tryPortalAction() {
        if (!running || portalTransitionBusy) return false;

        const best = getNearestPortal();

        if (!best) {
            status.textContent = 'PORTAL · OUT OF RANGE / TURN TOWARD A PORTAL';
            return false;
        }

        activatePortal(best);
        return true;
    }

    function buildAssetGallery(parent) {
        const reserved = {
            'wall1.png': true,
            'wall2.png': true,
            'wall3.png': true,
            'wall4.png': true,
            'wall5.png': true,
            'portal.png': true,
            'portal2.png': true,
            'portal3.png': true,
            'perference bg.png': true
        };

        const extras = assets.filter(asset => {
            if (!asset || asset.type !== 'image') return false;
            return !reserved[asset.name];
        });

        if (!extras.length) return;

        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x1b2028,
            metalness: 0.45,
            roughness: 0.55
        });

        extras.forEach((asset, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = col ? 3.0 : -3.0;
            const z = -20.5 - row * 4.3;

            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(2.7, 2.5, 0.25),
                frameMat
            );
            frame.position.set(x, 0.15, z);
            parent.add(frame);

            const screen = new THREE.Mesh(
                new THREE.PlaneGeometry(2.35, 2.0),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    side: THREE.DoubleSide
                })
            );
            screen.position.set(x, 0.15, z - 0.16);
            screen.rotation.y = col ? -Math.PI / 2 : Math.PI / 2;
            parent.add(screen);

            screen.userData.lazyAsset = asset.name;
        });
    }


    function loadChamberVisuals() {
        if (chamberVisualsLoaded || chamberVisualsLoading) return;

        chamberVisualsLoading = true;

        const targets = [];

        scene.traverse(object => {
            if (!object.isMesh || !object.material) return;

            if (object.userData && object.userData.lazyAsset) {
                targets.push({ object, asset: object.userData.lazyAsset });
                delete object.userData.lazyAsset;
                return;
            }

            const material = Array.isArray(object.material)
                ? object.material[0]
                : object.material;

            if (material && material.userData && material.userData.lazyAsset) {
                targets.push({ object, asset: material.userData.lazyAsset });
                delete material.userData.lazyAsset;
            }
        });

        let remaining = targets.length;

        if (!remaining) {
            chamberVisualsLoaded = true;
            chamberVisualsLoading = false;
            return;
        }

        const done = () => {
            remaining--;

            if (remaining <= 0) {
                chamberVisualsLoaded = true;
                chamberVisualsLoading = false;
                status.textContent = 'CHAMBER VISUALS READY · LOCAL ASSETS';
            }
        };

        targets.forEach(target => {
            const object = target.object;
            const assetName = target.asset;

            makeTexture(
                assetName,
                texture => {
                    if (object.material) {
                        const material = Array.isArray(object.material)
                            ? object.material[0]
                            : object.material;
                        material.map = texture;
                        if (material.color) material.color.set(0xffffff);
                        material.needsUpdate = true;
                    }
                    done();
                },
                done
            );
        });
    }

    function buildDoor() {
        const group = new THREE.Group();
        group.position.set(0, 0, -18);

        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x242a32,
            metalness: 0.72,
            roughness: 0.42,
            emissive: 0x000000
        });

        const top = new THREE.Mesh(
            new THREE.BoxGeometry(7.2, 0.55, 0.75),
            frameMaterial
        );
        top.position.y = 3.325;

        const bottom = new THREE.Mesh(
            new THREE.BoxGeometry(7.2, 0.55, 0.75),
            frameMaterial
        );
        bottom.position.y = -3.325;

        const leftFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 6.1, 0.75),
            frameMaterial
        );
        leftFrame.position.x = -3.325;

        const rightFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 6.1, 0.75),
            frameMaterial
        );
        rightFrame.position.x = 3.325;

        group.add(top, bottom, leftFrame, rightFrame);
        testDoor.frameParts = [top, bottom, leftFrame, rightFrame];
        testDoor.material = frameMaterial;

        const leftMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            side: THREE.DoubleSide
        });

        const rightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            side: THREE.DoubleSide
        });

        const leftDoor = new THREE.Mesh(
            new THREE.PlaneGeometry(3.05, 6.1),
            leftMaterial
        );
        const rightDoor = new THREE.Mesh(
            new THREE.PlaneGeometry(3.05, 6.1),
            rightMaterial
        );

        leftDoor.position.set(-1.525, 0, -0.39);
        rightDoor.position.set(1.525, 0, -0.39);

        group.add(leftDoor, rightDoor);

        const url = config.doorTexture || '';

        if (url) {
            loadImageTexture(
                '__door_texture__',
                url,
                texture => {
                    const leftTexture = texture.clone();
                    const rightTexture = texture.clone();

                    leftTexture.repeat.set(0.5, 1);
                    leftTexture.offset.set(0, 0);
                    rightTexture.repeat.set(0.5, 1);
                    rightTexture.offset.set(0.5, 0);

                    leftTexture.needsUpdate = true;
                    rightTexture.needsUpdate = true;

                    leftMaterial.map = leftTexture;
                    rightMaterial.map = rightTexture;
                    leftMaterial.needsUpdate = true;
                    rightMaterial.needsUpdate = true;
                }
            );
        }

        scene.add(group);
        testDoor.mesh = group;
        testDoor.leftPanel = leftDoor;
        testDoor.rightPanel = rightDoor;
    }

    const worldCollision = {
        radius: 0.32,
        minX: -5.35,
        maxX: 5.35,
        minY: -3.35,
        maxY: 3.35,
        frontZ: 5.55,
        chamberFrontZ: -18.35,
        backZ: -31.85,
        doorZ: -18,
        doorHalfWidth: 3.0,
        doorHalfHeight: 3.0
    };

    function beginDoorOpening(reason) {
        if (testDoor.state !== 'CLOSED') return false;

        testDoor.state = 'OPENING';
        doorCrystal.pulseUntil = performance.now() + 360;
        loadChamberVisuals();

        status.textContent = reason === 'REMOTE'
            ? 'DOOR CRYSTAL · REMOTE OPEN'
            : 'DOOR · AUTO OPEN';

        return true;
    }

    function tryRemoteDoor() {
        if (!running || !testDoor.mesh || testDoor.state !== 'CLOSED') return false;

        const now = performance.now();
        if (now < doorCrystal.cooldown) return false;

        const toDoor = testDoor.mesh.position.clone().sub(ship.position);
        const distance = toDoor.length();

        if (distance > 32 || distance < 0.001) {
            status.textContent = 'DOOR CRYSTAL · OUT OF RANGE';
            return false;
        }

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const facing = forward.dot(toDoor.normalize());

        if (facing < 0.90) {
            status.textContent = 'DOOR CRYSTAL · AIM AT DOOR';
            return false;
        }

        doorCrystal.cooldown = now + 650;
        return beginDoorOpening('REMOTE');
    }

    function updateDoor(dt) {
        if (!testDoor.mesh) return;

        const toDoor = testDoor.mesh.position.clone().sub(ship.position);
        const distance = toDoor.length();

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const facing = distance > 0 ? forward.dot(toDoor.normalize()) : -1;

        if (
            distance < testDoor.openDistance &&
            facing > 0.72 &&
            testDoor.state === 'CLOSED'
        ) {
            beginDoorOpening('LOCAL');
        }

        if (testDoor.state === 'OPENING') {
            testDoor.progress = Math.min(1, testDoor.progress + dt * testDoor.speed);
            const slide = testDoor.progress * 3.1;

            testDoor.leftPanel.position.x = -1.525 - slide;
            testDoor.rightPanel.position.x = 1.525 + slide;

            if (testDoor.progress >= 1) {
                testDoor.state = 'OPEN';
            }
        }
    }

    function resolveWorldCollision() {
        const r = worldCollision.radius;

        if (ship.position.x < worldCollision.minX + r) {
            ship.position.x = worldCollision.minX + r;
            if (ship.velocity.x < 0) ship.velocity.x *= -0.2;
        } else if (ship.position.x > worldCollision.maxX - r) {
            ship.position.x = worldCollision.maxX - r;
            if (ship.velocity.x > 0) ship.velocity.x *= -0.2;
        }

        if (ship.position.y < worldCollision.minY + r) {
            ship.position.y = worldCollision.minY + r;
            if (ship.velocity.y < 0) ship.velocity.y *= -0.2;
        } else if (ship.position.y > worldCollision.maxY - r) {
            ship.position.y = worldCollision.maxY - r;
            if (ship.velocity.y > 0) ship.velocity.y *= -0.2;
        }

        if (ship.position.z > worldCollision.frontZ - r) {
            ship.position.z = worldCollision.frontZ - r;
            if (ship.velocity.z > 0) ship.velocity.z *= -0.25;
        }

        const inDoorOpening =
            Math.abs(ship.position.x) < worldCollision.doorHalfWidth &&
            Math.abs(ship.position.y) < worldCollision.doorHalfHeight;

        const doorBlocking =
            testDoor.state !== 'OPEN' &&
            testDoor.progress < 0.85 &&
            inDoorOpening;

        if (
            doorBlocking &&
            ship.position.z < worldCollision.doorZ + r &&
            ship.position.z > worldCollision.doorZ - 1.3 &&
            ship.velocity.z < 0
        ) {
            ship.position.z = worldCollision.doorZ + r;
            ship.velocity.z = Math.max(0, ship.velocity.z * -0.08);
        }

        if (ship.position.z < worldCollision.backZ + r) {
            ship.position.z = worldCollision.backZ + r;
            if (ship.velocity.z < 0) ship.velocity.z *= -0.25;
        }
    }

    function toggleShield() {
        shipSystems.shieldOn = !shipSystems.shieldOn;
    }

    function handleDeviceOrientation(event) {
        if (typeof event.beta !== 'number' || typeof event.gamma !== 'number') {
            return;
        }

        tiltFrame.available = true;
        tiltFrame.beta = event.beta;
        tiltFrame.gamma = event.gamma;
    }

    async function enableTiltControl() {
        try {
            if (
                typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function'
            ) {
                const permission = await DeviceOrientationEvent.requestPermission();

                if (permission !== 'granted') {
                    status.textContent = 'TILT · SENSOR PERMISSION DENIED';
                    return false;
                }
            }

            if (!tiltFrame.available) {
                window.addEventListener(
                    'deviceorientation',
                    handleDeviceOrientation,
                    true
                );

                await new Promise(resolve => setTimeout(resolve, 300));
            }

            if (!tiltFrame.available) {
                status.textContent = 'TILT · SENSOR NOT AVAILABLE';
                return false;
            }

            tiltFrame.neutralBeta = tiltFrame.beta;
            tiltFrame.neutralGamma = tiltFrame.gamma;
            tiltFrame.enabled = true;

            status.textContent = 'TILT CONTROL · CALIBRATED';
            return true;
        } catch (error) {
            status.textContent = 'TILT · SENSOR ERROR';
            return false;
        }
    }

    function tiltAxes() {
        if (!tiltFrame.enabled || !tiltFrame.available) {
            return { thrust: 0, strafe: 0 };
        }

        const forward = (tiltFrame.beta - tiltFrame.neutralBeta) / 28;
        const side = (tiltFrame.gamma - tiltFrame.neutralGamma) / 24;

        return {
            thrust: applyDeadzone(forward, 0.10),
            strafe: applyDeadzone(side, 0.10)
        };
    }

    const gamepadFrame = {
        pad: null,
        leftX: 0,
        leftY: 0,
        rightX: 0,
        rightY: 0,
        roll: 0,
        vertical: 0
    };

    let gamepadIndex = -1;
    let previousGamepadButtons = [];

    function applyDeadzone(value, deadzone) {
        if (Math.abs(value) <= deadzone) return 0;

        const sign = value < 0 ? -1 : 1;
        const scaled = (Math.abs(value) - deadzone) / (1 - deadzone);
        return sign * Math.min(1, scaled);
    }

    function getActiveGamepad() {
        if (!navigator.getGamepads) return null;

        let pads;

        try {
            pads = navigator.getGamepads();
        } catch (error) {
            return null;
        }

        if (gamepadIndex >= 0 && pads[gamepadIndex]) {
            return pads[gamepadIndex];
        }

        for (let i = 0; i < pads.length; i++) {
            if (pads[i]) {
                gamepadIndex = i;
                return pads[i];
            }
        }

        gamepadIndex = -1;
        return null;
    }

    function gamepadButtonPressed(pad, index) {
        return !!(
            pad &&
            pad.buttons &&
            pad.buttons[index] &&
            (pad.buttons[index].pressed || pad.buttons[index].value > 0.55)
        );
    }

    function updateGamepad() {
        gamepadFrame.pad = getActiveGamepad();

        if (!gamepadFrame.pad) {
            gamepadFrame.leftX = 0;
            gamepadFrame.leftY = 0;
            gamepadFrame.rightX = 0;
            gamepadFrame.rightY = 0;
            gamepadFrame.roll = 0;
            gamepadFrame.vertical = 0;
            previousGamepadButtons = [];
            return;
        }

        const pad = gamepadFrame.pad;
        const axes = pad.axes || [];

        gamepadFrame.leftX = applyDeadzone(axes[0] || 0, 0.14);
        gamepadFrame.leftY = applyDeadzone(axes[1] || 0, 0.14);
        gamepadFrame.rightX = applyDeadzone(axes[2] || 0, 0.14);
        gamepadFrame.rightY = applyDeadzone(axes[3] || 0, 0.14);

        gamepadFrame.roll =
            (gamepadButtonPressed(pad, 5) ? 1 : 0) -
            (gamepadButtonPressed(pad, 4) ? 1 : 0);

        gamepadFrame.vertical =
            (gamepadButtonPressed(pad, 7) ? 1 : 0) -
            (gamepadButtonPressed(pad, 6) ? 1 : 0);

        const actions = [
            [0, tryRemoteDoor],
            [1, cyclePortalRoute],
            [2, toggleShield],
            [3, tryPortalAction]
        ];

        actions.forEach(([buttonIndex, action]) => {
            const pressed = gamepadButtonPressed(pad, buttonIndex);
            const wasPressed = previousGamepadButtons[buttonIndex] === true;

            if (pressed && !wasPressed && running) {
                action();
            }

            previousGamepadButtons[buttonIndex] = pressed;
        });
    }

    function inputAxes() {
        updateGamepad();

        const thrust = keys.KeyW || touch.thrust ? 1 : 0;
        const reverse = keys.KeyS || touch.brake ? 1 : 0;
        const strafe =
            (keys.KeyD || touch.right ? 1 : 0) -
            (keys.KeyA || touch.left ? 1 : 0);
        const vertical =
            (keys.Space || touch.up ? 1 : 0) -
            (keys.ControlLeft || touch.down ? 1 : 0);
        const roll =
            (keys.KeyE || touch.rollRight ? 1 : 0) -
            (keys.KeyQ || touch.rollLeft ? 1 : 0);

        const tilt = tiltAxes();

        return {
            thrust: thrust - reverse - gamepadFrame.leftY + tilt.thrust,
            strafe: strafe + gamepadFrame.leftX + tilt.strafe,
            vertical: vertical + gamepadFrame.vertical,
            roll: roll + gamepadFrame.roll
        };
    }

    function updateInteractionHint() {
        if (!interaction || !ship) return;

        const portal = getNearestPortal(10, 0.30);

        if (portal) {
            const route = portal.routes[portal.routeIndex];

            interaction.textContent = route
                ? portal.point + ' · G → ' + route.label +
                    (portal.routes.length > 1 ? ' · T/↕ сменить' : '')
                : portal.point + ' · ENDPOINT';
            return;
        }

        if (testDoor.mesh) {
            const toDoor = testDoor.mesh.position.clone().sub(ship.position);
            const distance = toDoor.length();
            const forward = new THREE.Vector3(0, 0, -1)
                .applyQuaternion(ship.quaternion)
                .normalize();
            const facing = distance > 0 ? forward.dot(toDoor.normalize()) : -1;

            if (testDoor.state === 'CLOSED' && distance < 34 && facing > 0.70) {
                interaction.textContent = 'DOOR · R / ◆ OPEN';
                return;
            }
        }

        interaction.textContent = '';
    }

    function updatePhysics(dt) {
        if (portalTransitionBusy) {
            camera.position.copy(ship.position);
            camera.quaternion.copy(ship.quaternion);
            light.position.copy(ship.position);
            return;
        }

        updateDoor(dt);

        // Chamber media are loaded when the door is opened, so there is no
        // second arbitrary distance trigger.
        const input = inputAxes();

        if (gamepadFrame.pad) {
            const padLookSensitivity = 1.15;
            ship.angularVelocity.y -= gamepadFrame.rightX * padLookSensitivity * dt;
            ship.angularVelocity.x -= gamepadFrame.rightY * padLookSensitivity * dt;
        }

        updateInteractionHint();

        if (keys[shipSystems.shieldToggleKey]) {
            toggleShield();
            keys[shipSystems.shieldToggleKey] = false;
        }

        const localAcceleration = new THREE.Vector3(
            input.strafe * ship.strafeThrust,
            input.vertical * ship.verticalThrust,
            -input.thrust * ship.thrust
        );

        localAcceleration.applyQuaternion(ship.quaternion);
        ship.velocity.addScaledVector(localAcceleration, dt);
        ship.velocity.multiplyScalar(Math.max(0, 1 - ship.linearDrag * dt));

        if (ship.velocity.length() > ship.maxSpeed) {
            ship.velocity.setLength(ship.maxSpeed);
        }

        ship.position.addScaledVector(ship.velocity, dt);
        resolveWorldCollision();

        // Roll is applied around the ship's local Z axis after pitch/yaw.
        const angularInput = new THREE.Vector3(0, 0, input.roll * 1.8);
        ship.angularVelocity.addScaledVector(angularInput, dt);
        ship.angularVelocity.multiplyScalar(Math.max(0, 1 - ship.angularDrag * dt));

        if (ship.angularVelocity.length() > 0.00001) {
            const angle = ship.angularVelocity.length() * dt;
            const axis = ship.angularVelocity.clone().normalize();

            const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
            ship.quaternion.multiply(dq).normalize();
        }

        if (pointerLocked) {
            ship.angularVelocity.x *= 0.98;
            ship.angularVelocity.y *= 0.98;
        }

        camera.position.copy(ship.position);
        camera.quaternion.copy(ship.quaternion);
        light.position.copy(ship.position);

        const crystalPulse = doorCrystal.pulseUntil > performance.now();
        testDoor.frameParts.forEach(part => {
            if (!part.material || !part.material.emissive) return;
            part.material.emissive.setHex(crystalPulse ? 0x8a5a00 : 0x000000);
            part.material.emissiveIntensity = crystalPulse ? 0.9 : 0;
        });

        const shield = shipSystems.shieldOn ? 'ON' : 'OFF';

        status.textContent =
            'SPD ' + ship.velocity.length().toFixed(1) +
            ' · 6DOF · PILOT · SHIELD ' + shield +
            ' · ♥'.repeat(shipSystems.hearts) +
            (shipSystems.halfHeart ? '½' : '') +
            ' · DOOR ' + testDoor.state;
    }

    function resize() {
        if (!renderer || !camera) return;

        const rect = root.getBoundingClientRect();
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);

        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function handleKeyDown(event) {
        keys[event.code] = true;
        startMusic();

        if (event.code === 'Space' || event.code === 'ControlLeft') {
            event.preventDefault();
        }

        if (event.code === 'KeyR') {
            event.preventDefault();
            tryRemoteDoor();
        }

        if (event.code === 'KeyG') {
            event.preventDefault();
            tryPortalAction();
        }

        if (event.code === 'KeyT') {
            event.preventDefault();
            cyclePortalRoute();
        }
    }

    function handleKeyUp(event) {
        keys[event.code] = false;
    }

    let activeTouchPointerId = null;
    let touchLookX = 0;
    let touchLookY = 0;

    function setupInput() {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('resize', resize);
        window.addEventListener('deviceorientation', handleDeviceOrientation, true);

        window.addEventListener('gamepadconnected', event => {
            if (gamepadIndex < 0) {
                gamepadIndex = event.gamepad.index;
            }
        });

        window.addEventListener('gamepaddisconnected', event => {
            if (event.gamepad.index === gamepadIndex) {
                gamepadIndex = -1;
            }
        });

        canvas.addEventListener('pointerdown', event => {
            if (!running) return;

            if (event.pointerType === 'touch' || event.pointerType === 'pen') {
                activeTouchPointerId = event.pointerId;
                touchLookX = event.clientX;
                touchLookY = event.clientY;

                if (canvas.setPointerCapture) {
                    canvas.setPointerCapture(event.pointerId);
                }

                event.preventDefault();
                startMusic();
                return;
            }

            if (event.pointerType === 'mouse' && canvas.requestPointerLock) {
                canvas.requestPointerLock();
            }
        });

        canvas.addEventListener('pointermove', event => {
            if (event.pointerId !== activeTouchPointerId || !ship) return;

            const dx = event.clientX - touchLookX;
            const dy = event.clientY - touchLookY;

            touchLookX = event.clientX;
            touchLookY = event.clientY;

            const sensitivity = 0.0052;
            ship.angularVelocity.y -= dx * sensitivity;
            ship.angularVelocity.x -= dy * sensitivity;

            event.preventDefault();
        });

        const endTouchLook = event => {
            if (event.pointerId !== activeTouchPointerId) return;
            activeTouchPointerId = null;
        };

        canvas.addEventListener('pointerup', endTouchLook);
        canvas.addEventListener('pointercancel', endTouchLook);

        document.addEventListener('pointerlockchange', () => {
            pointerLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', event => {
            if (!pointerLocked || !ship) return;

            const sensitivity = 0.0022;
            ship.angularVelocity.y -= event.movementX * sensitivity;
            ship.angularVelocity.x -= event.movementY * sensitivity;
        });

        root.querySelectorAll('.bcm-mini-sim-mobile button').forEach(button => {
            const control = button.dataset.control;

            const down = event => {
                event.preventDefault();
                startMusic();

                if (!running) return;

                if (control === 'shield') {
                    toggleShield();
                    return;
                }

                if (control === 'portal') {
                    tryPortalAction();
                    return;
                }

                if (control === 'route') {
                    cyclePortalRoute();
                    return;
                }

                if (control === 'tilt') {
                    enableTiltControl();
                    return;
                }

                touch[control] = true;
            };

            const up = event => {
                event.preventDefault();
                touch[control] = false;
            };

            button.addEventListener('pointerdown', down);
            button.addEventListener('pointerup', up);
            button.addEventListener('pointercancel', up);
            button.addEventListener('pointerleave', up);
        });

        const crystalButton = root.querySelector('.bcm-mini-sim-crystal-main');

        if (crystalButton) {
            crystalButton.addEventListener('click', event => {
                event.preventDefault();
                startMusic();
                tryRemoteDoor();
            });
        }

        if (musicButton) {
            musicButton.addEventListener('click', event => {
                event.preventDefault();

                if (!musicAudio || !config.musicUrl) return;

                musicAudio.muted = !musicAudio.muted;

                if (!musicAudio.muted) {
                    startMusic();
                }

                updateMusicButton();
            });
        }

        startButton.addEventListener('click', () => {
            startMusic();
            running = true;
            root.classList.add('game-active');
            startButton.classList.add('hidden');
            status.textContent = 'FLIGHT ACTIVE · 6DOF READY';

            if (canvas.requestPointerLock) {
                canvas.requestPointerLock();
            }

            canvas.focus();
        });

        // Any first interaction is a valid browser gesture for audio.
        root.addEventListener('pointerdown', startMusic);
    }

    function updateMusicButton() {
        if (!musicButton || !musicAudio) return;

        musicButton.textContent = musicAudio.muted ? '🔇' : '♫';
        musicButton.setAttribute(
            'aria-label',
            musicAudio.muted ? 'Включить музыку' : 'Выключить музыку'
        );
        musicButton.title = musicAudio.muted ? 'Включить музыку' : 'Выключить музыку';
    }

    function startMusic() {
        if (!musicAudio || !config.musicUrl || musicAudio.muted) return;

        if (!musicAudio.src) {
            musicAudio.src = config.musicUrl;
        }

        musicAudio.loop = true;
        musicAudio.preload = 'auto';
        musicAudio.volume = 0.42;

        const promise = musicAudio.play();

        if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {
                // Browser autoplay policy may require a user gesture.
            });
        }

        updateMusicButton();
    }

    function setupMedia() {
        if (menuBackdrop && config.menuBackgroundUrl) {
            const safeUrl = String(config.menuBackgroundUrl).replace(/"/g, '\\\"');
            menuBackdrop.style.backgroundImage = 'url("' + safeUrl + '")';
        }

        if (!musicAudio || !config.musicUrl) {
            if (musicButton) musicButton.hidden = true;
            return;
        }

        musicAudio.src = config.musicUrl;
        musicAudio.loop = true;
        musicAudio.preload = 'auto';
        musicAudio.volume = 0.42;
        musicAudio.setAttribute('playsinline', '');

        updateMusicButton();

        const promise = musicAudio.play();

        if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {
                // Expected until the browser receives a user gesture.
            });
        }
    }

    function renderFrame(now) {
        const dt = Math.min((now - last) / 1000, 0.033);
        last = now;

        if (running) {
            updatePhysics(dt);
        }

        renderer.render(scene, camera);
        requestAnimationFrame(renderFrame);
    }

    function startSimulator() {
        if (renderer) return;

        try {
            // IMPORTANT: this is the first place in the file where the
            // THREE namespace is required. This keeps the script safe even
            // when a WordPress optimizer reorders the two local scripts.
            if (!window.THREE) {
                throw new Error('Three.js r128 is not available yet');
            }

            ship = {
                position: new THREE.Vector3(0, 0, 0),
                velocity: new THREE.Vector3(),
                angularVelocity: new THREE.Vector3(),
                quaternion: new THREE.Quaternion(),
                thrust: 14,
                strafeThrust: 9,
                verticalThrust: 9,
                linearDrag: 0.08,
                angularDrag: 0.55,
                maxSpeed: 38
            };

            renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: false,
                powerPreference: 'high-performance'
            });

            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x020308);
            scene.fog = new THREE.Fog(0x020308, 40, 180);

            camera = new THREE.PerspectiveCamera(75, 1, 0.05, 250);
            camera.position.copy(ship.position);

            const ambient = new THREE.HemisphereLight(0x9bb7ff, 0x16120f, 1.3);
            scene.add(ambient);

            light = new THREE.PointLight(0xffffff, 12, 45);
            light.position.copy(ship.position);
            scene.add(light);

            // Affordable star field. The actual station texture work is
            // kept on local PNG surfaces so this remains inexpensive.
            const stars = new THREE.BufferGeometry();
            const points = [];

            for (let i = 0; i < 450; i++) {
                points.push(
                    (Math.random() - 0.5) * 500,
                    (Math.random() - 0.5) * 500,
                    (Math.random() - 0.5) * 500
                );
            }

            stars.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(points, 3)
            );

            scene.add(new THREE.Points(
                stars,
                new THREE.PointsMaterial({
                    color: 0xffffff,
                    size: 0.8,
                    sizeAttenuation: true
                })
            ));

            buildWorld();
            buildDoor();
            createPortalTransitionUI();
            setupMedia();
            setupInput();
            resize();

            status.textContent = 'ENGINE READY · LOCAL THREE.JS r128';

            requestAnimationFrame(renderFrame);
        } catch (error) {
            console.error('BCM Mini Sim startup error:', error);
            status.textContent = 'ERROR: ' + (error && error.message ? error.message : 'ENGINE START FAILED');
            startButton.disabled = true;
        }
    }

    updateAssetStatus();

    function bootThree() {
        if (window.THREE) {
            startSimulator();
            return;
        }

        status.textContent = 'ENGINE LOADING LOCAL r128...';

        const localEngine = document.createElement('script');
        localEngine.src = config.threeUrl || '';
        localEngine.async = false;

        localEngine.onload = () => {
            if (window.THREE) {
                status.textContent = 'ENGINE FOUND · STARTING LOCAL r128...';
                startSimulator();
            } else {
                status.textContent = 'ERROR: Three.js file loaded but window.THREE is missing';
                startButton.disabled = true;
            }
        };

        localEngine.onerror = () => {
            status.textContent = 'ERROR: Local Three.js r128 could not be loaded';
            startButton.disabled = true;
        };

        if (!localEngine.src) {
            status.textContent = 'ERROR: Local Three.js path is missing';
            startButton.disabled = true;
            return;
        }

        document.head.appendChild(localEngine);
    }

    bootThree();
})();
