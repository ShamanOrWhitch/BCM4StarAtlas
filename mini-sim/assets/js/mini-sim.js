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
    const tiltButton = root.querySelector('[data-control="tilt"]');
    const settingsPanel = root.querySelector('.bcm-mini-sim-settings');
    const settingsCloseButton = root.querySelector('[data-setting="close"]');
    const config = window.BCMMiniSimConfig || {};

    if (!canvas || !startButton || !status) return;

    const assets = Array.isArray(config.assets) ? config.assets : [];
    const assetByName = Object.create(null);
    const textureRecords = Object.create(null);

    assets.forEach(asset => {
        if (asset && asset.name && asset.url) {
            assetByName[asset.name] = asset;
        }
    });

    function findExactAsset(name) {
        const exact = assetByName[name];
        if (exact) return exact.url;

        const wanted = String(name).toLowerCase();
        const key = Object.keys(assetByName).find(path =>
            path.toLowerCase() === wanted
        );

        return key ? assetByName[key].url : '';
    }

    function findImageAsset(name) {
        const requested = String(name);
        const lower = requested.toLowerCase();
        const match = lower.match(/^(.*)\\.(png|jpg|jpeg|webp|gif)$/i);

        if (!match) {
            return findExactAsset(requested);
        }

        const base = match[1];
        const extensions = ['webp', 'jpg', 'jpeg', 'png', 'gif'];

        // Prefer WebP/JPG/JPEG as optional light variants, but keep PNG as
        // the canonical fallback supplied by the project.
        for (const extension of extensions) {
            const candidate = base + '.' + extension;
            const key = Object.keys(assetByName).find(path =>
                path.toLowerCase() === candidate
            );

            if (key) return assetByName[key].url;
        }

        return '';
    }

    function findAsset(name) {
        return /\\.(png|jpg|jpeg|webp|gif)$/i.test(String(name))
            ? findImageAsset(name)
            : findExactAsset(name);
    }

    let renderer;
    let scene;
    let camera;
    let light;
    let starfield = null;
    let running = false;
    let pointerLocked = false;
    let last = performance.now();

    const keys = Object.create(null);
    const touch = Object.create(null);

    const textureStats = {
        total: 0,
        loaded: 0,
        failed: 0,
        failedNames: []
    };

    const ship = {
        position: null,
        velocity: null,
        angularVelocity: null,
        quaternion: null,
        thrust: 15,
        strafeThrust: 10,
        verticalThrust: 10,
        linearDrag: 0.08,
        angularDrag: 0.48,
        maxSpeed: 40
    };

    const testDoor = {
        state: 'CLOSED',
        openDistance: 8,
        remoteDistance: 32,
        remoteFacing: 0.88,
        progress: 0,
        closeTimer: 0,
        speed: 1.8,
        style: 'slide',
        mesh: null,
        leftPanel: null,
        rightPanel: null,
        frameParts: []
    };

    const portal = {
        point: 'PORTAL 1 → ROOM 2',
        image: 'portal.png',
        video: 'portal2.mp4',
        position: null,
        mesh: null,
        surface: null
    };

    const tilt = {
        enabled: false,
        available: false,
        alpha: 0,
        beta: 0,
        gamma: 0,
        neutralAlpha: 0,
        neutralBeta: 0,
        neutralGamma: 0,
        yawOffset: 0
    };

    const gamepad = {
        pad: null,
        index: -1,
        leftX: 0,
        leftY: 0,
        rightX: 0,
        rightY: 0,
        roll: 0,
        vertical: 0,
        previousButtons: []
    };

    const settingsState = {
        open: false,
        volume: 42,
        quality: 'high',
        effects: true,
        invertPitch: true,
        invertYaw: false,
        historyPushed: false
    };

    let shieldEnabled = true;

    const room = {
        firstMinZ: -32.0,
        firstMaxZ: 6.0,
        secondMinZ: -74.0,
        secondMaxZ: -42.0,
        portalZ: -32.0,
        roomJoinZ: -41.0,
        backZ: -73.5
    };

    function updateAssetStatus() {
        if (!assetStatus) return;

        const audioState = config.musicUrl ? 'MUSIC READY' : 'MUSIC MISSING';
        const textureText = textureStats.total
            ? 'TEXTURES ' + textureStats.loaded + '/' + textureStats.total
            : 'TEXTURES 0';

        let failureText = '';

        if (textureStats.failedNames.length) {
            failureText = ' · ' + textureStats.failedNames.slice(-2).join(', ');
        }

        assetStatus.textContent =
            textureText +
            ' · ' + audioState +
            failureText;
    }

    function setImageTexture(texture, image, targetWidth, targetHeight, cover = true) {
        // All supplied 720p/NPOT images use safe WebGL-compatible wrapping.
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        if (!cover) {
            texture.repeat.set(1, 1);
            texture.offset.set(0, 0);
        } else {
            const sourceAspect = image.width / image.height;
            const targetAspect = targetWidth / targetHeight;

            if (sourceAspect > targetAspect) {
                const visibleX = targetAspect / sourceAspect;
                texture.repeat.set(visibleX, 1);
                texture.offset.set((1 - visibleX) / 2, 0);
            } else {
                const visibleY = sourceAspect / targetAspect;
                texture.repeat.set(1, visibleY);
                texture.offset.set(0, (1 - visibleY) / 2);
            }
        }

        if ('encoding' in texture && THREE.sRGBEncoding !== undefined) {
            texture.encoding = THREE.sRGBEncoding;
        }

        texture.needsUpdate = true;
    }

    function loadImageTexture(name, url, onReady, onError, options = {}) {
        const existing = textureRecords[name];

        if (existing) {
            if (existing.texture) {
                if (onReady) onReady(existing.texture, existing.image);
            } else if (existing.failed) {
                if (onError) onError(new Error('IMAGE_ASSET_FAILED'));
            } else {
                existing.callbacks.push({ onReady, onError });
            }

            return;
        }

        const record = {
            texture: null,
            image: null,
            failed: false,
            callbacks: [{ onReady, onError }]
        };

        textureRecords[name] = record;
        textureStats.total++;
        updateAssetStatus();

        const image = new Image();
        image.decoding = 'async';
        image.onload = () => {
            try {
                let source = image;
                let width = image.naturalWidth || image.width;
                let height = image.naturalHeight || image.height;

                if (!width || !height) {
                    throw new Error('IMAGE_DIMENSIONS_MISSING');
                }

                const maxDimension = Math.min(
                    2048,
                    renderer && renderer.capabilities
                        ? renderer.capabilities.maxTextureSize
                        : 2048
                );

                if (Math.max(width, height) > maxDimension) {
                    const scale = maxDimension / Math.max(width, height);
                    width = Math.max(1, Math.round(width * scale));
                    height = Math.max(1, Math.round(height * scale));

                    const scaled = document.createElement('canvas');
                    scaled.width = width;
                    scaled.height = height;

                    const context = scaled.getContext('2d');
                    if (!context) {
                        throw new Error('TEXTURE_SCALE_CONTEXT_FAILED');
                    }

                    context.imageSmoothingEnabled = true;
                    context.imageSmoothingQuality = 'high';
                    context.drawImage(image, 0, 0, width, height);
                    source = scaled;
                }

                const texture = new THREE.Texture(source);
                setImageTexture(
                    texture,
                    image,
                    options.targetWidth || width,
                    options.targetHeight || height,
                    options.cover !== false
                );

                record.texture = texture;
                record.image = {
                    width,
                    height
                };
                record.failed = false;

                textureStats.loaded++;
                updateAssetStatus();

                record.callbacks.forEach(callback => {
                    if (callback.onReady) callback.onReady(texture, record.image);
                });
                record.callbacks.length = 0;
            } catch (error) {
                record.failed = true;
                textureStats.failed++;
                textureStats.loaded++;
                textureStats.failedNames.push(name);

                updateAssetStatus();

                record.callbacks.forEach(callback => {
                    if (callback.onError) callback.onError(error);
                });
                record.callbacks.length = 0;
            }
        };

        image.onerror = () => {
            record.failed = true;
            textureStats.failed++;
            textureStats.loaded++;
            textureStats.failedNames.push(name);
            updateAssetStatus();

            record.callbacks.forEach(callback => {
                if (callback.onError) callback.onError(new Error('IMAGE_LOAD_FAILED'));
            });
            record.callbacks.length = 0;
        };

        image.src = url;
    }

    function wallMaterial(name, fallback = 0x58616c, targetWidth = 1, targetHeight = 1, textureOptions = {}) {
        const material = new THREE.MeshBasicMaterial({
            color: fallback,
            side: THREE.DoubleSide,
            fog: false
        });

        const url = findImageAsset(name);

        if (!url) {
            textureStats.total++;
            textureStats.loaded++;
            textureStats.failed++;
            textureStats.failedNames.push(name);
            updateAssetStatus();
            return material;
        }

        loadImageTexture(
            name,
            url,
            texture => {
                material.map = texture;
                material.color.set(0xffffff);
                material.needsUpdate = true;
            },
            () => {
                material.color.set(fallback);
                material.needsUpdate = true;
            },
            {
                targetWidth,
                targetHeight,
                ...textureOptions
            }
        );

        return material;
    }

    function addPlane(parent, x, y, z, width, height, rotationX, rotationY, rotationZ, material) {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            material
        );

        mesh.position.set(x, y, z);
        mesh.rotation.set(rotationX || 0, rotationY || 0, rotationZ || 0);
        parent.add(mesh);

        return mesh;
    }

    function addBeam(parent, x, y, z, sx, sy, sz, material) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(sx, sy, sz),
            material
        );

        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    }

    function buildTexturedRoom(parent, options) {
        const floorMat = wallMaterial(
            options.floor,
            options.floorColor,
            options.width,
            options.length
        );
        const ceilingNames = Array.isArray(options.ceiling)
            ? options.ceiling
            : [options.ceiling || 'roof.png'];
        const leftMat = wallMaterial(
            options.left,
            options.leftColor,
            options.length,
            options.height
        );
        const rightMat = wallMaterial(
            options.right,
            options.rightColor,
            options.length,
            options.height
        );

        addPlane(parent, 0, -3.5, options.centerZ, options.width, options.length, -Math.PI / 2, 0, 0, floorMat);

        const ceilingSegmentLength = options.length / ceilingNames.length;
        ceilingNames.forEach((name, index) => {
            const segmentZ =
                options.centerZ -
                options.length / 2 +
                ceilingSegmentLength * (index + 0.5);

            const ceilingMat = wallMaterial(
                name,
                options.ceilingColor,
                options.width,
                ceilingSegmentLength,
                { cover: false }
            );

            addPlane(
                parent,
                0,
                3.40,
                segmentZ,
                options.width,
                ceilingSegmentLength,
                Math.PI / 2,
                0,
                0,
                ceilingMat
            );
        });
        addPlane(parent, -options.width / 2, 0, options.centerZ, options.length, options.height, 0, Math.PI / 2, 0, leftMat);
        addPlane(parent, options.width / 2, 0, options.centerZ, options.length, options.height, 0, -Math.PI / 2, 0, rightMat);

        const structure = new THREE.MeshStandardMaterial({
            color: options.structureColor,
            metalness: 0.82,
            roughness: 0.28
        });

        for (let z = options.centerZ - options.length / 2 + 2; z < options.centerZ + options.length / 2; z += 6) {
            addBeam(parent, 0, 3.05, z, options.width, 0.26, 0.42, structure);
            addBeam(parent, -options.width / 2 + 0.18, 0, z, 0.32, options.height, 0.32, structure);
            addBeam(parent, options.width / 2 - 0.18, 0, z, 0.32, options.height, 0.32, structure);
        }

        const accent = wallMaterial(
            options.accent,
            options.accentColor,
            options.width,
            options.height
        );

        addPlane(
            parent,
            0,
            0,
            options.centerZ + options.length / 2 - 0.28,
            options.width,
            options.height,
            0,
            0,
            0,
            accent
        );


        const cornerA = wallMaterial(
            options.roofCornerA || 'roofa.png',
            options.ceilingColor,
            0.9,
            options.length,
            { cover: false }
        );
        const cornerB = wallMaterial(
            options.roofCornerB || 'roofa1.png',
            options.ceilingColor,
            0.9,
            options.length,
            { cover: false }
        );
        const cornerEnd = wallMaterial(
            options.roofCornerEnd || 'roofa2.png',
            options.ceilingColor,
            options.width,
            0.9,
            { cover: false }
        );

        addPlane(
            parent,
            -options.width / 2 + 0.45,
            3.36,
            options.centerZ,
            0.9,
            options.length,
            Math.PI / 2,
            0,
            0,
            cornerA
        );

        addPlane(
            parent,
            options.width / 2 - 0.45,
            3.36,
            options.centerZ,
            0.9,
            options.length,
            Math.PI / 2,
            0,
            0,
            cornerB
        );

        addPlane(
            parent,
            0,
            3.36,
            options.centerZ + options.length / 2 - 0.45,
            options.width,
            0.9,
            Math.PI / 2,
            0,
            0,
            cornerEnd
        );
    }

    function buildWorld() {
        const world = new THREE.Group();

        // Room 1: the pilot test corridor.
        buildTexturedRoom(world, {
            centerZ: -13,
            width: 12,
            length: 38,
            height: 8,
            floor: 'wall1.png',
            ceiling: ['roof.png', 'roof1.png', 'roof3.png'],
            roofCornerA: 'roofa.png',
            roofCornerB: 'roofa1.png',
            roofCornerEnd: 'roofa2.png',
            left: 'wall3.png',
            right: 'wall4.png',
            accent: 'wall5.png',
            floorColor: 0x46505b,
            ceilingColor: 0x53606a,
            leftColor: 0x3b444f,
            rightColor: 0x343d47,
            accentColor: 0x59636e,
            structureColor: 0x202731
        });

        // Room 2: same scale, intentionally different texture assignment
        // and structural pattern to make the transition visibly meaningful.
        buildTexturedRoom(world, {
            centerZ: -58,
            width: 12,
            length: 32,
            height: 8,
            floor: 'wall4.png',
            ceiling: ['roof1.png', 'roof3.png', 'roof.png'],
            roofCornerA: 'roofa1.png',
            roofCornerB: 'roofa2.png',
            roofCornerEnd: 'roofa.png',
            left: 'wall5.png',
            right: 'wall2.png',
            accent: 'wall3.png',
            floorColor: 0x343d48,
            ceilingColor: 0x5a636e,
            leftColor: 0x48535e,
            rightColor: 0x3a444f,
            accentColor: 0x69727d,
            structureColor: 0x161d25
        });

        // Room 1 back wall around the single portal: actual hole, not three
        // conflicting portal surfaces.
        const wallMaterial5 = wallMaterial(
            'wall5.png',
            0x58616c,
            2.8,
            7.5
        );
        addBeam(world, -4.6, 0, -32.0, 2.8, 7.5, 0.5, wallMaterial5);
        addBeam(world, 4.6, 0, -32.0, 2.8, 7.5, 0.5, wallMaterial5);
        addBeam(world, 0, 2.95, -32.0, 6.2, 1.0, 0.5, wallMaterial5);
        addBeam(world, 0, -2.95, -32.0, 6.2, 1.0, 0.5, wallMaterial5);

        scene.add(world);

        buildDoor();
        buildPortal();
    }

    function buildDoor() {
        const group = new THREE.Group();
        group.position.set(0, 0, -18);

        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x242a32,
            metalness: 0.76,
            roughness: 0.4
        });

        const top = addBeam(group, 0, 3.325, 0, 7.2, 0.55, 0.75, frameMaterial);
        const bottom = addBeam(group, 0, -3.325, 0, 7.2, 0.55, 0.75, frameMaterial);
        const leftFrame = addBeam(group, -3.325, 0, 0, 0.55, 6.1, 0.75, frameMaterial);
        const rightFrame = addBeam(group, 3.325, 0, 0, 0.55, 6.1, 0.75, frameMaterial);

        testDoor.frameParts = [top, bottom, leftFrame, rightFrame];

        const leftMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });

        const rightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });

        const left = addPlane(group, -1.525, 0, -0.39, 3.05, 6.1, 0, 0, 0, leftMaterial);
        const right = addPlane(group, 1.525, 0, -0.39, 3.05, 6.1, 0, 0, 0, rightMaterial);

        const doorUrl = config.doorTexture || findImageAsset('door.png') || findImageAsset('door1.png');

        if (doorUrl) {
            loadImageTexture(
                '__door_texture__',
                doorUrl,
                texture => {
                    const leftTexture = texture.clone();
                    const rightTexture = texture.clone();

                    leftTexture.repeat.set(0.5, 1);
                    leftTexture.offset.set(0, 0);
                    rightTexture.repeat.set(0.5, 1);
                    rightTexture.offset.set(0.5, 0);

                    leftTexture.needsUpdate = true;
                    rightTexture.needsUpdate = true;

                    left.material.map = leftTexture;
                    right.material.map = rightTexture;
                    left.material.needsUpdate = true;
                    right.material.needsUpdate = true;
                },
                null,
                { targetWidth: 3.05, targetHeight: 6.1 }
            );
        }

        scene.add(group);
        testDoor.mesh = group;
        testDoor.leftPanel = left;
        testDoor.rightPanel = right;
    }

    function buildPortal() {
        const group = new THREE.Group();
        group.position.set(0, 0, -31.72);

        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x5d6874,
            metalness: 0.88,
            roughness: 0.2,
            emissive: 0x09121b,
            emissiveIntensity: 0.75
        });

        const width = 3.8;
        const height = 6.1;

        addBeam(group, 0, 3.32, 0, 4.5, 0.52, 0.45, frameMaterial);
        addBeam(group, 0, -3.32, 0, 4.5, 0.52, 0.45, frameMaterial);
        addBeam(group, -2.16, 0, 0, 0.52, 6.1, 0.45, frameMaterial);
        addBeam(group, 2.16, 0, 0, 0.52, 6.1, 0.45, frameMaterial);

        const opening = new THREE.MeshBasicMaterial({
            color: 0x03070c,
            side: THREE.DoubleSide
        });

        const surface = addPlane(group, 0, 0, 0.06, width, height, 0, 0, 0, opening);

        portal.position = new THREE.Vector3(0, 0, -31.72);
        portal.mesh = group;
        portal.surface = surface;

        scene.add(group);

        const url = findImageAsset(portal.image);

        if (url) {
            loadImageTexture(
                'portal-image',
                url,
                texture => {
                    surface.material.map = texture;
                    surface.material.color.set(0xffffff);
                    surface.material.needsUpdate = true;
                },
                null,
                {
                    targetWidth: width,
                    targetHeight: height
                }
            );
        }
    }

    function buildSecondRoomArrivalMarker() {
        const material = new THREE.MeshBasicMaterial({
            color: 0x0b121b,
            side: THREE.DoubleSide
        });

        const plate = addPlane(
            scene,
            0,
            0,
            -73.0,
            7.0,
            5.5,
            0,
            0,
            0,
            material
        );

        const url = findImageAsset('wall5.png');

        if (url) {
            loadImageTexture(
                'room2-end',
                url,
                texture => {
                    plate.material.map = texture;
                    plate.material.color.set(0xffffff);
                    plate.material.needsUpdate = true;
                },
                null,
                {
                    targetWidth: 7,
                    targetHeight: 5.5
                }
            );
        }
    }

    function createPortalTransitionUI() {
        if (root.querySelector('.bcm-mini-sim-transition')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'bcm-mini-sim-transition';
        wrapper.hidden = true;

        const video = document.createElement('video');
        video.className = 'bcm-mini-sim-transition-video';
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'metadata';
        video.controls = false;

        const label = document.createElement('div');
        label.className = 'bcm-mini-sim-transition-label';

        wrapper.appendChild(video);
        wrapper.appendChild(label);
        root.appendChild(wrapper);

        return {
            wrapper,
            video,
            label
        };
    }

    let transitionUI = null;
    let transitionBusy = false;

    function startPortalTransition(fromUserGesture = false) {
        if (!running || transitionBusy) return false;

        const distance = ship.position.distanceTo(portal.position);

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const toPortal = portal.position.clone().sub(ship.position);
        const facing = toPortal.length()
            ? forward.dot(toPortal.normalize())
            : 1;

        if (distance > 9.5 || facing < 0.30) {
            status.textContent = 'PORTAL · APPROACH AND FACE THE GATE';
            return false;
        }

        const url = findExactAsset(portal.video);

        if (!url) {
            status.textContent = 'PORTAL · VIDEO ASSET MISSING';
            return false;
        }

        transitionUI = transitionUI || createPortalTransitionUI();

        transitionBusy = true;
        transitionUI.wrapper.hidden = false;
        transitionUI.label.textContent = 'ПЕРЕХОД · ROOM 1 → ROOM 2';

        const video = transitionUI.video;
        let finished = false;
        let watchdog = null;

        const finish = success => {
            if (finished) return;
            finished = true;

            if (watchdog) {
                clearTimeout(watchdog);
                watchdog = null;
            }

            video.pause();
            video.removeAttribute('src');
            video.load();
            transitionUI.wrapper.hidden = true;

            if (success) {
                ship.position.set(0, 0, -47.0);
                ship.velocity.set(0, 0, 0);
                ship.angularVelocity.set(0, 0, 0);
                ship.quaternion.identity();
                status.textContent = 'ROOM 2 · ARRIVED';
            } else {
                status.textContent = 'PORTAL · VIDEO FAILED';
            }

            transitionBusy = false;
        };

        const onEnded = () => {
            finish(true);
        };

        const onError = () => {
            finish(false);
        };

        video.pause();
        video.removeAttribute('src');
        video.load();
        video.src = url;
        video.preload = 'auto';
        video.controls = false;
        video.playsInline = true;

        // A gamepad press is not a browser media user-activation. Start muted there
        // so Chromium/Brave cannot reject the play and leave the simulator frozen.
        // Keyboard/touch starts are genuine user gestures and may start with audio.
        video.muted = !fromUserGesture;

        video.addEventListener('ended', onEnded, { once: true });
        video.addEventListener('error', onError, { once: true });

        watchdog = setTimeout(() => {
            if (!finished && video.readyState < 2) {
                finish(false);
                status.textContent = 'PORTAL · VIDEO DID NOT START';
            }
        }, 7000);

        const promise = video.play();

        if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {
                if (finished) return;

                if (!video.muted) {
                    video.muted = true;

                    const retry = video.play();

                    if (retry && typeof retry.catch === 'function') {
                        retry.catch(() => {
                            finish(false);
                            status.textContent = 'PORTAL · BROWSER BLOCKED VIDEO';
                        });
                    }
                } else {
                    finish(false);
                    status.textContent = 'PORTAL · BROWSER BLOCKED VIDEO';
                }
            });
        }

        return true;
    }
    function normalizeAngleDegrees(value) {
        let result = value % 360;
        if (result > 180) result -= 360;
        if (result < -180) result += 360;
        return result;
    }

    function handleDeviceOrientation(event) {
        if (
            typeof event.alpha !== 'number' ||
            typeof event.beta !== 'number' ||
            typeof event.gamma !== 'number'
        ) {
            return;
        }

        tilt.available = true;
        tilt.alpha = event.alpha;
        tilt.beta = event.beta;
        tilt.gamma = event.gamma;
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

            window.addEventListener('deviceorientation', handleDeviceOrientation, true);

            // Let a few sensor samples arrive before calibration.
            await new Promise(resolve => setTimeout(resolve, 280));

            if (!tilt.available) {
                status.textContent = 'TILT · SENSOR NOT AVAILABLE';
                return false;
            }

            tilt.neutralAlpha = tilt.alpha;
            tilt.neutralBeta = tilt.beta;
            tilt.neutralGamma = tilt.gamma;
            tilt.yawOffset = 0;
            tilt.enabled = true;

            if (tiltButton) tiltButton.classList.add('active');

            if (
                screen.orientation &&
                screen.orientation.lock
            ) {
                screen.orientation.lock('landscape').catch(() => {});
            }

            status.textContent = 'TILT CONTROL · LANDSCAPE · CALIBRATED';
            return true;
        } catch (error) {
            status.textContent = 'TILT · SENSOR ERROR';
            return false;
        }
    }

    function getScreenAngle() {
        const angle =
            screen.orientation && typeof screen.orientation.angle === 'number'
                ? screen.orientation.angle
                : (typeof window.orientation === 'number' ? window.orientation : 0);

        let normalized = angle % 360;
        if (normalized < 0) normalized += 360;
        return normalized;
    }

    function getTiltLook() {
        if (!tilt.enabled || !tilt.available) {
            return {
                pitch: 0,
                yaw: 0
            };
        }

        const angle = getScreenAngle();
        let forwardDelta;
        let sideDelta;

        if (angle === 90) {
            forwardDelta = tilt.gamma - tilt.neutralGamma;
            sideDelta = tilt.beta - tilt.neutralBeta;
        } else if (angle === 270) {
            forwardDelta = -(tilt.gamma - tilt.neutralGamma);
            sideDelta = -(tilt.beta - tilt.neutralBeta);
        } else if (angle === 180) {
            forwardDelta = -(tilt.beta - tilt.neutralBeta);
            sideDelta = tilt.gamma - tilt.neutralGamma;
        } else {
            forwardDelta = tilt.beta - tilt.neutralBeta;
            sideDelta = tilt.gamma - tilt.neutralGamma;
        }

        return {
            pitch: applyDeadzone(forwardDelta / 20, 0.055),
            yaw: applyDeadzone(sideDelta / 18, 0.055)
        };
    }

    function applyDeadzone(value, deadzone) {
        if (Math.abs(value) <= deadzone) return 0;

        const sign = value < 0 ? -1 : 1;
        const scaled = (Math.abs(value) - deadzone) / (1 - deadzone);

        return sign * Math.min(1, scaled);
    }

    function getGamepad() {
        if (!navigator.getGamepads) return null;

        let pads;

        try {
            pads = navigator.getGamepads();
        } catch (error) {
            return null;
        }

        if (gamepad.index >= 0 && pads[gamepad.index]) {
            return pads[gamepad.index];
        }

        for (let i = 0; i < pads.length; i++) {
            if (pads[i]) {
                gamepad.index = i;
                return pads[i];
            }
        }

        gamepad.index = -1;
        return null;
    }

    function buttonPressed(pad, index) {
        return !!(
            pad &&
            pad.buttons &&
            pad.buttons[index] &&
            (
                pad.buttons[index].pressed ||
                pad.buttons[index].value > 0.55
            )
        );
    }

    function updateGamepad() {
        gamepad.pad = getGamepad();

        if (!gamepad.pad) {
            gamepad.leftX = 0;
            gamepad.leftY = 0;
            gamepad.rightX = 0;
            gamepad.rightY = 0;
            gamepad.roll = 0;
            gamepad.vertical = 0;
            gamepad.previousButtons = [];
            return;
        }

        const pad = gamepad.pad;
        const axes = pad.axes || [];

        gamepad.leftX = applyDeadzone(axes[0] || 0, 0.14);
        gamepad.leftY = applyDeadzone(axes[1] || 0, 0.14);
        gamepad.rightX = applyDeadzone(axes[2] || 0, 0.12);
        gamepad.rightY = applyDeadzone(axes[3] || 0, 0.12);

        gamepad.roll =
            (buttonPressed(pad, 5) ? 1 : 0) -
            (buttonPressed(pad, 4) ? 1 : 0);

        gamepad.vertical =
            (buttonPressed(pad, 7) ? 1 : 0) -
            (buttonPressed(pad, 6) ? 1 : 0);

        const oneShot = [
            [0, tryRemoteDoor],
            [2, toggleShield],
            [3, () => startPortalTransition(false)],
            [8, toggleSettings],
            [9, toggleSettings]
        ];

        oneShot.forEach(([index, action]) => {
            const pressed = buttonPressed(pad, index);
            const wasPressed = gamepad.previousButtons[index] === true;

            if (pressed && !wasPressed && running) {
                action();
            }

            gamepad.previousButtons[index] = pressed;
        });
    }

    function inputAxes() {
        updateGamepad();

        const thrust =
            (keys.KeyW || touch.thrust ? 1 : 0) -
            (keys.KeyS || touch.brake ? 1 : 0);

        const strafe =
            (keys.KeyD || touch.right ? 1 : 0) -
            (keys.KeyA || touch.left ? 1 : 0);

        const vertical =
            (keys.Space || touch.up ? 1 : 0) -
            (keys.ControlLeft || touch.down ? 1 : 0);

        const roll =
            (keys.KeyE || touch.rollRight ? 1 : 0) -
            (keys.KeyQ || touch.rollLeft ? 1 : 0);

        const yawButtons =
            (touch.yawRight ? 1 : 0) -
            (touch.yawLeft ? 1 : 0);

        const tiltLook = getTiltLook();

        const yaw =
            yawButtons +
            tiltLook.yaw +
            (gamepad.rightX * (settingsState.invertYaw ? -1 : 1));

        return {
            thrust: thrust - gamepad.leftY,
            strafe: strafe + gamepad.leftX,
            vertical: vertical + gamepad.vertical,
            roll: roll + gamepad.roll,
            yaw,
            tiltPitch: tiltLook.pitch
        };
    }

    function applyDoorVisual() {
        if (!testDoor.leftPanel || !testDoor.rightPanel) return;
        const p = Math.max(0, Math.min(1, testDoor.progress));
        const closed = 1 - p;
        testDoor.leftPanel.position.set(-1.525, 0, -0.39);
        testDoor.rightPanel.position.set(1.525, 0, -0.39);
        testDoor.leftPanel.scale.set(1, 1, 1);
        testDoor.rightPanel.scale.set(1, 1, 1);
        if (testDoor.style === 'slide') {
            const slide = p * 3.1;
            testDoor.leftPanel.position.x = -1.525 - slide;
            testDoor.rightPanel.position.x = 1.525 + slide;
        } else if (testDoor.style === 'wipe') {
            testDoor.leftPanel.scale.x = closed;
            testDoor.rightPanel.scale.x = closed;
            testDoor.leftPanel.position.x = -1.525 + 0.7625 * p;
            testDoor.rightPanel.position.x = 1.525 - 0.7625 * p;
        } else {
            testDoor.leftPanel.scale.set(closed, closed, 1);
            testDoor.rightPanel.scale.set(closed, closed, 1);
        }
    }

    function updateDoor(dt) {
        if (!testDoor.mesh) return;
        const toDoor = testDoor.mesh.position.clone().sub(ship.position);
        const distance = toDoor.length();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion).normalize();
        const facing = distance > 0 ? forward.dot(toDoor.normalize()) : -1;
        if (testDoor.state === 'CLOSED' && distance < testDoor.openDistance && facing > 0.72) beginDoorOpening('LOCAL');
        if (testDoor.state === 'OPENING') {
            testDoor.progress = Math.min(1, testDoor.progress + dt * testDoor.speed);
            applyDoorVisual();
            if (testDoor.progress >= 1) { testDoor.state = 'OPEN'; testDoor.closeTimer = 0; }
            return;
        }
        if (testDoor.state === 'OPEN') {
            if (distance > 5) { testDoor.closeTimer += dt; if (testDoor.closeTimer >= 4) beginDoorClosing(); }
            else testDoor.closeTimer = 0;
            return;
        }
        if (testDoor.state === 'CLOSING') {
            if (distance <= 5) { testDoor.state = 'OPEN'; testDoor.closeTimer = 0; return; }
            testDoor.progress = Math.max(0, testDoor.progress - dt * testDoor.speed);
            applyDoorVisual();
            if (testDoor.progress <= 0) { testDoor.state = 'CLOSED'; testDoor.closeTimer = 0; applyDoorVisual(); }
        }
    }

    function beginDoorOpening(reason) {
        if (testDoor.state !== 'CLOSED') return false;
        testDoor.state = 'OPENING';
        testDoor.closeTimer = 0;
        testDoor.style = ['slide', 'wipe', 'iris'][Math.floor(Math.random() * 3)];
        applyDoorVisual();
        status.textContent = reason === 'REMOTE' ? 'DOOR CRYSTAL · REMOTE OPEN · ' + testDoor.style.toUpperCase() : 'DOOR · AUTO OPEN · ' + testDoor.style.toUpperCase();
        return true;
    }

    function beginDoorClosing() {
        if (testDoor.state !== 'OPEN') return false;
        testDoor.state = 'CLOSING';
        testDoor.closeTimer = 0;
        status.textContent = 'DOOR · CLOSING · ' + testDoor.style.toUpperCase();
        return true;
    }

    function tryRemoteDoor() {
        if (!running || !testDoor.mesh || testDoor.state !== 'CLOSED') return false;
        const toDoor = testDoor.mesh.position.clone().sub(ship.position);
        const distance = toDoor.length();
        if (distance > testDoor.remoteDistance) { status.textContent = 'DOOR CRYSTAL · OUT OF RANGE'; return false; }
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion).normalize();
        const facing = distance > 0 ? forward.dot(toDoor.normalize()) : -1;
        if (facing < testDoor.remoteFacing) { status.textContent = 'DOOR CRYSTAL · AIM AT DOOR'; return false; }
        return beginDoorOpening('REMOTE');
    }
    function resolveCollision() {
        const xLimit = 5.35;
        const yLimit = 3.25;
        const radius = 0.32;

        if (ship.position.x < -xLimit) {
            ship.position.x = -xLimit;
            if (ship.velocity.x < 0) ship.velocity.x *= -0.2;
        }

        if (ship.position.x > xLimit) {
            ship.position.x = xLimit;
            if (ship.velocity.x > 0) ship.velocity.x *= -0.2;
        }

        if (ship.position.y < -yLimit) {
            ship.position.y = -yLimit;
            if (ship.velocity.y < 0) ship.velocity.y *= -0.2;
        }

        if (ship.position.y > yLimit) {
            ship.position.y = yLimit;
            if (ship.velocity.y > 0) ship.velocity.y *= -0.2;
        }

        if (ship.position.z > room.firstMaxZ - radius) {
            ship.position.z = room.firstMaxZ - radius;
            if (ship.velocity.z > 0) ship.velocity.z *= -0.2;
        }

        if (ship.position.z < room.backZ + radius) {
            ship.position.z = room.backZ + radius;
            if (ship.velocity.z < 0) ship.velocity.z *= -0.2;
        }

        const inDoor =
            Math.abs(ship.position.x) < 3.0 &&
            Math.abs(ship.position.y) < 3.0;

        if (
            inDoor &&
            testDoor.state !== 'OPEN' &&
            testDoor.progress < 0.85 &&
            ship.position.z < -18 + radius &&
            ship.position.z > -19.3 &&
            ship.velocity.z < 0
        ) {
            ship.position.z = -18 + radius;
            ship.velocity.z = Math.max(0, ship.velocity.z * -0.08);
        }
    }

    function updateInteraction() {
        if (!interaction) return;

        const portalDistance = ship.position.distanceTo(portal.position);

        if (portalDistance < 9.0) {
            const forward = new THREE.Vector3(0, 0, -1)
                .applyQuaternion(ship.quaternion)
                .normalize();
            const toPortal = portal.position.clone().sub(ship.position);
            const facing = toPortal.length()
                ? forward.dot(toPortal.normalize())
                : 1;

            if (facing > 0.35) {
                interaction.textContent =
                    'PORTAL → ROOM 2 · G / Y ACTIVATE';
                return;
            }
        }

        if (
            testDoor.mesh &&
            testDoor.state === 'CLOSED'
        ) {
            const doorDistance = ship.position.distanceTo(testDoor.mesh.position);

            if (doorDistance < 30) {
                interaction.textContent = 'DOOR · R / ◆ OPEN';
                return;
            }
        }

        interaction.textContent = '';
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

        if (event.code === 'Escape') {
            if (document.pointerLockElement === canvas && document.exitPointerLock) {
                document.exitPointerLock();
            }
            pointerLocked = false;
            return;
        }

        if (event.code === 'Enter' && !event.repeat) {
            event.preventDefault();
            toggleSettings();
            return;
        }

        if (event.code === 'KeyF' && !event.repeat) {
            event.preventDefault();
            toggleShield();
            return;
        }

        if (event.code === 'Space' || event.code === 'ControlLeft') {
            event.preventDefault();
        }

        if (event.code === 'KeyR') {
            event.preventDefault();
            tryRemoteDoor();
        }

        if (event.code === 'KeyG') {
            event.preventDefault();
            startPortalTransition(true);
        }
    }

    function handleKeyUp(event) {
        keys[event.code] = false;
    }

    function toggleShield() {
        shieldEnabled = !shieldEnabled;
        status.textContent = shieldEnabled ? 'SHIELD · ON' : 'SHIELD · OFF';
        return shieldEnabled;
    }

    function applyGraphicsQuality() {
        if (!renderer) return;

        const dpr = window.devicePixelRatio || 1;

        if (settingsState.quality === 'low') {
            renderer.setPixelRatio(Math.min(dpr, 0.85));
        } else if (settingsState.quality === 'medium') {
            renderer.setPixelRatio(Math.min(dpr, 1.0));
        } else {
            renderer.setPixelRatio(Math.min(dpr, 1.5));
        }

        resize();
    }

    function updateSettingsControls() {
        if (!settingsPanel) return;

        const volume = settingsPanel.querySelector('[data-setting="volume"]');
        const quality = settingsPanel.querySelector('[data-setting="quality"]');
        const effects = settingsPanel.querySelector('[data-setting="effects"]');
        const invertPitch = settingsPanel.querySelector('[data-setting="invertPitch"]');
        const invertYaw = settingsPanel.querySelector('[data-setting="invertYaw"]');

        if (volume) volume.value = String(settingsState.volume);
        if (quality) quality.value = settingsState.quality;
        if (effects) effects.checked = settingsState.effects;
        if (invertPitch) invertPitch.checked = settingsState.invertPitch;
        if (invertYaw) invertYaw.checked = settingsState.invertYaw;

        if (musicAudio) {
            musicAudio.volume = settingsState.volume / 100;
        }

        if (starfield) {
            starfield.visible = settingsState.effects;
        }

        applyGraphicsQuality();
    }

    function setSettingsOpen(open, fromHistory = false) {
        if (!settingsPanel) return;

        settingsState.open = !!open;

        settingsPanel.hidden = !settingsState.open;
        root.classList.toggle('settings-open', settingsState.open);
        updateSettingsControls();

        if (
            settingsState.open &&
            !fromHistory &&
            window.history &&
            history.pushState &&
            !(history.state && history.state.bcmMiniSimSettings)
        ) {
            history.pushState(
                { bcmMiniSimSettings: true },
                '',
                window.location.href
            );
            settingsState.historyPushed = true;
        }

        if (!settingsState.open && settingsState.historyPushed) {
            const shouldGoBack =
                !fromHistory &&
                history.state &&
                history.state.bcmMiniSimSettings;

            settingsState.historyPushed = false;

            if (shouldGoBack) {
                history.back();
            }
        }
    }

    function toggleSettings() {
        setSettingsOpen(!settingsState.open);
    }

    function setupSettings() {
        if (!settingsPanel) return;

        updateSettingsControls();

        settingsPanel.querySelectorAll('[data-setting]').forEach(control => {
            if (control.getAttribute('data-setting') === 'close') return;

            control.addEventListener('input', () => {
                const key = control.getAttribute('data-setting');

                if (key === 'volume') {
                    settingsState.volume = Number(control.value) || 0;
                } else if (key === 'quality') {
                    settingsState.quality = control.value;
                } else if (key === 'effects') {
                    settingsState.effects = !!control.checked;
                } else if (key === 'invertPitch') {
                    settingsState.invertPitch = !!control.checked;
                } else if (key === 'invertYaw') {
                    settingsState.invertYaw = !!control.checked;
                }

                updateSettingsControls();
            });
        });

        if (settingsCloseButton) {
            settingsCloseButton.addEventListener('click', event => {
                event.preventDefault();
                setSettingsOpen(false);
            });
        }

        window.addEventListener('popstate', () => {
            if (settingsState.open) {
                setSettingsOpen(false, true);
            }
        });
    }

    function setupInput() {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('resize', resize);
        window.addEventListener('deviceorientation', handleDeviceOrientation, true);

        window.addEventListener('gamepadconnected', event => {
            if (gamepad.index < 0) {
                gamepad.index = event.gamepad.index;
            }
        });

        window.addEventListener('gamepaddisconnected', event => {
            if (event.gamepad.index === gamepad.index) {
                gamepad.index = -1;
            }
        });

        canvas.addEventListener('click', () => {
            if (!running || !canvas.requestPointerLock) return;
            canvas.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            pointerLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', event => {
            if (!pointerLocked) return;

            const sensitivity = 0.0029;

            ship.angularVelocity.y -= event.movementX * sensitivity;
            ship.angularVelocity.x -= event.movementY * (sensitivity * 1.18);
        });

        root.querySelectorAll('.bcm-mini-sim-mobile button').forEach(button => {
            const control = button.dataset.control;

            const down = event => {
                event.preventDefault();

                if (!running && control !== 'tilt') return;

                if (control === 'tilt') {
                    enableTiltControl();
                    return;
                }

                if (control === 'shield') {
                    toggleShield();
                    return;
                }

                if (control === 'portal') {
                    startPortalTransition(true);
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
                tryRemoteDoor();
            });
        }

        if (musicButton) {
            musicButton.addEventListener('click', event => {
                event.preventDefault();

                if (!running || !musicAudio || !config.musicUrl) return;

                musicAudio.muted = !musicAudio.muted;

                if (!musicAudio.muted) {
                    startMusic();
                }

                updateMusicButton();
            });
        }

        startButton.addEventListener('click', async () => {
            if (!renderer) return;

            running = true;
            startMusic();
            root.classList.add('game-active');
            startButton.classList.add('hidden');

            if (
                screen.orientation &&
                screen.orientation.lock
            ) {
                screen.orientation.lock('landscape').catch(() => {});
            }

            status.textContent = 'FLIGHT ACTIVE · 6DOF READY';

            canvas.focus();

            if (canvas.requestPointerLock && !('ontouchstart' in window)) {
                canvas.requestPointerLock();
            }
        });

    }

    function updateMusicButton() {
        if (!musicButton || !musicAudio) return;

        musicButton.textContent = musicAudio.muted ? '🔇' : '♫';
        musicButton.title = musicAudio.muted
            ? 'Включить музыку'
            : 'Выключить музыку';
    }

    function startMusic() {
        if (!running || !musicAudio || !config.musicUrl || musicAudio.muted) {
            return;
        }

        if (!musicAudio.src) {
            musicAudio.src = config.musicUrl;
        }

        musicAudio.loop = true;
        musicAudio.volume = settingsState.volume / 100;
        musicAudio.preload = 'auto';

        const promise = musicAudio.play();

        if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
        }

        updateMusicButton();
    }

    function setupMedia() {
        if (menuBackdrop && config.menuBackgroundUrl) {
            menuBackdrop.style.backgroundImage =
                'url("' + String(config.menuBackgroundUrl).replace(/"/g, '\\\"') + '")';
        }

        if (!musicAudio || !config.musicUrl) {
            if (musicButton) musicButton.hidden = true;
            return;
        }

        musicAudio.src = config.musicUrl;
        musicAudio.loop = true;
        musicAudio.volume = settingsState.volume / 100;
        musicAudio.preload = 'auto';

        updateMusicButton();
        // OST starts only from the Play button.
    }

    function updatePhysics(dt) {
        if (settingsState.open) {
            updateGamepad();
            camera.position.copy(ship.position);
            camera.quaternion.copy(ship.quaternion);
            light.position.copy(ship.position);
            return;
        }

        if (transitionBusy) {
            camera.position.copy(ship.position);
            camera.quaternion.copy(ship.quaternion);
            light.position.copy(ship.position);
            return;
        }

        updateDoor(dt);

        let input;
        try { input = inputAxes(); } catch (error) { console.warn('BCM input/gamepad error:', error); input = { thrust: 0, strafe: 0, vertical: 0, roll: 0, yaw: 0, tiltPitch: 0 }; }

        // Preserve the original aircraft-style right-stick Y:
        // physical stick DOWN => look UP; physical stick UP => look DOWN.
        if (gamepad.pad) {
            // Aircraft-style Y is intentionally preserved:
            // stick DOWN = look UP, stick UP = look DOWN.
            ship.angularVelocity.x += gamepad.rightY * 2.0 * dt;
        }

        ship.angularVelocity.x += input.tiltPitch * 2.0 * dt;

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
        resolveCollision();

        ship.angularVelocity.x *= Math.max(0, 1 - ship.angularDrag * dt);
        ship.angularVelocity.y *= Math.max(0, 1 - ship.angularDrag * dt);
        ship.angularVelocity.z *= Math.max(0, 1 - ship.angularDrag * dt);

        const angularInput = new THREE.Vector3(
            0,
            input.yaw * 1.85,
            input.roll * 2.7
        );

        ship.angularVelocity.addScaledVector(angularInput, dt);

        if (ship.angularVelocity.lengthSq() > 0.0000001) {
            const angle = ship.angularVelocity.length() * dt;
            const axis = ship.angularVelocity.clone().normalize();
            const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);

            ship.quaternion.multiply(dq).normalize();
        }

        camera.position.copy(ship.position);
        camera.quaternion.copy(ship.quaternion);
        light.position.copy(ship.position);

        updateInteraction();

        const shieldText = shieldEnabled ? 'ON' : 'OFF';
        const roomText = ship.position.z < room.roomJoinZ ? 'ROOM 2' : 'ROOM 1';

        status.textContent =
            roomText +
            (tilt.enabled ? ' · TILT' : '') +
            ' · SPD ' + ship.velocity.length().toFixed(1) +
            ' · 6DOF · SHIELD ' + shieldText +
            ' · DOOR ' + testDoor.state;
    }

    function render(now) {
        const dt = Math.min((now - last) / 1000, 0.033);
        last = now;

        if (running) {
            updatePhysics(dt);
        }

        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }

    function startSimulator() {
        if (renderer) return;

        try {
            if (!window.THREE) {
                throw new Error('Three.js r128 is not available yet');
            }

            ship.position = new THREE.Vector3(0, 0, 0);
            ship.velocity = new THREE.Vector3();
            ship.angularVelocity = new THREE.Vector3();
            ship.quaternion = new THREE.Quaternion();

            renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: false,
                powerPreference: 'high-performance'
            });

            renderer.setPixelRatio(
                Math.min(window.devicePixelRatio || 1, 1.5)
            );

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x020308);

            camera = new THREE.PerspectiveCamera(75, 1, 0.05, 250);
            camera.position.copy(ship.position);

            const ambient = new THREE.HemisphereLight(
                0xadc7ff,
                0x17130f,
                1.4
            );
            scene.add(ambient);

            light = new THREE.PointLight(0xffffff, 14, 48);
            light.position.copy(ship.position);
            scene.add(light);

            // Keep fog off in this texture diagnostic stage. Supplied 720p
            // artwork must remain visible at the end of the corridor.
            scene.fog = null;

            const stars = new THREE.BufferGeometry();
            const points = [];

            for (let i = 0; i < 300; i++) {
                points.push(
                    (Math.random() - 0.5) * 400,
                    (Math.random() - 0.5) * 400,
                    (Math.random() - 0.5) * 400
                );
            }

            stars.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(points, 3)
            );

            starfield = new THREE.Points(
                stars,
                new THREE.PointsMaterial({
                    color: 0xffffff,
                    size: 0.7,
                    sizeAttenuation: true
                })
            );
            scene.add(starfield);

            buildWorld();
            buildSecondRoomArrivalMarker();
            createPortalTransitionUI();
            setupMedia();
            setupSettings();
            setupInput();
            resize();

            status.textContent = 'ENGINE READY · LOCAL r128 · 0.5.1';
            updateAssetStatus();

            requestAnimationFrame(render);
        } catch (error) {
            console.error('BCM Mini Sim startup error:', error);
            status.textContent =
                'ERROR: ' + (error && error.message
                    ? error.message
                    : 'ENGINE START FAILED');
            startButton.disabled = true;
        }
    }

    // The portal is deliberately one station now. No old point-2 route
    // selector remains in this test build.
    setupMedia();
    updateAssetStatus();

    if (window.THREE) {
        startSimulator();
    } else {
        status.textContent = 'ENGINE LOADING LOCAL r128...';

        const localEngine = document.createElement('script');
        localEngine.src = config.threeUrl || '';
        localEngine.async = false;

        localEngine.onload = () => {
            if (window.THREE) {
                startSimulator();
            } else {
                status.textContent = 'ERROR: Three.js r128 did not initialize';
                startButton.disabled = true;
            }
        };

        localEngine.onerror = () => {
            status.textContent = 'ERROR: Local Three.js r128 could not be loaded';
            startButton.disabled = true;
        };

        document.head.appendChild(localEngine);
    }
})();