import * as THREE from "three";
import pack from "./systems.json";

const RADIUS = 1.6;
const DEG = Math.PI / 180;

function latLng(lat, lng, radius, target) {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return target.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function boot() {
  const root = document.querySelector("[data-galia-globe]");
  const canvas = root && root.querySelector("canvas");
  if (!root || !canvas) return;

  const systems = pack.systems;
  const base = root.dataset.base || "";
  let current = 0;
  let selected = 0;
  const loader = new THREE.TextureLoader();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(0, 0.4, 4.4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
  sun.position.set(4, 2, 3);
  scene.add(sun);

  const group = new THREE.Group();
  scene.add(group);
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 48, 48),
    new THREE.MeshStandardMaterial({ color: 0x223044, roughness: 1 }),
  );
  group.add(body);
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS * 1.08, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x88aaff, transparent: true, opacity: 0.18, side: THREE.BackSide }),
  );
  group.add(air);

  const markerGroup = new THREE.Group();
  group.add(markerGroup);
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let spin = 0.0015;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function paint() {
    const system = systems[current];
    const tone = pack.tones[system.faction] || "#c4a35a";
    root.querySelector("[data-galia-title]").textContent = system.name;
    root.querySelector("[data-galia-lore]").textContent = system.lore;
    air.material.color.set(system.atmosphere || tone);
    const list = root.querySelector("[data-galia-markers]");
    list.innerHTML = "";
    markerGroup.clear();
    system.markers.forEach((marker, index) => {
      const pos = marker.orbit ? tmp.set(marker.orbit[0], marker.orbit[1], marker.orbit[2]) : latLng(marker.lat, marker.lng, RADIUS + 0.08, tmp);
      const ship = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.16, 5),
        new THREE.MeshStandardMaterial({ color: tone, emissive: tone, emissiveIntensity: index === selected ? 0.8 : 0.2 }),
      );
      ship.position.copy(pos);
      ship.lookAt(0, 0, 0);
      ship.rotateX(Math.PI / 2);
      ship.userData.index = index;
      markerGroup.add(ship);
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = marker.name;
      if (index === selected) item.className = "is-on";
      item.addEventListener("click", () => {
        selected = index;
        paint();
      });
      list.appendChild(item);
    });
    const card = system.markers[selected];
    root.querySelector("[data-galia-blurb]").textContent = card ? card.name + " — " + card.blurb : "";
    loader.load(base + "textures/" + system.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      body.material.map = tex;
      body.material.color.set(0xffffff);
      body.material.needsUpdate = true;
    });
  }

  const bar = root.querySelector("[data-galia-factions]");
  systems.forEach((system, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = system.faction;
    button.addEventListener("click", () => {
      current = index;
      selected = 0;
      paint();
    });
    bar.appendChild(button);
  });

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    spin = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(markerGroup.children, false)[0];
    if (hit) {
      selected = hit.object.userData.index;
      paint();
    }
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
  });
  window.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    group.rotation.y += (event.clientX - lastX) * 0.005;
    group.rotation.x = Math.max(-0.8, Math.min(0.8, group.rotation.x + (event.clientY - lastY) * 0.005));
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener("resize", resize);

  function frame() {
    if (!dragging) group.rotation.y += spin;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  resize();
  paint();
  frame();
}

boot();
