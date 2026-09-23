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

    function findAssetRecord(name, type) {
        const wanted = String(name).toLowerCase();
        const keys = Object.keys(assetByName);

        for (const key of keys) {
            const asset = assetByName[key];
            if (
                key.toLowerCase() === wanted &&
                (!type || asset.type === type)
            ) {
                return asset;
            }
        }

        const wantedBase = wanted.replace(/\.[^.]+$/i, '');

        for (const key of keys) {
            const asset = assetByName[key];
            if (type && asset.type !== type) continue;

            const base = key
                .toLowerCase()
                .replace(/\.[^.]+$/i, '');

            if (base === wantedBase) {
                return asset;
            }
        }

        return null;
    }

    function findExactAsset(name) {
        const asset = findAssetRecord(name);
        return asset ? asset.url : '';
    }

    function findImageAsset(name) {
        const requested = String(name);
        const exact = findAssetRecord(requested, 'image');

        if (exact) return exact.url;

        const base = requested.replace(/\.[^.]+$/i, '');
        const extensions = ['webp', 'jpg', 'jpeg', 'png', 'gif'];

        for (const extension of extensions) {
            const asset = findAssetRecord(base + '.' + extension, 'image');
            if (asset) return asset.url;
        }

        return '';
    }

    function findVideoAsset(name) {
        const asset = findAssetRecord(name, 'video');
        if (!asset) return null;

        return {
            record: asset,
            url: asset.streamUrl || asset.url,
            directUrl: asset.url
        };
    }

    function findAsset(name) {
        const image = findAssetRecord(name, 'image');
        if (image) return image.url;

        const video = findAssetRecord(name, 'video');
        if (video) return video.url;

        return findExactAsset(name);
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
        speed: 1.8,
        mesh: null,
        leftPanel: null,
        rightPanel: null,
        frameParts: [],
        mode: 'slide',
        closeSpeed: 2.2,
        awayTimer: 0
    };

    const portal = {
        point: 'PORTAL 1 → ROOM 2',
        image: 'portal1.png',
        video: 'portal1.mp4',
        position: null,
        mesh: null,
        surface: null,
        width: 4.8,
        height: 6.0,
        targetRoom: 1,
        targetPosition: [0, 0, -47.0],
        randomPairs: [
            { image: 'portal1.png', video: 'portal1.mp4', label: 'PORTAL 1' },
            { image: 'portal2.png', video: 'portal2.mp4', label: 'PORTAL 2' },
            { image: 'portal3.png', video: 'portal3.mp4', label: 'PORTAL 3' }
        ],
        serial: 0,
        randomTimer: 0,
        lastRandomKey: ''
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

    const graphicsSettings = {
        quality: 'high',
        effects: true
    };

    const menuState = {
        open: false,
        historyArmed: false
    };

    let musicStarted = false;
    let mediaTransitionSerial = 0;

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

    const room = {
        current: 0,
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

    function setImageTexture(texture, image, targetWidth, targetHeight) {
        // All supplied 720p/NPOT images use safe WebGL-compatible wrapping.
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

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

        if ('encoding' in texture && THREE.sRGBEncoding !== undefined) {
            texture.encoding = THREE.sRGBEncoding;
        }

        texture.needsUpdate = true;
    }

    function loadImageTexture(name, url, onReady, onError, options = {}) {
        const existing = textureRecords[name];

        const makeTexture = (source, imageMeta) => {
            const texture = new THREE.Texture(source);

            if (options.repeat) {
                setImageTexture(
                    texture,
                    imageMeta,
                    options.targetWidth || 1,
                    options.targetHeight || 1,
                    options.repeat
                );
            } else {
                setImageTexture(
                    texture,
                    imageMeta,
                    options.targetWidth || imageMeta.width,
                    options.targetHeight || imageMeta.height
                );
            }

            return texture;
        };

        if (existing) {
            if (existing.source) {
                if (onReady) onReady(
                    makeTexture(existing.source, existing.image),
                    existing.image
                );
            } else if (existing.failed) {
                if (onError) onError(new Error('IMAGE_ASSET_FAILED'));
            } else {
                existing.callbacks.push({ onReady, onError, options });
            }

            return;
        }

        const record = {
            source: null,
            image: null,
            failed: false,
            callbacks: [{ onReady, onError, options }]
        };

        textureRecords[name] = record;
        textureStats.total++;
        updateAssetStatus();

        const image = new Image();
        image.decoding = 'async';
        image.crossOrigin = 'anonymous';

        const fail = error => {
            record.failed = true;
            textureStats.failed++;
            textureStats.loaded++;
            textureStats.failedNames.push(name);
            updateAssetStatus();

            record.callbacks.forEach(callback => {
                if (callback.onError) callback.onError(error);
            });
            record.callbacks.length = 0;
        };

        image.onload = () => {
            try {
                let source = image;
                let width = image.naturalWidth || image.width;
                let height = image.naturalHeight || image.height;

                if (!width || !height) {
                    throw new Error('IMAGE_DIMENSIONS_MISSING');
                }

                const qualityMax =
                    graphicsSettings.quality === 'low'
                        ? 768
                        : graphicsSettings.quality === 'medium'
                            ? 1280
                            : 2048;

                const maxDimension = Math.min(
                    qualityMax,
                    renderer && renderer.capabilities
                        ? renderer.capabilities.maxTextureSize
                        : qualityMax
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
                    context.imageSmoothingQuality =
                        graphicsSettings.quality === 'low' ? 'medium' : 'high';
                    context.drawImage(image, 0, 0, width, height);
                    source = scaled;
                }

                record.source = source;
                record.image = { width, height };
                record.failed = false;

                textureStats.loaded++;
                updateAssetStatus();

                record.callbacks.forEach(callback => {
                    if (callback.onReady) {
                        callback.onReady(
                            makeTexture(source, record.image),
                            record.image
                        );
                    }
                });
                record.callbacks.length = 0;
            } catch (error) {
                fail(error);
            }
        };

        image.onerror = () => {
            fail(new Error('IMAGE_LOAD_FAILED'));
        };

        image.src = url;
    }
    function wallMaterial(name, fallback = 0x58616c, targetWidth = 1, targetHeight = 1) {
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
                targetHeight
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

        addPlane(
            parent,
            0,
            -3.5,
            options.centerZ,
            options.width,
            options.length,
            -Math.PI / 2,
            0,
            0,
            floorMat
        );

        const hasRoof = ['roof.png', 'roof1.png', 'roof2.png', 'roof3.png']
            .some(name => !!findImageAsset(name));

        const roofNames = hasRoof
            ? ['roof.png', 'roof1.png', 'roof2.png', 'roof3.png']
            : [options.ceiling];

        const roofEndNames = [
            'roofa.png',
            'roofa1.png',
            'roofa2.png',
            'roofa3.png'
        ];

        const segmentLength = 6;
        const startZ = options.centerZ - options.length / 2;
        const endZ = options.centerZ + options.length / 2;
        let index = 0;

        for (let z = startZ + segmentLength / 2; z < endZ - 0.01; z += segmentLength) {
            const remaining = endZ - z;
            const len = Math.min(segmentLength, remaining + segmentLength / 2);
            const isFirst = index === 0;
            const isLast = z + segmentLength / 2 >= endZ - 0.01;

            const desired =
                isFirst || isLast
                    ? roofEndNames[index % roofEndNames.length]
                    : roofNames[index % roofNames.length];

            const roofName = findImageAsset(desired)
                ? desired
                : roofNames[index % roofNames.length];

            addPlane(
                parent,
                0,
                3.5,
                z,
                options.width,
                Math.max(0.4, Math.min(segmentLength, len)),
                Math.PI / 2,
                0,
                0,
                wallMaterial(
                    roofName,
                    options.ceilingColor,
                    options.width,
                    Math.max(0.4, Math.min(segmentLength, len))
                )
            );

            index++;
        }

        const structure = new THREE.MeshStandardMaterial({
            color: options.structureColor,
            metalness: 0.82,
            roughness: 0.28
        });

        for (
            let z = startZ + 2;
            z < endZ;
            z += 6
        ) {
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
            endZ - 0.28,
            options.width,
            options.height,
            0,
            0,
            0,
            accent
        );
    }
    function buildWorld() {
        const world = new THREE.Group();

        buildTexturedRoom(world, {
            centerZ: -13,
            width: 12,
            length: 38,
            height: 8,
            floor: 'wall1.png',
            ceiling: 'wall2.png',
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

        buildTexturedRoom(world, {
            centerZ: -58,
            width: 12,
            length: 32,
            height: 8,
            floor: 'wall4.png',
            ceiling: 'wall1.png',
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
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1
        });

        const rightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1
        });

        const left = addPlane(group, -1.525, 0, -0.39, 3.05, 6.1, 0, 0, 0, leftMaterial);
        const right = addPlane(group, 1.525, 0, -0.39, 3.05, 6.1, 0, 0, 0, rightMaterial);

        const doorUrl = config.doorTexture || '';

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

        applyDoorAnimation();
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

        const width = portal.width;
        const height = portal.height;

        addBeam(group, 0, 3.32, 0, 4.5, 0.52, 0.45, frameMaterial);
        addBeam(group, 0, -3.32, 0, 4.5, 0.52, 0.45, frameMaterial);
        addBeam(group, -2.42, 0, 0, 0.52, 6.1, 0.45, frameMaterial);
        addBeam(group, 2.42, 0, 0, 0.52, 6.1, 0.45, frameMaterial);

        const opening = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });

        const surface = addPlane(
            group,
            0,
            0,
            -0.18,
            width,
            height,
            0,
            0,
            0,
            opening
        );

        portal.position = group.position.clone();
        portal.mesh = group;
        portal.surface = surface;

        scene.add(group);

        applyPortalAppearance();
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

    function applyPortalAppearance() {
        if (!portal.surface) return;

        portal.serial++;
        const serial = portal.serial;
        const imageUrl = findImageAsset(portal.image);
        const imageName = portal.image;

        portal.surface.material.map = null;
        portal.surface.material.color.set(0xffffff);
        portal.surface.material.needsUpdate = true;

        if (!imageUrl) {
            status.textContent =
                'PORTAL · ' + imageName + ' MISSING · WAITING / FALLBACK AVAILABLE';
            return;
        }

        loadImageTexture(
            'portal-image-source',
            imageUrl,
            texture => {
                if (serial !== portal.serial || portal.surface === null) return;

                portal.surface.material.map = texture;
                portal.surface.material.color.set(0xffffff);
                portal.surface.material.needsUpdate = true;
            },
            () => {
                if (serial !== portal.serial) return;
                portal.surface.material.map = null;
                portal.surface.material.color.set(0xffffff);
                portal.surface.material.needsUpdate = true;
            },
            {
                targetWidth: portal.width,
                targetHeight: portal.height
            }
        );
    }

    function availablePortalPairs() {
        return portal.randomPairs.filter(pair =>
            !!findAssetRecord(pair.image, 'image') &&
            !!findAssetRecord(pair.video, 'video')
        );
    }

    function randomizeStartPortal(forceInitial) {
        const ready = availablePortalPairs();
        const canonicalFirst = portal.randomPairs[0];

        const firstReady =
            !!findAssetRecord(canonicalFirst.image, 'image') &&
            !!findAssetRecord(canonicalFirst.video, 'video');

        if (forceInitial && firstReady) {
            portal.image = canonicalFirst.image;
            portal.video = canonicalFirst.video;
            portal.point = canonicalFirst.label + ' → ROOM 2';
            portal.lastRandomKey = portal.image + '|' + portal.video;
            portal.randomTimer = 0;
            applyPortalAppearance();
            return true;
        }

        if (forceInitial) {
            const legacyImage = findAssetRecord('portal.png', 'image');
            const legacyVideo = findAssetRecord('portal2.mp4', 'video');

            if (legacyImage && legacyVideo) {
                portal.image = legacyImage.name;
                portal.video = legacyVideo.name;
                portal.point = 'PORTAL 1 FALLBACK → ROOM 2';
                portal.lastRandomKey = portal.image + '|' + portal.video;
                portal.randomTimer = 0;
                applyPortalAppearance();
                return true;
            }
        }

        if (!ready.length) {
            portal.image = canonicalFirst.image;
            portal.video = canonicalFirst.video;
            portal.point = canonicalFirst.label + ' → ROOM 2';
            portal.randomTimer = 0;
            applyPortalAppearance();
            return false;
        }

        let selected = ready[0];

        if (!forceInitial) {
            const choices = ready.filter(pair => {
                const key = pair.image + '|' + pair.video;
                return key !== portal.lastRandomKey;
            });

            const pool = choices.length ? choices : ready;
            selected = pool[Math.floor(Math.random() * pool.length)];
        }

        portal.image = selected.image;
        portal.video = selected.video;
        portal.point = selected.label + ' → ROOM 2';
        portal.lastRandomKey = portal.image + '|' + portal.video;
        portal.randomTimer = 0;
        applyPortalAppearance();
        return true;
    }
    function getPortalScreenMetrics() {
        if (!portal.surface || !camera) {
            return { visibleRatio: 0 };
        }

        const geometry = portal.surface.geometry;
        geometry.computeBoundingBox();

        const min = geometry.boundingBox.min;
        const max = geometry.boundingBox.max;

        const corners = [
            new THREE.Vector3(min.x, min.y, 0),
            new THREE.Vector3(max.x, min.y, 0),
            new THREE.Vector3(max.x, max.y, 0),
            new THREE.Vector3(min.x, max.y, 0)
        ];

        const projected = corners.map(point => {
            portal.surface.localToWorld(point);
            return point.project(camera);
        });

        const minX = Math.min(...projected.map(p => p.x));
        const maxX = Math.max(...projected.map(p => p.x));
        const minY = Math.min(...projected.map(p => p.y));
        const maxY = Math.max(...projected.map(p => p.y));

        const fullWidth = Math.max(0.0001, maxX - minX);
        const fullHeight = Math.max(0.0001, maxY - minY);

        const clippedWidth = Math.max(
            0,
            Math.min(1, maxX) - Math.max(-1, minX)
        );
        const clippedHeight = Math.max(
            0,
            Math.min(1, maxY) - Math.max(-1, minY)
        );

        return {
            visibleRatio: Math.max(
                0,
                Math.min(
                    1,
                    (clippedWidth / fullWidth) *
                    (clippedHeight / fullHeight)
                )
            )
        };
    }
    function getAutoPortalCandidate() {
        if (
            room.current !== 0 ||
            !portal.position ||
            transitionBusy ||
            !findAssetRecord(portal.image, 'image') ||
            !findAssetRecord(portal.video, 'video')
        ) {
            return false;
        }

        const toPortal = portal.position.clone().sub(ship.position);
        const distance = toPortal.length();

        if (distance > 9.5) return false;

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const facing = distance
            ? forward.dot(toPortal.normalize())
            : 1;

        if (facing < 0.38) return false;

        return getPortalScreenMetrics().visibleRatio >= 0.69;
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

    function startPortalTransition(reason = 'G') {
        if (!running || transitionBusy) return false;
        if (!portal.position) return false;

        const distance = ship.position.distanceTo(portal.position);

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const toPortal = portal.position.clone().sub(ship.position);
        const facing = toPortal.length()
            ? forward.dot(toPortal.normalize())
            : 1;

        if (distance > 9.5 || facing < 0.30) {
            if (reason !== 'AUTO') {
                status.textContent = 'PORTAL · APPROACH AND FACE THE GATE';
            }
            return false;
        }

        const videoAsset = findVideoAsset(portal.video);

        if (!videoAsset) {
            status.textContent = 'PORTAL · VIDEO ' + portal.video + ' MISSING';
            return false;
        }

        transitionUI = transitionUI || createPortalTransitionUI();

        transitionBusy = true;
        mediaTransitionSerial++;
        const serial = mediaTransitionSerial;

        transitionUI.wrapper.hidden = false;
        transitionUI.label.textContent =
            'ПЕРЕХОД · ' + portal.point + (reason === 'AUTO' ? ' · AUTO 69%' : '');

        const video = transitionUI.video;
        const directUrl = videoAsset.directUrl;
        let activeUrl = videoAsset.url;
        let fallbackUsed = false;
        let settled = false;
        let timer = null;

        const cleanup = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }

            video.removeEventListener('ended', onEnded);
            video.removeEventListener('error', onError);
        };

        const finish = success => {
            if (settled || serial !== mediaTransitionSerial) return;
            settled = true;
            cleanup();

            video.pause();
            video.removeAttribute('src');
            video.load();
            transitionUI.wrapper.hidden = true;

            if (success) {
                ship.position.set(
                    portal.targetPosition[0],
                    portal.targetPosition[1],
                    portal.targetPosition[2]
                );
                ship.velocity.set(0, 0, 0);
                ship.angularVelocity.set(0, 0, 0);
                ship.quaternion.identity();
                room.current = portal.targetRoom;

                status.textContent = 'ROOM 2 · ARRIVED · VIDEO COMPLETE';
            } else {
                status.textContent = 'PORTAL · VIDEO FAILED · FLIGHT CONTINUES';
            }

            transitionBusy = false;
            updateInteraction();
        };

        const onEnded = () => finish(true);

        const onError = () => {
            if (!fallbackUsed && activeUrl !== directUrl && directUrl) {
                fallbackUsed = true;
                activeUrl = directUrl;
                video.src = directUrl;
                video.load();
                playVideo();
                return;
            }

            finish(false);
        };

        const playVideo = () => {
            if (settled) return;

            const promise = video.play();

            if (promise && typeof promise.catch === 'function') {
                promise.catch(() => {
                    if (!video.muted) {
                        video.muted = true;
                        const retry = video.play();

                        if (retry && typeof retry.catch === 'function') {
                            retry.catch(() => finish(false));
                        }
                        return;
                    }

                    if (!fallbackUsed && activeUrl !== directUrl && directUrl) {
                        fallbackUsed = true;
                        activeUrl = directUrl;
                        video.src = directUrl;
                        video.load();
                        setTimeout(playVideo, 80);
                        return;
                    }

                    finish(false);
                });
            }
        };

        video.pause();
        video.removeAttribute('src');
        video.load();

        video.preload = 'auto';
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.muted = reason === 'AUTO';
        video.src = activeUrl;

        video.addEventListener('ended', onEnded);
        video.addEventListener('error', onError);

        try {
            video.currentTime = 0;
        } catch (error) {
            // Metadata has not arrived yet; the next load starts at 0 anyway.
        }

        status.textContent =
            'PORTAL VIDEO · ' + portal.video +
            (reason === 'AUTO' ? ' · AUTO' : ' · PLAYING');

        video.load();
        setTimeout(playVideo, 0);

        timer = setTimeout(() => {
            if (!video.readyState && !fallbackUsed && activeUrl !== directUrl && directUrl) {
                fallbackUsed = true;
                activeUrl = directUrl;
                video.src = directUrl;
                video.load();
                setTimeout(playVideo, 80);
                return;
            }

            if (!settled) finish(false);
        }, 15000);

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

            await new Promise(resolve => setTimeout(resolve, 180));

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

            status.textContent = 'TILT · NEUTRAL POSITION CALIBRATED';
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

    function getTiltMotion() {
        if (!tilt.enabled || !tilt.available) {
            return { pitch: 0, yaw: 0 };
        }

        const angle = getScreenAngle();
        let pitchDelta;
        let yawDelta;

        if (angle === 90) {
            pitchDelta = tilt.gamma - tilt.neutralGamma;
            yawDelta = tilt.beta - tilt.neutralBeta;
        } else if (angle === 270) {
            pitchDelta = -(tilt.gamma - tilt.neutralGamma);
            yawDelta = -(tilt.beta - tilt.neutralBeta);
        } else if (angle === 180) {
            pitchDelta = -(tilt.beta - tilt.neutralBeta);
            yawDelta = -(tilt.gamma - tilt.neutralGamma);
        } else {
            pitchDelta = tilt.beta - tilt.neutralBeta;
            yawDelta = tilt.gamma - tilt.neutralGamma;
        }

        return {
            // Aviation-style pitch: moving the top/front of the phone
            // downward produces positive pitch (nose up).
            pitch: applyDeadzone(-pitchDelta / 18, 0.06) * 1.55,
            // Normal left/right: tilt right means look right.
            yaw: applyDeadzone(-yawDelta / 18, 0.06) * 1.55
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

        const startPressed = buttonPressed(pad, 9);
        const startWasPressed = gamepad.previousButtons[9] === true;

        if (startPressed && !startWasPressed) {
            toggleSettings();
        }

        const selectPressed = buttonPressed(pad, 8);
        const selectWasPressed = gamepad.previousButtons[8] === true;

        if (selectPressed && !selectWasPressed) {
            toggleSettings();
        }

        const aPressed = buttonPressed(pad, 0);
        const aWasPressed = gamepad.previousButtons[0] === true;

        if (aPressed && !aWasPressed) {
            if (!running && menuState.open) {
                beginPlay();
            } else if (running) {
                tryRemoteDoor();
            }
        }

        const xPressed = buttonPressed(pad, 2);
        const xWasPressed = gamepad.previousButtons[2] === true;

        if (xPressed && !xWasPressed && running) {
            toggleShield();
        }

        const yPressed = buttonPressed(pad, 3);
        const yWasPressed = gamepad.previousButtons[3] === true;

        if (yPressed && !yWasPressed && running) {
            startPortalTransition('GAMEPAD');
        }

        for (let i = 0; i <= 9; i++) {
            gamepad.previousButtons[i] = buttonPressed(pad, i);
        }
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

        const look = getTiltMotion();

        const invertPitchControl =
            root.querySelector('[data-setting="invertPitch"]')?.checked !== false;

        const invertYawControl =
            !!root.querySelector('[data-setting="invertYaw"]')?.checked;

        let yaw =
            yawButtons -
            (gamepad.rightX * 0.95) +
            look.yaw;

        let pitch =
            (gamepad.rightY * 0.95) +
            look.pitch;

        if (!invertPitchControl) {
            pitch *= -1;
        }

        if (invertYawControl) {
            yaw *= -1;
        }

        return {
            thrust: Math.max(-1, Math.min(1, thrust - gamepad.leftY)),
            strafe: Math.max(-1, Math.min(1, strafe + gamepad.leftX)),
            vertical: Math.max(-1, Math.min(1, vertical + gamepad.vertical)),
            roll: Math.max(-1, Math.min(1, roll + gamepad.roll)),
            yaw,
            pitch
        };
    }
    function updateDoor(dt) {
        if (!testDoor.mesh) return;

        const toDoor = testDoor.mesh.position.clone().sub(ship.position);
        const distance = toDoor.length();

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const facing = distance > 0
            ? forward.dot(toDoor.normalize())
            : -1;

        if (
            testDoor.state === 'CLOSED' &&
            distance < testDoor.openDistance &&
            facing > 0.72
        ) {
            beginDoorOpening('LOCAL');
        }

        if (testDoor.state === 'OPENING') {
            testDoor.progress = Math.min(
                1,
                testDoor.progress + dt * testDoor.speed
            );

            if (testDoor.progress >= 1) {
                testDoor.progress = 1;
                testDoor.state = 'OPEN';
                testDoor.awayTimer = 0;
            }
        }

        if (testDoor.state === 'OPEN') {
            if (distance > 5.0) {
                testDoor.awayTimer = (testDoor.awayTimer || 0) + dt;

                if (testDoor.awayTimer >= 4.0) {
                    testDoor.state = 'CLOSING';
                    testDoor.closeSpeed = Math.max(
                        1.0,
                        testDoor.speed * 1.35
                    );
                }
            } else {
                testDoor.awayTimer = 0;
            }
        }

        if (testDoor.state === 'CLOSING') {
            testDoor.progress = Math.max(
                0,
                testDoor.progress - dt * (testDoor.closeSpeed || 1.8)
            );

            if (testDoor.progress <= 0) {
                testDoor.progress = 0;
                testDoor.state = 'CLOSED';
                testDoor.awayTimer = 0;
            }
        }

        applyDoorAnimation();
    }
    function applyDoorAnimation() {
        if (!testDoor.leftPanel || !testDoor.rightPanel) return;

        const p = Math.max(0, Math.min(1, testDoor.progress));
        const mode = testDoor.mode || 'slide';

        testDoor.leftPanel.position.set(-1.525, 0, -0.39);
        testDoor.rightPanel.position.set(1.525, 0, -0.39);
        testDoor.leftPanel.rotation.set(0, 0, 0);
        testDoor.rightPanel.rotation.set(0, 0, 0);
        testDoor.leftPanel.scale.set(1, 1, 1);
        testDoor.rightPanel.scale.set(1, 1, 1);

        if (mode === 'slide') {
            testDoor.leftPanel.position.x -= p * 3.1;
            testDoor.rightPanel.position.x += p * 3.1;
        } else if (mode === 'vertical') {
            testDoor.leftPanel.position.y += p * 3.2;
            testDoor.rightPanel.position.y -= p * 3.2;
        } else if (mode === 'wipe') {
            testDoor.leftPanel.rotation.z = -p * Math.PI * 0.5;
            testDoor.rightPanel.rotation.z = p * Math.PI * 0.5;
            testDoor.leftPanel.position.x -= p * 1.2;
            testDoor.rightPanel.position.x += p * 1.2;
        } else if (mode === 'iris' || mode === 'shrink') {
            const scale = Math.max(0.06, 1 - p);
            testDoor.leftPanel.scale.set(scale, scale, 1);
            testDoor.rightPanel.scale.set(scale, scale, 1);
        } else if (mode === 'fade') {
            testDoor.leftPanel.material.opacity = 1 - p;
            testDoor.rightPanel.material.opacity = 1 - p;
        }

        const visibleOpacity = mode === 'fade' ? 1 - p : 1;
        testDoor.leftPanel.material.opacity = visibleOpacity;
        testDoor.rightPanel.material.opacity = visibleOpacity;
        testDoor.leftPanel.material.transparent = true;
        testDoor.rightPanel.material.transparent = true;
        testDoor.leftPanel.material.needsUpdate = true;
        testDoor.rightPanel.material.needsUpdate = true;
    }
    function beginDoorOpening(reason) {
        if (testDoor.state !== 'CLOSED') return false;

        const modes = ['slide', 'vertical', 'wipe', 'iris', 'fade'];
        testDoor.mode = modes[Math.floor(Math.random() * modes.length)];
        testDoor.speed = 1.45 + Math.random() * 1.0;
        testDoor.closeSpeed = testDoor.speed * 1.35;
        testDoor.awayTimer = 0;
        testDoor.progress = 0;
        testDoor.state = 'OPENING';

        status.textContent = reason === 'REMOTE'
            ? 'DOOR · RANDOM ' + testDoor.mode.toUpperCase() + ' · REMOTE'
            : 'DOOR · RANDOM ' + testDoor.mode.toUpperCase() + ' · AUTO';

        return true;
    }
    function tryRemoteDoor() {
        if (!running || !testDoor.mesh || testDoor.state !== 'CLOSED') {
            return false;
        }

        const toDoor = testDoor.mesh.position.clone().sub(ship.position);
        const distance = toDoor.length();

        if (distance > testDoor.remoteDistance) {
            status.textContent = 'DOOR CRYSTAL · OUT OF RANGE';
            return false;
        }

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const facing = distance > 0
            ? forward.dot(toDoor.normalize())
            : -1;

        if (facing < testDoor.remoteFacing) {
            status.textContent = 'DOOR CRYSTAL · AIM AT DOOR';
            return false;
        }

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
        if (event.code === 'Enter' || event.code === 'Escape') {
            event.preventDefault();
            toggleSettings();
            return;
        }

        keys[event.code] = true;

        if (event.code === 'Space' || event.code === 'ControlLeft') {
            event.preventDefault();
        }

        if (event.code === 'KeyR') {
            event.preventDefault();
            tryRemoteDoor();
        }

        if (event.code === 'KeyG') {
            event.preventDefault();
            startPortalTransition('G');
        }
    }
    function handleKeyUp(event) {
        keys[event.code] = false;
    }

    function openSettings(forceOpen = true) {
        const panel = root.querySelector('.bcm-mini-sim-settings');
        if (!panel) return;

        menuState.wasRunning = running;
        menuState.open = forceOpen;
        panel.hidden = !forceOpen;

        if (forceOpen) {
            running = false;

            if (document.pointerLockElement === canvas && document.exitPointerLock) {
                document.exitPointerLock();
            }

            root.classList.remove('game-active');
            startButton.classList.remove('hidden');
            status.textContent = 'MENU · SETTINGS';
        }
    }
    function toggleSettings(force) {
        if (typeof force === 'boolean') {
            if (force) {
                openSettings(true);
            } else {
                closeSettings();
            }
            return;
        }

        if (menuState.open) {
            closeSettings();
        } else {
            openSettings(true);
        }
    }

    function closeSettings() {
        const panel = root.querySelector('.bcm-mini-sim-settings');
        if (!panel) return;

        panel.hidden = true;
        menuState.open = false;

        if (menuState.wasRunning) {
            running = true;
            root.classList.add('game-active');
            startButton.classList.add('hidden');
            status.textContent = 'FLIGHT ACTIVE · 6DOF READY';
        } else {
            running = false;
            root.classList.remove('game-active');
            startButton.classList.remove('hidden');
            status.textContent = 'ENGINE READY · PRESS PLAY';
        }
    }
    function beginPlay() {
        if (!renderer) return;

        running = true;
        menuState.open = false;

        const panel = root.querySelector('.bcm-mini-sim-settings');
        if (panel) panel.hidden = true;

        root.classList.add('game-active');
        startButton.classList.add('hidden');

        if (!musicStarted) {
            musicStarted = true;
            if (musicAudio) musicAudio.muted = false;
            startMusic();
        }

        if (
            !menuState.historyArmed &&
            window.history &&
            typeof window.history.pushState === 'function'
        ) {
            window.history.pushState(
                { bcmMiniSim: true },
                '',
                window.location.href
            );
            menuState.historyArmed = true;
        }

        canvas.focus();

        if (canvas.requestPointerLock && !('ontouchstart' in window)) {
            canvas.requestPointerLock();
        }

        status.textContent = 'FLIGHT ACTIVE · 6DOF READY';
    }

    function toggleShield() {
        // Shield is a gameplay placeholder for now, but the control is fully
        // wired so gamepad/mobile/menu input cannot throw a ReferenceError.
        const enabled = !root.dataset.shieldDisabled;
        root.dataset.shieldDisabled = enabled ? '1' : '';
        status.textContent = enabled ? 'SHIELD · OFF' : 'SHIELD · ON';
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
            if (!running || !canvas.requestPointerLock || menuState.open) return;
            canvas.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            pointerLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', event => {
            if (!pointerLocked || !running || menuState.open || transitionBusy) return;

            const sensitivity = 0.0026;
            const invertPitch =
                root.querySelector('[data-setting="invertPitch"]')?.checked !== false;
            const invertYaw =
                !!root.querySelector('[data-setting="invertYaw"]')?.checked;

            let yaw = -event.movementX * sensitivity;
            let pitch = -event.movementY * (sensitivity * 1.12);

            if (!invertYaw) {
                // normal mouse left/right
            } else {
                yaw *= -1;
            }

            if (!invertPitch) {
                pitch *= -1;
            }

            ship.angularVelocity.y += yaw;
            ship.angularVelocity.x += pitch;
        });

        root.querySelectorAll('.bcm-mini-sim-mobile button').forEach(button => {
            const control = button.dataset.control;

            const down = async event => {
                event.preventDefault();

                if ((!running || transitionBusy) && control !== 'tilt') return;

                if (control === 'tilt') {
                    await enableTiltControl();
                    return;
                }

                if (control === 'shield') {
                    toggleShield();
                    return;
                }

                if (control === 'portal') {
                    startPortalTransition('MOBILE');
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

                if (!musicAudio || !config.musicUrl) return;

                musicStarted = true;
                musicAudio.muted = !musicAudio.muted;

                if (!musicAudio.muted) {
                    startMusic();
                } else {
                    musicAudio.pause();
                }

                updateMusicButton();
            });
        }

        startButton.addEventListener('click', () => {
            beginPlay();
        });

        root.querySelectorAll('[data-setting]').forEach(control => {
            control.addEventListener('change', () => {
                if (control.dataset.setting === 'volume') {
                    if (musicAudio) {
                        musicAudio.volume = Number(control.value) / 100;
                    }
                }

                if (control.dataset.setting === 'quality') {
                    graphicsSettings.quality = control.value;
                    status.textContent =
                        'QUALITY · ' + control.value.toUpperCase() +
                        ' · NEW TEXTURES USE THIS LEVEL';
                }

                if (control.dataset.setting === 'effects') {
                    graphicsSettings.effects = !!control.checked;
                }
            });
        });

        const closeButton = root.querySelector('[data-setting="close"]');
        if (closeButton) {
            closeButton.addEventListener('click', () => toggleSettings(false));
        }

        window.addEventListener('popstate', () => {
            if (menuState.historyArmed) {
                openSettings();
                window.history.pushState(
                    { bcmMiniSim: true },
                    '',
                    window.location.href
                );
            }
        });

        window.addEventListener('beforeunload', () => {
            if (musicAudio) musicAudio.pause();
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
        if (
            !musicAudio ||
            !config.musicUrl ||
            musicStarted === false
        ) {
            return;
        }

        if (!musicAudio.src) {
            musicAudio.src = config.musicUrl;
        }

        musicAudio.loop = true;
        musicAudio.volume = (Number(
            root.querySelector('[data-setting="volume"]')?.value || 42
        ) / 100);

        const promise = musicAudio.play();

        if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {
                // Browser policy can reject a programmatic retry. The next
                // explicit Play/music click will try again.
            });
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
        musicAudio.volume = 0.42;
        musicAudio.preload = 'none';
        musicAudio.muted = false;

        // Do NOT call play() here. Audio starts only after Play/music action.
        updateMusicButton();
    }
    function updatePhysics(dt) {
        if (transitionBusy || menuState.open || !running) {
            camera.position.copy(ship.position);
            camera.quaternion.copy(ship.quaternion);
            light.position.copy(ship.position);
            return;
        }

        updateDoor(dt);

        portal.randomTimer += dt;
        if (room.current === 0 && portal.randomTimer >= 4.0) {
            portal.randomTimer = 0;
            randomizeStartPortal(false);
        }

        const input = inputAxes();

        const angularInput = new THREE.Vector3(
            input.pitch * 2.1,
            input.yaw * 1.9,
            input.roll * 2.7
        );

        ship.angularVelocity.addScaledVector(angularInput, dt);

        const maxAngularSpeed = 3.6;
        if (ship.angularVelocity.length() > maxAngularSpeed) {
            ship.angularVelocity.setLength(maxAngularSpeed);
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
        resolveCollision();

        ship.angularVelocity.x *= Math.max(0, 1 - ship.angularDrag * dt);
        ship.angularVelocity.y *= Math.max(0, 1 - ship.angularDrag * dt);
        ship.angularVelocity.z *= Math.max(0, 1 - ship.angularDrag * dt);

        if (ship.angularVelocity.lengthSq() > 0.0000001) {
            const angle = ship.angularVelocity.length() * dt;
            const axis = ship.angularVelocity.clone().normalize();
            const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);

            ship.quaternion.multiply(dq).normalize();
        }

        camera.position.copy(ship.position);
        camera.quaternion.copy(ship.quaternion);
        light.position.copy(ship.position);

        if (
            getAutoPortalCandidate() &&
            !transitionBusy
        ) {
            startPortalTransition('AUTO');
            return;
        }

        updateInteraction();

        const roomText = room.current === 0 ? 'ROOM 1' : 'ROOM 2';

        status.textContent =
            roomText +
            (tilt.enabled ? ' · TILT LOOK' : '') +
            ' · SPD ' + ship.velocity.length().toFixed(1) +
            ' · 6DOF · DOOR ' + testDoor.state +
            ' · PORTAL ' + portal.point;
    }
    function render(now) {
        const dt = Math.min((now - last) / 1000, 0.033);
        last = now;

        if (running) {
            updatePhysics(dt);
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }

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
            room.current = 0;
            portal.randomTimer = 0;
            portal.lastRandomKey = '';

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

            scene.fog = null;

            const stars = new THREE.BufferGeometry();
            const points = [];

            for (let i = 0; i < 240; i++) {
                points.push(
                    (Math.random() - 0.5) * 400,
                    (Math.random() - 0.5) * 400,
                    (Math.random() - 0.5) * 400
                );
            }

            scene.add(new THREE.Points(
                stars,
                new THREE.PointsMaterial({
                    color: 0xffffff,
                    size: 0.7,
                    sizeAttenuation: true
                })
            ));

            stars.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(points, 3)
            );

            buildWorld();
            buildSecondRoomArrivalMarker();
            createPortalTransitionUI();
            setupMedia();
            setupInput();
            resize();

            randomizeStartPortal(true);

            status.textContent = 'ENGINE READY · LOCAL THREE.JS r128 · 0.4.2';
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
})();