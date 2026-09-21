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

    function buildLabyrinth() {
        const group = new THREE.Group();
        const loader = new THREE.TextureLoader();

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
            : [new THREE.MeshStandardMaterial({color:0x3a3f48,roughness:0.9})];

        const cell = 10;
        const half = 50;
        const wallThickness = 0.7;
        const wallHeight = 7;

        function wall(x, y, z, sx, sy, sz, materialIndex) {
            const geo = new THREE.BoxGeometry(sx, sy, sz);
            const mesh = new THREE.Mesh(geo, materials[materialIndex % materials.length]);
            mesh.position.set(x, y, z);
            group.add(mesh);
        }

        // Outer shell + deliberately irregular internal passages.
        wall(0, 0, -half, 2 * half, wallHeight, wallThickness, 0);
        wall(0, 0, half, 2 * half, wallHeight, wallThickness, 1);
        wall(-half, 0, 0, wallThickness, wallHeight, 2 * half, 2);
        wall(half, 0, 0, wallThickness, wallHeight, 2 * half, 3);

        const layout = [
            [-30,-35,1],[0,-35,0],[25,-35,2],
            [-30,-15,3],[-10,-15,1],[15,-15,4],
            [-30,5,2],[-5,5,0],[25,5,3],
            [-30,25,1],[0,25,4],[25,25,0]
        ];

        layout.forEach(([x,z,m]) => {
            wall(x, 0, z, 7, wallHeight, wallThickness, m);
        });

        // A few perpendicular walls make the route genuinely 3D.
        wall(-15, 3.5, -25, wallThickness, 7, 14, 2);
        wall(20, -3.5, -5, wallThickness, 7, 16, 3);
        wall(-20, 3.5, 18, 18, 7, wallThickness, 1);

        scene.add(group);
    }

    buildLabyrinth();

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

    function updatePhysics(dt) {
        const input = axisInput();

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

        status.textContent =
            'SPD ' + ship.velocity.length().toFixed(1) +
            '  |  6DOF  |  INERTIA';
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
