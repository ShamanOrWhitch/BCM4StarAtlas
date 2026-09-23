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
        mode: 'split',
        textureName: '',
        closeDelay: 4,
        awayTimer: 0,
        mesh: null,
        leftPanel: null,
        rightPanel: null,
        frameParts: []
    };

    const portals = [
        {
            id: '1',
            point: 'PORTAL 1 → ROOM 2',
            image: 'portal.png',
            video: 'portal1.mp4',
            roomIndex: 0,
            targetRoom: 1,
            position: null,
            targetPosition: [0, 0, -40],
            mesh: null,
            surface: null,
            size: 4.8
        },
        {
            id: '2',
            point: 'PORTAL 2 → ROOM 3',
            image: 'portal2.png',
            video: 'portal2.mp4',
            roomIndex: 1,
            targetRoom: 2,
            position: null,
            targetPosition: [0, 0, -80],
            mesh: null,
            surface: null,
            size: 4.8
        },
        {
            id: '3',
            point: 'PORTAL 3 → ROOM 1',
            image: 'portal3.png',
            video: 'portal3.mp4',
            roomIndex: 2,
            targetRoom: 0,
            position: null,
            targetPosition: [0, 0, -10],
            mesh: null,
            surface: null,
            size: 4.8
        }
    ];

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

    const rooms = [
        {
            id: 'ROOM 1',
            centerZ: -13,
            length: 38,
            width: 12,
            height: 8,
            minZ: -32,
            maxZ: 6,
            floor: 'wall1.png',
            ceilingRoofs: ['roof.png', 'roof1.png', 'roof3.png'],
            ceilingEnds: ['roofa.png', 'roofa1.png', 'roofa2.png'],
            left: 'wall3.png',
            right: 'wall4.png',
            accent: 'wall5.png',
            floorColor: 0x46505b,
            leftColor: 0x3b444f,
            rightColor: 0x343d47,
            accentColor: 0x59636e,
            structureColor: 0x202731
        },
        {
            id: 'ROOM 2',
            centerZ: -53,
            length: 38,
            width: 12,
            height: 8,
            minZ: -72,
            maxZ: -34,
            floor: 'wall4.png',
            ceilingRoofs: ['roof1.png', 'roof3.png', 'roof.png'],
            ceilingEnds: ['roofa1.png', 'roofa2.png', 'roofa.png'],
            left: 'wall5.png',
            right: 'wall2.png',
            accent: 'wall3.png',
            floorColor: 0x343d48,
            leftColor: 0x48535e,
            rightColor: 0x3a444f,
            accentColor: 0x69727d,
            structureColor: 0x161d25
        },
        {
            id: 'ROOM 3',
            centerZ: -93,
            length: 38,
            width: 12,
            height: 8,
            minZ: -112,
            maxZ: -74,
            floor: 'wall3.png',
            ceilingRoofs: ['roof3.png', 'roof.png', 'roof1.png'],
            ceilingEnds: ['roofa2.png', 'roofa.png', 'roofa1.png'],
            left: 'wall2.png',
            right: 'wall4.png',
            accent: 'wall5.png',
            floorColor: 0x3b4650,
            leftColor: 0x414d58,
            rightColor: 0x303a44,
            accentColor: 0x5e6974,
            structureColor: 0x18212a
        }
    ];

    const room = {
        current: 0
    };

    let nearestPortal = null;
    let shieldEnabled = true;
    let introHintUntil = 0;

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
                if (options.repeat) {
                    setImageTexture(texture, image, options.targetWidth || 1, options.targetHeight || 1, options.repeat);
                } else {
                    setImageTexture(texture, image, options.targetWidth || width, options.targetHeight || height);
                }

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

    function buildTexturedCeiling(parent, options) {
        const segmentLength = 6;
        const seamWidth = 0.42;
        const startZ = options.centerZ - options.length / 2;
        const endZ = options.centerZ + options.length / 2;
        const count = Math.ceil(options.length / segmentLength);
        const roofs = options.ceilingRoofs || [];
        const ends = options.ceilingEnds || [];

        for (let i = 0; i < count; i++) {
            const z0 = startZ + i * segmentLength;
            const z1 = Math.min(z0 + segmentLength, endZ);
            const length = Math.max(0.25, z1 - z0);
            const isFirst = i === 0;
            const isLast = i === count - 1;

            const textureName = (isFirst || isLast)
                ? (ends.length
                    ? ends[(isFirst ? 0 : 1) % ends.length]
                    : (roofs.length ? roofs[i % roofs.length] : ''))
                : (roofs.length ? roofs[i % roofs.length] : '');

            const material = textureName
                ? wallMaterial(textureName, options.ceilingColor, options.width, length)
                : new THREE.MeshBasicMaterial({
                    color: options.ceilingColor,
                    side: THREE.DoubleSide,
                    fog: false
                });

            addPlane(
                parent,
                0,
                3.5,
                (z0 + z1) / 2,
                options.width,
                length,
                Math.PI / 2,
                0,
                0,
                material
            );

            if (i < count - 1 && ends.length) {
                const seamMaterial = wallMaterial(
                    ends[(i - 1 + ends.length) % ends.length],
                    options.ceilingColor,
                    options.width,
                    seamWidth
                );

                addPlane(
                    parent,
                    0,
                    3.505,
                    z1,
                    options.width,
                    seamWidth,
                    Math.PI / 2,
                    0,
                    0,
                    seamMaterial
                );
            }
        }
    }

    function buildTexturedRoom(parent, options) {
        const floorMat = wallMaterial(options.floor, options.floorColor, options.width, options.length);
        const leftMat = wallMaterial(options.left, options.leftColor, options.length, options.height);
        const rightMat = wallMaterial(options.right, options.rightColor, options.length, options.height);

        addPlane(parent, 0, -3.5, options.centerZ, options.width, options.length, -Math.PI / 2, 0, 0, floorMat);
        buildTexturedCeiling(parent, options);
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
    }

    function addPipe(parent, points, radius, color) {
        const curve = points.length === 2
            ? new THREE.LineCurve3(points[0], points[1])
            : new THREE.CatmullRomCurve3(points);

        const geometry = new THREE.TubeGeometry(
            curve,
            Math.max(36, points.length * 12),
            radius,
            8,
            false
        );

        const material = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.82,
            roughness: 0.27
        });

        parent.add(new THREE.Mesh(geometry, material));
    }

    function buildPipes(parent, options, index) {
        const c = options.centerZ;
        const variants = [
            {
                radius: 0.13,
                color: 0x77818b,
                points: [
                    new THREE.Vector3(-5.1, 2.45, c + 18),
                    new THREE.Vector3(-5.1, 2.45, c - 18)
                ]
            },
            {
                radius: 0.18,
                color: 0x8a6c49,
                points: [
                    new THREE.Vector3(4.9, 2.0, c + 18),
                    new THREE.Vector3(4.7, 1.8, c - 18)
                ]
            },
            {
                radius: 0.10,
                color: 0x4f6f77,
                points: [
                    new THREE.Vector3(-3.8, -2.5, c + 18),
                    new THREE.Vector3(1.2, -2.5, c - 18)
                ]
            },
            {
                radius: 0.22,
                color: 0x6e6260,
                points: [
                    new THREE.Vector3(2.4, 2.8, c + 18),
                    new THREE.Vector3(2.4, 2.65, c - 18)
                ]
            }
        ];

        if (index === 1) {
            variants.push({
                radius: 0.08,
                color: 0x687a56,
                points: [
                    new THREE.Vector3(-5.0, -1.9, c + 18),
                    new THREE.Vector3(-4.2, -1.4, c - 18)
                ]
            });
        }

        variants.forEach(v => addPipe(parent, v.points, v.radius, v.color));
    }

    function buildWorld() {
        const world = new THREE.Group();

        rooms.forEach((roomOptions, index) => {
            buildTexturedRoom(world, roomOptions);
            buildPipes(world, roomOptions, index);

            const wallMaterialObject = wallMaterial(
                roomOptions.accent,
                roomOptions.accentColor,
                12,
                8
            );

            buildPortalWall(world, roomOptions.minZ, wallMaterialObject);

            const endWall = wallMaterial(
                roomOptions.right,
                roomOptions.rightColor,
                12,
                8
            );

            buildEndWall(world, roomOptions.maxZ, endWall);
        });

        scene.add(world);

        buildDoor();
        portals.forEach(buildPortal);
    }

    function buildEndWall(parent, z, material) {
        addPlane(parent, 0, 0, z, 12, 8, 0, 0, 0, material);
    }

    function buildPortalWall(parent, z, material) {
        const portalWidth = 5.6;
        const portalHeight = 6.4;

        addBeam(parent, -4.65, 0, z, 2.7, 7.5, 0.5, material);
        addBeam(parent, 4.65, 0, z, 2.7, 7.5, 0.5, material);
        addBeam(parent, 0, (portalHeight / 2) + 0.62, z, 6.6, 1.0, 0.5, material);
        addBeam(parent, 0, -(portalHeight / 2) - 0.62, z, 6.6, 1.0, 0.5, material);
        return portalWidth;
    }

    function pickDoorTexture() {
        const candidates = [
            'door.png',
            'door1.png',
            'door2.png',
            'door3.png',
            'door4.png',
            'door5.png'
        ].filter(name => findImageAsset(name));

        return candidates.length
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : '';
    }

    function resetDoorVisual() {
        if (!testDoor.leftPanel || !testDoor.rightPanel) return;

        testDoor.leftPanel.position.set(-1.525, 0, -0.39);
        testDoor.rightPanel.position.set(1.525, 0, -0.39);
        testDoor.leftPanel.scale.set(1, 1, 1);
        testDoor.rightPanel.scale.set(1, 1, 1);
    }

    function applyDoorAnimation(progress) {
        if (!testDoor.leftPanel || !testDoor.rightPanel) return;

        const slide = progress * 3.15;

        if (testDoor.mode === 'vertical') {
            testDoor.leftPanel.position.set(-1.525, slide, -0.39);
            testDoor.rightPanel.position.set(1.525, -slide, -0.39);
        } else if (testDoor.mode === 'pocket') {
            testDoor.leftPanel.position.set(-1.525 - slide, 0, -0.39);
            testDoor.rightPanel.position.set(1.525 - slide, 0, -0.39);
        } else if (testDoor.mode === 'shrink') {
            testDoor.leftPanel.position.set(-1.525, 0, -0.39);
            testDoor.rightPanel.position.set(1.525, 0, -0.39);
            const scale = Math.max(0.02, 1 - progress);
            testDoor.leftPanel.scale.x = scale;
            testDoor.rightPanel.scale.x = scale;
        } else {
            testDoor.leftPanel.position.set(-1.525 - slide, 0, -0.39);
            testDoor.rightPanel.position.set(1.525 + slide, 0, -0.39);
        }
    }

    function buildDoor() {
        const group = new THREE.Group();
        group.position.set(0, 0, -18);

        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x242a32,
            metalness: 0.76,
            roughness: 0.4
        });

        addBeam(group, 0, 3.325, 0, 7.2, 0.55, 0.75, frameMaterial);
        addBeam(group, 0, -3.325, 0, 7.2, 0.55, 0.75, frameMaterial);
        const leftFrame = addBeam(group, -3.325, 0, 0, 0.55, 6.1, 0.75, frameMaterial);
        const rightFrame = addBeam(group, 3.325, 0, 0, 0.55, 6.1, 0.75, frameMaterial);

        testDoor.frameParts = [leftFrame, rightFrame];

        const leftMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            fog: false
        });
        const rightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            fog: false
        });

        const left = addPlane(group, -1.525, 0, -0.39, 3.05, 6.1, 0, 0, 0, leftMaterial);
        const right = addPlane(group, 1.525, 0, -0.39, 3.05, 6.1, 0, 0, 0, rightMaterial);

        const chosen = pickDoorTexture();
        testDoor.textureName = chosen;

        const doorUrl = chosen
            ? findImageAsset(chosen)
            : (config.doorTexture || '');

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
                {
                    targetWidth: 3.05,
                    targetHeight: 6.1
                }
            );
        }

        resetDoorVisual();

        scene.add(group);
        testDoor.mesh = group;
        testDoor.leftPanel = left;
        testDoor.rightPanel = right;
    }

    function buildPortal(portalState) {
        const group = new THREE.Group();
        const roomOptions = rooms[portalState.roomIndex];
        const portalZ = roomOptions.minZ + 0.28;

        group.position.set(0, 0, portalZ);

        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x5d6874,
            metalness: 0.88,
            roughness: 0.2,
            emissive: 0x09121b,
            emissiveIntensity: 0.95
        });

        const size = portalState.size;

        addBeam(group, 0, size / 2 + 0.28, 0, size + 0.72, 0.46, 0.45, frameMaterial);
        addBeam(group, 0, -(size / 2 + 0.28), 0, size + 0.72, 0.46, 0.45, frameMaterial);
        addBeam(group, -(size / 2 + 0.28), 0, 0, 0.46, size + 0.72, 0.45, frameMaterial);
        addBeam(group, size / 2 + 0.28, 0, 0, 0.46, size + 0.72, 0.45, frameMaterial);

        const opening = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            fog: false
        });

        const surface = addPlane(group, 0, 0, -0.18, size, size, 0, 0, 0, opening);

        portalState.position = new THREE.Vector3(0, 0, portalZ);
        portalState.mesh = group;
        portalState.surface = surface;

        scene.add(group);

        const url = findImageAsset(portalState.image);

        if (url) {
            loadImageTexture(
                'portal-image-' + portalState.id,
                url,
                texture => {
                    surface.material.map = texture;
                    surface.material.color.set(0xffffff);
                    surface.material.needsUpdate = true;
                },
                null,
                {
                    targetWidth: size,
                    targetHeight: size
                }
            );
        }
    }

    function createPortalTransitionUI() {
        const existing = root.querySelector('.bcm-mini-sim-transition');

        if (existing) {
            return {
                wrapper: existing,
                video: existing.querySelector('.bcm-mini-sim-transition-video'),
                label: existing.querySelector('.bcm-mini-sim-transition-label')
            };
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'bcm-mini-sim-transition';
        wrapper.hidden = true;

        const video = document.createElement('video');
        video.className = 'bcm-mini-sim-transition-video';
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'auto';
        video.controls = false;
        video.setAttribute('disablepictureinpicture', '');
        video.setAttribute('controlslist', 'nodownload noplaybackrate');

        const label = document.createElement('div');
        label.className = 'bcm-mini-sim-transition-label';

        wrapper.appendChild(video);
        wrapper.appendChild(label);
        root.appendChild(wrapper);

        return { wrapper, video, label };
    }

    let transitionUI = null;
    let transitionBusy = false;

    function getCurrentRoomIndex() {
        const z = ship.position.z;

        for (let i = 0; i < rooms.length; i++) {
            if (z <= rooms[i].maxZ && z >= rooms[i].minZ) {
                return i;
            }
        }

        return room.current;
    }

    function polygonArea(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            area += (a.x * b.y) - (b.x * a.y);
        }
        return Math.abs(area) * 0.5;
    }

    function clipPolygonAgainstEdge(points, edge) {
        if (!points.length) return [];

        const output = [];

        const inside = point => {
            if (edge === 'left') return point.x >= -1;
            if (edge === 'right') return point.x <= 1;
            if (edge === 'top') return point.y <= 1;
            return point.y >= -1;
        };

        const intersect = (a, b) => {
            if (edge === 'left' || edge === 'right') {
                const x = edge === 'left' ? -1 : 1;
                const dx = b.x - a.x;
                const t = Math.abs(dx) > 0.000001 ? (x - a.x) / dx : 0;
                return { x, y: a.y + (b.y - a.y) * t };
            }

            const y = edge === 'top' ? 1 : -1;
            const dy = b.y - a.y;
            const t = Math.abs(dy) > 0.000001 ? (y - a.y) / dy : 0;
            return { x: a.x + (b.x - a.x) * t, y };
        };

        let previous = points[points.length - 1];
        let previousInside = inside(previous);

        points.forEach(current => {
            const currentInside = inside(current);

            if (currentInside !== previousInside) {
                output.push(intersect(previous, current));
            }

            if (currentInside) {
                output.push(current);
            }

            previous = current;
            previousInside = currentInside;
        });

        return output;
    }

    function getPortalScreenMetrics(portalState) {
        if (!portalState || !portalState.surface || !camera || !renderer || !portalState.position) {
            return null;
        }

        const half = portalState.size / 2;
        const corners = [
            new THREE.Vector3(-half, -half, 0),
            new THREE.Vector3(half, -half, 0),
            new THREE.Vector3(half, half, 0),
            new THREE.Vector3(-half, half, 0)
        ];

        portalState.surface.updateMatrixWorld(true);

        const points = corners.map(corner =>
            corner.clone()
                .applyMatrix4(portalState.surface.matrixWorld)
                .project(camera)
        );

        const fullArea = polygonArea(points);
        if (!Number.isFinite(fullArea) || fullArea <= 0.000001) {
            return null;
        }

        let clipped = points;
        ['left', 'right', 'top', 'bottom'].forEach(edge => {
            clipped = clipPolygonAgainstEdge(clipped, edge);
        });

        const visibleArea = polygonArea(clipped);
        const visibleRatio = Math.max(0, Math.min(1, visibleArea / fullArea));

        const toPortal = portalState.position.clone().sub(ship.position);
        const distance = toPortal.length();

        if (distance <= 0.000001) {
            return { distance: 0, facing: 1, visibleRatio };
        }

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const facing = forward.dot(toPortal.normalize());

        return { distance, facing, visibleRatio };
    }

    function getNearestPortalForManualActivation() {
        const currentRoom = getCurrentRoomIndex();
        let best = null;
        let bestDistance = Infinity;

        portals.forEach(portalState => {
            if (portalState.roomIndex !== currentRoom) return;

            const distance = ship.position.distanceTo(portalState.position);

            if (distance < bestDistance) {
                bestDistance = distance;
                best = portalState;
            }
        });

        return best;
    }

    function getAutoPortalCandidate() {
        const currentRoom = getCurrentRoomIndex();
        const portalState = portals.find(
            candidate => candidate.roomIndex === currentRoom
        );

        if (!portalState) return null;

        const metrics = getPortalScreenMetrics(portalState);

        if (!metrics) return null;

        if (
            metrics.distance <= 9.5 &&
            metrics.facing >= 0.38 &&
            metrics.visibleRatio >= 0.69
        ) {
            return { portal: portalState, metrics };
        }

        return null;
    }

    function startPortalTransition(portalState = null, source = 'MANUAL') {
        if (!running || transitionBusy) return false;

        const targetPortal = portalState || getNearestPortalForManualActivation();

        if (!targetPortal) {
            status.textContent = 'PORTAL · NO ACTIVE GATE IN THIS ZONE';
            return false;
        }

        const distance = ship.position.distanceTo(targetPortal.position);

        if (source !== 'AUTO' && distance > 12) {
            status.textContent = 'PORTAL · APPROACH THE GATE';
            return false;
        }

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const toPortal = targetPortal.position.clone().sub(ship.position);
        const facing = toPortal.length()
            ? forward.dot(toPortal.normalize())
            : 1;

        if (source !== 'AUTO' && facing < 0.30) {
            status.textContent = 'PORTAL · FACE THE GATE';
            return false;
        }

        const asset = targetPortal.video
            ? assets.find(item => item && item.name === targetPortal.video)
            : null;
        const url = (asset && asset.streamUrl) || findAsset(targetPortal.video);

        if (!url) {
            status.textContent = 'PORTAL ' + targetPortal.id + ' · VIDEO ASSET MISSING';
            return false;
        }

        transitionUI = transitionUI || createPortalTransitionUI();
        transitionBusy = true;
        nearestPortal = targetPortal;
        root.classList.add('transition-active');

        transitionUI.wrapper.hidden = false;
        transitionUI.label.textContent =
            'ПЕРЕХОД · ' + targetPortal.point +
            ' · ' + (source === 'AUTO' ? '69% AUTO' : 'MANUAL');

        if (document.pointerLockElement === canvas && document.exitPointerLock) {
            document.exitPointerLock();
        }

        Object.keys(keys).forEach(key => {
            keys[key] = false;
        });

        Object.keys(touch).forEach(key => {
            touch[key] = false;
        });

        const video = transitionUI.video;

        video.pause();
        video.removeAttribute('src');
        while (video.firstChild) {
            video.removeChild(video.firstChild);
        }
        video.currentTime = 0;
        video.muted = source === 'AUTO';
        video.src = url;
        video.load();

        let playbackStarted = false;
        let finished = false;

        const cleanup = () => {
            video.removeEventListener('ended', onEnded);
            video.removeEventListener('error', onError);
            video.removeEventListener('stalled', onStalled);
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
        };

        const finish = success => {
            if (finished) return;
            finished = true;
            cleanup();

            video.pause();
            video.removeAttribute('src');
            video.load();
            transitionUI.wrapper.hidden = true;

            if (success) {
                ship.position.set(
                    targetPortal.targetPosition[0],
                    targetPortal.targetPosition[1],
                    targetPortal.targetPosition[2]
                );
                ship.velocity.set(0, 0, 0);
                ship.angularVelocity.set(0, 0, 0);
                ship.quaternion.identity();
                room.current = targetPortal.targetRoom;
                status.textContent =
                    rooms[room.current].id +
                    ' · ARRIVED VIA PORTAL ' + targetPortal.id;
                introHintUntil = performance.now() + 3500;
            } else {
                status.textContent =
                    'PORTAL ' + targetPortal.id +
                    ' · VIDEO FAILED';
            }

            root.classList.remove('transition-active');
            transitionBusy = false;
        };

        const onEnded = () => finish(true);
        const onError = () => finish(false);
        const onStalled = () => {
            status.textContent = 'PORTAL ' + targetPortal.id + ' · BUFFERING…';
        };

        const tryPlay = () => {
            if (finished || playbackStarted) return;

            playbackStarted = true;

            const promise = video.play();

            if (promise && typeof promise.then === 'function') {
                promise.then(() => {
                    status.textContent =
                        'PORTAL ' + targetPortal.id +
                        ' · VIDEO PLAYING · CONTROLS LOCKED';
                }).catch(() => {
                    playbackStarted = false;

                    if (!video.muted) {
                        video.muted = true;
                        tryPlay();
                    } else {
                        finish(false);
                        status.textContent =
                            'PORTAL ' + targetPortal.id +
                            ' · BROWSER CANNOT START VIDEO';
                    }
                });
            }
        };

        const onReady = () => tryPlay();

        video.addEventListener('ended', onEnded, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.addEventListener('stalled', onStalled);
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('canplay', onReady, { once: true });

        tryPlay();

        window.setTimeout(() => {
            if (!finished && !playbackStarted) {
                tryPlay();
            }
        }, 900);

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

    function getTiltMotion() {
        if (!tilt.enabled || !tilt.available) {
            return {
                thrust: 0,
                strafe: 0,
                yaw: 0
            };
        }

        const angle = getScreenAngle();
        let forwardDelta;
        let sideDelta;

        if (angle === 90) {
            forwardDelta = tilt.gamma - tilt.neutralGamma;
            sideDelta = -(tilt.beta - tilt.neutralBeta);
        } else if (angle === 270) {
            forwardDelta = -(tilt.gamma - tilt.neutralGamma);
            sideDelta = tilt.beta - tilt.neutralBeta;
        } else if (angle === 180) {
            forwardDelta = -(tilt.beta - tilt.neutralBeta);
            sideDelta = -(tilt.gamma - tilt.neutralGamma);
        } else {
            forwardDelta = tilt.beta - tilt.neutralBeta;
            sideDelta = tilt.gamma - tilt.neutralGamma;
        }

        const neutralAlphaDelta = normalizeAngleDegrees(
            tilt.alpha - tilt.neutralAlpha
        );

        return {
            thrust: applyDeadzone(forwardDelta / 24, 0.08),
            strafe: applyDeadzone(sideDelta / 22, 0.08),
            yaw: applyDeadzone(neutralAlphaDelta / 22, 0.06)
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
            [3, startPortalTransition]
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

        const motion = getTiltMotion();

        return {
            thrust: thrust - gamepad.leftY + motion.thrust,
            strafe: strafe + gamepad.leftX + motion.strafe,
            vertical: vertical + gamepad.vertical,
            roll: roll + gamepad.roll,
            yaw: yawButtons + motion.yaw + (gamepad.rightX * -1)
        };
    }

    function toggleShield() {
        shieldEnabled = !shieldEnabled;
        status.textContent = 'SHIELD · ' + (shieldEnabled ? 'ON' : 'OFF');
        return shieldEnabled;
    }

    function updateDoor(dt) {
        if (!testDoor.mesh || room.current !== 0) return;

        const toDoor = testDoor.mesh.position.clone().sub(ship.position);
        const distance = toDoor.length();

        const forward = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(ship.quaternion)
            .normalize();

        const facing = distance > 0
            ? forward.dot(toDoor.normalize())
            : -1;

        if (
            !transitionBusy &&
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

            applyDoorAnimation(testDoor.progress);

            if (testDoor.progress >= 1) {
                testDoor.state = 'OPEN';
                testDoor.awayTimer = 0;
            }
        } else if (testDoor.state === 'OPEN') {
            if (distance > 5) {
                testDoor.awayTimer += dt;

                if (testDoor.awayTimer >= testDoor.closeDelay) {
                    testDoor.state = 'CLOSED';
                    testDoor.progress = 0;
                    testDoor.awayTimer = 0;
                    resetDoorVisual();
                    status.textContent = 'DOOR · CLOSED · READY';
                }
            } else {
                testDoor.awayTimer = 0;
            }
        }
    }

    function beginDoorOpening(reason) {
        if (transitionBusy || testDoor.state !== 'CLOSED') return false;

        const modes = ['split', 'vertical', 'pocket', 'shrink'];
        testDoor.mode = modes[Math.floor(Math.random() * modes.length)];
        testDoor.speed = 1.15 + Math.random() * 1.35;
        testDoor.progress = 0;
        testDoor.awayTimer = 0;
        resetDoorVisual();

        testDoor.state = 'OPENING';

        const textureLabel = testDoor.textureName
            ? ' · ' + testDoor.textureName.toUpperCase()
            : '';

        status.textContent =
            (reason === 'REMOTE'
                ? 'DOOR CRYSTAL · REMOTE OPEN'
                : 'DOOR · AUTO OPEN') +
            ' · ' + testDoor.mode.toUpperCase() +
            textureLabel;

        return true;
    }

    function tryRemoteDoor() {
        if (
            !running ||
            transitionBusy ||
            !testDoor.mesh ||
            testDoor.state !== 'CLOSED' ||
            room.current !== 0
        ) {
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
        const activeRoom = rooms[room.current];

        if (!activeRoom) return;

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

        if (ship.position.z > activeRoom.maxZ - radius) {
            ship.position.z = activeRoom.maxZ - radius;
            if (ship.velocity.z > 0) ship.velocity.z *= -0.2;
        }

        if (ship.position.z < activeRoom.minZ + radius) {
            ship.position.z = activeRoom.minZ + radius;
            if (ship.velocity.z < 0) ship.velocity.z *= -0.2;
        }

        const inDoor =
            room.current === 0 &&
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

    function updatePortalActivation() {
        if (!running || transitionBusy) return false;

        const candidate = getAutoPortalCandidate();

        if (!candidate) return false;

        nearestPortal = candidate.portal;

        status.textContent =
            candidate.portal.point +
            ' · VIEW ' +
            Math.round(candidate.metrics.visibleRatio * 100) +
            '%';

        return startPortalTransition(candidate.portal, 'AUTO');
    }

    function updateInteraction() {
        if (!interaction) return;

        if (performance.now() < introHintUntil) {
            interaction.textContent =
                'ПОРТАЛ · ИЩИТЕ СВЕТЯЩИЙСЯ КВАДРАТ · 69% ВИДИМОСТИ = АВТОПЕРЕХОД · G / Y / PORTAL';
            return;
        }

        const activePortal = portals.find(
            candidate => candidate.roomIndex === getCurrentRoomIndex()
        );

        if (activePortal) {
            const metrics = getPortalScreenMetrics(activePortal);

            if (metrics && metrics.distance < 18 && metrics.facing > 0.20) {
                const percent = Math.round(metrics.visibleRatio * 100);
                interaction.textContent =
                    activePortal.point +
                    ' · VIEW ' + percent + '%' +
                    (percent >= 69 ? ' · AUTO NOW' : ' · NEED 69%') +
                    ' · G / Y / PORTAL';
                return;
            }
        }

        if (
            testDoor.mesh &&
            testDoor.state === 'CLOSED' &&
            room.current === 0
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
        startMusic();

        if (event.code === 'Space' || event.code === 'ControlLeft') {
            event.preventDefault();
        }

        if (event.code === 'KeyR') {
            event.preventDefault();
            tryRemoteDoor();
        }

        if (event.code === 'KeyF') {
            event.preventDefault();
            toggleShield();
        }

        if (event.code === 'KeyG') {
            event.preventDefault();
            startPortalTransition();
        }
    }

    function handleKeyUp(event) {
        keys[event.code] = false;
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
                startMusic();

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
                    if (!transitionBusy) startPortalTransition();
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

        startButton.addEventListener('click', async () => {
            startMusic();

            if (!renderer) return;

            running = true;
            root.classList.add('game-active');
            startButton.classList.add('hidden');

            if (
                screen.orientation &&
                screen.orientation.lock
            ) {
                screen.orientation.lock('landscape').catch(() => {});
            }

            introHintUntil = performance.now() + 8500;
            status.textContent = 'FLIGHT ACTIVE · FIND PORTAL 1 · AUTO AT 69%';

            canvas.focus();

            if (canvas.requestPointerLock && !('ontouchstart' in window)) {
                canvas.requestPointerLock();
            }
        });

        root.addEventListener('pointerdown', startMusic);
    }

    function updateMusicButton() {
        if (!musicButton || !musicAudio) return;

        musicButton.textContent = musicAudio.muted ? '🔇' : '♫';
        musicButton.title = musicAudio.muted
            ? 'Включить музыку'
            : 'Выключить музыку';
    }

    function startMusic() {
        if (!musicAudio || !config.musicUrl || musicAudio.muted) {
            return;
        }

        if (!musicAudio.src) {
            musicAudio.src = config.musicUrl;
        }

        musicAudio.loop = true;
        musicAudio.volume = 0.42;
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
        musicAudio.volume = 0.42;
        musicAudio.preload = 'auto';

        updateMusicButton();

        const promise = musicAudio.play();

        if (promise && typeof promise.catch === 'function') {
            promise.catch(() => {});
        }
    }

    function updatePhysics(dt) {
        if (transitionBusy) {
            camera.position.copy(ship.position);
            camera.quaternion.copy(ship.quaternion);
            light.position.copy(ship.position);
            return;
        }

        room.current = getCurrentRoomIndex();
        updateDoor(dt);

        const input = inputAxes();

        if (gamepad.pad) {
            ship.angularVelocity.x += gamepad.rightY * 2.0 * dt;
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

        room.current = getCurrentRoomIndex();

        if (updatePortalActivation()) {
            camera.position.copy(ship.position);
            camera.quaternion.copy(ship.quaternion);
            light.position.copy(ship.position);
            return;
        }

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
        const roomText = rooms[room.current]
            ? rooms[room.current].id
            : 'ROOM ?';

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
            room.current = 0;
            nearestPortal = null;
            shieldEnabled = true;
            introHintUntil = 0;
            transitionBusy = false;

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

            scene.add(new THREE.Points(
                stars,
                new THREE.PointsMaterial({
                    color: 0xffffff,
                    size: 0.7,
                    sizeAttenuation: true
                })
            ));

            buildWorld();
            buildSecondRoomArrivalMarker();
            createPortalTransitionUI();
            setupMedia();
            setupInput();
            resize();

            status.textContent = 'ENGINE READY · TEXTURE TEST · LOCAL r128';
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