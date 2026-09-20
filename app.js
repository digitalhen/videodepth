import * as THREE from "three";
import { installPicker } from "./picker.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
const $ = (id) => document.getElementById(id),
  video = $("video"),
  stage = $("viewport");
const playbackBar = document.querySelector("footer");
new ResizeObserver(() => {
  document.documentElement.style.setProperty(
    "--playback-height",
    `${playbackBar.getBoundingClientRect().height}px`,
  );
}).observe(playbackBar);
async function init(config) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1, 0.01, 150);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 0.8;
  controls.autoRotate = $("spin").checked;
  controls.minDistance = 2;
  controls.maxDistance = 100000;
  const root = new THREE.Group();
  scene.add(root);
  const ratio = config.ratio;
  const height = 3.2 / Math.max(1, ratio),
    width = height * ratio;
  await new Promise((resolve, reject) => {
    if (video.readyState >= 2) return resolve();
    video.addEventListener("loadeddata", resolve, { once: true });
    video.addEventListener(
      "error",
      () => reject(Error("Could not load the local video.")),
      { once: true },
    );
  });
  const duration = video.duration,
    count = Math.ceil(duration);
  const [left, right, top, bottom, ...frames] = config.assets;
  const live = new THREE.VideoTexture(video);
  live.colorSpace = THREE.SRGBColorSpace;
  const material = (map) =>
    new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
  const sides = [left, right, top, bottom].map(material),
    frozen = frames.map(material),
    liveMat = material(live);
  // Quads use explicit world-space vertices: u/v represent image x/y or time.
  function quad(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(12), 3),
    );
    g.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(new Float32Array(8), 2),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }
  function set(q, vertices, uv) {
    q.geometry.attributes.position.array.set(vertices.flat());
    q.geometry.attributes.position.needsUpdate = true;
    q.geometry.attributes.uv.array.set(uv.flat());
    q.geometry.attributes.uv.needsUpdate = true;
  }
  const slabs = Array.from({ length: count }, (_, i) => {
    const g = new THREE.Group();
    root.add(g);
    const faces = [...sides, frozen[i], frozen[Math.min(i + 1, count - 1)]].map(
      quad,
    );
    faces.forEach((f) => g.add(f));
    return { g, faces };
  });
  const ghostTextures = [left, right, top, bottom, ...frames].map((source) => {
    const canvas = document.createElement("canvas");
    // Downsampling and blur turn hard image detail into a faint haze.
    const image = source.image;
    const scale = Math.min(1, 256 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.filter = "blur(2px) saturate(65%)";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
  const ghostMaterials = ghostTextures.map(
    (map) =>
      new THREE.MeshBasicMaterial({
        map,
        color: 0xd6e1d9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        forceSinglePass: true,
      }),
  );
  const ghosts = Array.from({ length: count }, (_, i) => {
    const g = new THREE.Group();
    root.add(g);
    const faces = [
      ...ghostMaterials.slice(0, 4),
      ghostMaterials[4 + i],
      ghostMaterials[4 + Math.min(i + 1, count - 1)],
    ].map(quad);
    faces.forEach((f) => g.add(f));
    return { g, faces };
  });
  const currentOutline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 2, -height / 2, 0),
      new THREE.Vector3(width / 2, -height / 2, 0),
      new THREE.Vector3(width / 2, height / 2, 0),
      new THREE.Vector3(-width / 2, height / 2, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0xbaf18d }),
  );
  root.add(currentOutline);
  const x = width / 2,
    y = height / 2,
    square = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
  function updateFaces(f, a, b, ta, tb) {
    set(
      f[0],
      [
        [-x, -y, a],
        [-x, -y, b],
        [-x, y, b],
        [-x, y, a],
      ],
      [
        [ta, 0],
        [tb, 0],
        [tb, 1],
        [ta, 1],
      ],
    );
    set(
      f[1],
      [
        [x, -y, a],
        [x, -y, b],
        [x, y, b],
        [x, y, a],
      ],
      [
        [ta, 0],
        [tb, 0],
        [tb, 1],
        [ta, 1],
      ],
    );
    set(
      f[2],
      [
        [-x, y, a],
        [x, y, a],
        [x, y, b],
        [-x, y, b],
      ],
      [
        [0, 1 - ta],
        [1, 1 - ta],
        [1, 1 - tb],
        [0, 1 - tb],
      ],
    );
    set(
      f[3],
      [
        [-x, -y, a],
        [x, -y, a],
        [x, -y, b],
        [-x, -y, b],
      ],
      [
        [0, 1 - ta],
        [1, 1 - ta],
        [1, 1 - tb],
        [0, 1 - tb],
      ],
    );
    set(
      f[4],
      [
        [-x, -y, a],
        [x, -y, a],
        [x, y, a],
        [-x, y, a],
      ],
      square,
    );
    set(
      f[5],
      [
        [-x, -y, b],
        [x, -y, b],
        [x, y, b],
        [-x, y, b],
      ],
      square,
    );
  }
  function update() {
    const t = Math.min(video.currentTime, duration),
      d = +$("depth").value,
      gap = +$("gap").value;
    const last = Math.min(count - 1, Math.max(0, Math.ceil(t) - 1));
    const total = Math.max(0.006, t * d) + last * gap;
    const showGhost = $("ghost").checked;
    const fullDepth = duration * d + (count - 1) * gap;
    // Keep the destination fixed while the solid front advances into it.
    root.position.z = -(showGhost ? fullDepth : total) / 2;
    ghosts.forEach(({ g, faces: f }, i) => {
      const start = Math.max(t, i),
        end = Math.min(duration, i + 1);
      g.visible = showGhost && end - start > 0.00001;
      if (!g.visible) return;
      const a = start * d + i * gap,
        b = end * d + i * gap;
      updateFaces(f, a, b, start / duration, end / duration);
      // No translucent plane across the live face, or accumulated internal fog.
      f[4].visible = gap > 0 && start === i && i > last;
      f[5].visible = gap > 0 || i === count - 1;
    });
    slabs.forEach(({ g, faces: f }, i) => {
      g.visible = i <= last;
      if (!g.visible) return;
      let elapsed = Math.max(0.0001, Math.min(1, t - i)),
        a = i * d + i * gap,
        b = a + elapsed * d,
        ta = i / duration,
        tb = Math.min(duration, i + elapsed) / duration;
      updateFaces(f, a, b, ta, tb);
      f[5].material = i === last ? liveMat : frozen[Math.min(i + 1, count - 1)];
      // Hide touching interior caps in solid mode to avoid coplanar flicker.
      f[4].visible = gap > 0 || i === 0;
      f[5].visible = gap > 0 || i === last;
    });
    currentOutline.position.z = total + 0.003;
    $("clock").textContent = t.toFixed(2);
    $("seek").value = t;
    $("time").textContent = `${t.toFixed(2)} / ${duration.toFixed(2)} s`;
    window.volumeState = {
      time: t,
      layers: last + 1,
      completed: Math.floor(t),
      depth: total,
      spacing: gap,
      playing: !video.paused,
      ghost: showGhost,
      fullDepth,
    };
  }
  function view(name) {
    const span = Math.max(
        4,
        duration * +$("depth").value + (count - 1) * +$("gap").value,
      ),
      dist = Math.max(8, span * 1.55);
    camera.far = Math.max(150, dist * 5);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    const pos = {
      perspective: [0.8, 0.45, 1],
      front: [0, 0, 1],
      back: [0, 0, -1],
      left: [-1, 0, 0],
      right: [1, 0, 0],
      top: [0, 1, 0.001],
      bottom: [0, -1, 0.001],
    }[name];
    camera.position
      .set(...pos)
      .normalize()
      .multiplyScalar(dist);
    controls.update();
  }
  $("seek").max = duration;
  $("play").disabled = false;
  $("restart").disabled = false;
  $("loading").hidden = true;
  async function play() {
    try {
      if (video.ended) video.currentTime = 0;
      await video.play();
    } catch (e) {
      $("loading").hidden = false;
      $("loading").textContent = "Press Play to start the video.";
    }
  }
  $("play").onclick = () => (video.paused ? play() : video.pause());
  video.onplay = () => {
    $("play").textContent = "Pause";
    $("loading").hidden = true;
  };
  video.onpause = () => {
    $("play").textContent = video.ended ? "Replay" : "Play";
  };
  video.onended = () => {
    if ($("loop").checked) {
      video.currentTime = 0;
      play();
    }
  };
  $("restart").onclick = () => {
    video.currentTime = 0;
    play();
  };
  $("seek").oninput = (e) => {
    video.currentTime = +e.target.value;
  };
  $("speed").onchange = (e) => (video.playbackRate = +e.target.value);
  $("spin").onchange = (e) => (controls.autoRotate = e.target.checked);
  $("sound").onchange = (e) => (video.muted = !e.target.checked);
  $("gap").oninput = () => {
    $("gapValue").value =
      +$("gap").value === 0 ? "Solid" : (+$("gap").value).toFixed(2);
    view("perspective");
  };
  $("depth").oninput = () => {
    $("depthValue").value = (+$("depth").value).toFixed(2);
  };
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => (b.onclick = () => view(b.dataset.view)));
  const keyHandler = (e) => {
    if (
      e.code === "Space" &&
      !["INPUT", "BUTTON", "SELECT"].includes(document.activeElement.tagName)
    ) {
      e.preventDefault();
      $("play").click();
    }
  };
  window.addEventListener("keydown", keyHandler);
  const observer = new ResizeObserver(() => {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  observer.observe(stage);
  view("perspective");
  let previous = performance.now();
  renderer.setAnimationLoop((now) => {
    update();
    controls.update(Math.min(0.1, (now - previous) / 1000));
    previous = now;
    renderer.render(scene, camera);
  });
  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener("keydown", keyHandler);
    controls.dispose();
    root.traverse((o) => o.geometry?.dispose());
    [
      ...sides,
      ...frozen,
      ...ghostMaterials,
      liveMat,
      currentOutline.material,
    ].forEach((m) => m.dispose());
    [left, right, top, bottom, ...frames, live, ...ghostTextures].forEach((t) =>
      t.dispose(),
    );
    renderer.dispose();
    renderer.domElement.remove();
  };
}
let cleanup, currentUrl;
installPicker(async (config) => {
  cleanup?.();
  cleanup = null;
  video.pause();
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = config.url;
  $("play").disabled = true;
  $("restart").disabled = true;
  $("seek").disabled = true;
  $("loading").hidden = false;
  $("loading").textContent = "Opening video…";
  video.hidden = false;
  video.src = config.url;
  video.load();
  $("gap").value = 0;
  $("gapValue").value = "Solid";
  $("loop").checked = false;
  $("depth").min = Math.min(0.08, 3.2 / config.duration);
  $("depth").step = 0.001;
  $("depth").value = Math.min(0.3, 3.2 / config.duration);
  $("depthValue").value = (+$("depth").value).toFixed(3);
  $("sourceName").textContent = config.name;
  $("sourceMeta").textContent =
    `${config.duration.toFixed(1)} seconds · one layer per second`;
  try {
    cleanup = await init(config);
    $("play").textContent = "Play";
    $("seek").disabled = false;
    video.playbackRate = +$("speed").value;
  } catch (e) {
    $("loading").hidden = false;
    $("loading").textContent = "Unable to render this video: " + e.message;
    throw e;
  }
});
