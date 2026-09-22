(() => {
    'use strict';

    const root = document.querySelector('.bcm-mini-sim');
    if (!root || !window.THREE) return;

    const canvas = root.querySelector('.bcm-mini-sim-canvas');
    const startButton = root.querySelector('.bcm-mini-sim-start');
    const status = root.querySelector('.bcm-mini-sim-status');

    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020308);
    scene.fog = new THREE.Fog(0x020308, 45, 180);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 250);
    camera.position.set(0, 0, 0);

    const ambient = new THREE.HemisphereLight(0x9bb7ff, 0x16120f, 1.3);
    scene.add(ambient);

    const light = new THREE.PointLight(0xffffff, 12, 45);
    light.position.set(0, 0, 0);
    scene.add(light);

    // ---- Ship state: deliberately simple, but true 6DOF/inertial ----
    const ship = {
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0, -5),
        localAcceleration: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        mass: 1,
        thrust: 14,
        strafeThrust: 9,
        verticalThrust: 9,
        linearDrag: 0.08,
        angularDrag: 0.55,
        maxSpeed: 38
    };

    const keys = Object.create(null);
    const touch = Object.create(null);
    let running = false;

    // ---- Pilot systems: one-player control first ----
    const shipSystems = {
        shieldOn: true,
        shieldToggleKey: 'KeyF',
        blasterCharge: 1,
        blasterMax: 1,
        blasterChargeRate: 0.22,
        shotCost: 0.25,
        shotCooldown: 0.16,
        nextShotAt: 0,
        hearts: 4,
        halfHeart: false
    };

    const testDoor = {
        state: 'CLOSED',
        openDistance: 8,
        progress: 0,
        speed: 1.8,
        mesh: null,
        texture: null
    };
    let pointerLocked = false;
    let last = performance.now();

    function makeShip() {
        const group = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.ConeGeometry(0.55, 2.1, 6),
            new THREE.MeshStandardMaterial({
                color: 0x9aa4b5,
                metalness: 0.75,
                roughness: 0.4
            })
        );
        body.rotation.x = -Math.PI / 2;
        group.add(body);

        const cockpit = new THREE.Mesh(
            new THREE.SphereGeometry(0.34, 8, 6),
            new THREE.MeshStandardMaterial({
                color: 0x4b86b5,
                metalness: 0.2,
                roughness: 0.25,
                emissive: 0x081522
            })
        );
        cockpit.position.z = -0.25;
        group.add(cockpit);

        return group;
    }

    const shipMesh = makeShip();
    scene.add(shipMesh);

    function wallMaterial(texture) {
        return new THREE.MeshStandardMaterial({
            map: texture,
            color: 0xffffff,
            roughness: 0.92,
            metalness: 0.18
        });
    }

    // ---- Procedural 6DOF room prototype ----
    // The room is assembled from reusable sectors. One central portal opens
    // exactly one sector at a time. The active opening changes after a random
    // interval, so the player never knows which section will be available next.
    const labyrinthState = {
        activeSector: 0,
        nextSwitchAt: 0,
        minSwitchMs: 3200,
        maxSwitchMs: 7800,
        sectors: 6,
        seed: Math.floor(Math.random() * 0x7fffffff)
    };

    function seededRandom(seed) {
        let x = seed >>> 0;
        return function () {
            x += 0x6D2B79F5;
            let t = x;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function buildLabyrinth() {
        const group = new THREE.Group();
        const loader = new THREE.TextureLoader();
        const random = seededRandom(labyrinthState.seed);

        const urls = (window.BCMMiniSimConfig && window.BCMMiniSimConfig.remoteTextures) || [];
        const textures = urls.map((url) => {
            const t = loader.load(url);
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(1, 1);
            return t;
        });

        const materials = textures.length
            ? textures.map(wallMaterial)
            : [
                new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.9 }),
                new THREE.MeshStandardMaterial({ color: 0x4b525d, roughness: 0.85 }),
                new THREE.MeshStandardMaterial({ color: 0x303741, roughness: 0.92 })
            ];

        const wallHeight = 7;
        const wallThickness = 0.7;
        const radius = 15;
        const sectionLength = 13;
        const sectionWidth = 9;

        function addBox(x, y, z, sx, sy, sz, materialIndex, parent = group) {
            const geo = new THREE.BoxGeometry(sx, sy, sz);
            const mesh = new THREE.Mesh(geo, materials[materialIndex % materials.length]);
            mesh.position.set(x, y, z);
            parent.add(mesh);
            return mesh;
        }

        // Central room: a six-sided hub with a circular portal in the middle.
        addBox(0, -wallHeight / 2, 0, 34, wallThickness, 34, 0);
        addBox(0, wallHeight / 2, 0, 34, wallThickness, 34, 1);

        const hubRadius = 7.5;
        const hubRing = new THREE.Mesh(
            new THREE.TorusGeometry(hubRadius, 0.32, 8, 32),
            new THREE.MeshStandardMaterial({
                color: 0x68727d,
                metalness: 0.75,
                roughness: 0.32
            })
        );
        hubRing.rotation.x = Math.PI / 2;
        hubRing.position.y = -3.15;
        group.add(hubRing);

        // Six sectors around the hub. Their geometry is static; only the
        // portal connection changes. This is the first step toward a larger
        // room/module generator.
        const sectorGroups = [];

        for (let i = 0; i < labyrinthState.sectors; i++) {
            const angle = (Math.PI * 2 * i) / labyrinthState.sectors;
            const sector = new THREE.Group();
            sector.userData.angle = angle;
            sector.userData.index = i;

            const dirX = Math.cos(angle);
            const dirZ = Math.sin(angle);
            const sideX = -dirZ;
            const sideZ = dirX;

            const centerDist = radius + sectionLength * 0.5;
            const cx = dirX * centerDist;
            const cz = dirZ * centerDist;

            // Floor/ceiling of the sector.
            addBox(cx, -wallHeight / 2, cz, sectionLength, wallThickness, sectionWidth, 2, sector);
            addBox(cx, wallHeight / 2, cz, sectionLength, wallThickness, sectionWidth, 1, sector);

            // Side walls.
            addBox(
                cx + sideX * (sectionWidth / 2),
                0,
                cz + sideZ * (sectionWidth / 2),
                sectionLength,
                wallHeight,
                wallThickness,
                i % 3,
                sector
            );
            addBox(
                cx - sideX * (sectionWidth / 2),
                0,
                cz - sideZ * (sectionWidth / 2),
                sectionLength,
                wallHeight,
                wallThickness,
                (i + 1) % 3,
                sector
            );

            // Random internal obstacle: cheap geometry, but each generated
            // section is slightly different.
            if (random() > 0.35) {
                const obstacle = addBox(
                    cx - dirX * 1.5 + sideX * ((random() - 0.5) * 3),
                    -1.4,
                    cz - dirZ * 1.5 + sideZ * ((random() - 0.5) * 3),
                    2.2,
                    2.8 + random() * 1.8,
                    2.2,
                    i + 2,
                    sector
                );
                obstacle.userData.generatedObstacle = true;
            }

            // Back wall closes the far end of the sector.
            const backX = cx + dirX * (sectionLength / 2);
            const backZ = cz + dirZ * (sectionLength / 2);
            addBox(
                backX,
                0,
                backZ,
                wallThickness,
                wallHeight,
                sectionWidth,
                (i + 2) % 3,
                sector
            );

            group.add(sector);
            sectorGroups.push(sector);
        }

        // Portal mechanism. It is a visual/logic gate, not a heavy video
        // surface. Only one aperture is active at any moment.
        const portal = new THREE.Group();
        portal.position.set(0, 0, 0);
        group.add(portal);

        const portalCore = new THREE.Mesh(
            new THREE.CylinderGeometry(2.8, 2.8, 0.45, 24),
            new THREE.MeshStandardMaterial({
                color: 0x10151b,
                emissive: 0x06121c,
                emissiveIntensity: 0.8,
                metalness: 0.45,
                roughness: 0.25
            })
        );
        portalCore.rotation.x = Math.PI / 2;
        portalCore.position.y = -2.75;
        portal.add(portalCore);

        const apertureRing = new THREE.Mesh(
            new THREE.TorusGeometry(3.1, 0.42, 8, 32),
            new THREE.MeshStandardMaterial({
                color: 0x8997a5,
                emissive: 0x17232e,
                emissiveIntensity: 1.0,
                metalness: 0.8,
                roughness: 0.24
            })
        );
        apertureRing.rotation.x = Math.PI / 2;
        apertureRing.position.y = -2.5;
        portal.add(apertureRing);

        const aperture = new THREE.Mesh(
            new THREE.CircleGeometry(2.65, 24),
            new THREE.MeshBasicMaterial({
                color: 0x0a1620,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            })
        );
        aperture.rotation.x = Math.PI / 2;
        aperture.position.y = -2.47;
        portal.add(aperture);

        const connector = new THREE.Mesh(
            new THREE.CylinderGeometry(2.15, 2.15, 1.0, 20, 1, true),
            new THREE.MeshStandardMaterial({
                color: 0x5c6977,
                emissive: 0x101b24,
                emissiveIntensity: 0.8,
                metalness: 0.65,
                roughness: 0.35,
                side: THREE.DoubleSide
            })
        );
        connector.rotation.x = Math.PI / 2;
        connector.position.y = -2.48;
        portal.add(connector);

        const portalLight = new THREE.PointLight(0x7ec8ff, 5, 22);
        portalLight.position.set(0, -1.2, 0);
        portal.add(portalLight);

        const switchPortal = (index, now) => {
            labyrinthState.activeSector = index;
            labyrinthState.nextSwitchAt = now + labyrinthState.minSwitchMs +
                Math.random() * (labyrinthState.maxSwitchMs - labyrinthState.minSwitchMs);

            const angle = (Math.PI * 2 * index) / labyrinthState.sectors;

            // Rotate the central portal toward the selected hole.
            portal.rotation.y = angle;

            sectorGroups.forEach((sector, sectorIndex) => {
                const active = sectorIndex === index;
                sector.userData.portalOpen = active;

                // Slightly brighten the currently connected sector.
                sector.traverse((object) => {
                    if (!object.isMesh || !object.material || Array.isArray(object.material)) return;
                    if (!object.userData.baseOpacity) {
                        object.userData.baseOpacity = object.material.opacity;
                    }
                    object.material.emissiveIntensity = active ? 0.16 : 0.02;
                });
            });

            status.textContent =
                'SECTOR ' + (index + 1) + '/' + labyrinthState.sectors +
                '  |  PORTAL ROTATING  |  NEXT CONNECTION RANDOM';
        };

        group.userData.portal = portal;
        group.userData.switchPortal = switchPortal;
        group.userData.sectors = sectorGroups;

        scene.add(group);

        // First connection is deterministic for reproducibility; subsequent
        // changes are random in time and never reuse the same sector twice
        // in a row.
        switchPortal(Math.floor(random() * labyrinthState.sectors), performance.now());
        window.BCMMiniSimLabyrinth = labyrinthState;
        window.BCMMiniSimLabyrinth.group = group;
    }

    buildLabyrinth();

    function buildTestDoor() {
        const loader = new THREE.TextureLoader();
        const url = (window.BCMMiniSimConfig && window.BCMMiniSimConfig.doorTexture) || '';
        const group = new THREE.Group();
        group.position.set(0, 0, -18);

        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(7.2, 7.2, 0.55),
            new THREE.MeshStandardMaterial({
                color: 0x222831,
                metalness: 0.7,
                roughness: 0.45
            })
        );
        group.add(frame);

        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            side: THREE.DoubleSide
        });

        const door = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), material);
        door.position.z = -0.31;
        group.add(door);

        if (url) {
            testDoor.texture = loader.load(url);
            material.map = testDoor.texture;
            material.needsUpdate = true;
        }

        scene.add(group);
        testDoor.mesh = group;
        testDoor.doorPanel = door;
        testDoor.frame = frame;
    }

    buildTestDoor();

    function updateTestDoor(dt) {
        if (!testDoor.mesh) return;

        const toDoor = testDoor.mesh.position.clone().sub(ship.position);
        const distance = toDoor.length();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion).normalize();
        const facing = distance > 0 ? forward.dot(toDoor.normalize()) : -1;

        if (
            distance < testDoor.openDistance &&
            facing > 0.72 &&
            testDoor.state === 'CLOSED'
        ) {
            testDoor.state = 'OPENING';
        }

        if (testDoor.state === 'OPENING') {
            testDoor.progress = Math.min(1, testDoor.progress + dt * testDoor.speed);
            // Simple two-leaf opening: the test image splits sideways.
            testDoor.doorPanel.scale.x = Math.max(0.02, 1 - testDoor.progress);
            if (testDoor.progress >= 1) testDoor.state = 'OPEN';
        }
    }

    function createShot() {
        const now = performance.now() / 1000;
        if (shipSystems.shieldOn || now < shipSystems.nextShotAt) return false;
        if (shipSystems.blasterCharge + 0.0001 < shipSystems.shotCost) return false;

        shipSystems.blasterCharge = Math.max(0, shipSystems.blasterCharge - shipSystems.shotCost);
        shipSystems.nextShotAt = now + shipSystems.shotCooldown;

        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion).normalize();
        const start = ship.position.clone().addScaledVector(direction, 1.5);
        const end = start.clone().addScaledVector(direction, 55);

        const beam = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([start, end]),
            new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true })
        );
        scene.add(beam);

        window.setTimeout(() => {
            scene.remove(beam);
            beam.geometry.dispose();
            beam.material.dispose();
        }, 70);

        return true;
    }

    function toggleShield() {
        shipSystems.shieldOn = !shipSystems.shieldOn;
    }

    // Tiny star field; cheap enough for mobile.
    const stars = new THREE.BufferGeometry();
    const points = [];
    for (let i = 0; i < 450; i++) {
        points.push(
            (Math.random()-0.5)*500,
            (Math.random()-0.5)*500,
            (Math.random()-0.5)*500
        );
    }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({
        color:0xffffff,
        size:0.8,
        sizeAttenuation:true
    })));

    function axisInput() {
        const thrust = keys.KeyW || touch.thrust ? 1 : 0;
        const reverse = keys.KeyS || touch.brake ? 1 : 0;
        const strafe = (keys.KeyD || touch.right ? 1 : 0) - (keys.KeyA || touch.left ? 1 : 0);
        const vertical = (keys.Space || touch.up ? 1 : 0) - (keys.ControlLeft || touch.down ? 1 : 0);
        const roll = (keys.KeyE || touch.rollRight ? 1 : 0) - (keys.KeyQ || touch.rollLeft ? 1 : 0);

        return { thrust: thrust - reverse, strafe, vertical, roll };
    }

    function updatePortal(dtNow) {
        const labyrinth = window.BCMMiniSimLabyrinth;
        const group = labyrinth && labyrinth.group;
        if (!labyrinth || !group || !group.userData.switchPortal) return;

        if (dtNow >= labyrinth.nextSwitchAt) {
            let next = Math.floor(Math.random() * labyrinth.sectors);
            if (labyrinth.sectors > 1 && next === labyrinth.activeSector) {
                next = (next + 1 + Math.floor(Math.random() * (labyrinth.sectors - 1))) % labyrinth.sectors;
            }

            group.userData.switchPortal(next, dtNow);
        }
    }

    function updatePhysics(dt) {
        updatePortal(performance.now());
        updateTestDoor(dt);

        const input = axisInput();

        if (keys[shipSystems.shieldToggleKey]) {
            toggleShield();
            keys[shipSystems.shieldToggleKey] = false;
        }

        if (!shipSystems.shieldOn) {
            shipSystems.blasterCharge = Math.min(
                shipSystems.blasterMax,
                shipSystems.blasterCharge + shipSystems.blasterChargeRate * dt
            );
        }


        const accel = new THREE.Vector3(
            input.strafe * ship.strafeThrust,
            input.vertical * ship.verticalThrust,
            -input.thrust * ship.thrust
        );

        accel.applyQuaternion(ship.quaternion);
        ship.velocity.addScaledVector(accel, dt);

        // Gentle drag: release the engine and the ship keeps drifting.
        ship.velocity.multiplyScalar(Math.max(0, 1 - ship.linearDrag * dt));

        if (ship.velocity.length() > ship.maxSpeed) {
            ship.velocity.setLength(ship.maxSpeed);
        }

        ship.position.addScaledVector(ship.velocity, dt);

        // Angular inertia.
        const angularInput = new THREE.Vector3(
            0, 0, input.roll * 1.8
        );
        ship.angularVelocity.addScaledVector(angularInput, dt);
        ship.angularVelocity.multiplyScalar(Math.max(0, 1 - ship.angularDrag * dt));

        const angle = ship.angularVelocity.length() * dt;
        if (angle > 0.00001) {
            const dq = new THREE.Quaternion().setFromAxisAngle(
                ship.angularVelocity.clone().normalize(), angle
            );
            ship.quaternion.multiply(dq).normalize();
        }

        // Mouse-look changes angular velocity rather than teleporting rotation.
        if (pointerLocked) {
            ship.angularVelocity.x *= 0.98;
            ship.angularVelocity.y *= 0.98;
        }

        // Basic bounds for the first prototype.
        const limit = 47;
        ['x','y','z'].forEach(axis => {
            if (ship.position[axis] > limit) {
                ship.position[axis] = limit;
                ship.velocity[axis] *= -0.35;
            } else if (ship.position[axis] < -limit) {
                ship.position[axis] = -limit;
                ship.velocity[axis] *= -0.35;
            }
        });

        shipMesh.position.copy(ship.position);
        shipMesh.quaternion.copy(ship.quaternion);

        // Camera is the pilot's head: no forced horizon.
        camera.position.copy(ship.position);
        camera.quaternion.copy(ship.quaternion);

        light.position.copy(ship.position);

        const charge = Math.round(shipSystems.blasterCharge * 100);
        const shield = shipSystems.shieldOn ? 'ON' : 'OFF';
        const door = testDoor.state;

        status.textContent =
            'SPD ' + ship.velocity.length().toFixed(1) +
            '  |  6DOF  |  PILOT' +
            '  |  SHIELD ' + shield +
            '  |  SYSTEM CHARGE ' + charge + '%' +
            '  |  ♥'.repeat(shipSystems.hearts) +
            (shipSystems.halfHeart ? '½' : '') +
            '  |  DOOR ' + door;
    }

    function resize() {
        const r = root.getBoundingClientRect();
        const w = Math.max(1, r.width);
        const h = Math.max(1, r.height);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (['Space','ControlLeft'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => keys[e.code] = false);


    canvas.addEventListener('click', () => {
        if (!running) return;
        if (canvas.requestPointerLock) canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        pointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', e => {
        if (!pointerLocked) return;
        const sensitivity = 0.0022;
        ship.angularVelocity.y -= e.movementX * sensitivity;
        ship.angularVelocity.x -= e.movementY * sensitivity;
    });

    root.querySelectorAll('.bcm-mini-sim-mobile button').forEach(btn => {
        const control = btn.dataset.control;
        const down = e => {
            e.preventDefault();
            touch[control] = true;
            if (control === 'shield') toggleShield();
            if (control === 'fire') createShot();
        };
        const up = e => {
            e.preventDefault();
            touch[control] = false;
        };
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
    });

    startButton.addEventListener('click', () => {
        running = true;
        startButton.classList.add('hidden');
        canvas.focus();
        status.textContent = 'FLIGHT ACTIVE';
    });

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.033);
        last = now;

        if (running) updatePhysics(dt);
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
})();
