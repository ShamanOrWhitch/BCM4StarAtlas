(() => {
    'use strict';

    const root = document.querySelector('.bcm-mini-sim');
    if (!root) return;

    const canvas = root.querySelector('.bcm-mini-sim-canvas');
    const startButton = root.querySelector('.bcm-mini-sim-start');
    const status = root.querySelector('.bcm-mini-sim-status');
    const assetStatus = root.querySelector('.bcm-mini-sim-asset-status');
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

    function findAsset(name) {
        if (assetByName[name]) return assetByName[name].url;

        const wanted = String(name).toLowerCase();
        const key = Object.keys(assetByName).find(path => path.toLowerCase() === wanted);
        return key ? assetByName[key].url : '';
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

        if (assetProgress.total === 0) {
            assetStatus.textContent =
                'LOCAL ASSETS: ' + assets.length +
                ' FILES · ' + manifestImages + ' IMG · ' + manifestVideos + ' VIDEO';
            return;
        }

        assetStatus.textContent =
            'LOCAL ASSETS: ' + assetProgress.done + '/' + assetProgress.total +
            ' · FILES ' + assets.length +
            (assetProgress.failed ? ' · FAILED ' + assetProgress.failed : '');
    }

    function makeTexture(name, onReady, onError) {
        const url = imageName(name);

        if (!url) {
            if (onError) onError();
            return null;
        }

        const existing = textureRecords[name];
        if (existing) {
            if (existing.texture) {
                if (onReady) onReady(existing.texture);
            } else if (onError && existing.failed) {
                onError();
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

        const loader = new THREE.TextureLoader();

        loader.load(
            url,
            loaded => {
                setTextureColor(loaded);
                record.texture = loaded;
                assetProgress.done++;
                updateAssetStatus();

                record.callbacks.forEach(callback => {
                    if (callback.onReady) callback.onReady(loaded);
                });
                record.callbacks.length = 0;
            },
            undefined,
            () => {
                record.failed = true;
                assetProgress.done++;
                assetProgress.failed++;
                updateAssetStatus();

                record.callbacks.forEach(callback => {
                    if (callback.onError) callback.onError();
                });
                record.callbacks.length = 0;
            }
        );

        return null;
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
            metalness: 0.16
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
        const chamberFloor = lazyTexturedMaterial('wall1.png', 0x39414b);
        const chamberCeiling = lazyTexturedMaterial('wall2.png', 0x4b535e);
        const chamberLeft = lazyTexturedMaterial('wall3.png', 0x343b45);
        const chamberRight = lazyTexturedMaterial('wall4.png', 0x2d343d);
        const chamberBack = lazyTexturedMaterial('wall5.png', 0x565e68);

        addBox(world, 0, -3.65, -25.5, 11.2, 0.6, 13.4, chamberFloor);
        addBox(world, 0, 3.65, -25.5, 11.2, 0.6, 13.4, chamberCeiling);
        addBox(world, -5.65, 0, -25.5, 0.6, 7.3, 13.4, chamberLeft);
        addBox(world, 5.65, 0, -25.5, 0.6, 7.3, 13.4, chamberRight);
        addBox(world, 0, 0, -32.2, 11.2, 7.3, 0.6, chamberBack);

        scene.add(world);
        buildBackgroundDisplay(world, wall5);
        buildPortalStations(world);
        buildAssetGallery(world);
    }

    function buildBackgroundDisplay(parent, material) {
        const url = findAsset('perference bg.png');
        if (!url) return;

        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x161b22,
            metalness: 0.55,
            roughness: 0.5
        });

        // Keep the background display on a side wall so it never covers
        // the rear portal station.
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 3.8, 5.9),
            frameMat
        );
        frame.position.set(-5.48, 1.1, -28.8);
        parent.add(frame);

        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(3.2, 5.3),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide
            })
        );
        screen.position.set(-5.31, 1.1, -28.8);
        screen.rotation.y = Math.PI / 2;
        parent.add(screen);

        screen.userData.lazyAsset = 'perference bg.png';
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

    function createPortalStation(options) {
        const group = new THREE.Group();
        group.position.copy(options.position);
        group.rotation.y = options.rotationY || 0;

        const frame = portalFrameMaterial();
        const width = 4.8;
        const height = 6.2;

        addBox(group, 0, height / 2 + 0.3, 0, width, 0.55, 0.38, frame);
        addBox(group, 0, -height / 2 - 0.3, 0, width, 0.55, 0.38, frame);
        addBox(group, -width / 2 - 0.3, 0, 0, 0.55, height, 0.38, frame);
        addBox(group, width / 2 + 0.3, 0, 0, 0.55, height, 0.38, frame);

        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });

        const surface = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            material
        );
        surface.position.z = -0.16;
        group.add(surface);

        const glow = new THREE.Mesh(
            new THREE.PlaneGeometry(width + 0.22, height + 0.22),
            new THREE.MeshBasicMaterial({
                color: 0x6ebcff,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide
            })
        );
        glow.position.z = -0.24;
        glow.rotation.y = Math.PI;
        group.add(glow);

        const station = {
            group,
            surface,
            glow,
            point: options.point,
            image: options.image,
            routes: options.routes || [],
            routeIndex: 0,
            target: options.target || null,
            video: null,
            videoTexture: null,
            playing: false
        };

        portalStations.push(station);

        surface.userData.lazyAsset = options.image;
        group.userData.portalStation = station;
        parentAdd(group);

        return station;
    }

    function parentAdd(group) {
        scene.add(group);
    }

    function buildPortalStations(parent) {
        // Routing is deliberately preserved:
        // point 1 -> 2 = portal2.mp4
        // point 2 -> 1 = portal1.mp4
        // point 2 -> 3 = portal3.mp4
        // point 3 is represented visually by portal3.png.
        createPortalStation({
            point: 'POINT 1',
            image: 'portal.png',
            routes: [{ label: '1 → 2', video: 'portal2.mp4' }],
            position: new THREE.Vector3(-4.65, 0, -23.7),
            rotationY: Math.PI / 2,
            target: { x: 4.0, y: 0, z: -23.7, yaw: -Math.PI / 2 }
        });

        createPortalStation({
            point: 'POINT 2 · RETURN',
            image: 'portal2.png',
            routes: [{ label: '2 → 1', video: 'portal1.mp4' }],
            position: new THREE.Vector3(4.65, 0, -23.7),
            rotationY: -Math.PI / 2,
            target: { x: -4.0, y: 0, z: -23.7, yaw: Math.PI / 2 }
        });

        createPortalStation({
            point: 'POINT 2 · OUTBOUND',
            image: 'portal2.png',
            routes: [{ label: '2 → 3', video: 'portal3.mp4' }],
            position: new THREE.Vector3(0, 0, -31.35),
            rotationY: 0,
            target: { x: 0, y: 0, z: -20.2, yaw: Math.PI }
        });

        createPortalStation({
            point: 'POINT 3',
            image: 'portal3.png',
            routes: [],
            position: new THREE.Vector3(0, 0, -20.2),
            rotationY: Math.PI,
            target: null
        });
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

        if (success && station && station.target) {
            ship.position.set(
                station.target.x,
                station.target.y,
                station.target.z
            );
            ship.velocity.set(0, 0, 0);
            ship.angularVelocity.set(0, 0, 0);
            ship.quaternion.setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                station.target.yaw || 0
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

    function tryPortalAction() {
        if (!running || portalTransitionBusy) return false;

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
            if (!distance || distance > 7.5) return;

            const facing = forward.dot(to.normalize());
            if (facing < 0.50) return;

            if (distance < bestDistance) {
                best = station;
                bestDistance = distance;
            }
        });

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
            const loader = new THREE.TextureLoader();
            assetProgress.total++;

            loader.load(
                url,
                texture => {
                    setTextureColor(texture);

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

                    assetProgress.done++;
                    updateAssetStatus();
                },
                undefined,
                () => {
                    assetProgress.done++;
                    assetProgress.failed++;
                    updateAssetStatus();
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

    function inputAxes() {
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

        return {
            thrust: thrust - reverse,
            strafe,
            vertical,
            roll
        };
    }

    function updatePhysics(dt) {
        updateDoor(dt);

        // The chamber holds the portal and background media. Do not decode
        // those large images until the pilot is actually approaching it.
        if (!chamberVisualsLoaded && ship.position.z < -14.5) {
            loadChamberVisuals();
        }

        const input = inputAxes();

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
    }

    function handleKeyUp(event) {
        keys[event.code] = false;
    }

    function setupInput() {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        window.addEventListener('resize', resize);

        canvas.addEventListener('click', () => {
            if (!running) return;
            if (canvas.requestPointerLock) {
                canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            pointerLocked = document.pointerLockElement === canvas;
        });

        document.addEventListener('mousemove', event => {
            if (!pointerLocked) return;

            const sensitivity = 0.0022;
            ship.angularVelocity.y -= event.movementX * sensitivity;
            ship.angularVelocity.x -= event.movementY * sensitivity;
        });

        root.querySelectorAll('.bcm-mini-sim-mobile button').forEach(button => {
            const control = button.dataset.control;

            const down = event => {
                event.preventDefault();

                if (control === 'shield') {
                    toggleShield();
                    return;
                }

                if (control === 'portal') {
                    tryPortalAction();
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

        startButton.addEventListener('click', () => {
            running = true;
            startButton.classList.add('hidden');
            status.textContent = 'FLIGHT ACTIVE · 6DOF READY';

            if (canvas.requestPointerLock) {
                canvas.requestPointerLock();
            }

            canvas.focus();
        });
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
